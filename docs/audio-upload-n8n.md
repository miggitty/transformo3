# PRD: n8n Audio Processing & Content Automation

This document outlines the technical requirements for integrating an n8n workflow to process uploaded audio files, generate content, and update the application database.

---

## **Goal**

To create a fully automated, asynchronous pipeline that begins after a user uploads an audio file. The system will send the audio metadata to an n8n workflow for processing. Upon completion, n8n will call a webhook in our application to update the corresponding content record with the generated transcript and title.

## **High-Level Asynchronous Workflow**

1.  **Client-side:** The user records and uploads an audio file to Supabase Storage using the existing `AudioRecorder` component.
2.  **Server Action (`finalizeContentRecord`):**
    *   The existing server action successfully saves the public `audio_url` to the `content` table.
    *   The status of the content is updated to `'processing'`.
    *   A new function, `triggerN8nWorkflow`, is called, passing the `content_id`, `business_id`, and `audio_url`.
3.  **Trigger n8n (`triggerN8nWorkflow`):**
    *   This new server-side function sends a `POST` request to the n8n webhook URL.
    *   The request body contains a JSON payload with `{ content_id, business_id, audio_url }`.
    *   The application **does not** wait for the n8n workflow to complete. It only confirms that the trigger request was successfully received by n8n.
4.  **n8n Workflow:**
    *   Receives the webhook trigger.
    *   Uses the `audio_url` to download the audio file directly from Supabase Storage.
    *   Performs all required processing (transcription, AI content generation, etc.).
    *   Constructs a final payload containing `{ content_id, transcript, content_title }`.
5.  **n8n Callback:**
    *   n8n sends a `POST` request to a dedicated callback webhook in our Next.js application (`/api/n8n/callback`).
    *   This request contains the final payload with the processed content.
6.  **Next.js API Route (`/api/n8n/callback`):**
    *   The webhook receives the data from n8n.
    *   It uses a Supabase client with service-level privileges to bypass RLS.
    *   It finds the correct record using `content_id` and updates it with the `transcript` and `content_title`.
    *   The content `status` is updated to `'completed'`.
    *   It sends a `204 No Content` response back to n8n to confirm receipt.

---

## **Technical Implementation Plan**

- [x] **1. Environment Variable Configuration**
    - [x] Add `N8N_WEBHOOK_URL` to `.env.local` and production environment variables. This will be the full URL for triggering the n8n workflow.
    - [x] Add `N8N_CALLBACK_SECRET` to environment variables. This will be a shared secret used to secure the callback webhook.
    - [x] Ensure `SUPABASE_SERVICE_ROLE_KEY` is available in the environment for the callback API route to bypass RLS.

- [x] **2. Database Migration**
    - [x] Create a new migration file in `supabase/migrations/` named `YYYYMMDDHHMMSS_add-transcript-to-content.sql`.
    - [x] Add a `transcript` column to the `content` table.
    - [x] Update the RLS policies if necessary to allow the service role to update this new column.

- [x] **3. Create n8n Trigger Utility**
    - [x] Create a new file at `lib/n8n.ts`.
    - [x] Implement the `triggerN8nWorkflow` function. This function will be called from the server action.

        ```typescript
        // lib/n8n.ts
        export async function triggerN8nWorkflow({
          audioUrl,
          contentId,
          businessId,
        }: {
          audioUrl: string;
          contentId: string;
          businessId: string;
        }) {
          const webhookUrl = process.env.N8N_WEBHOOK_URL;

          if (!webhookUrl) {
            console.error('N8N_WEBHOOK_URL is not defined.');
            throw new Error('n8n webhook URL is not configured.');
          }

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              audio_url: audioUrl,
              content_id: contentId,
              business_id: businessId,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to trigger n8n workflow. Status: ${response.status}`);
          }

          // We don't need to read the response body, just confirm it was accepted.
          console.log(`n8n workflow triggered for content ID: ${contentId}`);
          return { success: true };
        }
        ```

- [x] **4. Update Server Action to Trigger Workflow**
    - [x] Modify the `finalizeContentRecord` function in `app/dashboard/new/actions.ts`.
    - [x] Update the `status` to `'processing'`.
    - [x] Call `triggerN8nWorkflow` after successfully updating the record with the `audio_url`.

        ```typescript
        // app/dashboard/new/actions.ts
        // ... imports
        import { triggerN8nWorkflow } from '@/lib/n8n';

        // ... existing code

        export async function finalizeContentRecord(
          contentId: string,
          audioUrl: string,
        ) {
          const cookieStore = cookies();
          const supabase = await createClient();

          // First, update status to awaiting_processing and set the URL
          const { data: updatedContent, error } = await supabase
            .from('content')
            .update({
              audio_url: audioUrl,
              status: 'processing', // <-- Update status
            })
            .eq('id', contentId)
            .select('id, business_id, audio_url') // Select necessary fields for n8n
            .single();

          if (error || !updatedContent) {
            console.error('Error finalizing content record:', error);
            return { error: 'Could not update content record with audio URL.' };
          }

          // Trigger the n8n workflow (fire-and-forget)
          try {
            await triggerN8nWorkflow({
              audioUrl: updatedContent.audio_url!,
              contentId: updatedContent.id,
              businessId: updatedContent.business_id!,
            });
          } catch (n8nError) {
            console.error('Failed to trigger n8n workflow:', n8nError);
            // Optional: Update status to 'failed' here
            // For now, we just log the error and continue.
          }

          revalidatePath('/dashboard/content');
          return { data: updatedContent };
        }
        ```

- [x] **5. Create API Route for n8n Callback**
    - [x] Create a new API route at `app/api/n8n/callback/route.ts`.
    - [x] This route will handle the `POST` request from the n8n workflow to update the content record.

        ```typescript
        // app/api/n8n/callback/route.ts
        import { createClient } from '@supabase/supabase-js';
        import { type NextRequest, NextResponse } from 'next/server';

        // Initialize Supabase client with service role key
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false } }
        );

        export async function POST(req: NextRequest) {
          // 1. Secure the webhook
          const callbackSecret = process.env.N8N_CALLBACK_SECRET;
          const authHeader = req.headers.get('authorization');
          if (!callbackSecret || authHeader !== `Bearer ${callbackSecret}`) {
            return new NextResponse('Unauthorized', { status: 401 });
          }

          // 2. Parse the request body
          const { content_id, transcript, content_title } = await req.json();

          if (!content_id || !transcript || !content_title) {
            return new NextResponse('Missing required fields', { status: 400 });
          }

          // 3. Update the database
          const { error } = await supabase
            .from('content')
            .update({
              transcript: transcript,
              content_title: content_title,
              status: 'completed', // Final status
            })
            .eq('id', content_id);

          if (error) {
            console.error('Error updating content from n8n callback:', error);
            return new NextResponse(JSON.stringify({ error: error.message }), {
              status: 500,
            });
          }

          // 4. Respond to n8n
          return new NextResponse(null, { status: 204 }); // All good
        }
        ```

</rewritten_file> 