# Master Implementation Guide: HeyGen AI Video Feature (Vault Architecture)

**Version:** 3.0
**Status:** Final Documentation

## 1. Overview & Goal

This document is the **single source of truth** for implementing the HeyGen AI Video Generation feature. It replaces all previous PRDs and implementation notes.

The goal is to provide a comprehensive, step-by-step guide for developers to build this feature from a clean database state. It synthesizes the original product requirements with all critical technical learnings from the initial implementation, resulting in a secure, robust, and maintainable integration using **Supabase Vault**.

---

## 2. Final Architecture

The architecture uses Supabase Vault to securely manage the HeyGen API key, decoupling it from the main `businesses` table.

-   **Data Model:**
    -   `businesses` table: Extended with `heygen_avatar_id`, `heygen_voice_id`, and `heygen_secret_id`. The `secret_id` is a UUID that references the actual encrypted key in the Vault.
    -   `content` table: Extended with `heygen_video_id` and `heygen_status` to track video generation jobs.

-   **Backend Logic:**
    -   **RPC Functions**: Two secure Postgres functions, `set_heygen_key` and `delete_heygen_key`, are created to manage the secret in the Vault. They run with elevated privileges (`SECURITY DEFINER`), so end-users never need direct access to the Vault.
    -   **Server Actions**: Next.js Server Actions are used to call these RPC functions from the frontend.

-   **Frontend UI:**
    -   The HeyGen settings form treats the API key as **write-only** for security. When a key is set, the UI displays a placeholder (`••••••••••••••••`) and a "Remove" button.

-   **n8n Workflow:**
    -   A decoupled n8n workflow handles the long-running video generation process. It is triggered by a webhook from the Next.js app, fetches the necessary credentials securely using an RPC call, and handles the entire lifecycle of video creation, polling, and storage.

---

## 3. Development Workflow & Environment

**CRITICAL NOTE:** This project connects directly to a **remote Supabase database** for all development and testing. There is no local database instance.

-   **Remote-Only Migrations**: All migration files must be placed in the `supabase/migrations` folder. Commands like `supabase db push` will apply changes **directly to the live, remote database**. Exercise extreme caution.
-   **Configuration**: Ensure your `.env.local` file is correctly configured with the credentials for the remote Supabase project.

---

## 4. Key Learnings & Troubleshooting Guide

This section documents the critical issues encountered during development and their solutions.

1.  **Problem: Failing Migrations due to Pre-existing Objects.**
    -   **Symptom:** `supabase db push` fails with errors like `policy "..." already exists` or `function "..." already exists`. This happened because our remote database contained objects that were not tracked in our local migration history, and the migration scripts were not designed to handle this.
    -   **Solution: Idempotent Migrations.** Every `CREATE` statement in a migration script must be preceded by a corresponding `DROP...IF EXISTS` statement. This ensures the script can run successfully on any environment, regardless of its current state.
        -   For policies: `DROP POLICY IF EXISTS "policy_name" ON table_name;`
        -   For functions: `DROP FUNCTION IF EXISTS function_name(arg_types);`
        -   For columns: `ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name...;`

2.  **Problem: `supabase gen types typescript` Fails.**
    -   **Symptom:** The command to generate TypeScript types fails with a `401 Unauthorized` error message: `Your account does not have the necessary privileges...`.
    -   **Solution: Manual Type Patching.** This is a platform-level permissions issue. The immediate workaround is to manually edit the `types/supabase.ts` file to add the new columns. This is not ideal but unblocks development. The long-term solution requires contacting Supabase support.

3.  **Problem: Inconsistent Migration History.**
    -   **Symptom:** Old or deleted migration files were still being tracked by the remote database, causing conflicts. The local `supabase/migrations` folder became out of sync with the server.
    -   **Solution: Consolidate and Repair.** The safest way to fix this is to treat the remote database as the source of truth. By moving local migrations, pulling a fresh schema with `supabase db pull`, and then creating one new, clean, consolidated migration file, we restore a healthy state.

---

## 4. Step-by-Step Implementation Guide

This guide assumes you are starting from a clean database state (e.g., after a `supabase db reset`).

### Step 1: Create the Consolidated Database Migration

This is the most critical step. We will create a single, idempotent migration file that sets up all required database objects. This single file replaces all previous attempts.

1.  **Create the migration file:**
    ```bash
    # Ensure you use a current timestamp
    timestamp=$(TZ=Australia/Brisbane date +"%Y%m%d%H%M%S")
    touch "supabase/migrations/${timestamp}_implement_heygen_vault_feature.sql"
    ```

2.  **Add the following SQL to the new file.**

    ```sql
    -- =================================================================
    --          HeyGen AI Video Feature Migration
    -- =================================================================
    -- This script sets up all database objects required for the
    -- HeyGen integration using Supabase Vault. It is idempotent
    -- and can be safely run on a clean or existing database.
    -- =================================================================

    -- Step 1: Add new columns to the 'businesses' table
    -- -----------------------------------------------------------------
    ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS heygen_avatar_id TEXT,
    ADD COLUMN IF NOT EXISTS heygen_voice_id TEXT,
    ADD COLUMN IF NOT EXISTS heygen_secret_id UUID REFERENCES vault.secrets(id);

    -- Step 2: Add new columns to the 'content' table
    -- -----------------------------------------------------------------
    ALTER TABLE public.content
    ADD COLUMN IF NOT EXISTS heygen_video_id TEXT,
    ADD COLUMN IF NOT EXISTS heygen_status TEXT;

    -- Step 3: Create the function to set/update the HeyGen API key
    -- -----------------------------------------------------------------
    DROP FUNCTION IF EXISTS public.set_heygen_key(uuid, text);
    CREATE OR REPLACE FUNCTION public.set_heygen_key(p_business_id uuid, p_new_key text)
    RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
    AS $$
    DECLARE
      v_secret_id UUID;
      v_secret_name TEXT;
    BEGIN
      SELECT heygen_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
      IF v_secret_id IS NULL THEN
        v_secret_name := 'heygen_api_key_for_business_' || p_business_id::text;
        v_secret_id := vault.create_secret(p_new_key, v_secret_name, 'HeyGen API key for business');
        UPDATE public.businesses SET heygen_secret_id = v_secret_id WHERE id = p_business_id;
      ELSE
        PERFORM vault.update_secret(v_secret_id, p_new_key);
      END IF;
    END;
    $$;
    GRANT EXECUTE ON FUNCTION public.set_heygen_key(uuid, text) TO authenticated;

    -- Step 4: Create the function to delete the HeyGen API key
    -- -----------------------------------------------------------------
    DROP FUNCTION IF EXISTS public.delete_heygen_key(uuid);
    CREATE OR REPLACE FUNCTION public.delete_heygen_key(p_business_id uuid)
    RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
    AS $$
    DECLARE
      v_secret_id UUID;
    BEGIN
      SELECT heygen_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
      IF v_secret_id IS NOT NULL THEN
        PERFORM vault.delete_secret(v_secret_id);
        UPDATE public.businesses SET heygen_secret_id = NULL WHERE id = p_business_id;
      END IF;
    END;
    $$;
    GRANT EXECUTE ON FUNCTION public.delete_heygen_key(uuid) TO authenticated;
    ```

### Step 2: Apply the Migration

```bash
supabase db push
```

### Step 3: Manually Update TypeScript Types (Workaround)

Due to potential permissions issues with the type generator, manually patch `types/supabase.ts`.

1.  **Open `types/supabase.ts`**.
2.  **Locate the `businesses` table definition** and add `heygen_avatar_id`, `heygen_voice_id`, and `heygen_secret_id`.
3.  **Locate the `content` table definition** and add `heygen_video_id` and `heygen_status`.

### Step 4: Implement Backend Logic (Server Actions)

**File Path:** `app/actions/settings.ts`

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const heygenSettingsFormSchema = z.object({
  heygen_api_key: z.string().optional(),
  heygen_avatar_id: z.string().min(1, 'Avatar ID is required.'),
  heygen_voice_id: z.string().min(1, 'Voice ID is required.'),
});

// Action to update settings
export async function updateHeygenSettings(
  businessId: string,
  formData: z.infer<typeof heygenSettingsFormSchema>
) {
  const supabase = await createClient();

  const parsedData = heygenSettingsFormSchema.safeParse(formData);
  if (!parsedData.success) {
    const errorMessages = parsedData.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid form data.';
    return { error: firstError };
  }
  const { heygen_api_key, heygen_avatar_id, heygen_voice_id } = parsedData.data;

  // Only update the secret if a new key was provided.
  if (heygen_api_key) {
    const { error: rpcError } = await supabase.rpc('set_heygen_key', {
      p_business_id: businessId,
      p_new_key: heygen_api_key,
    });

    if (rpcError) {
      console.error('Error saving secret to Vault:', rpcError);
      return { error: `Database error: ${rpcError.message}` };
    }
  }

  // Always update the non-sensitive fields.
  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      heygen_avatar_id: heygen_avatar_id,
      heygen_voice_id: heygen_voice_id,
    })
    .eq('id', businessId);

  if (updateError) {
    console.error('Error updating business settings:', updateError);
    return { error: `Could not update settings: ${updateError.message}` };
  }

  revalidatePath('/settings');
  return { success: true };
}

// Action to remove the API key
export async function removeHeygenApiKey(businessId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('delete_heygen_key', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error deleting HeyGen API key:', error);
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings');
  return { success: true };
}
```

### Step 5: Implement Frontend UI (Settings Form)

**File Path:** `components/shared/settings/heygen-settings-form.tsx`

```typescript
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Tables } from '@/types/supabase';
import { updateHeygenSettings, removeHeygenApiKey } from '@/app/actions/settings';
import { useState } from 'react';

const heygenSettingsFormSchema = z.object({
  heygen_api_key: z.string().optional(),
  heygen_avatar_id: z.string().min(1, 'Avatar ID is required.'),
  heygen_voice_id: z.string().min(1, 'Voice ID is required.'),
});

type HeygenSettingsFormValues = z.infer<typeof heygenSettingsFormSchema>;

interface HeygenSettingsFormProps {
  business: Tables<'businesses'>;
}

export function HeygenSettingsForm({ business }: HeygenSettingsFormProps) {
  const [isKeySet, setIsKeySet] = useState(!!business.heygen_secret_id);

  const form = useForm<HeygenSettingsFormValues>({
    resolver: zodResolver(heygenSettingsFormSchema),
    defaultValues: {
      heygen_api_key: '', // Always start empty for security
      heygen_avatar_id: business.heygen_avatar_id || '',
      heygen_voice_id: business.heygen_voice_id || '',
    },
    mode: 'onChange',
  });

  async function handleRemoveKey() {
    const result = await removeHeygenApiKey(business.id);
    if (result.error) {
      toast.error('Failed to remove key', { description: result.error });
    } else {
      toast.success('HeyGen API Key has been removed.');
      setIsKeySet(false); // Update UI to show the input field
      form.resetField('heygen_api_key');
    }
  }

  async function onSubmit(data: HeygenSettingsFormValues) {
    if (isKeySet && !data.heygen_api_key) {
      delete data.heygen_api_key;
    }

    const result = await updateHeygenSettings(business.id, data);

    if (result.error) {
      toast.error('Failed to update settings', { description: result.error });
    } else {
      toast.success('HeyGen Settings Updated');
      if (data.heygen_api_key) {
        setIsKeySet(true);
        form.resetField('heygen_api_key');
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <FormField
            control={form.control}
            name="heygen_api_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HeyGen API Key</FormLabel>
                {isKeySet ? (
                  <div className="flex items-center space-x-2">
                    <Input type="password" placeholder="••••••••••••••••" disabled />
                    <Button type="button" variant="destructive" onClick={handleRemoveKey}>Remove</Button>
                  </div>
                ) : (
                  <FormControl>
                    <Input type="password" placeholder="Enter your new HeyGen API Key" {...field} />
                  </FormControl>
                )}
                <FormDescription>This key is stored securely and is write-only.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="heygen_avatar_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Avatar ID</FormLabel>
                <FormControl><Input placeholder="Default HeyGen Avatar ID" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="heygen_voice_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Voice ID</FormLabel>
                <FormControl><Input placeholder="Default HeyGen Voice ID" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button type="submit">Save Changes</Button>
        </CardFooter>
      </form>
    </Form>
  );
}
```

---

## 5. n8n Workflow Architecture

The n8n workflow is critical for handling the asynchronous video generation.

**Workflow Trigger**: A webhook that accepts `POST` with `{ "business_id": "...", "content_id": "...", "script": "..." }`.

**Workflow Steps**:
1.  **Start (Webhook)**: Receives the trigger.
2.  **Fetch Business Config**:
    -   Uses Supabase node to query `businesses` table for `heygen_avatar_id` and `heygen_voice_id`.
    -   **Crucially, makes an RPC call to a secure `get_business_secret` function** to retrieve the `heygen_api_key` from the Vault. (Note: this getter function needs to be created, similar to the setter/deleter).
3.  **Update Content Status**: Sets `heygen_status` to `'processing'`.
4.  **Generate Video (HeyGen API)**: Calls `POST https://api.heygen.com/v2/video/generate` with the fetched config and script. Extracts the `video_id`.
5.  **Update Content with Video ID**: Saves the `video_id` to the `content` table.
6.  **Polling Loop**:
    -   Waits 30 seconds.
    -   Calls `GET https://api.heygen.com/v2/video/status/{video_id}`.
    -   If status is `'completed'`, proceeds. If not, loops. Includes a max attempts counter.
7.  **Download and Upload**:
    -   Downloads the completed video from the URL provided in the status response.
    -   Uploads the video file to the Supabase `videos` storage bucket.
8.  **Final Update**: Updates the `content` table: `heygen_status` to `'completed'`, `heygen_url` to the HeyGen URL, and `video_long_url` to the public Supabase Storage URL.

---

## 6. Full Implementation Checklist

### Phase 1: Backend & Database
-   [ ] Create the single, consolidated Supabase migration script as detailed above.
-   [ ] Push the migration successfully (`supabase db push`).
-   [ ] Manually patch the `types/supabase.ts` file as a workaround.

### Phase 2: Application UI & Logic
-   [ ] Update the Business Settings page with the `HeygenSettingsForm` component.
-   [ ] Create the `app/actions/settings.ts` file with the `updateHeygenSettings` and `removeHeygenApiKey` actions.
-   [ ] Add the "Generate AI Avatar Video" button to the Content Details page.
-   [ ] Create the `generateHeygenVideo` Server Action to trigger the n8n webhook.
-   [ ] Implement the video player on the Content Details page.
-   [ ] Set up Supabase Realtime on the Content Details page to listen for the final `'completed'` status.

### Phase 3: n8n Workflow
-   [ ] Set up the new n8n workflow with a Webhook trigger.
-   [ ] Add Supabase credentials to n8n.
-   [ ] Implement all steps as detailed in the "n8n Workflow Architecture" section.
-   [ ] Add robust error handling.

### Phase 4: Testing & Verification
-   [ ] **Full E2E Test**: From the UI, save a new API key, see it persist, generate a video, and see it appear on the content page.
-   [ ] **Security Verification**: Confirm the API key is **only** visible in the Supabase Vault and not in the `businesses` table.
-   [ ] **Removal Test**: Use the "Remove" button to delete a key and confirm the UI updates and the secret is gone from the Vault.
-   [ ] Deploy changes. 