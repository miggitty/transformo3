# Integrations Database Upgrade: Migration to Specialized Tables

## **Overview**

This document outlines the complete migration from the current wide `businesses` table integration approach to specialized integration tables (Option 2) based on proven patterns used by Zapier, n8n, and Make.com.

## **Project Structure**

This migration is divided into **4 phases** with detailed AI implementation checklists:

1. **[Phase 1: Email Integration Migration](./integrations-database-upgrade-phase-1-email.md)**
2. **[Phase 2: AI Avatar Integration Migration](./integrations-database-upgrade-phase-2-ai-avatar.md)**  
3. **[Phase 3: Blog Integration Migration](./integrations-database-upgrade-phase-3-blog.md)**
4. **[Phase 4: Social Integration Migration](./integrations-database-upgrade-phase-4-social.md)**


## **Why This Migration?**

### **Current Problems**
- **Wide Table Anti-Pattern**: 37+ integration columns in `businesses` table
- **Schema Drift**: Each new integration adds more columns
- **Mixed Concerns**: Business data + integration configs in same table
- **Poor Normalization**: Duplicate patterns across providers
- **Complex Queries**: Massive table updates for simple integration changes

### **New Architecture Benefits**
- **Specialized Tables**: Each integration type has its own optimized table
- **Better Performance**: Smaller, focused tables with proper indexing
- **Easier Scaling**: Add new providers without schema changes
- **Clear Separation**: Business data separate from integration configs
- **Type Safety**: Proper constraints and validation per integration type
- **Audit Trail**: Better tracking of integration changes

## **Migration Strategy**

### **Development Environment Approach**
- ✅ **Clean Slate**: No existing data to migrate
- ✅ **All-at-Once**: Complete migration in single deployment
- ✅ **Simplified Process**: Focus on schema and code updates only

### **Integration Types Covered**

| Integration | Current Fields | New Table | Provider Support |
|------------|---------------|-----------|------------------|
| **Email** | `email_provider`, `email_secret_id`, `sender_name`, `sender_email` | `email_integrations` | MailerLite, MailChimp, Brevo |
| **AI Avatar** | `heygen_secret_id`, `heygen_avatar_id`, `heygen_voice_id` | `ai_avatar_integrations` | HeyGen |
| **Blog** | `blog_provider`, `blog_secret_id`, `blog_username`, `blog_site_url` | `blog_integrations` | WordPress, Wix |
| **Social** | `upload_post_profiles` table (username format update) | `upload_post_profiles` | Upload-Post Platform |

## **Implementation Guidelines**

### **For AI Implementation**
1. **Follow Phase Order**: Complete each phase fully before moving to next
2. **Use Checklists**: Mark off each item as completed
3. **Test After Each Step**: Verify functionality before proceeding
4. **Preserve Existing Patterns**: Keep current UI/UX patterns intact

### **Key Architectural Principles**
- **Business-Centric**: All integration tables link to `business_id`
- **Provider Flexibility**: Support multiple providers per integration type
- **Secure Storage**: Continue using Supabase Vault for secrets
- **Consistent Patterns**: Follow established RPC function patterns
- **Audit Trail**: Track integration changes and status

## **Database Schema Overview**

### **New Table Structure**
```sql
-- Email integrations
email_integrations (id, business_id, provider, secret_id, sender_name, sender_email, ...)

-- AI Avatar integrations  
ai_avatar_integrations (id, business_id, provider, secret_id, avatar_id, voice_id, ...)

-- Blog integrations
blog_integrations (id, business_id, provider, secret_id, site_url, username, ...)

-- Social integrations (existing table with username generation update)
upload_post_profiles (id, business_id, upload_post_username, social_accounts, ...)
```

### **Benefits Over Current Approach**
- **Focused Queries**: Only load relevant integration data
- **Better Indexing**: Optimize for integration-specific query patterns
- **Easier Maintenance**: Update one integration without affecting others
- **Provider Expansion**: Add new providers without schema changes
- **Clear Relationships**: Explicit foreign keys and constraints



## **Success Criteria**

### **Phase Completion Checklist**
- [ ] All database migrations applied successfully
- [ ] All API routes updated and tested
- [ ] All UI components working with new tables
- [ ] All existing integration features preserved
- [ ] Performance improved (faster queries)
- [ ] Code complexity reduced

### **Final Validation**
- [ ] Create new integrations work correctly
- [ ] Existing integrations continue functioning
- [ ] Integration settings pages load quickly
- [ ] All error handling preserved
- [ ] Security patterns maintained

## **Getting Started**

1. **Read Phase 1**: Start with [Email Integration Migration](./integrations-database-upgrade-phase-1-email.md)
2. **Follow Checklists**: Complete each checklist item in order
3. **Test Thoroughly**: Verify each component before moving on
4. **Document Issues**: Note any problems encountered for future reference

---

**⚠️ Important**: This is a development environment migration. No production data will be affected. The migration can be safely tested and refined multiple times. 