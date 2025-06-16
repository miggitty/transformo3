# N8N Integration with Local Supabase - Best Practices

## Architecture Overview

This document defines the best practices for integrating N8N workflows with Supabase across different environments (local, staging, production). The core principle is **direct database connections** per environment using **N8N environment variables** for configuration management.

## Environment Architecture

### Core Principle: Single Workflow + Environment Variables
```
LOCAL:      N8N Cloud (local env vars) → ngrok tunnel → Local Supabase (127.0.0.1:54321)
STAGING:    N8N Cloud (staging env vars) → Direct HTTPS → Staging Supabase
PRODUCTION: N8N Cloud (production env vars) → Direct HTTPS → Production Supabase
```

### Why This Architecture?
- **Performance**: No extra HTTP hops
- **Reliability**: Fewer points of failure
- **Scalability**: No load on app servers
- **Industry Standard**: Used by Netflix, Uber, Airbnb
- **Separation of Concerns**: Background processing isolated from web app
- **Single Source of Truth**: One workflow file with environment-specific configurations
- **Easy Deployment**: Update environment variables, not workflow files

## Environment Configuration

### Next.js App Environment Variables

#### Local Development
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# N8N Integration
NEXT_PUBLIC_APP_URL=https://your-ngrok-url.ngrok-free.app
N8N_WEBHOOK_URL_CONTENT_CREATION=https://enzango.app.n8n.cloud/webhook/content-creation
N8N_CALLBACK_SECRET=your-callback-secret
```

#### Staging Environment
```bash
# .env.staging
NEXT_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging_anon_key...
SUPABASE_SERVICE_ROLE_KEY=staging_service_role_key...

NEXT_PUBLIC_APP_URL=https://staging.your-app.com
N8N_WEBHOOK_URL_CONTENT_CREATION=https://enzango.app.n8n.cloud/webhook/content-creation
N8N_CALLBACK_SECRET=your-callback-secret
```

#### Production Environment
```bash
# .env.production
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=production_anon_key...
SUPABASE_SERVICE_ROLE_KEY=production_service_role_key...

NEXT_PUBLIC_APP_URL=https://your-app.com
N8N_WEBHOOK_URL_CONTENT_CREATION=https://enzango.app.n8n.cloud/webhook/content-creation
N8N_CALLBACK_SECRET=your-callback-secret
```

### N8N Environment Variables

#### Local Development
```bash
# N8N Local Environment Variables
SUPABASE_URL=https://your-ngrok-url.ngrok-free.app:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CALLBACK_URL=https://your-ngrok-url.ngrok-free.app/api/n8n/callback
CALLBACK_SECRET=your-callback-secret
ENVIRONMENT=local
```

#### Staging Environment
```bash
# N8N Staging Environment Variables
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_ANON_KEY=staging_anon_key...
SUPABASE_SERVICE_ROLE_KEY=staging_service_role_key...
CALLBACK_URL=https://staging.your-app.com/api/n8n/callback
CALLBACK_SECRET=your-callback-secret
ENVIRONMENT=staging
```

#### Production Environment
```bash
# N8N Production Environment Variables
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_ANON_KEY=production_anon_key...
SUPABASE_SERVICE_ROLE_KEY=production_service_role_key...
CALLBACK_URL=https://your-app.com/api/n8n/callback
CALLBACK_SECRET=your-callback-secret
ENVIRONMENT=production
```

## N8N Workflow Configuration

### Single Workflow with Environment Variables
Use **one workflow file** that references environment variables:

```json
{
  "nodes": [
    {
      "name": "Create Content Asset",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/rest/v1/content_assets?on_conflict=content_id,content_type",
        "method": "POST",
        "headers": {
          "apikey": "={{$env.SUPABASE_ANON_KEY}}",
          "Authorization": "Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}",
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=representation"
        },
        "body": {
          "content_id": "={{$json.contentId}}",
          "content_type": "={{$json.assetType}}",
          "headline": "={{$json.headline}}",
          "content": "={{$json.content}}",
          "asset_status": "Draft"
        }
      }
    },
    {
      "name": "Callback to App",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "={{$env.CALLBACK_URL}}",
        "method": "POST",
        "headers": {
          "Content-Type": "application/json",
          "x-n8n-callback-secret": "={{$env.CALLBACK_SECRET}}"
        },
        "body": {
          "contentId": "={{$json.contentId}}",
          "success": true,
          "environment": "={{$env.ENVIRONMENT}}",
          "data": "={{$json}}"
        }
      }
    }
  ]
}
```

### Naming Convention
```
Workflow Files:
- n8n-workflows/content-creation.json
- n8n-workflows/email-processing.json
- n8n-workflows/heygen-video.json

Environment Configs:
- n8n-workflows/environment-configs/local.env
- n8n-workflows/environment-configs/staging.env
- n8n-workflows/environment-configs/production.env
```

## File Structure for N8N Workflows

```
project-root/
├── n8n-workflows/
│   ├── README.md
│   ├── content-creation.json           # Single workflow file
│   ├── email-processing.json           # Single workflow file
│   ├── heygen-video.json              # Single workflow file
│   ├── social-media-automation.json   # Single workflow file
│   └── environment-configs/
│       ├── local.env                  # Local N8N environment variables
│       ├── staging.env                # Staging N8N environment variables
│       ├── production.env             # Production N8N environment variables
│       └── README.md                  # Environment setup instructions
├── app/api/n8n/
│   ├── callback/
│   │   └── route.ts
│   └── [workflow-name]/
│       └── route.ts
└── .cursor/rules/
    └── n8n-integration-local-supabase.md
```

## Next.js API Routes for N8N Integration

### Callback Route Pattern
```typescript
// app/api/n8n/callback/route.ts
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Verify N8N callback secret
    const callbackSecret = request.headers.get('x-n8n-callback-secret');
    if (callbackSecret !== process.env.N8N_CALLBACK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contentId, success, error, data, environment } = body;

    // Log the callback for debugging
    console.log(`N8N callback received from ${environment}:`, {
      contentId,
      success,
      error: error || 'none'
    });

    const supabase = await createClient();
    
    // Update content based on N8N callback
    const { error: updateError } = await supabase
      .from('content')
      .update({ 
        status: success ? 'completed' : 'error',
        error_message: error || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', contentId);

    if (updateError) {
      console.error('Error updating content:', updateError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('N8N callback error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### Workflow Trigger Route Pattern
```typescript
// app/api/n8n/content-creation/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL_CONTENT_CREATION;
  
  if (!webhookUrl) {
    return NextResponse.json({ error: 'Webhook URL not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    
    // Add callback information for N8N to call back
    const payload = {
      ...body,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET
    };

    console.log(`Triggering N8N workflow: ${webhookUrl}`);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`N8N webhook failed [${response.status}]:`, errorText);
      return NextResponse.json({ error: 'N8N webhook failed' }, { status: response.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('N8N trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## Server Actions Pattern

### N8N Integration in Server Actions
```typescript
// app/(app)/content/[id]/actions.ts
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function triggerContentCreation(payload: ContentCreationPayload) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL_CONTENT_CREATION;
  
  if (!webhookUrl) {
    return { success: false, error: 'N8N webhook not configured' };
  }

  try {
    // Add environment-specific callback information
    const enrichedPayload = {
      ...payload,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET,
      environment: process.env.NODE_ENV
    };

    console.log('Triggering N8N content creation workflow...');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('N8N webhook failed:', errorText);
      return { success: false, error: `N8N webhook failed: ${response.statusText}` };
    }

    return { success: true };
  } catch (error) {
    console.error('N8N integration error:', error);
    return { success: false, error: 'Failed to trigger N8N workflow' };
  }
}
```

## Environment Variable Management

### Required Environment Variables

#### Next.js App (.env files)
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# N8N Integration
N8N_CALLBACK_SECRET=
N8N_API_KEY=

# Workflow-Specific Webhooks (same across environments)
N8N_WEBHOOK_URL_CONTENT_CREATION=
N8N_WEBHOOK_URL_EMAIL_PROCESSING=
N8N_WEBHOOK_URL_HEYGEN_VIDEO=
N8N_WEBHOOK_URL_SOCIAL_MEDIA=

# App Configuration
NEXT_PUBLIC_APP_URL=
```

#### N8N Environment Variables
```bash
# Supabase Connection (environment-specific)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Callback Configuration (environment-specific)
CALLBACK_URL=
CALLBACK_SECRET=

# Environment Identification
ENVIRONMENT=local|staging|production
```

### Environment Variable Validation
```typescript
// lib/env-validation.ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  N8N_CALLBACK_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  N8N_WEBHOOK_URL_CONTENT_CREATION: z.string().url(),
});

export const validateEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  return result.data;
};
```

## Local Development Setup

### 1. Start Local Supabase
```bash
supabase start
```

### 2. Start ngrok tunnel
```bash
ngrok http 3000
# Update NEXT_PUBLIC_APP_URL in .env.local with ngrok URL
# Update CALLBACK_URL in N8N local environment variables
```

### 3. Configure N8N Environment Variables
```bash
# In N8N interface, set environment variables for local development:
SUPABASE_URL=https://your-ngrok-url.ngrok-free.app:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
CALLBACK_URL=https://your-ngrok-url.ngrok-free.app/api/n8n/callback
CALLBACK_SECRET=your-callback-secret
ENVIRONMENT=local
```

### 4. Import Workflow
- Import the single workflow file (e.g., `content-creation.json`)
- Workflow will automatically use the environment variables

### 5. Test Integration
```bash
npm run dev
# Test webhook endpoints
curl -X POST http://localhost:3000/api/n8n/content-creation \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

## Deployment Strategy

### 1. Environment Promotion Workflow
```bash
# Step 1: Test locally
npm run dev
# Verify workflow works with local N8N environment variables

# Step 2: Deploy to staging
git push origin staging
# Update N8N staging environment variables
# Test staging workflow

# Step 3: Deploy to production  
git push origin main
# Update N8N production environment variables
# Deploy production workflow
```

### 2. N8N Environment Variable Management
```bash
# Local → Staging
1. Export workflow from N8N (same file)
2. Update N8N staging environment variables:
   - SUPABASE_URL → staging Supabase URL
   - SUPABASE_ANON_KEY → staging key
   - SUPABASE_SERVICE_ROLE_KEY → staging key
   - CALLBACK_URL → staging callback URL
   - ENVIRONMENT → "staging"

# Staging → Production
1. Same workflow file (no changes needed)
2. Update N8N production environment variables:
   - SUPABASE_URL → production Supabase URL
   - SUPABASE_ANON_KEY → production key
   - SUPABASE_SERVICE_ROLE_KEY → production key
   - CALLBACK_URL → production callback URL
   - ENVIRONMENT → "production"
```

### 3. Version Control Best Practices
```bash
# Keep workflow files in version control
git add n8n-workflows/content-creation.json
git commit -m "Update content creation workflow"

# Keep environment configs as templates (no secrets)
git add n8n-workflows/environment-configs/local.env.template
git add n8n-workflows/environment-configs/staging.env.template
git add n8n-workflows/environment-configs/production.env.template
```

## Common Patterns

### ✅ DO: Single Workflow + Environment Variables
```json
{
  "url": "={{$env.SUPABASE_URL}}/rest/v1/table_name",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer {{$env.SUPABASE_SERVICE_ROLE_KEY}}"
  }
}
```

### ❌ DON'T: Separate Workflow Files per Environment
```
content-creation-local.json
content-creation-staging.json  
content-creation-production.json
```

### ✅ DO: Environment-Specific N8N Variables
```bash
# N8N Environment Variables
SUPABASE_URL={{environment_specific_url}}
SUPABASE_SERVICE_ROLE_KEY={{environment_specific_key}}
```

### ❌ DON'T: Hardcoded Values in Workflows
```json
{
  "url": "https://hardcoded-project.supabase.co/rest/v1/table_name",
  "headers": {
    "Authorization": "Bearer hardcoded_key_123..."
  }
}
```

### ✅ DO: Callback with Environment Context
```json
{
  "body": {
    "contentId": "={{$json.contentId}}",
    "success": true,
    "environment": "={{$env.ENVIRONMENT}}",
    "timestamp": "={{new Date().toISOString()}}"
  }
}
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use N8N environment variables** for all credentials
3. **Validate callback secrets** for webhook security
4. **Use HTTPS** for all external communications
5. **Implement rate limiting** on webhook endpoints
6. **Rotate credentials regularly** across environments
7. **Audit N8N access logs** for security monitoring

## Monitoring and Logging

### Error Handling Pattern
```typescript
try {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`N8N webhook failed [${response.status}]:`, errorBody);
    
    // Log to monitoring service with environment context
    await logError({
      service: 'n8n-integration',
      workflow: 'content-creation',
      environment: process.env.NODE_ENV,
      error: errorBody,
      status: response.status,
      payload: payload
    });
    
    return { success: false, error: `Webhook failed: ${response.statusText}` };
  }

  return { success: true };
} catch (error) {
  console.error('N8N integration error:', error);
  
  // Log to monitoring service
  await logError({
    service: 'n8n-integration',
    workflow: 'content-creation',
    environment: process.env.NODE_ENV,
    error: error.message,
    payload: payload
  });
  
  return { success: false, error: 'Network error occurred' };
}
```

### N8N Workflow Logging
```json
{
  "name": "Log Execution",
  "type": "n8n-nodes-base.set",
  "parameters": {
    "values": {
      "string": [
        {
          "name": "execution_id",
          "value": "={{$workflow.id}}-={{$execution.id}}"
        },
        {
          "name": "environment", 
          "value": "={{$env.ENVIRONMENT}}"
        },
        {
          "name": "timestamp",
          "value": "={{new Date().toISOString()}}"
        }
      ]
    }
  }
}
```

## Testing Strategy

### 1. Local Testing
- Use ngrok for external webhook testing
- Test all database operations with local Supabase
- Verify callback functionality
- Test environment variable resolution

### 2. Staging Testing
- Deploy to staging environment
- Update N8N staging environment variables
- Test complete end-to-end workflow
- Verify staging database operations

### 3. Production Readiness
- Load test webhook endpoints
- Monitor error rates across environments
- Set up alerting for failures
- Verify credential rotation procedures

## Benefits of This Architecture

1. **🔄 Single Source of Truth**: One workflow file to maintain
2. **🚀 Rapid Deployment**: Update environment variables, not workflow logic
3. **🔒 Enhanced Security**: Credentials managed centrally in N8N
4. **⚡ Quick Environment Switching**: Change variables, not code
5. **👥 Team Collaboration**: Developers work with same workflow file
6. **🛡️ No Credential Leakage**: Secrets never in version control
7. **📊 Environment Visibility**: Clear environment context in all operations
8. **🔧 Easy Maintenance**: Update logic once, deploy everywhere

This architecture ensures scalable, maintainable, and secure N8N integrations while following industry best practices for multi-environment deployments. 
This architecture ensures scalable, maintainable, and performant N8N integrations while following industry best practices. 