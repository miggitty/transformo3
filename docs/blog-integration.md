# Blog Integration PRD

## Overview

This document outlines the requirements for integrating blog platform functionality into the Transformo3 application. The blog integration will allow users to connect their blog platforms (WordPress, Wix, and future additions) to automatically publish blog posts and upload featured images through our platform.

## Objectives

- Enable users to connect their blog platforms to Transformo3
- Support multiple blog providers (WordPress, Wix, with extensibility for more)
- Store blog platform credentials securely using Supabase Vault (following Email integration pattern)
- Validate connection details for blog platforms so n8n can publish blog posts
- Automatically detect and validate blog site URLs
- Provide a user-friendly interface for blog platform management with provider selection
- Maintain compatibility with existing integration infrastructure

## Current Integration Patterns Analysis

Based on existing integrations (Email and HeyGen), our blog integration should follow these established patterns, with particular similarity to the Email integration's provider selection pattern:

### Database Schema Pattern
- Store non-sensitive configuration in `businesses` table
- Store API keys/passwords in Supabase Vault using RPC functions
- Use `*_secret_id` fields to reference vault entries
- Include validation timestamps for connection status

### UI/UX Pattern
- Card-based layout in integrations page
- Form validation using Zod schemas
- Toast notifications for user feedback
- "Remove" functionality for stored credentials
- Hide/show API key inputs based on connection status

### Backend Pattern
- Server actions in `app/actions/settings.ts`
- API routes for validation and external API calls
- Proper error handling and user feedback
- Revalidation of affected pages after updates

## Technical Requirements

### 1. Database Schema Changes

#### Add Blog Integration fields to `businesses` table:
```sql
-- Migration: YYYYMMDDHHMMSS_add-blog-integration.sql
ALTER TABLE businesses 
ADD COLUMN blog_provider text,
ADD COLUMN blog_secret_id uuid REFERENCES vault.secrets(id),
ADD COLUMN blog_site_url text,
ADD COLUMN blog_username text, -- Only used for WordPress
ADD COLUMN blog_site_name text,
ADD COLUMN blog_validated_at timestamp with time zone;

-- Add constraint for supported blog providers
ALTER TABLE businesses 
ADD CONSTRAINT businesses_blog_provider_check 
CHECK (blog_provider IN ('wordpress', 'wix'));

-- Add constraint that username is required for WordPress only
ALTER TABLE businesses 
ADD CONSTRAINT businesses_blog_username_check 
CHECK (
  (blog_provider = 'wordpress' AND blog_username IS NOT NULL) OR 
  (blog_provider = 'wix') OR 
  (blog_provider IS NULL)
);
```

#### Create Supabase Vault RPC Functions:
```sql
-- Function to set Blog Platform credentials
CREATE OR REPLACE FUNCTION set_blog_key(
  p_business_id uuid,
  p_provider text,
  p_new_username text,
  p_new_credential text
) RETURNS void AS $$
BEGIN
  -- Implementation following set_heygen_key and set_email_key patterns
  -- Store credentials in Supabase Vault (Application Password for WordPress, API key for Wix, etc.)
  -- Update businesses table with blog_secret_id reference
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete Blog Platform credentials
CREATE OR REPLACE FUNCTION delete_blog_key(
  p_business_id uuid
) RETURNS void AS $$
BEGIN
  -- Implementation following delete_heygen_key pattern
  -- Remove credentials from vault
  -- Clear blog_secret_id from businesses table
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Frontend Components

#### Create `components/shared/settings/blog-integration-form.tsx`

**Props Interface:**
```typescript
interface BlogIntegrationFormProps {
  business: Tables<'businesses'>;
}
```

**Form Schema (Following Email Integration Pattern):**
```typescript
const blogSettingsFormSchema = z.object({
  blog_provider: z.enum(['wordpress', 'wix']).optional(),
  blog_username: z.string().min(1, 'Username is required').optional(),
  blog_credential: z.string().optional(), // Application Password for WordPress, API key for Wix
  blog_site_url: z.string().url('Please enter a valid URL').optional(),
}).refine((data) => {
  // If no provider is selected, all fields are optional
  if (!data.blog_provider) return true;
  
  // WordPress requires username, credential, and URL
  if (data.blog_provider === 'wordpress') {
    return data.blog_username && data.blog_credential && data.blog_site_url;
  }
  
  // Wix only requires credential (API key)
  if (data.blog_provider === 'wix') {
    return data.blog_credential;
  }
  
  return true;
}, {
  message: "Please provide all required fields for the selected blog provider.",
  path: ["blog_credential"]
});
```

**Key Features (Following Email Integration Pattern):**
- Provider dropdown (WordPress, Wix) - similar to email provider selection
- Dynamic form fields based on selected provider
- Auto-validation on provider change
- Loading states for validation
- Username field (shown when WordPress provider selected)
- Credential field (hidden when credentials are set, following HeyGen pattern)
- Site URL field with automatic detection and validation (WordPress only)
- "Remove Credentials" button when connected
- "Test Connection" functionality with automatic site info retrieval
- Real-time URL validation and site name detection
- Connection status indicator showing blog platform and site name
- Provider-specific documentation links
- Proper error handling with retry buttons
- Status indicators with visual feedback

**Component Structure:**
```typescript
export function BlogIntegrationForm({ business }: BlogIntegrationFormProps) {
  const [isKeySet, setIsKeySet] = useState(!!business.blog_secret_id);
  const [isValidating, setIsValidating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  
  const selectedProvider = form.watch('blog_provider');
  const credentialValue = form.watch('blog_credential');
  
  // Auto-validation on provider change (following Email integration pattern)
  useEffect(() => {
    if (credentialValue && selectedProvider && !isKeySet && credentialValue.length > 10) {
      const timeoutId = setTimeout(() => {
        validateCredentials(credentialValue, selectedProvider);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [credentialValue, selectedProvider, isKeySet]);
  
  // Form implementation following Email integration pattern
  // Provider-specific field rendering
  // Auto-validation on credential change
  // Credential storage in vault
  // Connection testing functionality
  // Loading states and error handling
}
```

### 3. Backend Implementation

#### Update `app/actions/settings.ts`

**Add Blog Integration Schema:**
```typescript
const blogSettingsFormSchema = z.object({
  blog_provider: z.enum(['wordpress', 'wix']).optional(),
  blog_username: z.string().min(1, 'Username is required').optional(),
  blog_credential: z.string().optional(),
  blog_site_url: z.string().url('Please enter a valid URL').optional(),
});
```

**Add Server Actions:**
```typescript
export async function updateBlogSettings(
  businessId: string,
  formData: z.infer<typeof blogSettingsFormSchema>
);

export async function removeBlogCredentials(businessId: string);

export async function validateBlogConnection(
  provider: 'wordpress' | 'wix',
  credential: string,
  siteUrl?: string, // Required for WordPress only
  username?: string // Required for WordPress only
);

// Note: Publishing is handled by n8n workflows
// No additional server actions needed for publishing
```

#### Create API Route: `app/api/blog-integration/validate/route.ts`

**Purpose:** Validate blog platform credentials and retrieve site information (for form display only)
**Method:** POST
**Payload:**
```typescript
{
  provider: 'wordpress' | 'wix';
  // WordPress fields
  siteUrl?: string; // Required for WordPress only
  username?: string; // Required for WordPress only
  // Universal field
  credential: string; // Application Password for WordPress, API Key for Wix
}
```

**Response:**
```typescript
{
  success: boolean;
  error?: string;
  siteInfo?: {
    name: string;
    description?: string;
    url: string;
    version?: string;
    platform: 'wordpress' | 'wix';
    canPublishPosts: boolean;
    canUploadMedia: boolean;
  };
}
```

**Implementation Details:**
- **WordPress**: Test REST API endpoints (`/wp-json/wp/v2/`), validate Application Password, require manual URL entry
- **Wix**: Use API key to retrieve site information via Wix Sites API, automatically detect website URL
- Return site information for display in the form
- **Note**: Actual blog publishing will be handled by n8n workflows, not direct API calls

### 4. Integration Page Updates

#### Update `app/(app)/settings/integrations/page.tsx`

Add Blog integration card after HeyGen integration:

```typescript
<Card>
  <CardHeader>
    <CardTitle>Blog Integration</CardTitle>
    <CardDescription>
      Connect your blog platform to automatically publish blog posts and content.
    </CardDescription>
  </CardHeader>
  <BlogIntegrationForm business={business} />
</Card>
```

### 5. Blog Platform API Integration

#### Authentication Methods by Provider:

**WordPress** (Application Passwords - WordPress 5.6+)
- User-specific passwords for API access
- Granular permission control
- No additional plugins required
- Secure authentication without exposing main password

**Wix** (API Keys)
- Wix API key authentication (generated from Wix Enterprise dashboard)
- Automatic website URL detection via Wix Sites API
- Access to Wix Blog API endpoints
- No manual URL entry required (API provides site information)

**Integration Scope:**
- Blog platform credentials are validated and stored for n8n access
- n8n handles all publishing workflows using stored credentials
- Integration provides connection validation and credential management only

## User Experience Flow

### 1. Initial Setup (Similar to Email Integration)
1. User navigates to Settings → Integrations
2. Locates "Blog Integration" card
3. Sees form with provider dropdown:
   - **Select Blog Provider**: Dropdown with "WordPress" and "Wix" options
4. After selecting provider, provider-specific fields appear:
   - **WordPress**: Site URL, Username, Application Password
   - **Wix**: API Key only (website URL auto-detected)

### 2. Connection Process
1. User selects blog provider from dropdown
2. Form reveals provider-specific fields
3. User enters credentials:
   - **WordPress**: Manual URL entry, username, and Application Password
   - **Wix**: API Key only (system auto-detects site information)
4. System validates credentials and retrieves site information
5. On success: displays connected status with platform, site name and URL
6. On failure: shows specific error message with platform-specific troubleshooting links

### 3. Post-Connection Experience
1. Form shows connected status with blog platform, site name and URL
2. Credential field is hidden (shows "••••••••••••••••")
3. "Remove Connection" button available
4. Connected site information displayed (platform, name, URL, version if applicable)
5. Last validation timestamp shown
6. Publishing capabilities confirmed (posts and media)

### 4. Documentation Links (Provider-Specific)

Include provider-specific documentation links that appear based on selected provider:

**WordPress Provider:**
- **"How to generate Application Passwords"**: https://wordpress.org/support/article/application-passwords/
- **WordPress REST API Documentation**: https://developer.wordpress.org/rest-api/
- **Help Text**: "Generate an Application Password in your WordPress admin (Users → Profile → Application Passwords). This is more secure than using your main password."

**Wix Provider:**
- **"How to get Wix API Key"**: https://support.wix.com/en/article/wix-enterprise-using-wix-api-keys
- **Wix Blog API Documentation**: https://dev.wix.com/docs/rest/business-solutions/blog
- **Help Text**: "Generate an API key from your Wix Enterprise dashboard (Settings → API Keys). The website URL will be automatically detected."

**General:**
- **Troubleshooting Guide**: Internal documentation for common connection issues

## Security Considerations

### 1. Credential Storage
- Blog platform credentials stored in Supabase Vault (encrypted)
- No plaintext storage of sensitive credentials
- Use UUID references to vault entries
- Automatic cleanup on credential removal
- Provider-specific credential handling (Application Passwords for WordPress, API keys for Wix)

### 2. API Communication
- All blog platform API calls over HTTPS
- Provider-specific authentication headers
- Request/response logging for debugging
- Rate limiting protection
- Platform-specific error handling

### 3. Permission Validation
- Verify user has publishing permissions
- Test specific endpoints during validation
- Clear error messages for permission issues

## Error Handling

### Common Scenarios:
1. **Invalid Site URL**: Clear validation message with URL format examples
2. **Site Not Accessible**: Network connectivity troubleshooting
3. **Invalid Credentials**: Authentication failure guidance
4. **Insufficient Permissions**: Permission requirements explanation
5. **API Unavailable**: WordPress REST API activation guidance
6. **Plugin Conflicts**: Common plugin conflict resolution

### Error Response Format:
```typescript
{
  success: false,
  error: "Human-readable error message",
  errorCode: "SPECIFIC_ERROR_CODE",
  troubleshooting?: {
    title: "How to fix this",
    steps: ["Step 1", "Step 2", "Step 3"],
    documentationUrl: "https://..."
  }
}
```

## Testing Requirements

### 1. Unit Tests
- Form validation logic
- API response handling
- Error message formatting
- Credential storage/retrieval

### 2. Integration Tests
- Self-hosted WordPress connectivity
- Various WordPress versions (5.6+)
- Plugin compatibility testing
- Featured image upload functionality
- Blog post publishing with different statuses

### 3. User Acceptance Testing
- Complete connection flow
- Error handling scenarios
- UI/UX validation
- Cross-browser compatibility

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1)
- Database schema migration
- Supabase Vault RPC functions
- Basic form component structure

### Phase 2: API Integration (Week 2)
- WordPress validation API route
- Connection testing functionality
- Error handling implementation

### Phase 3: UI/UX Polish (Week 3)
- Form validation and feedback
- Connection status indicators
- Documentation links integration

### Phase 4: Testing & Refinement (Week 4)
- Comprehensive testing
- Bug fixes and improvements
- Performance optimization

## Success Metrics

### Technical Metrics:
- Connection success rate > 95%
- Average connection time < 3 seconds
- API response time < 1 second
- Zero credential exposure in logs

### User Experience Metrics:
- Setup completion rate > 80%
- User satisfaction score > 4.5/5
- Support ticket reduction for WordPress issues
- Time to successful connection < 2 minutes

## Migration Notes

When implementing this integration:

1. **Database Migration**: Use Brisbane timezone for migration filename
2. **Existing Data**: No existing WordPress data to migrate
3. **Feature Flags**: Consider implementing feature flag for gradual rollout
4. **Monitoring**: Add logging for connection attempts and failures
5. **Documentation**: Update user documentation with setup instructions

## Compatibility Requirements

### Blog Platform Support:
- **WordPress**: 5.6+ (Application Passwords native support), self-hosted installations only
- **Wix**: Current Wix sites with API access enabled
- Multisite/multi-domain installations (future consideration)
- Platform-specific API requirements (WordPress REST API, Wix API access)

### Browser Support:
- Modern browsers with ES6+ support
- Mobile responsiveness required
- Accessibility compliance (WCAG 2.1)

## Future Enhancements

### Phase 2 Features (Future Releases):
1. **Bulk Operations**: Multiple post publishing
2. **Media Management**: WordPress media library integration
3. **Category/Tag Sync**: Automatic taxonomy management
4. **Scheduling**: WordPress-specific publishing schedules
5. **Analytics**: WordPress traffic and engagement metrics
6. **Multi-site Support**: Connect multiple WordPress sites

### Integration Possibilities:
- WordPress plugin development for enhanced features
- Webhook support for real-time synchronization
- WordPress Gutenberg block integration
- WooCommerce compatibility (e-commerce features)

---

## Implementation Checklist

### Backend Tasks:
- [ ] Create database migration for blog integration fields
- [ ] Implement Supabase Vault RPC functions for blog credentials
- [ ] Add blog integration server actions to settings.ts
- [ ] Create blog platform validation API route
- [ ] Add provider-specific publishing logic
- [ ] Add proper error handling and logging

### Frontend Tasks:
- [ ] Create BlogIntegrationForm component following email integration pattern
- [ ] Implement provider dropdown with WordPress and Wix options
- [ ] Implement dynamic form fields based on selected provider
- [ ] Implement form validation with Zod
- [ ] Add connection status indicators
- [ ] Integrate with existing UI patterns
- [ ] Add provider-specific documentation links and help text

### Integration Tasks:
- [ ] Update integrations page layout
- [ ] Test WordPress connectivity and functionality
- [ ] Test Wix connectivity and functionality
- [ ] Test blog post publishing functionality for both providers
- [ ] Test featured image upload functionality for both providers
- [ ] Implement automatic site URL detection
- [ ] Implement provider-specific error handling
- [ ] Add user feedback mechanisms

### Testing Tasks:
- [ ] Unit test form validation
- [ ] Integration test WordPress API
- [ ] User acceptance testing
- [ ] Performance testing
- [ ] Security testing

### Documentation Tasks:
- [ ] Update user documentation
- [ ] Create troubleshooting guide
- [ ] Document API endpoints
- [ ] Create setup video/tutorial

This PRD provides a comprehensive blueprint for implementing blog integration that follows existing patterns while providing a robust, user-friendly experience for connecting blog platforms to the Transformo3 platform. 