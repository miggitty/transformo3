# Resend Integration PRD
**Product Requirements Document**

## Overview

This document outlines the integration of Resend as the primary email service provider for Transformo, replacing the current fragmented email system with a unified, reliable transactional email solution.

## Goals

1. **Replace Supabase Auth email system** with Resend for signup and password reset emails
2. **Ensure high deliverability** for authentication emails

## Current State Analysis

### Existing Email Systems
- **Supabase Auth**: Currently using local inbucket for development, no production SMTP configured
- **User Email Integrations**: MailerLite/MailChimp/Brevo integrations (these remain unchanged)
- **Status**: No reliable auth email delivery in production

### Problems to Solve
- No reliable auth email delivery in production (signup confirmations, password resets)

## Technical Architecture

### Environment Configuration

All environments use the same Resend setup for simplicity:

```bash
# All environments (.env.local, staging, production)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Database Schema Changes

No database changes needed. We'll use Resend directly without app-level tracking.

## Implementation Phases

### Phase 1: Supabase Auth Integration (Priority: Critical)

#### 1.1 Resend Setup
- Configure DNS records for messages.transformo.io subdomain
- Set up single Resend API key for all environments
- Verify domain in Resend dashboard

#### 1.2 Supabase Configuration
Update `supabase/config.toml` to use Resend SMTP:

```toml
[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 587
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "noreply@messages.transformo.io"
sender_name = "Transformo"
```

#### 1.3 Custom Email Templates (Optional)
- Create branded email templates for auth emails
- Implement custom template paths in Supabase config

That's it! Just configure Supabase to use Resend SMTP.

No custom API implementation needed. Supabase handles everything through SMTP configuration.

## Setup Instructions

### 1. Resend Account Configuration

#### Domain Setup
1. **Add DNS Records for optimal deliverability**:
   ```
   # DKIM Record (Required)
   TXT record: resend._domainkey.messages.transformo.io
   Value: [Provided by Resend Dashboard]
   
   # SPF Record (Recommended)
   TXT record: messages.transformo.io
   Value: "v=spf1 include:_spf.resend.com ~all"
   
   # DMARC Record (Recommended)
   TXT record: _dmarc.messages.transformo.io
   Value: "v=DMARC1; p=quarantine; rua=mailto:admin@transformo.io"
   ```

2. **Verify domain** in Resend dashboard (wait for DNS propagation)
3. **Create API key with domain restrictions**

#### API Key Generation
1. Go to Resend Dashboard → API Keys
2. Create API key: `Transformo Production`
3. **Restrict API key** to `messages.transformo.io` domain only
4. **Copy and secure** the API key immediately

### 2. Environment Variable Setup

#### All Environments
```bash
# Resend Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# App URL for email links - CRITICAL: Must match your environment
# Local:
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Staging:
# NEXT_PUBLIC_APP_URL=https://staging.transformo.io  

# Production:
# NEXT_PUBLIC_APP_URL=https://transformo.io
```

### 3. Supabase Configuration Updates

#### Update supabase/config.toml
```toml
[auth]
enabled = true
site_url = "env(NEXT_PUBLIC_APP_URL)"
additional_redirect_urls = ["https://staging.transformo.io", "https://transformo.io"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
enable_signup = true
enable_anonymous_sign_ins = false
enable_manual_linking = false
# Minimum password length (6 characters)
minimum_password_length = 6
# No required character patterns (allows simple passwords)
password_requirements = ""

[auth.rate_limit]
# Allow up to 10 auth emails per hour
email_sent = 10
sms_sent = 30
anonymous_users = 30
token_refresh = 150
sign_in_sign_ups = 30
token_verifications = 30
web3 = 30

[auth.email]
enable_signup = true
# Require confirmation for email changes on both old and new addresses
double_confirm_changes = true
# Users must confirm email before signing in
enable_confirmations = true
# Users can change password without recent authentication
secure_password_change = false
max_frequency = "1m0s"
# 6-digit OTP codes
otp_length = 6
# OTP expires after 1 hour (3600 seconds)
otp_expiry = 3600

[auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 587
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "noreply@messages.transformo.io"
sender_name = "Transformo"
```

**Key Configuration Settings:**
- ✅ **Email provider enabled** - Allows email-based signup and login
- ✅ **Email confirmations enabled** - Users must verify email before signing in
- ✅ **Secure email change enabled** - Requires confirmation on both old and new email addresses
- ❌ **Secure password change disabled** - Users can change passwords without recent authentication
- ❌ **Leaked password prevention disabled** - Allows commonly used passwords
- 📧 **6-character minimum password** - Simple password requirements
- 📧 **6-digit OTP codes** - Email verification codes
- ⏱️ **1-hour OTP expiry** - Email links/codes expire after 3600 seconds
- 📨 **10 emails per hour limit** - Rate limiting for auth emails

### 4. Database Migration

No database migration needed for basic setup. We'll use Resend directly without app-level tracking.

### 5. Package Installation

No additional packages needed. Supabase uses SMTP directly.

### 6. Testing Strategy

#### Testing Strategy
1. Test auth email flows (signup, password reset) in local environment
2. Test transactional email API routes with test email addresses
3. Verify email links redirect correctly to appropriate environment
4. Deploy and test in staging with real email addresses
5. Verify email deliverability and formatting

## Success Metrics

### Technical Metrics
- **Email Delivery Rate**: >98% for auth emails
- **Email Open Rate**: >40% for transactional emails  
- **API Response Time**: <500ms for email sending
- **Uptime**: 99.9% for email service

### User Experience Metrics
- **Auth Email Delivery Time**: <30 seconds
- **User Complaint Rate**: <0.1%
- **Email Click-through Rate**: >15% for emails with CTAs
- **User Satisfaction**: Monitor support tickets related to email issues

## Risk Assessment

### High Risk
- **Email Deliverability**: Risk of emails going to spam
  - *Mitigation*: Complete DNS setup (DKIM + SPF + DMARC), domain verification
- **API Key Exposure**: Risk of unauthorized email sending
  - *Mitigation*: Domain-restricted API keys, secure environment variables
- **Unverified Email Addresses**: Users with invalid emails
  - *Mitigation*: Enable email confirmations (`enable_confirmations = true`)

### Medium Risk  
- **Domain Reputation**: New domain may have low reputation
  - *Mitigation*: Start with low volumes, monitor reputation
- **Template Rendering**: Risk of broken email layouts
  - *Mitigation*: Thorough testing across email clients

### Low Risk
- **Rate Limiting**: Resend API limits
  - *Mitigation*: Implement retry logic and queue management

## Timeline

### Week 1: Setup & Configuration
- [ ] Configure Resend domain and API key
- [ ] Update environment variables

### Week 2: Supabase Auth Integration
- [ ] Update Supabase SMTP configuration
- [ ] Test auth email flows (signup, password reset)
- [ ] Deploy and test

## Post-Implementation

### Monitoring
- Set up email delivery monitoring
- Configure alerts for failed email sends
- Track email engagement metrics

### Optimization
- A/B test email templates
- Optimize sending times
- Implement advanced segmentation

### Maintenance
- Regular domain reputation monitoring
- API key rotation schedule
- Template updates and improvements

---

## Appendix

### Useful Links
- [Resend Documentation](https://resend.com/docs)
- [Supabase Auth SMTP Configuration](https://supabase.com/docs/guides/auth/auth-smtp)
- [Email Deliverability Best Practices](https://resend.com/docs/knowledge-base/deliverability)

### Support Contacts
- Resend Support: support@resend.com
- Supabase Support: Available through dashboard

### Code Examples
All code examples are available in the implementation sections above and follow the existing project architecture patterns. 