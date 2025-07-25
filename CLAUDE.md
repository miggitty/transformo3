# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Transformo3 is a Next.js 15 SaaS application for transforming audio content into multiple formats. The app uses Supabase for authentication, database, and storage, with Stripe for payments and N8N for workflow automation.

## Critical Commands

```bash
# Development
npm run dev                    # Start development server with Turbopack
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Run ESLint

# Database
npm run db:reset               # Reset and seed database (destructive)
npm run db:migrate             # Push migrations to remote database
npm run db:migrate:local       # Push migrations to local database

# Supabase (local development)
npx supabase start             # Start local Supabase instance
npx supabase stop              # Stop local Supabase instance
npx supabase db reset          # Reset local database
npx supabase db push           # Push migrations to local database
```

## Architecture & Patterns

### Business-Centric Authentication
- Users belong to businesses via `profiles` table (`profiles.id = user_id`, `profiles.business_id = business_id`)
- All features are scoped to the active business context
- Business switching handled via URL parameter `/app?business_id=xxx`
- Row Level Security (RLS) policies enforce business-level access

### Server Components & Actions
- Use React Server Components by default
- Mark interactive components with `"use client"`
- Server actions in `app/actions/` or inline for mutations
- Always validate business access in server actions:
```typescript
const user = await authenticateUser();
const hasAccess = await userHasAccessToBusiness(user.id, businessId);
```

### Middleware Access Control
The middleware (`middleware.ts`) handles:
1. Authentication check for protected routes
2. Subscription validation for paid features
3. Business context validation

### Database Patterns
- Use transactions for multi-table operations
- API keys stored in vault (via stored procedures)
- Real-time subscriptions for live updates
- Always include business_id in queries

## Git Workflow (CRITICAL)

Follow these exact steps for all changes:

```bash
# 1. Start from clean main branch
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Make changes and commit
git add .
git commit -m "feat: description"  # Use conventional commits

# 4. Push and create PR
git push -u origin feature/your-feature-name
# Create PR from feature branch to main

# 5. After PR approval/merge
git checkout main
git pull origin main
git branch -d feature/your-feature-name  # Clean up local branch

# 6. Sync other branches if needed
git checkout development-4
git merge main
git push origin development-4
```

**NEVER commit directly to main or development-4**

## Common Tasks

### Adding a New Page
1. Create route in `app/(app)/[feature]/page.tsx`
2. Add to navigation in `components/shared/app-sidebar.tsx` if needed
3. Implement access control in middleware if restricted

### Adding an Integration
1. Add integration config to `types/integrations.ts`
2. Create settings UI in `app/(app)/settings/integrations/`
3. Add database table for integration data
4. Implement connection flow with proper error handling

### File Upload Pattern
1. Use `components/shared/dropzone-upload.tsx` as base
2. Upload to Supabase Storage
3. Store metadata in database with business_id
4. Set proper bucket RLS policies

### Adding Database Migrations
```bash
# Create new migration
npx supabase migration new migration_name

# Edit the migration file in supabase/migrations/
# Test locally first
npm run db:migrate:local

# Apply to remote
npm run db:migrate
```

### Security Implementation
When implementing new features:
1. **Add business authorization** to all server actions and API routes
2. **Sanitize HTML content** using `SafeHtml` component or `sanitizeRichHTML` function
3. **Validate file uploads** server-side with proper MIME type and size checks
4. **Add rate limiting** to sensitive endpoints
5. **Use HMAC signatures** for webhook endpoints

## Testing Checklist

While no automated tests exist, manually verify:
- [ ] Authentication flows work correctly
- [ ] Business context switches properly
- [ ] Subscription gates function as expected
- [ ] Server actions validate business access
- [ ] HTML content is properly sanitized (no XSS)
- [ ] File uploads validate MIME types and sizes
- [ ] API routes require proper authentication
- [ ] No debug endpoints or hardcoded secrets
- [ ] CSP headers don't block legitimate resources
- [ ] UI works on mobile viewports
- [ ] No console errors in development
- [ ] Environment variables are set correctly

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=
EMAIL_FROM=
N8N_WORKFLOW_URL=
```

## Key Architecture Decisions

1. **No Redux/Zustand**: Server state via RSC, client state via React Context
2. **Business Scoping**: Every feature is scoped to active business
3. **Subscription Model**: Features gated by subscription tier
4. **File Storage**: All uploads go to Supabase Storage with proper RLS
5. **API Keys**: Stored encrypted in vault, accessed via stored procedures
6. **Content Generation**: Async via N8N webhooks with callback pattern

## Important Patterns to Follow

### Error Handling
```typescript
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: 'User-friendly error message' };
}
```

### Form Validation
Use Zod schemas with React Hook Form:
```typescript
const schema = z.object({
  field: z.string().min(1, "Required"),
});
type FormData = z.infer<typeof schema>;
```

### Loading States
Use Suspense boundaries with loading.tsx files or pending states from useFormStatus.

## Security Considerations

### Critical Security Patterns
1. **Business Access Validation**: Always validate user access to business resources:
   ```typescript
   const user = await authenticateUser();
   const hasAccess = await userHasAccessToBusiness(user.id, businessId);
   if (!hasAccess) throw new Error('Unauthorized');
   ```

2. **API Route Authentication**: Use proper authentication for API routes:
   ```typescript
   import { authenticateApiRequest } from '@/lib/api-auth-helpers';
   const { user, error } = await authenticateApiRequest(request);
   if (error) return error;
   ```

3. **HTML Sanitization**: Always sanitize user-generated HTML content:
   ```typescript
   import { sanitizeRichHTML } from '@/lib/sanitize-html';
   import SafeHtml from '@/components/shared/safe-html';
   
   // Use SafeHtml component instead of dangerouslySetInnerHTML
   <SafeHtml html={content} className="prose" />
   ```

4. **File Upload Security**: Validate files server-side:
   ```typescript
   import { validateFile } from '@/lib/file-validation';
   await validateFile(file, 'image'); // Validates MIME type, size, content
   ```

5. **Webhook Security**: Validate webhook signatures:
   ```typescript
   import { validateWebhookRequest } from '@/lib/webhook-security';
   const validation = await validateWebhookRequest(request, body, secret);
   if (!validation.valid) return 401;
   ```

### Security Headers
- CSP headers configured in `lib/security-headers.ts`
- Applied via middleware for all responses
- Development-specific CSP allows local Supabase, ngrok tunnels

### Essential Security Rules
- Never expose debug endpoints in production
- Store all secrets in environment variables only
- Use RLS policies for database access control
- Rate limit authentication endpoints
- Validate all user inputs server-side

## Debugging Tips

1. Check Supabase logs: `npx supabase logs --local`
2. Use `console.log` in server actions (appears in terminal)
3. Check browser Network tab for API failures
4. Verify RLS policies with `select * from table_name` in Supabase dashboard
5. For auth issues, check middleware.ts logic

## Performance Considerations

1. Use dynamic imports for heavy components
2. Implement pagination for large lists
3. Optimize images with Next.js Image component
4. Use Suspense for async components
5. Cache expensive operations with React cache()

## N8N Workflow Integration

Workflows are triggered via webhook with callback pattern:
```typescript
await callN8nWorkflow(workflowUrl, {
  ...data,
  callback_url: `${APP_URL}/api/webhooks/n8n/[endpoint]`
});
```

The workflow must POST back to the callback URL with results.