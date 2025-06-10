# PRD: HeyGen AI Avatar Video Generation

This document outlines the requirements for integrating HeyGen AI avatar video generation into the platform. The goal is to allow users to generate a video from a script using a pre-configured AI avatar and voice, and have the final video automatically saved and displayed within the application.

## 1. Feature Overview

A new feature will be added to the "Content Details" page. A button labeled "Generate AI Avatar Video" will trigger a workflow that:
1.  Uses the script from the current content item.
2.  Fetches the business's configured HeyGen API Key, Avatar ID, and Voice ID.
3.  Calls an n8n workflow to orchestrate the video generation with HeyGen.
4.  The n8n workflow generates the video, polls for its completion, downloads it, and uploads it to Supabase storage.
5.  The content record in the database is updated with the new video URLs and status.
6.  The newly generated video is displayed on the "Content Details" page.

---

## 2. Architecture & Design

### 2.1. Data Model & Database Changes

To support this feature, we will need to update our Supabase database schema.

#### 2.1.1. `businesses` Table
We need to store HeyGen credentials and configuration at the business level. The following columns will be added:

- `heygen_api_key` (type: `text`): The API key for the business's HeyGen account. **This will be encrypted at the column level using `pgsodium` for security.**
- `heygen_avatar_id` (type: `text`): The ID of the default HeyGen avatar to be used for video generation.
- `heygen_voice_id` (type: `text`): The ID of the default HeyGen voice to be used.

#### 2.1.2. `content` Table
We need to track the status and assets associated with the HeyGen video generation for each piece of content.

- `heygen_video_id` (type: `text`): Stores the unique ID returned by HeyGen when a video generation job is initiated. This is crucial for polling the status.
- `heygen_status` (type: `text`): Tracks the current state of the video generation. Values: `idle`, `processing`, `completed`, `failed`. This will help manage the UI state.

**Existing columns to be used:**
- `video_script`: This will be the source text for the video.
- `heygen_url`: The direct URL to the video on HeyGen's servers will be stored here.
- `video_long_url`: The public URL of the video file after it has been uploaded to our Supabase Storage will be stored here.

### 2.2. API Key Encryption: `pgsodium`

The `heygen_api_key` is highly sensitive. We will use the `pgsodium` extension in Supabase to implement transparent column encryption.

- **Why `pgsodium`?**: It is a modern, secure, and officially supported encryption method within Supabase. It allows us to encrypt data in a specific column, and the data is automatically decrypted upon selection by an authorized role, which is perfect for our n8n workflow's needs. This is more secure than application-level encryption as the encryption key is managed by Postgres and never exposed to the client or application server directly.

- **Implementation**: A new database migration will be created to enable the `pgsodium` extension, add the new columns, and apply the encryption policy to the `heygen_api_key` column.

### 2.3. n8n Workflow

An n8n workflow will be responsible for the entire video generation process. This decouples the long-running task from our Next.js application, making the system more robust.

**Workflow Trigger**: A webhook that accepts a `POST` request with the following JSON payload:
```json
{
  "business_id": "...",
  "content_id": "...",
  "script": "..."
}
```

**Workflow Steps**:
1.  **Start (Webhook)**: Receives the initial trigger from our application.
2.  **Fetch Business Config**:
    -   Uses the Supabase node to connect to our database.
    -   Queries the `businesses` table using the `business_id` to retrieve the (decrypted) `heygen_api_key`, `heygen_avatar_id`, and `heygen_voice_id`.
3.  **Update Content Status (Processing)**:
    -   Uses the Supabase node to update the `content` table.
    -   Sets `heygen_status` to `'processing'` for the given `content_id`.
4.  **Generate Video (HeyGen API)**:
    -   Uses the HTTP Request node to call `POST https://api.heygen.com/v2/video/generate`.
    -   **Headers**: `X-Api-Key: {{ $json.heygen_api_key }}`
    -   **Body**: 
        ```json
        {
          "video_inputs": [
            {
              "character": {
                "type": "avatar",
                "avatar_id": "{{ $json.heygen_avatar_id }}",
                "avatar_style": "normal"
              },
              "voice": {
                "type": "text",
                "input_text": "{{ $json.script }}",
                "voice_id": "{{ $json.heygen_voice_id }}"
              }
            }
          ],
          "test": true,
          "aspect_ratio": "16:9"
        }
        ```
    -   Extracts the `video_id` from the response.
5.  **Update Content with Video ID**:
    -   Uses the Supabase node to update the `content` table.
    -   Sets `heygen_video_id` to the ID received from HeyGen.
6.  **Polling Loop (Check Status)**:
    -   **Wait**: Waits for 30 seconds.
    -   **Check Status (HeyGen API)**: Uses HTTP Request node to call `GET https://api.heygen.com/v2/video/status/{{ $json.video_id }}`.
    -   **IF Node**: Checks if `data.status` is `'completed'`.
    -   If not complete, loop back to the Wait node.
    -   If `failed`, send a notification and stop the workflow.
    -   Includes a counter to prevent an infinite loop (e.g., max 20 attempts).
7.  **Download and Upload**:
    -   Once complete, the status response will contain a `video_url`.
    -   **Download**: Use HTTP Request node (with "File" output) to download the video.
    -   **Upload**: Use the Supabase node to upload the downloaded video file to the `videos` storage bucket.
8.  **Final Update (Success)**:
    -   Uses the Supabase node to update the `content` table one last time:
        -   `heygen_status`: `'completed'`
        -   `heygen_url`: The URL from HeyGen.
        -   `video_long_url`: The public URL from Supabase Storage.

### 2.4. Application Changes (Next.js)

#### 2.4.1. Business Settings Page (`app/(app)/settings`)
-   A new section "HeyGen Configuration" will be added to this page.
-   Input fields for "HeyGen API Key", "Default Avatar ID", and "Default Voice ID" will be created.
-   The form submission will be handled by a Server Action that saves these values to the `businesses` table.

#### 2.4.2. Content Details Page (`app/(app)/content/[id]`)
-   A new button **"Generate AI Avatar Video"** will be added near the video upload section.
-   The button will be disabled if `heygen_status` is `'processing'`.
-   Clicking the button will trigger a Server Action.

#### 2.4.3. API Endpoint & Server Action
-   A Server Action (`generateHeygenVideo`) will be created.
-   It performs the following steps:
    1.  Authenticates the user and checks permissions.
    2.  Fetches the `content` record, including the `video_script`.
    3.  Fetches the `business` record to get the `business_id`.
    4.  Makes a `fetch` call to the n8n webhook URL, passing `{ business_id, content_id, script }`.
    5.  It does **not** wait for the workflow to finish. It will return immediately after triggering the workflow.

#### 2.4.4. Real-time UI Updates (Simplified)
-   The Content Details page will use Supabase's Realtime functionality to listen for changes to its `content` record.
-   **Simplified Flow**:
    1.  When the user clicks "Generate", the UI will immediately show a loading/processing indicator.
    2.  The page will then listen for a single update from the database.
    3.  When the n8n workflow completes its final step (updating the `heygen_status` to `completed` and populating `video_long_url`), the Realtime service will notify the client.
    4.  The UI will then automatically hide the processing indicator and display the final video in an HTML `<video>` player.
-   This approach avoids complex, granular status tracking in the UI, providing a simple "processing" and "complete" state for the user, without requiring a page refresh.

---

## 3. Implementation Checklist

### Phase 1: Backend & Database
-   [ ] Create a new Supabase migration script.
-   [ ] In the script: Enable the `pgsodium` extension.
-   [ ] In the script: Add `heygen_api_key`, `heygen_avatar_id`, `heygen_voice_id` to the `businesses` table.
-   [ ] In the script: Add `heygen_video_id` and `heygen_status` to the `content` table.
-   [ ] In the script: Apply `pgsodium` encryption to the `heygen_api_key` column.
-   [ ] Push the migration to the database (`supabase db push`).

### Phase 2: Application UI & Logic
-   [ ] Update the Business Settings page (`app/(app)/settings/page.tsx`) with the new form fields.
-   [ ] Create the Server Action to save the HeyGen settings.
-   [ ] Add the "Generate AI Avatar Video" button to the Content Details page (`app/(app)/content/[id]/page.tsx`).
-   [ ] Create the `generateHeygenVideo` Server Action to trigger the n8n webhook and set the initial status to `processing`.
-   [ ] Implement the video player on the Content Details page.
-   [ ] Set up Supabase Realtime on the Content Details page to listen for the final `'completed'` status and video URL.

### Phase 3: n8n Workflow
-   [ ] Set up a new n8n workflow with a Webhook trigger.
-   [ ] Add a Supabase credential to n8n.
-   [ ] Implement the "Fetch Business Config" step, including the query to decrypt the API key.
-   [ ] Implement the "Generate Video" step using the HeyGen API.
-   [ ] Implement the polling loop to check for video status.
-   [ ] Implement the download and upload to Supabase Storage steps.
-   [ ] Implement the final database update step to set status to `completed` and add the video URLs.
-   [ ] Add robust error handling throughout the workflow.

### Phase 4: Testing & Deployment
-   [ ] Test the entire flow from the UI.
-   [ ] Verify that the API key is stored encrypted in the database.
-   [ ] Verify that the n8n workflow executes successfully.
-   [ ] Verify that the video appears correctly on the content page.
-   [ ] Deploy changes. 