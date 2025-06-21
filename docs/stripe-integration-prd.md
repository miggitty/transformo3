# **Stripe Subscription Integration PRD**

**Project**: Transformo SaaS Platform  
**Feature**: Subscription Billing with Stripe  
**Version**: 1.0  
**Last Updated**: December 2024

---

## **🎯 Overview**

This PRD outlines the implementation of Stripe subscription billing for Transformo, a Next.js 15 SaaS application that transforms audio content into multiple formats for content creators and marketers.

**Business Goal**: Enable subscription revenue with a 7-day free trial, monthly/yearly billing options, and proper access control throughout the application.

**Technical Goals**: 
- Seamless Stripe integration following official best practices
- Robust webhook handling for subscription lifecycle management
- Graceful access control with proper fallbacks
- Performance-optimized middleware with caching
- Production-ready security and error handling

---

## **📚 Official Stripe Documentation References**

This implementation is based on official Stripe documentation and best practices:

### **Primary Resources**
1. **[Next.js Subscription Guide](https://stripe.com/docs/billing/subscriptions/build-subscriptions-nextjs)** - Main implementation guide
2. **[Stripe Checkout Sessions](https://stripe.com/docs/payments/checkout)** - Payment flow setup
3. **[Subscription Trials](https://stripe.com/docs/billing/subscriptions/trials)** - Free trial implementation
4. **[Webhook Handling](https://stripe.com/docs/webhooks)** - Event processing and security
5. **[Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)** - Self-service billing

### **Security & Best Practices**
- **[Webhook Signatures](https://stripe.com/docs/webhooks/signatures)** - Event verification
- **[Idempotency](https://stripe.com/docs/api/idempotent_requests)** - Duplicate event handling
- **[Error Handling](https://stripe.com/docs/error-handling)** - Graceful failure management

### **Revenue Recovery**
- **[Smart Retries](https://stripe.com/docs/billing/revenue-recovery)** - Failed payment handling
- **[Grace Periods](https://stripe.com/docs/billing/revenue-recovery#grace-periods)** - Access control during payment issues

---

## **🏗️ Technical Architecture**

### **Data Model**
- **Business-centric billing**: One Stripe customer per business (not per user)
- **Subscription tracking**: Full lifecycle management via webhooks
- **Audit trail**: Complete event logging for compliance and debugging

### **Access Control Strategy**
```
Trial (7 days) → Active Subscription → Past Due (7-day grace) → Access Denied
                ↓
            Canceled (access until period end) → Access Denied
```

### **Infrastructure Requirements**
- **Environment**: Next.js 15 App Router with Supabase backend
- **Authentication**: Supabase Auth with RLS policies
- **Payments**: Stripe Checkout with Customer Portal
- **Real-time**: Webhook-driven subscription status updates

---

## **💰 Business Model**

### **Pricing Structure**
- **Free Trial**: 7 days, full feature access
- **Monthly Plan**: $29/month
- **Yearly Plan**: $290/year (2 months free)
- **Grace Period**: 7 days for failed payments

### **Feature Access Levels**
```typescript
type AccessLevel = 'full' | 'trial' | 'grace' | 'denied';

// Trial: Full access with usage limitations and trial banners
// Full: Complete access to all features
// Grace: Continued access with payment failure warnings
// Denied: No access, redirect to billing page
```

---

## **🎯 Core Features**

### **✅ Subscription Management**
- Stripe Checkout integration with trial support
- Customer Portal for self-service billing
- Multiple pricing plans (monthly/yearly)
- Automatic proration for plan changes

### **✅ Access Control**
- Middleware-based subscription verification
- Feature-specific access gates
- Graceful degradation for edge cases
- Real-time subscription status updates

### **✅ Payment Lifecycle**
- 7-day free trial with card collection
- Automatic trial-to-paid conversion
- Failed payment handling with grace period
- Subscription cancellation with access until period end

### **✅ User Experience**
- Seamless signup flow with immediate trial access
- Clear subscription status indicators
- Contextual upgrade prompts
- Comprehensive billing management

---

## **🔄 Implementation Phases**

This implementation is structured in 4 sequential phases, each building on the previous:

### **[Phase 1: Database Schema & Migrations](./stripe-integration-phase-1-database.md)**
**Duration**: 2-3 hours

**Core Tasks**:
- Add `stripe_customer_id` to businesses table
- Create `subscriptions` table with full Stripe data model
- Create `stripe_events` table for webhook idempotency
- Implement RLS policies and performance indexes
- Generate updated TypeScript types

**Key Outcomes**:
- Database foundation ready for Stripe integration
- Proper constraints ensuring data integrity
- Audit trail infrastructure for compliance
- Type-safe database interactions

---

### **[Phase 2: API Routes & Server Actions](./stripe-integration-phase-2-api.md)**
**Duration**: 4-5 hours

**Core Tasks**:
- Install and configure Stripe dependencies
- Create billing server actions (checkout, portal, status)
- Implement robust webhook handler with signature verification
- Build subscription utility functions
- Set up proper error handling and logging

**Key Outcomes**:
- Complete backend Stripe integration
- Secure webhook processing with idempotency
- Server actions following app conventions
- Production-ready error handling

---

### **[Phase 3: UI Components & Forms](./stripe-integration-phase-3-ui.md)**
**Duration**: 5-6 hours

**Core Tasks**:
- Build billing page with plan selection
- Create subscription management dashboard
- Implement trial countdown and status banners
- Add upgrade prompts and billing portal access
- Design responsive billing UI with ShadCN

**Key Outcomes**:
- Complete billing user interface
- Trial experience with clear progression
- Self-service subscription management
- Mobile-responsive design

---

### **[Phase 4: Integration & Access Control](./stripe-integration-phase-4-integration.md)**
**Duration**: 3-4 hours

**Core Tasks**:
- Enhance middleware with subscription checks
- Create access gate components with fallbacks
- Integrate subscription provider throughout app
- Add performance optimizations and caching
- Implement feature-specific access controls

**Key Outcomes**:
- Complete access control implementation
- Performance-optimized middleware
- Graceful degradation for all scenarios
- Production-ready user experience

---

## **🔐 Security Implementation**

### **Webhook Security**
```typescript
// Required for all webhook endpoints
const sig = headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
```

### **RLS Policies**
```sql
-- Users can only access their business subscription
CREATE POLICY "subscription_access" ON subscriptions
FOR ALL USING (business_id IN (
  SELECT business_id FROM profiles WHERE id = auth.uid()
));

-- Service role for webhook processing
CREATE POLICY "service_role_access" ON subscriptions
FOR ALL TO service_role USING (true);
```

### **Access Control Middleware**
- Cached subscription lookups (1-minute TTL)
- Graceful degradation on database errors
- Protection of all content routes
- Bypass for public and auth routes

---

## **📊 Monitoring & Analytics**

### **Required Tracking**
- Subscription lifecycle events (trial start, conversion, churn)
- Failed payment recovery rates
- Grace period effectiveness
- Customer portal usage
- API performance metrics

### **Stripe Dashboard Setup**
- Revenue recognition configuration
- Tax handling setup (if applicable)
- Dispute monitoring
- Subscription metrics tracking

---

## **🚀 Environment Configuration**

### **Required Environment Variables**
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_...
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...

# Pricing Configuration
STRIPE_MONTHLY_PRICE_ID=price_... # Monthly plan price ID
STRIPE_YEARLY_PRICE_ID=price_... # Yearly plan price ID

# Application URLs
NEXT_PUBLIC_BASE_URL=https://your-domain.com # or http://localhost:3000 for dev
```

### **Stripe Dashboard Setup**
1. Create products and pricing in Stripe Dashboard
2. Configure webhook endpoint: `https://your-domain.com/api/stripe/webhooks`
3. Subscribe to events: `customer.subscription.*`, `invoice.*`, `payment_intent.*`
4. Configure Customer Portal settings
5. Set up tax handling (if required)

---

## **✅ Testing Strategy**

### **Automated Testing**
- Unit tests for subscription utility functions
- Integration tests for server actions
- Webhook endpoint testing with Stripe CLI
- Middleware performance testing

### **Manual Testing Scenarios**
```bash
# Test all subscription states
1. New user trial signup
2. Trial to paid conversion
3. Failed payment scenarios
4. Subscription cancellation
5. Plan changes and proration
6. Customer portal functionality
7. Access control edge cases
```

### **Performance Benchmarks**
- Middleware overhead: < 100ms
- Subscription lookup: < 50ms (cached)
- Webhook processing: < 500ms
- Page load impact: < 200ms additional

---

## **🎯 Success Metrics**

### **Technical KPIs**
- **Webhook Success Rate**: > 99.5%
- **Page Load Performance**: < 2s including subscription checks
- **API Error Rate**: < 0.1%
- **Database Query Performance**: < 100ms avg

### **Business KPIs**
- **Trial Conversion Rate**: > 20%
- **Churn Rate**: < 5% monthly
- **Failed Payment Recovery**: > 60%
- **Customer Portal Usage**: > 80% of billing interactions

---

## **🔄 Post-Launch Optimization**

### **Phase 5: Advanced Features** (Future)
- Usage-based billing for enterprise plans
- Team collaboration and seat management
- Advanced analytics and reporting
- Multi-currency support
- Regional tax compliance

### **Ongoing Maintenance**
- Monthly webhook health checks
- Quarterly security reviews
- Performance monitoring and optimization
- Customer feedback integration
- Stripe API version updates

---

## **📋 Implementation Checklist**

### **Pre-Implementation**
- [ ] Stripe account setup with test/live environments
- [ ] Product and pricing configuration in Stripe Dashboard
- [ ] Webhook endpoint configuration
- [ ] Environment variables configured
- [ ] Team access to Stripe Dashboard

### **Phase 1: Database**
- [ ] Migration file created with Brisbane timezone naming
- [ ] Tables created with proper constraints and RLS
- [ ] Indexes optimized for subscription lookups
- [ ] TypeScript types generated and verified
- [ ] Database schema tested with sample data

### **Phase 2: Backend**
- [ ] Stripe SDK installed and configured
- [ ] Server actions implemented and tested
- [ ] Webhook handler with signature verification
- [ ] Error handling and logging implemented
- [ ] Idempotency handling verified

### **Phase 3: Frontend**
- [ ] Billing page with plan selection
- [ ] Subscription dashboard with portal access
- [ ] Trial banners and countdown timers
- [ ] Mobile-responsive design verified
- [ ] Upgrade flows tested end-to-end

### **Phase 4: Integration**
- [ ] Middleware with subscription checks
- [ ] Access gates protecting all content
- [ ] Performance optimization with caching
- [ ] Error states with graceful fallbacks
- [ ] Complete user journey tested

### **Launch Readiness**
- [ ] All environment variables configured for production
- [ ] Webhook endpoints tested with Stripe CLI
- [ ] Error monitoring and logging configured
- [ ] Customer support documentation prepared
- [ ] Rollback plan documented and tested

---

## **🆘 Support & Troubleshooting**

### **Common Issues & Solutions**

**Webhook Processing Failures**:
- Verify webhook signing secret
- Check event idempotency handling
- Review Stripe Dashboard event logs
- Monitor application error logs

**Access Control Issues**:
- Verify RLS policies are correctly applied
- Check subscription status in database
- Review middleware caching behavior
- Test with different subscription states

**Performance Problems**:
- Monitor subscription cache hit rates
- Review database query performance
- Check middleware execution time
- Optimize subscription lookup queries

### **Emergency Procedures**
- **Webhook Downtime**: Events are retried by Stripe for 3 days
- **Database Issues**: Middleware allows access on errors to prevent blocking
- **Billing Portal Errors**: Direct users to email support with clear escalation
- **Payment Failures**: Grace period provides 7-day buffer for resolution

---

**Implementation Contact**: Development Team  
**Business Contact**: Product Management  
**Technical Review**: Senior Engineering Team

---

*This PRD serves as the complete technical specification for implementing Stripe subscription billing in the Transformo application. Each phase includes detailed implementation guides with code examples, security considerations, and testing procedures.* 