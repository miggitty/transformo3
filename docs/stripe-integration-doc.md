# **PRD: Stripe Subscription Integration for SaaS App**

## **1\. Overview & Goals**

This document outlines the requirements for integrating Stripe into the Next.js/Supabase application to handle recurring subscriptions, including a 7-day free trial. The HeyGen integration will be handled separately via user-provided API keys and will not be part of the billing system.

**Project Goals:**

* **Monetize the Platform:** Implement a robust and scalable subscription billing system.  
* **Offer Flexible Plans:** Provide a 7-day free trial with seamless conversion to a paid monthly or yearly plan.  
* **Seamless User Experience:** Create a simple and intuitive interface for users to sign up and manage their subscription.  
* **Maintain Data Integrity:** Ensure all subscription data is accurately synchronized between Stripe and the application's Supabase database.  
* **Secure Access Control:** Gate application features based on a business's subscription status.

## **2\. User Stories**

### **As a Business Owner/Admin:**

* I want to sign up for a 7-day free trial by providing my payment details, with the understanding that I will be charged automatically when the trial ends.  
* I want to see a countdown in the app that clearly shows how many days are left in my free trial.  
* I want to subscribe my business to a monthly or yearly plan to access the application's full features.  
* I want to clearly see the pricing options: a monthly plan for $199 and a yearly plan for $1990 (which includes a "2 months free" discount).  
* I want a self-service portal where I can manage my subscription, update my payment method, view invoices, and cancel my plan.  
* When I cancel my subscription, I expect to retain access to the paid features until the end of my current billing period.  
* If my payment fails, I want a 7-day grace period to update my card details before I get locked out of the app.

### **As an Application Administrator:**

* I want to view the subscription status and plan details for any business using the platform, including whether they are in a trial period.

## **3\. Proposed Solution & Architecture**

We will adopt a robust, webhook-driven architecture that treats each business as the primary billing entity.

### **3.1. Core Architecture: "Stripe Customer per Business"**

Each business in our Supabase businesses table will be mapped one-to-one with a Customer object in Stripe.

* **Process:**  
  1. When a new business is created in our database, a corresponding Stripe Customer object will be created via the Stripe API.  
  2. The resulting stripe\_customer\_id will be saved in a new column in our businesses table.  
  3. All subsequent subscription activities for that business will be linked to this stripe\_customer\_id.

### **3.2. Application Access Control Logic**

This section explicitly answers: **"How does the app know if a user has paid?"**

Access to core features of the application will be controlled by a user's business's subscription status, which is stored in our subscriptions table and kept in sync by Stripe webhooks.

1. **On User Login/Page Load:** When a user logs in or navigates through the app, the application middleware or a high-level component will perform a check.  
2. **The Check:** It will query the subscriptions table for the business\_id associated with the current user.  
3. **Access Rules based on Status & Date:**  
   * status **is 'active' or 'trialing'**: The user has full access to all features.  
   * status **is 'past\_due'**: The user has full access during a **7-day grace period**. A persistent banner must be shown. After the grace period (when Stripe's retry attempts fail and the subscription is canceled), access is denied.  
   * status **is 'canceled'**: Access is determined by current\_period\_end. If the current date is before current\_period\_end, the user retains full access. If it is after, access is denied.  
   * **No Subscription Record Found**: The user is treated as a non-subscriber and is prompted to start a trial. Access is restricted.

### **3.3. Technology & Stripe Products**

* **Application Stack:** Next.js, Supabase, stripe-js library.  
* **Stripe Checkout:** We will use pre-built, hosted payment pages.  
* **Stripe Webhooks:** This is the critical component for synchronizing data.  
* **Stripe Customer Portal:** We will integrate the no-code Customer Portal.

### **3.4. Implementation: Middleware for Access Control**

To enforce the access rules defined above, the application's routing system must be upgraded. The recommended approach is to use **Next.js Middleware**.

* **File Location:** Create a middleware.ts file at the root of the /app or /pages directory.  
* **Logic Flow:** The middleware will run on the server before a request to a protected page is completed. It will perform a two-step check:  
  * **Authentication Check:** It first verifies if a user is logged in. If not, it redirects them to the login page.  
  * **Subscription Check:** If the user is authenticated, the middleware performs a server-side query to the Supabase database to fetch the status and current\_period\_end from the subscriptions table associated with the user's business\_id.  
* **Routing Decision:**  
  * If the user has access based on the rules in 3.2, the middleware allows them to proceed.  
  * If the user does not have access, the middleware intercepts the request and redirects them to the /billing page.

### **3.5. Data Integrity Best Practices**

* **Database Transactions:** For any webhook logic that requires multiple database operations (e.g., creating or updating several tables), these operations **must** be wrapped in a database transaction to ensure atomicity. If any part of the transaction fails, all changes should be rolled back to prevent data inconsistencies.

## **4\. Feature Breakdown**

### **4.1. Feature: Subscription Management with 7-Day Trial**

**Stripe Setup:**

* **Create Product & Prices:**  
  * Create one **Product** in the Stripe Dashboard named "SaaS Plan".  
  * Attach two **Prices** to this product:  
    * **Monthly Price:** $199.00, recurring monthly.  
    * **Yearly Price:** $1990.00, recurring yearly.  
* **Enable Customer Emails (Mandatory):**  
  * In the Stripe Dashboard, under **Settings \-\> Billing \-\> Customer emails**, ensure that emails for **failed payments** and **subscription payment reminders** are enabled. This offloads the responsibility of notifying users about payment issues to Stripe's automated system.

**User Flow (Trial Signup & Lifecycle):**

1. A new user signs up and creates their business profile.  
2. They are prompted to start their 7-day free trial.  
3. The backend creates a Stripe Checkout Session with trial\_period\_days: 7.  
4. The user is redirected to Stripe Checkout to enter their card details.  
5. Upon success, Stripe sends a checkout.session.completed event. Our webhook handler creates a subscriptions record with status: 'trialing'.  
6. The user has full access, and the trial countdown is displayed in the UI.  
7. After 7 days, Stripe attempts to charge the card on file.  
   * **On Success:** Stripe sends invoice.paid. Our webhook updates the subscription status to active. The user continues with seamless access.  
   * **On Failure (7-Day Grace Period):**  
     * Stripe sends invoice.payment\_failed. Our webhook updates the status to past\_due.  
     * The user retains full access, but a persistent, non-dismissible banner is shown in the UI: "Your payment has failed. Please update your payment method within 7 days to maintain access."  
     * Stripe will automatically retry the payment according to your settings (e.g., Smart Retries) and send email reminders to the user (if enabled as per setup).  
     * If a retry succeeds, invoice.paid is sent and the status becomes active.  
     * If all retries fail after the grace period, the subscription is marked as canceled in Stripe. Our webhook updates the status, and the user's access is revoked immediately.

## **5\. Database Schema Changes**

(No changes to schema)

### **5.1. Modified Tables**

businesses **Table**

* **ADD COLUMN:** stripe\_customer\_id (Type: text, nullable, unique)

### **5.2. New Tables**

subscriptions **Table**

* id (uuid, pk)  
* business\_id (uuid, fk \-\> businesses.id)  
* stripe\_subscription\_id (text, unique)  
* status (text) \- An enum storing trialing, active, past\_due, canceled.  
* price\_id (text) \- The Stripe Price ID for the current plan.  
* current\_period\_end (timestamptz) \- The date the trial or current billing period ends.

### **5.3. Full Mermaid Diagram of New Schema**

```

erDiagram
    businesses {
        uuid id PK
        timestamptz created_at
        text business_name
        text website_url
        text contact_email
        jsonb social_media_profiles
        text writing_style_guide
        text cta_youtube
        text cta_email
        text first_name
        text last_name
        text cta_social_long
        text cta_social_short
        text booking_link
        text email_name_token
        text email_sign_off
        text color_primary
        text color_secondary
        text color_background
        text color_highlight
        text timezone
        text heygen_avatar_id
        text heygen_voice_id
        uuid heygen_secret_id FK
        text email_provider
        uuid email_secret_id FK
        text email_sender_name
        text email_sender_email
        text email_selected_group_id
        text email_selected_group_name
        timestamptz email_validated_at
        text stripe_customer_id "NEW"
    }

    profiles {
        uuid id PK
        uuid business_id FK
        boolean is_admin
        text first_name
        text last_name
    }

    subscriptions {
        uuid id PK "NEW TABLE"
        uuid business_id FK "NEW"
        text stripe_subscription_id "NEW"
        text status "NEW"
        text price_id "NEW"
        timestamptz current_period_end "NEW"
    }

    content {
        uuid id PK
        timestamptz created_at
        uuid business_id FK
        text content_title
        text status
        text transcript
        text research
        text video_script
        text keyword
        text audio_url
        text heygen_url
        text video_long_url
        text video_short_url
        text error_message
        timestamptz scheduled_at
        timestamptz published_at
        text heygen_video_id
        text heygen_status
        timestamptz updated_at
    }

    content_assets {
        uuid id PK
        timestamptz created_at
        uuid content_id FK
        text name
        text asset_status
        text content_type
        text headline
        text headline_prompt
        text content
        text content_prompt
        text image_url
        text image_prompt
        text blog_url
        text blog_meta_description
        text error_message
        timestamptz asset_scheduled_at
        timestamptz asset_published_at
    }

    upload_post_profiles {
        uuid id PK
        uuid business_id FK
        text upload_post_username
        jsonb social_accounts
        timestamptz created_at
        timestamptz updated_at
        timestamptz last_synced_at
    }

    businesses ||--o{ profiles : "has"
    businesses |o--|| subscriptions : "has one"
    businesses ||--o{ content : "creates"
    businesses ||--o{ upload_post_profiles : "has"
    content ||--o{ content_assets : "has"

```

## **6\. Required API Endpoints & Webhooks**

### **6.1. API Routes**

* POST /api/stripe/create-checkout-session  
* POST /api/stripe/create-portal-session

### **6.2. Webhook Handler:** POST /api/stripe/webhooks

* **Security (Mandatory):** The handler **must** perform Stripe signature verification on every incoming request. Any request failing verification must be rejected with a 400 Bad Request response.  
* **Reliability (Mandatory):** The handler **must** be idempotent. Log the id of every processed Stripe event. Before processing, check if the event id has already been logged. If so, return a 200 OK response but perform no further actions.  
* **Required Events to Handle:**  
  * checkout.session.completed: Create the subscriptions record.  
  * customer.subscription.trial\_will\_end: (Optional) Send the user a reminder email.  
  * invoice.paid: Update current\_period\_end and set subscription status to active.  
  * invoice.payment\_failed: Update subscription status to past\_due to initiate the grace period.  
  * customer.subscription.updated: Handle upgrades, downgrades, and cancellations. Update the status and price\_id accordingly.  
  * customer.subscription.deleted: This is fired at the end of a billing period for a canceled subscription.  
  * customer.updated: If a user changes their email in the Stripe Customer Portal, sync this back to the application's profiles or businesses table.

## **7\. UI/UX Requirements**

* **New "Billing" Page:** A dedicated page in your application (e.g., /dashboard/billing).  
* **Page Components:**  
  * **Trial Countdown Timer:** A highly visible component in the UI.  
  * **Grace Period Banner:** A persistent, non-dismissible banner when a payment fails.  
  * **Subscription Status Card:** Shows the current plan, status (Trialing, Active, Past Due, Canceled \- access until \[Date\]), and next renewal date.  
  * **Plan Selection Cards:** For new or unsubscribed users.  
  * **Manage Subscription Button:** Links to the Stripe Customer Portal.  
* **Notifications & Banners:**  
  * Full-page overlays or redirects to the billing page to block app usage when access is denied.

## **8\. Environment and Key Management**

* **Environment Variables:** The application **must** support both Stripe test and live modes. All Stripe API keys (secret, publishable, and webhook signing secret) **must** be managed via environment variables.  
* **Local Development:** Use the .env.local file to store environment variables for local development. This file should be included in .gitignore and never committed to source control.  
* **Production:** Production keys must be set as environment variables in the hosting provider's dashboard (e.g., Vercel, Netlify).  
* **Key Naming:** Use clear naming conventions:  
  * NEXT\_PUBLIC\_STRIPE\_PUBLISHABLE\_KEY  
  * STRIPE\_SECRET\_KEY  
  * STRIPE\_WEBHOOK\_SIGNING\_SECRET  
  * 