# PRD: Content Listing & Audio Upload

This document outlines the phased implementation plan for creating the content listing dashboard and the subsequent audio upload and processing functionality.

---

## **Phase 1: Content Listing Page**

**Goal:** Build the primary dashboard page where users can view a list of all their created content and initiate the creation of new content. This will become the default page after a user logs in.

#### **Features & Scope**

*   A table view that lists all content associated with the logged-in user's business.
*   The table will display columns for: Content Title, Status, and Creation Date.
*   A prominent "New Content" button on the page.
*   Clicking the "New Content" button will navigate the user to the `/new` page (the audio recording page).
*   The application's routing will be updated to make this page the default destination after sign-in.

#### **Technical Implementation Plan**

- [x] **Create Content Listing Page Component:**
    - [x] Create a new server component at `app/(app)/content/page.tsx`.
    - [x] This component will fetch all records from the `content` table that belong to the user's `business_id`.
    - [x] It will use ShadCN's `Table` component to display the fetched content in a clear, responsive table.
    - [x] A ShadCN `Button` component will be included with the text "New Content", configured to navigate to `/new` using a Next.js `<Link>`.

- [x] **Update Routing and Redirection:**
    - [x] Modify `app/page.tsx`: If a user is logged in, they should be redirected to `/content`.
    - [x] Modify `app/(auth)/sign-in/page.tsx`: Upon successful login, the user should be redirected to `/content`.

---

## **Phase 2: Audio Recording & Upload**

**Goal:** Implement a seamless, mobile-first audio recording experience that allows users to create new content, upload the audio file to Supabase Storage, and trigger the backend processing workflow.

#### **Features & Scope**

*   A dedicated page at `/new` for creating new audio content.
*   A simple UI with a "Record" button to initiate microphone capture. The browser will prompt for microphone permission if not already granted.
*   The UI will provide clear feedback on the recording state (e.g., button changes to "Stop," a timer displays elapsed time).
*   The system will provide feedback for processing, uploading, success, and error states using toast notifications.
*   After a successful upload, the user will be redirected to the main Content Listing page.

#### **Technical Implementation Plan**

- [x] **Create Audio Recorder Component:**
    - [x] The core functionality will be built within a client component at `components/shared/audio-recorder.tsx`.
    - [x] A parent server component will exist at `app/(app)/new/page.tsx` to render the recorder.
    - [x] The component will use the browser's `MediaRecorder` API. The audio will be recorded and exported in the **WebM** format.

- [x] **Implement the Backend Data Flow:**
    - [x] The process will be handled by two distinct Server Actions to ensure security and efficiency.

    - [x] **Step 1: Create Content Record (Server Action 1)**
        - [x] When the user clicks "Stop", this action is called.
        - [x] It performs an `INSERT` into the `content` table with a default `status` of `'creating'`.
        - [x] It securely returns the `id` of the new content record and the user's `business_id` to the client.

    - [x] **Step 2: Upload Audio to Storage (Client-side)**
        - [x] Using the IDs from the previous step, the client constructs a unique filename: `{business_id}-{content_id}.webm`.
        - [x] The client directly uploads the audio `Blob` to the `audio` bucket in Supabase Storage using this filename. This is efficient as the large file does not pass through the application server.

    - [x] **Step 3: Finalize Content & Trigger Workflow (Server Action 2)**
        - [x] Once the upload is complete, the client calls the second Server Action.
        - [x] This action retrieves the public URL of the uploaded file from Supabase Storage.
        - [x] It performs an `UPDATE` on the `content` record, setting the `audio_url` field to the new URL and updating the `status` to `'awaiting_processing'`.
        - [x] **(Future Implementation):** This action will be responsible for making a secure, server-to-server call to the n8n webhook. The webhook URL will be stored in an environment variable (`N8N_AUDIO_WEBHOOK_URL`).

- [x] **Final Redirection:**
    - [x] Upon the successful completion of the entire flow, the user will be redirected back to the Content Listing page (`/content`), where they should see their new content record appear with the status "Awaiting Processing". 