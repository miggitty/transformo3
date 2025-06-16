# PRD: Content Asset Scheduling Calendar

## 1. Overview

This document outlines the requirements for implementing a content scheduling calendar on the content details page. This feature will allow users to visually schedule, view, and manage the publication dates and times for all content assets associated with a piece of content. The calendar will be interactive, supporting drag-and-drop for rescheduling, and will provide a comprehensive view of all scheduled content across the business, with a clear distinction between assets for the current content and others.

## 2. Goals and Objectives

-   **Goal**: To provide a powerful and intuitive visual interface for scheduling content assets.
-   **Objective 1**: Allow users to schedule all assets for a piece of content with a single click.
-   **Objective 2**: Enable users to fine-tune the schedule by dragging and dropping assets on a calendar.
-   **Objective 3**: Provide a holistic view of all scheduled content, helping users avoid conflicts and plan effectively.
-   **Objective 4**: Ensure all scheduling respects the business's specified timezone, with all data stored in UTC.

## 3. Scope

### In Scope

-   Adding a `timezone` field to the `businesses` table.
-   Creating a new calendar view within the `ContentAssetsManager` component.
-   Fetching and displaying content assets for the current content on the calendar.
-   Fetching and displaying content assets from other content pieces in a read-only, "grayed-out" state.
-   Implementing a one-click automatic scheduling feature based on a predefined sequence.
-   Implementing drag-and-drop to reschedule assets.
-   Implementing a modal to edit the scheduled time of an asset.
-   Implementing a hover-over preview for calendar events.
-   Implementing a confirmation modal before navigating to another content's detail page.

### Out of Scope

-   Real-time collaboration (e.g., multiple users editing the calendar simultaneously).
-   Customizable scheduling sequences (the 5-day sequence is fixed for now).
-   Directly publishing content to social media platforms from the calendar.

## 4. Requirements & Implementation Phases

The project will be implemented in four phases.

---

### Phase 1: Backend & Core UI Setup

This phase focuses on preparing the database and the basic UI structure needed for the calendar.

#### User Stories

-   As an admin, I want to set a default timezone for my business so that all scheduling is based on my local time.

#### Technical Requirements

1.  **Database Migration**:
    -   Add a new `timezone` column (type: `text`) to the `businesses` table.
    -   The default value for existing records can be `UTC`.
2.  **Settings UI**:
    -   In the business settings page, add a dropdown menu to allow users to select and save their timezone. The list should be comprehensive (e.g., using the standard IANA timezone database names).
3.  **Component Structure**:
    -   In `ContentAssetsManager`, add a toggle (e.g., Tabs from ShadCN) to switch between the existing "List View" and a new "Calendar View".
    -   The state for the current view should be managed within the `ContentDetailClientPage`.

---

### Phase 2: Calendar Display & Auto-Scheduling

This phase focuses on rendering the calendar and implementing the initial one-click scheduling logic.

#### User Stories

-   As a user, I want to see a monthly calendar view for my content assets.
-   As a user, I want to be able to schedule all my unscheduled content assets starting from a specific day with a single click.

#### Technical Requirements

1.  **Calendar Integration**:
    -   Integrate `FullCalendar` (React version) into the "Calendar View".
    -   The calendar should default to a monthly view (`dayGridMonth`).
    -   Users should be able to navigate between months.
2.  **Display Current Content Assets**:
    -   Fetch all `content_assets` for the current `content_id`.
    -   For assets with a `asset_scheduled_at` date, display them on the calendar.
    -   The event title should be the asset's `name` (e.g., "Blog Post", "YouTube Video").
    -   The event color should be distinct for assets belonging to the currently viewed content.
3.  **One-Click Scheduling**:
    -   In the calendar view, if there are unscheduled assets, provide a way for the user to initiate auto-scheduling (e.g., a "Schedule All" button or by clicking a date).
    -   When a user selects a start date, schedule the assets according to the following fixed sequence, starting at 10:00 AM in the business's timezone:
        -   **Day 1**: Youtube Video, Blog post, Social Long Video
        -   **Day 2**: Quote Card
        -   **Day 3**: Email, Social Blog Post
        -   **Day 4**: Social Rant
        -   **Day 5**: Social Short Video
    -   If an asset type does not exist for the content, it is skipped, and the sequence continues on the next day.
    -   The `asset_scheduled_at` timestamp for each asset must be converted to UTC before being saved to the database.

---

### Phase 3: Advanced Calendar Interactions

This phase introduces drag-and-drop, time editing, and the display of external assets.

#### User Stories

-   As a user, I want to drag and drop an asset to a different day to reschedule it easily.
-   As a user, I want to click on an asset in the calendar to update its specific scheduled time.
-   As a user, I want to see all other content scheduled for the month so I can avoid conflicts.

#### Technical Requirements

1.  **Drag-and-Drop Rescheduling**:
    -   Enable `editable` and `droppable` options in FullCalendar.
    -   When an asset is dragged to a new date, update its `asset_scheduled_at` field in the database. The time component should remain the same (e.g., 10:00 AM), only the date changes.
2.  **Time Editing**:
    -   When a user clicks on a calendar event, open a modal (`Dialog` from ShadCN).
    -   The modal should display the asset's name and a time input.
    -   Allow the user to change the time. On save, update the `asset_scheduled_at` in the database, ensuring the new timestamp is converted to UTC.
3.  **Display Other Assets**:
    -   When the calendar view is active, fetch all `content_assets` from the same business that are scheduled within the visible month.
    -   Exclude the assets belonging to the current `content_id` (which are already displayed).
    -   Display these external assets on the calendar with a "grayed-out" or muted color to distinguish them.
    -   These external events should not be draggable or editable from this view.

---

### Phase 4: Final Touches

This phase focuses on improving the user experience with previews and navigation confirmations.

#### User Stories

-   As a user, I want to hover over any calendar event to see a quick preview of its details.
-   As a user, when I double-click an external asset, I want to be asked if I wish to navigate to its content page to edit it.

#### Technical Requirements

1.  **Event Hover Preview**:
    -   Implement a hover-over preview for all calendar events (`eventMouseEnter` in FullCalendar).
    -   The preview (e.g., using `Tooltip` from ShadCN) should display:
        -   Content Asset Name (Headline)
        -   Content Type
        -   Scheduled Time (in the business's timezone)
        -   Image (`image_url`) if available.
2.  **Navigate to External Content**:
    -   Add a double-click handler (`eventDblClick`) to the grayed-out external asset events.
    -   On double-click, show a confirmation dialog (`AlertDialog` from ShadCN) asking the user if they want to navigate away to the selected content asset's page.
    -   If confirmed, navigate the user to the corresponding content detail page (`/content/[id]`).

## 5. Task Checklist

### Phase 1: Backend & Core UI Setup
-   [ ] **Task**: Create a new Supabase migration script.
-   [ ] **Task**: Add `timezone` column (`text`) to the `businesses` table.
-   [ ] **Task**: Push the migration to the database.
-   [ ] **Task**: Update the business settings page with a timezone selection dropdown.
-   [ ] **Task**: Implement "List View" / "Calendar View" toggle tabs in `ContentAssetsManager`.

### Phase 2: Calendar Display & Auto-Scheduling
-   [ ] **Task**: Install `FullCalendar` and its React plugin (`@fullcalendar/react`, `@fullcalendar/daygrid`).
-   [ ] **Task**: Add the `FullCalendar` component to the "Calendar View".
-   [ ] **Task**: Fetch and display assets for the current content on the calendar.
-   [ ] **Task**: Implement the client-side logic for the 5-day auto-scheduling sequence.
-   [ ] **Task**: Create a server action to update the `asset_scheduled_at` for multiple assets at once.
-   [ ] **Task**: Implement correct timezone conversions (Business Timezone -> UTC) when saving.

### Phase 3: Advanced Calendar Interactions
-   [ ] **Task**: Enable drag-and-drop functionality on the calendar.
-   [ ] **Task**: Create a server action to update an asset's schedule on drop.
-   [ ] **Task**: Create a `Dialog` component for editing the scheduled time.
-   [ ] **Task**: Implement the server action to update the time for a single asset.
-   [ ] **Task**: Create an API route or server function to fetch all other assets scheduled in a given month for the business.
-   [ ] **Task**: Render external assets in a distinct, non-interactive style.

### Phase 4: Final Touches
-   [ ] **Task**: Implement a hover-over `Tooltip` to show event previews.
-   [ ] **Task**: Implement a double-click handler on external events.
-   [ ] **Task**: Create an `AlertDialog` to confirm navigation.
-   [ ] **Task**: Write the logic to redirect the user upon confirmation.
-   [ ] **Task**: Final review of the feature for bugs and UX improvements. 