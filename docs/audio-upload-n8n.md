# PRD: n8n Audio Processing & Content Automation

This document outlines the technical requirements for integrating an n8n workflow to process uploaded audio files, generate content, and update the application database.

---

## **Goal**

To create a fully automated, asynchronous pipeline that begins after a user uploads an audio file. The system will send the audio file's public URL to an n8n workflow for processing. Upon completion, n8n will call a webhook in our application to update the corresponding content record with the generated transcript and title.

## **High-Level Asynchronous Workflow (Pull Model)**

1.  **Client-side:** The user records and uploads an audio file to Supabase Storage.
2.  **Server Action (`finalizeContentRecord`):**
    *   The server action saves the public `audio_url` to the `content` table.
    *   The status of the content is updated to `'processing'`.
    *   The `triggerN8nWorkflow` function is called, passing the `content_id`, `business_id`, and the public `audio_url`.
3.  **Trigger n8n (`triggerN8nWorkflow`):**
    *   This server-side function sends a `POST` request to the n8n webhook URL.
    *   The request body contains a JSON payload with `{ content_id, business_id, audio_url }`.
    *   The application does not wait for the n8n workflow to complete.
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
    *   It updates the correct record with the `transcript` and `content_title` and sets the `status` to `'completed'`.
    *   It sends a `204 No Content` response back to n8n to confirm receipt.

---

## **Technical Implementation Plan**

- [x] **1. Environment Variable Configuration**
- [x] **2. Database Migration**

- [ ] **3. Update n8n Trigger Utility**
    - [ ] Modify `lib/n8n.ts` to send a JSON payload with `audio_url`.

- [ ] **4. Update Server Action to Trigger Workflow**
    - [ ] Modify `finalizeContentRecord` in `app/dashboard/new/actions.ts`.
    - [ ] Remove the file-fetching logic and pass the `audio_url` directly.

- [x] **5. Create API Route for n8n Callback**

- [ ] **6. Update n8n Workflow Configuration**
    - [ ] The **Webhook** node should be configured to accept a standard JSON payload.
    - [ ] An **HTTP Request** node should be added after the webhook to download the file from the received `audio_url`.

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