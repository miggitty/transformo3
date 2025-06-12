## **Content Automation SaaS: Phased Implementation Plan**

As you complete tasks in this doc can you tick them off.

### **1\. Project Overview**

This document outlines the strategic, phased development plan for a SaaS application that enables clients to manage the creation and scheduling of marketing content. The application is designed to be a comprehensive tool for managing brand profiles, initiating content creation via text or audio, reviewing and approving assets, and scheduling content for publishing. The core backend logic is handled by external n8n workflows, with Supabase providing the database, authentication, storage, and real-time capabilities.

### **2\. Core Technology & Design Principles**

#### **Core Technology Stack**

* **Frontend:** Next.js  
* **UI Framework:** Shadcn/ui with Tailwind CSS  
* **Backend & Database:** Supabase (PostgreSQL, Auth, Storage, Realtime Subscriptions)  
* **Automation:** n8n  
* **Webhook Security:** Secret token passed in an HTTP header (Authorization: Bearer \<N8N\_WEBHOOK\_SECRET\>).

#### **Global Design & UX Principles**

* **Mobile-First Design:** The UI will be designed primarily for mobile devices and then scaled up.  
* **Responsive Design:** The UI must adapt seamlessly to all screen sizes.  
* **Asynchronous Operation & Feedback:** Long-running operations will be non-blocking and provide immediate UI feedback (spinners) and completion notifications (toasts) driven by real-time events.  
* **PWA Readiness:** The application will be architected for PWA compatibility from the start. Full feature implementation is the final phase.  
* **Accessibility:** Adherence to WCAG standards is a priority.

### **3\. Final Database Schema (Reference)**

This is the complete schema for the entire application. Each phase will focus on implementing parts of this schema.

erDiagram  
    profiles {  
        uuid id PK  
        uuid business\_id FK  
        boolean is\_admin  
    }  
    businesses {  
        uuid id PK  
        timestamptz created\_at  
        text name  
        text website\_url  
        text contact\_email  
        text social\_username  
        jsonb social\_media\_profiles  
        jsonb social\_media\_integrations  
        text writing\_style\_guide  
        text cta\_youtube  
        text cta\_email  
        text cta\_social  
    }  
    content {  
        uuid id PK  
        timestamptz created\_at  
        uuid business\_id FK  
        text content\_title  
        text status  
        text transcript  
        text research  
        text video\_script  
        text keyword  
        text audio\_url  
        text heygen\_url  
        text video\_long\_url  
        text video\_short\_url  
        text error\_message  
        timestamptz scheduled\_at  
        timestamptz published\_at  
    }  
    content\_assets {  
        uuid id PK  
        timestamptz created\_at  
        uuid content\_id FK  
        text name  
        text asset\_status  
        text content\_type  
        text headline  
        text headline\_prompt  
        text content  
        text content\_prompt  
        text image\_url  
        text image\_prompt  
        text blog\_url  
        text blog\_meta\_description  
        text error\_message  
        timestamtptz asset\_scheduled\_at  
        timestamptz asset\_published\_at  
    }

    profiles }o--|| businesses : "belongs to (optional for admins)"  
    businesses ||--o{ content : "owns"  
    content     ||--o{ content\_assets : "contains"

## **Phase 1: Core Application & Client MVP**

**Goal:** Build the essential functionality for a Business User to sign up, manage their profile, create content via text and audio, and approve assets. This phase focuses on delivering the core value proposition with a mobile-first, PWA-ready design and implementing the asynchronous feedback loop.

#### **Features & Scope for Phase 1**

* **Authentication & Onboarding:** New users can sign up, create a business profile, and log in.  
* **Business Profile Management:** Users can edit their business details, including social media URLs and integration keys.  
* **Audio Input & Processing:** A dedicated page allows users to record or upload audio to initiate content.  
* **Content & Asset Management:** Users can view a dashboard of their content, drill down to see generated assets, and approve them.  
* **Asynchronous Feedback:** The UI provides real-time updates when background n8n tasks (transcription, content generation) are complete.

#### **Technical Implementation Details for Phase 1**

* **Database Setup:**  
  * Implement the full schema for businesses, profiles, content, and content\_assets tables.  
  * Implement Row Level Security (RLS) rules ensuring users can only access their own business's data.  
  * Implement the database function/trigger to create a profile when a user signs up.  
* **Storage Setup:** Create the Audio, Images, and Videos buckets in Supabase Storage.  
* **Realtime Setup:** Configure Supabase client with Realtime subscriptions for ON UPDATE events on the content and content\_assets tables, filtered by business\_id.  
* **n8n Workflows:** Build the "Audio Processing & Transcription" and "Content Creation" workflows.  
* **Data Validation:** Implement validation for URLs, email formats, and audio file uploads (MP3, WAV, M4A; max 100MB).  
* **System Setup:**  
  * Implement the Admin User seed script/procedure.  
  * Configure all necessary environment variables (SUPABASE\_URL, SUPABASE\_ANON\_KEY, n8n webhook URLs, and N8N\_WEBHOOK\_SECRET).

#### **Phase 1 Checklist**

**Project & Supabase Setup**

* **[x] P1.1.1** Initialize Next.js app, set up Tailwind CSS and Shadcn/ui for mobile-first design.  
* **[x] P1.1.2** Configure Next.js for PWA basics (create manifest.json, basic service worker).  
* **[x] P1.1.3** Set up Supabase client with Realtime subscriptions filtered by business_id.  
* **[x] P1.1.4** Create all database tables as per the schema.  
* **[x] P1.1.5** Implement the Admin User Creation seed script/procedure.  
* **[x] P1.1.6** Create Audio, Images, Videos Storage buckets.  
* **[x] P1.1.7** Enable and configure all necessary RLS policies.

**Authentication & Onboarding**

* **[x] P1.2.1** Create the mobile-first sign-up page with input validation.  
* **[x] P1.2.2** Create the mobile-first sign-in page.  
* **[x] P1.2.3** Implement middleware for route protection.

**Business Profile Management**

* **[x] P1.3.1** Create the responsive "Business Settings" page with input validation for all fields.

**Audio Input & Processing**

* **\[x\] P1.4.1** Create the mobile-first "Audio Input" page with record/upload functionality and file validation.  
* **\[ \] P1.4.2** Implement the frontend logic to show immediate processing feedback and call the n8n webhook with the security header.  
* **\[ \] P1.4.3** Implement the Realtime listener to handle UI updates upon transcription completion or error.

**Content & Asset Management (Client View)**

* **\[ \] P1.5.1** Create the mobile-first content dashboard.  
* **\[ \] P1.5.2** Create the "New Content" form with processing feedback and a secure webhook call.  
* **\[ \] P1.5.3** Implement the Realtime listener for content generation completion/error.  
* **\[ \] P1.5.4** Create the responsive content detail page.  
* **\[ \] P1.5.5** Implement the asset approval logic (clicking "Approve" updates asset\_status).  
* **\[ \] P1.5.6** Implement the scheduling UI (calendar), which becomes active only when all assets are approved.

## **Phase 2: User Management & Admin Portal**

**Goal:** Expand the application to support multi-user businesses and provide a comprehensive admin portal for platform management.

#### **Features & Scope for Phase 2**

* **User Invitation Flow:** Business users can invite team members to their business account via email.  
* **Admin Portal:** A separate, secure section of the app where App Admins can view and manage all businesses and users on the platform.

#### **Technical Implementation Details for Phase 2**

* **Supabase Edge Functions:** Use for the email invitation logic to keep secrets secure.  
* **RLS Policies:** Implement specific RLS policies for the Admin Portal to grant superuser access. The is\_admin flag in the profiles table is key.

#### **Phase 2 Checklist**

**User Invitation Flow**

* **\[ \] P2.1.1** Create a responsive "Users" tab in the "Business Settings" page to list users and invite new ones.  
* **\[ \] P2.1.2** Implement the UI form to capture an invitee's email address.  
* **\[ \] P2.1.3** Create and deploy a Supabase Edge Function to handle sending invitation emails (e.g., with a magic link).

**Admin Portal**

* **\[ \] P2.2.1** Create an admin-only section (e.g., at /admin).  
* **\[ \] P2.2.2** Protect this section using RLS and application-level checks for is\_admin \= true.  
* **\[ \] P2.2.3** Create a responsive dashboard for admins to view a list of all businesses.  
* **\[ \] P2.2.4** Create a responsive page for admins to view a list of all users and have the ability to toggle their is\_admin status.

## **Phase 3: Enhancements & Polish**

**Goal:** Refine the user experience, improve application stability, and add a more robust notification system.

#### **Features & Scope for Phase 3**

* **UI/UX Refinements:** Implement loading states and more detailed error feedback.  
* **In-App Notifications:** A "bell icon" style notification center for recent events.  
* **Email Notifications:** Proactive email alerts for key events.

#### **Technical Implementation Details for Phase 3**

* **Realtime:** The existing Realtime setup will be used to power the in-app notification system.  
* **UI Components:** Leverage Shadcn/ui for loading skeletons and toast notifications.  
* **Email Service:** This may require a Supabase Edge Function integrated with a transactional email service (e.g., Resend, SendGrid).

#### **Phase 3 Checklist**

**UI/UX Refinements**

* **\[ \] P3.1.1** Add loading skeletons to pages and components that fetch data.  
* **\[ \] P3.1.2** Implement toast notifications for all major actions (e.g., "Settings Saved\!", "Content Scheduled\!").  
* **\[ \] P3.1.3** Enhance the error handling UI to show specific messages from the error\_message fields.  
* **\[ \] P3.1.4** Thoroughly test responsiveness across different devices.

**Notification System**

* **\[ \] P3.2.1** Create the UI for an in-app notification center (e.g., a dropdown from a bell icon).  
* **\[ \] P3.2.2** Use the Realtime listeners to populate this notification center with recent events (content generated, transcription complete, errors, etc.).  
* **\[ \] P3.2.3** Set up and integrate an email service for sending transactional emails on key events.

## **Phase 4: PWA Implementation & Final Review**

**Goal:** Convert the PWA-ready application into a full-featured Progressive Web App.

#### **Features & Scope for Phase 4**

* **Offline Functionality:** Implement caching for key data to allow for limited offline use.  
* **Installability:** Allow users to "install" the app to their home screen on supported devices.  
* **Performance Optimization:** Conduct final performance tuning.

#### **Technical Implementation Details for Phase 4**

* **Service Workers:** Implement robust service worker caching strategies using a library like next-pwa.  
* **Testing Tools:** Use Lighthouse and other browser developer tools to test and score the PWA implementation.

#### **Phase 4 Checklist**

**PWA Feature Rollout**

* **\[ \] P4.1.1** Implement robust service worker caching strategies for offline access to key data (e.g., viewed content, business settings).  
* **\[ \] P4.1.2** Implement and test "Add to Home Screen" prompts.

**PWA Testing & Optimization**

* **\[ \] P4.2.1** Conduct thorough PWA testing using Lighthouse, aiming for high scores.  
* **\[ \] P4.2.2** Test installability and offline functionality on various mobile devices (iOS and Android).  
* **\[ \] P4.2.3** Optimize for performance, focusing on load times and responsiveness as a PWA.

**Final UI/UX Review**

* **\[ \] P4.3.1** Conduct a final UI/UX review specifically considering the installed PWA experience.  
* **\[ \] P4.3.2** Make any necessary adjustments for a seamless app-like feel.