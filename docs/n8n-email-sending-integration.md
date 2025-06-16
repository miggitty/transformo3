# N8N Email Sending Integration

## 📋 Overview

This document outlines the implementation of a polling-based email sending system using N8N. Unlike webhook-triggered approaches, this system polls the database for scheduled email content assets and processes them automatically.

## 🏗️ Architecture

### **Polling-Based Flow:**
1. **N8N polls database** → Checks for scheduled email assets
2. **For each email asset** → Gets business configuration 
3. **Secure credential retrieval** → Calls secure API endpoint for email API keys
4. **Send email** → Uses appropriate provider (MailerLite, MailChimp, Brevo)
5. **Update status** → Marks as 'Sent', 'Failed', or 'Error'

### **Database Structure:**
content_assets table:
├── content_type: 'email' | 'social' | 'blog' etc.
├── asset_status: 'Scheduled' | 'Sent' | 'Failed'
├── asset_scheduled_at: timestamp
├── content_id: UUID → content.id
├── headline: email subject line
├── content: email body content
└── error_message: error details if failed
content table:
├── id: UUID
├── business_id: UUID → businesses.id
└── content_title: content title
businesses table:
├── email_provider: 'mailerlite' | 'mailchimp' | 'brevo'
├── email_secret_id: UUID → vault.secrets(id)
├── email_sender_name: sender display name
├── email_sender_email: sender email address
├── email_selected_group_id: target audience group ID
└── email_selected_group_name: target audience group name



---

## 🔧 Implementation

### 1. Environment Variables Setup

Add to `.env.local`:
```env
# Supabase REST API for N8N
SUPABASE_REST_URL=https://mmodhofduvuyifwlsrmh.supabase.co/rest/v1
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-anon-key

# N8N Authentication (existing)
N8N_CALLBACK_SECRET=your-secret-key

# Application Domain (for N8N API endpoints)
# Development: https://rested-monthly-boar.ngrok-free.app
# Production: https://app2.transformo.io
NEXT_PUBLIC_APP_DOMAIN=https://rested-monthly-boar.ngrok-free.app
```

### ⚠️ Alternative for N8N Lower Plans (No Environment Variables)

If your N8N plan doesn't support environment variables, we've created separate workflow files with hardcoded domains:
- `docs/n8n-email-workflow-dev.json` - For development (ngrok domain)
- `docs/n8n-email-workflow-prod.json` - For production (app2.transformo.io)

### 2. Secure Email Credentials API Endpoint

**✅ ENDPOINT CREATED: The API endpoint has been successfully created**

The `app/api/n8n/email-credentials/route.ts` endpoint is now available and integrated with your existing email infrastructure:

```typescript
import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client with service role key for N8N
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    // 1. Secure the endpoint with N8N secret
    const callbackSecret = process.env.N8N_CALLBACK_SECRET;
    const authHeader = req.headers.get('authorization');
    if (!callbackSecret || authHeader !== `Bearer ${callbackSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // 2. Parse the request body
    const { business_id } = await req.json();

    if (!business_id) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // 3. Get business email configuration
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select(`
        email_provider,
        email_secret_id,
        email_sender_name,
        email_sender_email,
        email_selected_group_id,
        email_selected_group_name
      `)
      .eq('id', business_id)
      .single();

    if (businessError || !business) {
      console.error('Error fetching business email configuration:', businessError);
      return NextResponse.json(
        { error: 'Business email configuration not found' },
        { status: 404 }
      );
    }

    if (!business.email_provider || !business.email_secret_id) {
      return NextResponse.json(
        { error: 'Email integration not configured for this business' },
        { status: 400 }
      );
    }

    // 4. Retrieve the API key from vault using RPC function
    const { data: apiKey, error: secretError } = await supabase.rpc('get_email_secret', {
      p_business_id: business_id
    });

    if (secretError || !apiKey) {
      console.error('Error retrieving email API key:', secretError);
      return NextResponse.json(
        { error: 'Unable to retrieve email API key' },
        { status: 500 }
      );
    }

    // 5. Return email configuration for N8N
    return NextResponse.json({
      success: true,
      email_config: {
        provider: business.email_provider,
        api_key: apiKey, // Decrypted API key from vault
        sender_name: business.email_sender_name,
        sender_email: business.email_sender_email,
        selected_group_id: business.email_selected_group_id,
        selected_group_name: business.email_selected_group_name,
      },
      business_id: business_id,
    });

  } catch (error) {
    console.error('Email credentials API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 🔄 N8N Workflow Configuration

### Step 1: Poll for Scheduled Emails

**Node Type:** HTTP Request  
**Method:** GET  
**URL:** `{{ $env.SUPABASE_REST_URL }}/content_assets?asset_scheduled_at=lt.now()&asset_status=eq.Scheduled&content_type=eq.email&select=*,content(business_id,content_title)`

**Headers:**
```json
{
  "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
  "Authorization": "Bearer {{ $env.SUPABASE_ANON_KEY }}"
}
```

### Step 2: Check If Any Emails Found

**Node Type:** IF  
**Condition:** `{{ $json.length > 0 }}`

- **True:** Continue to process emails
- **False:** End workflow (no emails to send)

### Step 3: Split Into Batches

**Node Type:** Split In Batches  
**Batch Size:** 1 (process one email at a time)

### Step 4: Get Email Credentials

**Node Type:** HTTP Request  
**Method:** POST  
**URL:** `{{ $env.NEXT_PUBLIC_APP_DOMAIN }}/api/n8n/email-credentials`

**✅ DOMAIN CONFIGURED:** The workflow now uses environment variables for domain management

**Headers:**
```json
{
  "Authorization": "Bearer {{ $env.N8N_CALLBACK_SECRET }}",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "business_id": "{{ $json.content.business_id }}"
}
```

### Step 5: Switch By Email Provider

**Node Type:** Switch  
**Mode:** Expression  
**Value:** `{{ $('Get Email Credentials').item.json.email_config.provider }}`

**Routes:**
- `mailerlite`
- `mailchimp` 
- `brevo`

### Step 6A: Send Email (MailerLite Branch)

**Node Type:** HTTP Request  
**Method:** POST  
**URL:** `https://connect.mailerlite.com/api/campaigns`
**Authentication:** None (using headers)

**⚠️ CRITICAL: Set Authentication to "None" and use Headers section**

**Headers:**
```json
{
  "Authorization": "Bearer {{ $('Get Email Credentials').item.json.email_config.api_key }}",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "name": "{{ $json.content.content_title }}",
  "type": "regular",
  "emails": [{
    "subject": "{{ $json.headline }}",
    "from": "{{ $('Get Email Credentials').item.json.email_config.sender_email }}",
    "from_name": "{{ $('Get Email Credentials').item.json.email_config.sender_name }}",
    "content": "{{ $json.content }}"
  }],
  "groups": ["{{ $('Get Email Credentials').item.json.email_config.selected_group_id }}"]
}
```

### Step 6B: Send Email (MailChimp Branch)

**Node Type:** HTTP Request  
**Method:** POST  
**URL:** `https://us1.api.mailchimp.com/3.0/campaigns`
**Authentication:** None (using headers)

**⚠️ CRITICAL: Set Authentication to "None" and use Headers section**

**Headers:**
```json
{
  "Authorization": "apikey {{ $('Get Email Credentials').item.json.email_config.api_key }}",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "type": "regular",
  "recipients": {
    "list_id": "{{ $('Get Email Credentials').item.json.email_config.selected_group_id }}"
  },
  "settings": {
    "subject_line": "{{ $json.headline }}",
    "from_name": "{{ $('Get Email Credentials').item.json.email_config.sender_name }}",
    "reply_to": "{{ $('Get Email Credentials').item.json.email_config.sender_email }}"
  }
}
```

### Step 6C: Send Email (Brevo Branch)

**Node Type:** HTTP Request  
**Method:** POST  
**URL:** `https://api.brevo.com/v3/emailCampaigns`
**Authentication:** None (using headers)

**⚠️ CRITICAL: Set Authentication to "None" and use Headers section**

**Headers:**
```json
{
  "api-key": "{{ $('Get Email Credentials').item.json.email_config.api_key }}",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "name": "{{ $json.content.content_title }}",
  "subject": "{{ $json.headline }}",
  "sender": {
    "name": "{{ $('Get Email Credentials').item.json.email_config.sender_name }}",
    "email": "{{ $('Get Email Credentials').item.json.email_config.sender_email }}"
  },
  "htmlContent": "{{ $json.content }}",
  "recipients": {
    "listIds": ["{{ $('Get Email Credentials').item.json.email_config.selected_group_id }}"]
  }
}
```

### Step 7: Update Email Status (Success)

**Node Type:** HTTP Request  
**Method:** PATCH  
**URL:** `{{ $env.SUPABASE_REST_URL }}/content_assets?id=eq.{{ $json.id }}`

**Headers:**
```json
{
  "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
  "Authorization": "Bearer {{ $env.SUPABASE_ANON_KEY }}",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "asset_status": "Sent",
  "asset_published_at": "{{ new Date().toISOString() }}"
}
```

### Step 8: Update Email Status (Error Handler)

**Node Type:** HTTP Request (in error workflow)  
**Method:** PATCH  
**URL:** `{{ $env.SUPABASE_REST_URL }}/content_assets?id=eq.{{ $json.id }}`

**Headers:**
```json
{
  "apikey": "{{ $env.SUPABASE_ANON_KEY }}",
  "Authorization": "Bearer {{ $env.SUPABASE_ANON_KEY }}",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "asset_status": "Failed",
  "error_message": "{{ $json.error || 'Unknown error occurred' }}"
}
```

---

## 🔒 Security Features & Flow

### **Secure API Key Flow:**
1. **N8N polls database** → Gets scheduled emails (no API keys exposed)
2. **Secure credential call** → N8N calls `/api/n8n/email-credentials` with secret
3. **Database retrieval** → API uses service role to call `get_email_secret()` RPC
4. **Temporary exposure** → API key returned to N8N memory only
5. **Email sending** → N8N uses API key in Authorization headers
6. **Memory cleanup** → API key discarded after request

### API Key Protection
- ✅ **Encrypted Storage**: API keys stored in Supabase Vault
- ✅ **Secure Retrieval**: Uses RPC functions with proper permissions  
- ✅ **No Hardcoding**: API keys never stored in N8N workflows
- ✅ **Headers-Only**: API keys only in request headers, not N8N credentials
- ✅ **Authenticated Access**: Endpoint secured with N8N callback secret

### Authentication Flow
1. N8N calls secure endpoint with `N8N_CALLBACK_SECRET`
2. Endpoint validates secret before processing
3. Uses service role key to bypass RLS
4. Retrieves encrypted API key from vault
5. Returns decrypted key temporarily for email sending

---

## 📊 Benefits

### **Polling vs Webhook Approach:**
- ✅ **Reliable**: Database-driven, doesn't depend on webhook delivery
- ✅ **Retry Logic**: Can easily retry failed emails
- ✅ **Batching**: Process multiple emails efficiently
- ✅ **Scheduling**: Precise scheduling control via database
- ✅ **Monitoring**: Full audit trail in database

### **Security Advantages:**
- ✅ **Vault Integration**: Follows established HeyGen pattern
- ✅ **Minimal Exposure**: API keys only exist in memory during execution
- ✅ **Role-Based Access**: Proper database permissions
- ✅ **Audit Trail**: All access logged through RPC functions

### **Scalability:**
- ✅ **Multi-Provider**: Easy to add new email providers
- ✅ **Multi-Tenant**: Handles multiple businesses seamlessly
- ✅ **Error Handling**: Comprehensive error tracking
- ✅ **Status Management**: Clear state transitions

---

## 🚀 Implementation Checklist

### Prerequisites (COMPLETE FIRST)
- [ ] Verify email integration from [Email Integration PRD](./prd-mailerlite.md) is fully implemented
- [ ] Confirm `get_email_secret()` RPC function exists in Supabase
- [ ] Ensure `content_assets` table has all required columns:
  - `content_type` (varchar)
  - `asset_status` (varchar) 
  - `asset_scheduled_at` (timestamp)
  - `content_id` (uuid)
  - `headline` (text)
  - `content` (text)
  - `error_message` (text)
- [ ] Verify `businesses` table has email configuration columns

### Backend Setup
- [ ] Create `/api/n8n/email-credentials/route.ts` endpoint
- [ ] Add environment variables to `.env.local`
- [ ] Test endpoint with sample business_id: `curl -X POST https://your-domain.com/api/n8n/email-credentials -H "Authorization: Bearer your-secret" -d '{"business_id":"test-uuid"}'`

### N8N Workflow Setup

**Option A: N8N Pro/Enterprise Plans (Environment Variables)**
- [ ] Configure environment variables in N8N Settings → Variables:
  - `SUPABASE_REST_URL`: `https://mmodhofduvuyifwlsrmh.supabase.co/rest/v1`
  - `SUPABASE_ANON_KEY`: Your project anon key
  - `N8N_CALLBACK_SECRET`: Your secret key from `.env.local`
  - `NEXT_PUBLIC_APP_DOMAIN`: `https://rested-monthly-boar.ngrok-free.app` (dev) or `https://app2.transformo.io` (prod)
- [ ] Import workflow from `docs/n8n-email-workflow.json`

**Option B: N8N Lower Plans (No Environment Variables)**
- [ ] **Development**: Import workflow from `docs/n8n-email-workflow-dev.json`
- [ ] **Production**: Import workflow from `docs/n8n-email-workflow-prod.json`
- [ ] Update the Authorization header in "Get Email Credentials" node with your actual `N8N_CALLBACK_SECRET`

**Both Options:**
- [ ] ✅ **READY TO USE:** Workflow automatically uses the correct domain from environment variables
- [ ] Test workflow with manual execution first
- [ ] Activate workflow for automatic polling

### Database Preparation
- [ ] Verify email integration is set up (from email integration PRD)
- [ ] Ensure `content_assets` table has required columns
- [ ] Test creating scheduled email assets
- [ ] Verify business email configuration is complete

### Testing & Troubleshooting
- [ ] Create test email asset:
  ```sql
  INSERT INTO content_assets (content_type, asset_status, asset_scheduled_at, content_id, headline, content)
  VALUES ('email', 'Scheduled', NOW() - INTERVAL '1 minute', 'your-content-id', 'Test Subject', 'Test email content');
  ```
- [ ] Test API endpoint: `curl -X POST https://your-domain.com/api/n8n/email-credentials -H "Authorization: Bearer your-secret" -d '{"business_id":"your-business-id"}'`
- [ ] Execute N8N workflow manually first
- [ ] Check N8N execution logs for errors
- [ ] Verify database updates: `SELECT * FROM content_assets WHERE asset_status IN ('Sent', 'Failed');`
- [ ] Test each email provider separately
- [ ] Monitor workflow executions for 24 hours after activation

---

## ⚠️ CRITICAL SECURITY FIXES

### **Issue: N8N Not Using Database API Keys**
If you imported the workflow and see:
- MailerLite showing "Generic Credential Type" or "Upload Post Credentials"
- Brevo showing "None" authentication  
- MailChimp using stored credentials

**IMMEDIATE ACTION REQUIRED:**

1. **For ALL email provider nodes (MailerLite, MailChimp, Brevo):**
   - Set **Authentication** to **"None"**
   - Go to **Options** → **Headers** 
   - Add the Authorization header manually:

2. **MailerLite Headers:**
   ```
   Authorization: Bearer {{ $('Get Email Credentials').item.json.email_config.api_key }}
   Content-Type: application/json
   ```

3. **MailChimp Headers:**
   ```
   Authorization: apikey {{ $('Get Email Credentials').item.json.email_config.api_key }}
   Content-Type: application/json
   ```

4. **Brevo Headers:**
   ```
   api-key: {{ $('Get Email Credentials').item.json.email_config.api_key }}
   Content-Type: application/json
   ```

**🔒 Why This Matters:**
- **Current setup** = Uses hardcoded/stored credentials (SECURITY RISK)
- **Fixed setup** = Uses database-retrieved API keys (SECURE)

---

## 🔧 Common Issues & Solutions

### **Issue 1: "Business email configuration not found"**
**Solution:** Verify the business record has email configuration:
```sql
SELECT email_provider, email_secret_id, email_sender_name, email_sender_email 
FROM businesses WHERE id = 'your-business-id';
```

### **Issue 2: "Unable to retrieve email API key"**
**Solution:** Check RPC function exists and permissions:
```sql
-- Test the RPC function
SELECT get_email_secret('your-business-id');
```

### **Issue 3: N8N workflow fails with "Unauthorized access"**
**Solution:** Verify environment variables in N8N match `.env.local`

### **Issue 4: Emails not being sent**
**Solution:** Check if content_assets query returns results:
```sql
SELECT * FROM content_assets 
WHERE asset_scheduled_at < NOW() 
AND asset_status = 'Scheduled' 
AND content_type = 'email';
```

### **Issue 5: Provider-specific API errors**
**Solutions:**
- **MailerLite:** Verify API key has campaign permissions
- **MailChimp:** Check if list_id is valid and accessible
- **Brevo:** Ensure sender email is verified in Brevo account

---

## 🔗 Related Documentation

- **[Email Integration PRD](./prd-mailerlite.md)** - Complete email integration setup
- **[Email Integration Technical Spec](./email-integration-technical-spec.md)** - Implementation details
- **[HeyGen Integration](./heygen-rollout.md)** - Reference vault pattern

---

## 🔧 AI Implementation Guide (PRD)

### **Step-by-Step Implementation for AI**

This section provides complete implementation instructions that an AI can follow to build this system from scratch.

#### **Phase 1: Prerequisites Verification**

**1.1 Check Database Schema**
```sql
-- Verify content_assets table exists with required columns
\d content_assets;

-- Check for required columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'content_assets' 
AND column_name IN ('content_type', 'asset_status', 'asset_scheduled_at', 'content_id', 'headline', 'content', 'error_message');

-- Verify businesses table has email columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'businesses' 
AND column_name IN ('email_provider', 'email_secret_id', 'email_sender_name', 'email_sender_email', 'email_selected_group_id');
```

**1.2 Verify RPC Function Exists**
```sql
-- Check if get_email_secret function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'get_email_secret';

-- Test the function (replace with actual business_id)
SELECT get_email_secret('your-test-business-id');
```

#### **Phase 2: API Endpoint Creation**

**2.1 Create Directory Structure**
```bash
# From project root
mkdir -p app/api/n8n/email-credentials
```

**2.2 Create API Route File**

Create `app/api/n8n/email-credentials/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client with service role key for N8N
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    // 1. Secure the endpoint with N8N secret
    const callbackSecret = process.env.N8N_CALLBACK_SECRET;
    const authHeader = req.headers.get('authorization');
    
    console.log('N8N Email Credentials API called');
    console.log('Auth header present:', !!authHeader);
    
    if (!callbackSecret || authHeader !== `Bearer ${callbackSecret}`) {
      console.error('Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // 2. Parse the request body
    const { business_id } = await req.json();
    console.log('Business ID requested:', business_id);

    if (!business_id) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // 3. Get business email configuration
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select(`
        email_provider,
        email_secret_id,
        email_sender_name,
        email_sender_email,
        email_selected_group_id,
        email_selected_group_name
      `)
      .eq('id', business_id)
      .single();

    if (businessError || !business) {
      console.error('Error fetching business email configuration:', businessError);
      return NextResponse.json(
        { error: 'Business email configuration not found' },
        { status: 404 }
      );
    }

    console.log('Business email config found:', {
      provider: business.email_provider,
      has_secret_id: !!business.email_secret_id,
      sender_email: business.email_sender_email
    });

    if (!business.email_provider || !business.email_secret_id) {
      return NextResponse.json(
        { error: 'Email integration not configured for this business' },
        { status: 400 }
      );
    }

    // 4. Retrieve the API key from vault using RPC function
    const { data: apiKey, error: secretError } = await supabase.rpc('get_email_secret', {
      p_business_id: business_id
    });

    if (secretError || !apiKey) {
      console.error('Error retrieving email API key:', secretError);
      return NextResponse.json(
        { error: 'Unable to retrieve email API key' },
        { status: 500 }
      );
    }

    console.log('API key retrieved successfully');

    // 5. Return email configuration for N8N
    return NextResponse.json({
      success: true,
      email_config: {
        provider: business.email_provider,
        api_key: apiKey, // Decrypted API key from vault
        sender_name: business.email_sender_name,
        sender_email: business.email_sender_email,
        selected_group_id: business.email_selected_group_id,
        selected_group_name: business.email_selected_group_name,
      },
      business_id: business_id,
    });

  } catch (error) {
    console.error('Email credentials API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**2.3 Update Environment Variables**

Add to `.env.local`:
```env
# N8N Integration
N8N_CALLBACK_SECRET=your-secure-random-string-here

# Existing Supabase vars (verify these exist)
NEXT_PUBLIC_SUPABASE_URL=https://mmodhofduvuyifwlsrmh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**2.4 Generate Secure Secret**
```bash
# Generate a secure random string for N8N_CALLBACK_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### **Phase 3: API Testing**

**3.1 Start Development Server**
```bash
npm run dev
# Verify server starts on http://localhost:3000
```

**3.2 Test API Endpoint**

Create test file `test-n8n-api.js`:
```javascript
const testAPI = async () => {
  const response = await fetch('http://localhost:3000/api/n8n/email-credentials', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-secure-random-string-here',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      business_id: 'your-test-business-id'
    })
  });
  
  const data = await response.json();
  console.log('Status:', response.status);
  console.log('Response:', data);
};

testAPI();
```

Run test:
```bash
node test-n8n-api.js
```

**Expected Success Response:**
```json
{
  "success": true,
  "email_config": {
    "provider": "mailerlite",
    "api_key": "ml-xxx-decrypted-key",
    "sender_name": "Your Business",
    "sender_email": "hello@yourbusiness.com",
    "selected_group_id": "123456",
    "selected_group_name": "Newsletter"
  },
  "business_id": "your-business-id"
}
```

#### **Phase 4: N8N Configuration**

**4.1 Configure N8N Environment Variables**

In N8N Settings → Environment → Variables, add:
```
SUPABASE_REST_URL=https://mmodhofduvuyifwlsrmh.supabase.co/rest/v1
SUPABASE_ANON_KEY=your-anon-key
N8N_CALLBACK_SECRET=your-secure-random-string-here
```

**4.2 Import Workflow**

1. Download `docs/n8n-email-workflow.json`
2. In N8N, go to Workflows → Import from File
3. Select the JSON file
4. Click Import

**4.3 Domain Configuration**

**For N8N Pro/Enterprise (Environment Variables):**
1. ✅ **No manual URL changes needed**
2. ✅ **Uses** `{{ $env.NEXT_PUBLIC_APP_DOMAIN }}/api/n8n/email-credentials`
3. ✅ **Automatically switches** between development and production domains

**For N8N Lower Plans (Hardcoded URLs):**
1. 📁 **Development**: Use `n8n-email-workflow-dev.json` with `https://rested-monthly-boar.ngrok-free.app`
2. 📁 **Production**: Use `n8n-email-workflow-prod.json` with `https://app2.transformo.io`
3. ⚠️ **Manual Step**: Update Authorization header with your actual `N8N_CALLBACK_SECRET`

#### **Phase 5: Database Test Data**

**5.1 Create Test Content**
```sql
-- Insert test content record
INSERT INTO content (id, business_id, content_title)
VALUES (
  'test-content-id',
  'your-business-id',
  'Test Email Campaign'
);

-- Insert test email asset
INSERT INTO content_assets (
  id,
  content_type,
  asset_status,
  asset_scheduled_at,
  content_id,
  headline,
  content
) VALUES (
  'test-asset-id',
  'email',
  'Scheduled',
  NOW() - INTERVAL '1 minute',
  'test-content-id',
  'Test Email Subject',
  '<h1>Test Email</h1><p>This is a test email content.</p>'
);
```

**5.2 Verify Test Data**
```sql
-- Check scheduled emails query
SELECT ca.*, c.business_id, c.content_title
FROM content_assets ca
JOIN content c ON ca.content_id = c.id
WHERE ca.asset_scheduled_at < NOW()
AND ca.asset_status = 'Scheduled'
AND ca.content_type = 'email';
```

#### **Phase 6: End-to-End Testing**

**6.1 Manual N8N Execution**

1. In N8N workflow, click "Execute Workflow"
2. Watch execution flow in real-time
3. Check each node output

**6.2 Verify Database Updates**
```sql
-- Check if email status was updated
SELECT * FROM content_assets 
WHERE id = 'test-asset-id';

-- Should show asset_status = 'Sent' and asset_published_at timestamp
```

**6.3 Check Email Provider**

- **MailerLite:** Login to dashboard, check Campaigns
- **MailChimp:** Check Campaigns section
- **Brevo:** Check Email Campaigns

#### **Phase 7: Production Deployment**

**7.1 Environment Variables for Production**
```env
# Production .env.local
N8N_CALLBACK_SECRET=different-secure-string-for-production
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key
```

**7.2 Update N8N Production Domain**

**For N8N Pro/Enterprise (Environment Variables):**
In N8N Environment Variables, change:
`NEXT_PUBLIC_APP_DOMAIN=https://app2.transformo.io`
**✅ No workflow changes needed** - the URL automatically updates!

**For N8N Lower Plans (Hardcoded URLs):**
1. Delete/deactivate the development workflow
2. Import the production workflow from `docs/n8n-email-workflow-prod.json`
3. Update Authorization header with your production `N8N_CALLBACK_SECRET`

**7.3 Activate Workflow**

1. In N8N, switch workflow status to "Active"
2. Set execution log level to "Info" for monitoring
3. Workflow will now run every 5 minutes automatically

#### **Phase 8: Monitoring & Validation**

**8.1 Create Monitoring Queries**
```sql
-- Daily email sending stats
SELECT 
  asset_status,
  COUNT(*) as count,
  DATE(COALESCE(asset_published_at, updated_at)) as date
FROM content_assets 
WHERE content_type = 'email'
AND DATE(COALESCE(asset_published_at, updated_at)) >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY asset_status, DATE(COALESCE(asset_published_at, updated_at))
ORDER BY date DESC, asset_status;

-- Failed emails for debugging
SELECT ca.*, c.business_id, c.content_title
FROM content_assets ca
JOIN content c ON ca.content_id = c.id
WHERE ca.asset_status = 'Failed'
AND ca.content_type = 'email'
ORDER BY ca.updated_at DESC
LIMIT 10;
```

**8.2 N8N Execution Monitoring**

Check N8N Executions tab regularly for:
- ✅ Successful executions (every 5 minutes)
- ❌ Failed executions
- ⚠️ Warning messages

**8.3 Log Monitoring**

Monitor application logs for:
```
"N8N Email Credentials API called"
"Business email config found"
"API key retrieved successfully"
```

#### **Phase 9: Troubleshooting Checklist**

**9.1 Common Error Resolutions**

| Error | Cause | Solution |
|-------|-------|----------|
| "Unauthorized access" | Wrong N8N secret | Check N8N_CALLBACK_SECRET matches |
| "Business email configuration not found" | Missing business record | Verify business_id in database |
| "Unable to retrieve email API key" | RPC function issue | Check get_email_secret() function |
| "Credentials not found" | N8N variables missing | Verify N8N environment variables |

**9.2 Validation Commands**

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/n8n/email-credentials \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"business_id":"your-business-id"}'

# Check N8N environment variables
echo $SUPABASE_REST_URL
echo $N8N_CALLBACK_SECRET
```

**9.3 Database Validation**
```sql
-- Verify all components exist
SELECT 'content_assets table' as component, COUNT(*) as count FROM content_assets
UNION ALL
SELECT 'businesses with email config', COUNT(*) FROM businesses WHERE email_provider IS NOT NULL
UNION ALL
SELECT 'get_email_secret function', CASE WHEN EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_email_secret') THEN 1 ELSE 0 END;
```

### **Implementation Complete ✅**

Your N8N email sending integration is now fully implemented with:
- ✅ Secure API endpoint for credential retrieval
- ✅ Database-driven email scheduling
- ✅ Multi-provider support (MailerLite, MailChimp, Brevo)
- ✅ Comprehensive error handling
- ✅ Production monitoring capabilities

---

**✅ This polling-based approach provides a robust, secure, and scalable email sending system that integrates seamlessly with your existing email integration infrastructure.**