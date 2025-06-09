# PRD: Content Detail Page

This document outlines the features and implementation plan for the Content Detail Page, which corresponds to task **P1.5.4** in the main project PRD.

---

## **1. Goal**

To provide users with a dedicated view where they can see the full details of a single piece of content. This page is critical for reviewing the output of the automated content generation process.

## **2. Features & Scope**

*   **Navigation:** Users will access this page by double-clicking on a row in the main content table.
*   **Dynamic Routing:** The page will be available at a dynamic route: `/content/[id]`.
*   **Data Display:** The page will display the following fields from the `content` database record:
    *   `content_title`
    *   `transcript`
    *   `research`
    *   `video_script`
*   **Interactive Audio Player:** An embedded audio player will be present, allowing the user to play and pause the original audio file linked in the `audio_url` field.
*   **Responsive & PWA-Optimized:** The page will be fully responsive, with a clean, single-column layout on mobile devices that scales appropriately for tablets and desktops.
*   **Read-Only:** For this initial version, all fields will be display-only. Editing functionality is out of scope.

## **3. Technical Implementation Plan**

*   **[ ] Create Dynamic Page Route:**
    *   Create a new server component at `app/(app)/content/[id]/page.tsx`.
    *   This component will be responsible for fetching the specific content record from Supabase using the `id` parameter from the URL.

*   **[ ] Build the UI:**
    *   The page will use ShadCN `Card` components to structure the content. Each major field (`Transcript`, `Research`, etc.) will be displayed in its own card for clarity.
    *   Sections for fields that are `null` or empty will be hidden to keep the UI clean.

*   **[ ] Create a Custom Audio Player Component:**
    *   Create a new client component at `components/shared/audio-player.tsx`.
    *   This component will accept the `audio_url` as a prop.
    *   It will use the HTML `<audio>` element and React hooks (`useState`, `useRef`) to manage the play/pause state.
    *   The UI will consist of a simple, accessible button that toggles between a "Play" and "Pause" icon.

*   **[ ] Update the Content Table:**
    *   Modify `components/shared/content-table.tsx`.
    *   Add an `onDoubleClick` event handler to the `<TableRow>` element.
    *   The handler will use the `useRouter` hook from Next.js to programmatically navigate the user to `/content/[id]`.

</rewritten_file> 