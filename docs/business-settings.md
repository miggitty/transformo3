# Business Settings Page PRD

This document outlines the requirements for the Business Settings page. The goal is to create a user-friendly interface for businesses to manage their company information, branding, and other settings.

## 1. Overview

The Business Settings page will allow authenticated users to update their business details. The page will be divided into logical sections, each with its own "Save" button to provide a clear and straightforward user experience. The settings are stored in the `businesses` table in the Supabase database.

## 2. Page Structure

The settings page will be located at `/settings`. It will be composed of the following sections:

-   Company Details
-   Design Colors
-   Speaker Details
-   Social Media
-   Call To Actions
-   Email

Each section will be a form with its own "Save" button. When a "Save" button is clicked, only the data in that section will be updated in the database.

## 3. Detailed Field Specifications

### 3.1. Company Details

-   **Business Name**
    -   **Database Field:** `business_name`
    -   **UI:** Text input.
    -   **Validation:** Required, minimum 2 characters.
-   **Website Address**
    -   **Database Field:** `website_url`
    -   **UI:** Text input with `https://` prepended.
    -   **Validation:** Must be a valid URL.
-   **Business Email**
    -   **Database Field:** `contact_email`
    -   **UI:** Text input.
    -   **Validation:** Must be a valid email format.
-   **Timezone**
    -   **Database Field:** `timezone`
    -   **UI:** Dropdown list of world timezones.

### 3.2. Design Colors

-   **Primary Color**
    -   **Database Field:** `color_primary`
    -   **UI:** A color picker that supports hex codes and displays the selected color.
-   **Secondary Color**
    -   **Database Field:** `color_secondary`
    -   **UI:** A color picker that supports hex codes and displays the selected color.
-   **Background Color**
    -   **Database Field:** `color_background`
    -   **UI:** A color picker that supports hex codes and displays the selected color.
-   **Highlight Color**
    -   **Database Field:** `color_highlight`
    -   **UI:** A color picker that supports hex codes and displays the selected color.

### 3.3. Speaker Details

-   **First Name**
    -   **Database Field:** `first_name`
    -   **UI:** Text input.
-   **Last Name**
    -   **Database Field:** `last_name`
    -   **UI:** Text input.
-   **Writing Style Guide**
    -   **Database Field:** `writing_style_guide`
    -   **UI:** Text area.

### 3.4. Social Media

-   **UploadPost.com User ID**
    -   **Database Field:** `upload_post_id`
    -   **UI:** Text input.
-   **Social Media Post Profiles**
    -   **Database Field:** `social_media_profiles` (JSONB)
    -   **UI:** A set of text inputs for different social media platforms (Facebook, LinkedIn, YouTube, Instagram, Twitter, TikTok). The data will be stored as a JSON object in the database.

### 3.5. Call To Actions

-   **YouTube Call To Action**
    -   **Database Field:** `cta_youtube`
    -   **UI:** Text area.
-   **Email Call To Action**
    -   **Database Field:** `cta_email`
    -   **UI:** Text area.
-   **Social Media Long Video Call To Action**
    -   **Database Field:** `cta_social_long`
    -   **UI:** Text area.
-   **Social Media Short Video Call To Action**
    -   **Database Field:** `cta_social_short`
    -   **UI:** Text area.
-   **Booking Link**
    -   **Database Field:** `booking_link`
    -   **UI:** Text input.
    -   **Validation:** Must be a valid URL.

### 3.6. Email

-   **Email Name Token**
    -   **Database Field:** `email_name_token`
    -   **UI:** Text input.
-   **Email Sign Off**
    -   **Database Field:** `email_signoff`
    -   **UI:** Text area.

## 4. Database Changes

The following fields will be removed from the `businesses` table:
- `social_media_integrations`
- `contact_url`

A new migration will be created to apply these changes.

## 5. Technical Implementation Details

-   The page will be built using Next.js App Router.
-   The UI will be built with ShadCN UI components.
-   Forms will be managed using `react-hook-form` and `zod` for validation.
-   Data will be updated using server actions.
-   A suitable color picker component will be integrated or created.
-   The timezone dropdown will be populated with a comprehensive list of world timezones.

## 6. Checklist

-   [ ] Create a new directory `docs` if it doesn't exist.
-   [ ] Create `business-settings.md` in the `docs` directory.
-   [ ] Create a new migration file to remove `social_media_integrations` and `contact_url` from the `businesses` table.
-   [ ] Create a new `settings` page component that will be divided into sections.
-   [ ] Create a `CompanyDetailsForm` component.
-   [ ] Create a `DesignColorsForm` component.
-   [ ] Create a `SpeakerDetailsForm` component.
-   [ ] Create a `SocialMediaForm` component.
-   [ ] Create a `CallToActionsForm` component.
-   [ ] Create an `EmailSettingsForm` component.
-   [ ] Implement the UI for each form section with the specified fields.
-   [ ] Implement the save functionality for each section.
-   [ ] Add a color picker component.
-   [ ] Populate the timezone dropdown.
-   [ ] Ensure all fields are correctly wired to the database and update as expected.
-   [ ] Test the page thoroughly. 