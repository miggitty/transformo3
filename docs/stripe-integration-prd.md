# **Stripe Subscription Integration PRD**

## **📋 Document Suite**

This is the main PRD document. Related documents:
- **[Phase 1: Database Schema & Migrations](./stripe-integration-phase-1-database.md)** - Database setup and migration scripts
- **[Phase 2: API Routes & Server Actions](./stripe-integration-phase-2-api.md)** - Backend implementation
- **[Phase 3: UI Components & Forms](./stripe-integration-phase-3-ui.md)** - Frontend components and pages
- **[Phase 4: Integration & Access Control](./stripe-integration-phase-4-integration.md)** - Middleware and access control

---

## **1. Project Overview & Goals**

### **Background**
Transformo is a Next.js 15 SaaS application using Supabase for database and authentication. The app helps businesses create and manage content across multiple platforms. Currently, the app is free to use, but we need to implement a subscription billing system to monetize the platform.

### **Architecture Context**
The app follows specific patterns that **MUST** be preserved:
- **Next.js App Router** with server components and server actions
- **Supabase** for database with RLS policies and Vault for secrets
- **ShadCN UI** components with Tailwind CSS
- **TypeScript** with generated Supabase types
- **Migration-first** database schema changes
- **Business-centric** data model (each user belongs to a business)

### **Goals**
- [ ] Implement Stripe subscription billing with 7-day free trial
- [ ] Gate application features based on subscription status
- [ ] Provide self-service billing management via Stripe Customer Portal
- [ ] Maintain data integrity between Stripe and Supabase
- [ ] Follow existing app patterns and reuse components

---

## **2. User Stories**

### **As a Business Owner/Admin:**
- [ ] I want to start a 7-day free trial by providing payment details
- [ ] I want to see a trial countdown showing remaining days
- [ ] I want to choose between monthly ($199) and yearly ($1990) plans
- [ ] I want a self-service portal to manage my subscription
- [ ] I want to retain access until the end of my billing period after cancellation
- [ ] I want a 7-day grace period if my payment fails

### **As a Team Member:**
- [ ] I want my access to be controlled by my business's subscription status
- [ ] I want clear messaging when access is restricted

---

## **3. Technical Architecture**

### **3.1 Core Design Principles**
Following the app's existing patterns:

1. **Business-Centric Billing**: Each business gets one Stripe Customer
2. **Vault-Based Secrets**: Stripe Customer ID stored in business record
3. **Server Actions**: Use server actions for all subscription operations
4. **RLS Policies**: Subscription data protected by business ownership
5. **Middleware Access Control**: Existing middleware enhanced for billing checks
6. **Component Reuse**: Leverage existing ShadCN components and form patterns

### **3.2 Data Flow**
```
User → Business → Stripe Customer → Subscription → Access Control
```

### **3.3 Access Control Logic**
The existing `middleware.ts` will be enhanced to check subscription status:

1. **Authentication Check** (existing) → **Subscription Check** (new)
2. Query subscriptions table for user's business
3. Apply access rules based on status and dates:
   - `trialing` or `active`: Full access
   - `past_due`: 7-day grace period with warning banner
   - `canceled`: Access until `current_period_end`
   - No subscription: Redirect to billing

---

## **4. Implementation Phases**

### **Phase 1: Database Foundation** ⏱️ 2-3 hours
Set up database schema following app's migration patterns
**→ [Detailed Phase 1 Guide](./stripe-integration-phase-1-database.md)**

### **Phase 2: API & Server Actions** ⏱️ 4-5 hours  
Implement backend logic following app's API route patterns
**→ [Detailed Phase 2 Guide](./stripe-integration-phase-2-api.md)**

### **Phase 3: UI Components & Pages** ⏱️ 5-6 hours
Build frontend following app's ShadCN component patterns
**→ [Detailed Phase 3 Guide](./stripe-integration-phase-3-ui.md)**

### **Phase 4: Integration & Access Control** ⏱️ 3-4 hours
Integrate middleware and access control
**→ [Detailed Phase 4 Guide](./stripe-integration-phase-4-integration.md)**

---

## **5. Environment Setup**

### **Required Environment Variables**
```bash
# Stripe Keys (add to .env.local)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...

# Product IDs (set after creating in Stripe Dashboard)
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...
```

### **Stripe Dashboard Setup**
1. Create Product: "Transformo SaaS Plan"
2. Create Prices:
   - Monthly: $199.00 USD, recurring monthly
   - Yearly: $1990.00 USD, recurring yearly
3. Enable customer emails for failed payments
4. Configure webhook endpoint: `{your-domain}/api/stripe/webhooks`

---

## **6. Success Criteria**

### **Functional Requirements**
- [ ] New users can start 7-day free trial with credit card
- [ ] Trial countdown displays remaining days
- [ ] Payment failure triggers 7-day grace period with banner
- [ ] Users can manage subscriptions via Stripe Customer Portal
- [ ] App features gated based on subscription status
- [ ] Webhook events properly sync subscription data

### **Technical Requirements**
- [ ] All database changes via migration files
- [ ] Server actions used for subscription operations
- [ ] Existing ShadCN components reused
- [ ] TypeScript types generated from Supabase schema
- [ ] RLS policies protect subscription data
- [ ] Middleware handles access control efficiently

### **User Experience Requirements**
- [ ] Seamless trial signup flow
- [ ] Clear subscription status visibility
- [ ] Non-intrusive but clear access restriction messaging
- [ ] Consistent UI following app's design patterns

---

## **7. Risk Mitigation**

### **Data Integrity**
- Webhook idempotency prevents duplicate processing
- Database transactions ensure atomic operations
- Event logging tracks all Stripe webhook events

### **Security**
- Stripe signature verification on all webhooks
- Supabase RLS policies protect subscription data
- Environment variables for all sensitive keys

### **User Experience**
- Grace period prevents abrupt access loss
- Clear messaging for all subscription states
- Stripe Customer Portal for self-service management

---

## **Next Steps**

1. **Start with Phase 1**: Database schema and migrations
2. **Set up Stripe Dashboard**: Create products and prices
3. **Configure Environment**: Add Stripe keys to `.env.local`
4. **Follow Phase Guides**: Complete each phase in order
5. **Test Thoroughly**: Use Stripe test mode throughout development

Each phase includes detailed checklists and implementation guides to ensure the AI coding tool has everything needed for successful implementation. 