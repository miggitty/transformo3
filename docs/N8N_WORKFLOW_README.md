# N8N Workflow Configuration Guide

## Overview

The N8N workflow files in this directory contain templates for email integration workflows. For security reasons, sensitive values like API keys and URLs have been replaced with placeholders.

## Security Notice

**IMPORTANT**: Never commit workflow files containing actual API keys, tokens, or other sensitive credentials to version control.

## Placeholder Values

The workflow files use the following placeholders that need to be replaced with actual values in N8N:

- `{{SUPABASE_URL}}` - Your Supabase project URL
- `{{SUPABASE_ANON_KEY}}` - Your Supabase anonymous key
- `{{N8N_CALLBACK_SECRET}}` - Your N8N callback secret (must match the environment variable)

## How to Use These Workflows

1. **Import the Workflow**
   - Open N8N
   - Go to Workflows → Import from File
   - Select the appropriate workflow file (dev or prod)

2. **Configure Credentials**
   - In N8N, create credentials for:
     - Supabase (HTTP Header Auth)
     - Email providers (MailerLite, MailChimp, Brevo)

3. **Replace Placeholders**
   - Edit each HTTP Request node
   - Replace placeholder values with actual credentials
   - Use N8N's credential system instead of hardcoding values

4. **Best Practices**
   - Store credentials in N8N's credential manager
   - Use environment variables where possible
   - Enable HMAC signature validation for webhooks
   - Test workflows in development before production

## Webhook Security

The application now supports HMAC signature validation for enhanced security. When configuring webhooks:

1. Add these headers to webhook requests:
   - `x-webhook-signature`: HMAC signature of the payload
   - `x-webhook-timestamp`: Unix timestamp in milliseconds

2. The signature is calculated as:
   ```
   HMAC-SHA256(timestamp + "." + JSON.stringify(payload), secret)
   ```

3. The application will validate both the signature and timestamp to prevent replay attacks.

## Environment Variables Required

Ensure these environment variables are set in your application:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `N8N_CALLBACK_SECRET`
- `N8N_WEBHOOK_URL_CONTENT_CREATION`

## Workflow Descriptions

### Email Sending Integration
- Polls for scheduled emails every 5 minutes
- Fetches email provider credentials dynamically
- Supports multiple email providers (MailerLite, MailChimp, Brevo)
- Updates email status after sending

### Content Creation Workflow
- Triggered via webhook from the application
- Processes content generation requests
- Sends callbacks with results

## Troubleshooting

- If webhooks fail with 401 errors, check that the callback secret matches
- For HMAC validation failures, ensure timestamps are synchronized
- Check N8N logs for detailed error messages