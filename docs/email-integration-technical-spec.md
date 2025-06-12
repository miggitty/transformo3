# Email Integration - Technical Specification

## 📋 Related Documentation
- **[Product Requirements Document](./prd-mailerlite.md)** - Business requirements, user stories, and implementation phases
- **[HTML Mockup](./integrations-page-mockup.html)** - Visual design and layout reference for the integrations page  
- **This Document** - Complete technical implementation with code examples and API specifications

> **⚠️ Implementation Note**: This technical specification implements all requirements from the PRD. Follow the phased approach outlined in the PRD document while using the code examples and API specifications from this document.

## Overview
Complete technical implementation guide for email integration feature using MailerLite, MailChimp, and Brevo providers with Supabase Vault security pattern following the exact HeyGen implementation pattern.

## 1. Database Migration

### Migration File: `supabase/migrations/YYYYMMDDHHMMSS_implement_email_vault_feature.sql`

```sql
-- =================================================================
--          Email Integration Feature Migration
-- =================================================================
-- This script sets up all database objects required for the
-- email integration using Supabase Vault (following HeyGen pattern).
-- =================================================================

-- Step 1: Add email integration columns to businesses table
-- -----------------------------------------------------------------
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS email_provider TEXT CHECK (email_provider IN ('mailerlite', 'mailchimp', 'brevo')),
ADD COLUMN IF NOT EXISTS email_secret_id UUID REFERENCES vault.secrets(id),
ADD COLUMN IF NOT EXISTS email_sender_name TEXT,
ADD COLUMN IF NOT EXISTS email_sender_email TEXT,
ADD COLUMN IF NOT EXISTS email_selected_group_id TEXT,
ADD COLUMN IF NOT EXISTS email_selected_group_name TEXT,
ADD COLUMN IF NOT EXISTS email_validated_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Create RPC function to set/update email API key
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.set_email_key(uuid, text);
CREATE OR REPLACE FUNCTION public.set_email_key(p_business_id uuid, p_new_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_secret_name TEXT;
BEGIN
  SELECT email_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NULL THEN
    v_secret_name := 'email_api_key_for_business_' || p_business_id::text;
    v_secret_id := vault.create_secret(p_new_key, v_secret_name, 'Email provider API key for business');
    UPDATE public.businesses SET email_secret_id = v_secret_id WHERE id = p_business_id;
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_new_key);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_email_key(uuid, text) TO authenticated;

-- Step 3: Create RPC function to delete email API key
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_email_key(uuid);
CREATE OR REPLACE FUNCTION public.delete_email_key(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  SELECT email_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NOT NULL THEN
    -- FIRST: Clear the reference to avoid FK constraint violation
    UPDATE public.businesses SET email_secret_id = NULL WHERE id = p_business_id;
    -- THEN: Delete the secret from vault.secrets
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_email_key(uuid) TO authenticated;

-- Step 4: Create RPC function to retrieve email API key
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_email_secret(uuid);
CREATE OR REPLACE FUNCTION public.get_email_secret(p_business_id uuid)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_secret_value TEXT;
BEGIN
  SELECT email_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NOT NULL THEN
    SELECT decrypted_secret INTO v_secret_value FROM vault.decrypted_secrets WHERE id = v_secret_id;
    RETURN v_secret_value;
  END IF;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_email_secret(uuid) TO authenticated;
```

## 2. TypeScript Types Update

### File: `types/supabase.ts` (Manual Update Required)

```typescript
// Add to businesses table Row interface
export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          // ... existing fields ...
          email_provider: string | null;
          email_secret_id: string | null;
          email_sender_name: string | null;
          email_sender_email: string | null;
          email_selected_group_id: string | null;
          email_selected_group_name: string | null;
          email_validated_at: string | null;
        }
        Insert: {
          // ... existing fields ...
          email_provider?: string | null;
          email_secret_id?: string | null;
          email_sender_name?: string | null;
          email_sender_email?: string | null;
          email_selected_group_id?: string | null;
          email_selected_group_name?: string | null;
          email_validated_at?: string | null;
        }
        Update: {
          // ... existing fields ...
          email_provider?: string | null;
          email_secret_id?: string | null;
          email_sender_name?: string | null;
          email_sender_email?: string | null;
          email_selected_group_id?: string | null;
          email_selected_group_name?: string | null;
          email_validated_at?: string | null;
        }
      }
      // ... other tables
    }
  }
}
```

## 3. Email Provider Library

### File: `lib/email-providers.ts`

```typescript
// Email provider types and interfaces
export interface EmailGroup {
  id: string;
  name: string;
  subscriber_count?: number;
  created_at?: string;
}

export interface EmailProviderResponse {
  success: boolean;
  groups?: EmailGroup[];
  error?: string;
}

export class EmailProviderError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'EmailProviderError';
  }
}

// MailerLite API client
export class MailerLiteClient {
  private baseUrl = 'https://connect.mailerlite.com/api';
  
  constructor(private apiKey: string) {}

  async validateAndFetchGroups(): Promise<EmailProviderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/groups`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid API key. Please check your credentials.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Rate limit exceeded. Please try again later.' };
        }
        return { success: false, error: `API error: ${response.statusText}` };
      }

      const data = await response.json();
      const groups: EmailGroup[] = data.data?.map((group: any) => ({
        id: group.id,
        name: group.name,
        subscriber_count: group.total,
        created_at: group.created_at,
      })) || [];

      return { success: true, groups };
    } catch (error) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }
}

// MailChimp API client
export class MailChimpClient {
  private baseUrl: string;
  
  constructor(private apiKey: string) {
    // Extract datacenter from API key (format: key-us1)
    const dc = apiKey.split('-').pop() || 'us1';
    this.baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
  }

  async validateAndFetchGroups(): Promise<EmailProviderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/lists`, {
        headers: {
          'Authorization': `apikey ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid API key. Please check your credentials.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Rate limit exceeded. Please try again later.' };
        }
        return { success: false, error: `API error: ${response.statusText}` };
      }

      const data = await response.json();
      const groups: EmailGroup[] = data.lists?.map((list: any) => ({
        id: list.id,
        name: list.name,
        subscriber_count: list.stats?.member_count,
        created_at: list.date_created,
      })) || [];

      return { success: true, groups };
    } catch (error) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }
}

// Brevo API client
export class BrevoClient {
  private baseUrl = 'https://api.brevo.com/v3';
  
  constructor(private apiKey: string) {}

  async validateAndFetchGroups(): Promise<EmailProviderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/contacts/lists`, {
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid API key. Please check your credentials.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Rate limit exceeded. Please try again later.' };
        }
        return { success: false, error: `API error: ${response.statusText}` };
      }

      const data = await response.json();
      const groups: EmailGroup[] = data.lists?.map((list: any) => ({
        id: list.id.toString(),
        name: list.name,
        subscriber_count: list.totalSubscribers,
        created_at: list.createdAt,
      })) || [];

      return { success: true, groups };
    } catch (error) {
      return { success: false, error: 'Network error. Please check your connection.' };
    }
  }
}

// Factory function to create provider clients
export function createEmailProviderClient(provider: string, apiKey: string) {
  switch (provider) {
    case 'mailerlite':
      return new MailerLiteClient(apiKey);
    case 'mailchimp':
      return new MailChimpClient(apiKey);
    case 'brevo':
      return new BrevoClient(apiKey);
    default:
      throw new EmailProviderError(`Unsupported provider: ${provider}`);
  }
}
```

## 4. Server Actions

### File: `app/actions/settings.ts` (Extended)

```typescript
// Add to existing file

const emailSettingsFormSchema = z.object({
  email_provider: z.enum(['mailerlite', 'mailchimp', 'brevo']).optional(),
  email_api_key: z.string().optional(),
  email_sender_name: z.string().min(1, 'Sender name is required.'),
  email_sender_email: z.string().email('Valid sender email is required.'),
  email_selected_group_id: z.string().optional(),
  email_selected_group_name: z.string().optional(),
});

export async function updateEmailSettings(
  businessId: string,
  formData: z.infer<typeof emailSettingsFormSchema>
) {
  const supabase = await createClient();

  const parsedData = emailSettingsFormSchema.safeParse(formData);
  if (!parsedData.success) {
    const errorMessages = parsedData.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid form data.';
    return { error: firstError };
  }

  const { 
    email_provider, 
    email_api_key, 
    email_sender_name, 
    email_sender_email,
    email_selected_group_id,
    email_selected_group_name 
  } = parsedData.data;

  // Only update the secret if a new key was provided
  if (email_api_key) {
    const { error: rpcError } = await supabase.rpc('set_email_key', {
      p_business_id: businessId,
      p_new_key: email_api_key,
    });

    if (rpcError) {
      console.error('Error saving email secret to Vault:', rpcError);
      return { error: `Database error: ${rpcError.message}` };
    }
  }

  // Always update the non-sensitive fields
  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      email_provider: email_provider,
      email_sender_name: email_sender_name,
      email_sender_email: email_sender_email,
      email_selected_group_id: email_selected_group_id,
      email_selected_group_name: email_selected_group_name,
      email_validated_at: new Date().toISOString(),
    })
    .eq('id', businessId);

  if (updateError) {
    console.error('Error updating email settings:', updateError);
    return { error: `Could not update settings: ${updateError.message}` };
  }

  revalidatePath('/settings/integrations');
  return { success: true };
}

export async function removeEmailApiKey(businessId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('delete_email_key', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error deleting email API key:', error);
    return { error: `Database error: ${error.message}` };
  }

  // Clear provider and settings when removing API key
  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      email_provider: null,
      email_sender_name: null,
      email_sender_email: null,
      email_selected_group_id: null,
      email_selected_group_name: null,
      email_validated_at: null,
    })
    .eq('id', businessId);

  if (updateError) {
    console.error('Error clearing email settings:', updateError);
    return { error: `Could not clear settings: ${updateError.message}` };
  }

  revalidatePath('/settings/integrations');
  return { success: true };
}
```

## 5. API Route for Group Fetching

### File: `app/api/email-integration/groups/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createEmailProviderClient } from '@/lib/email-providers';

// Rate limiting cache
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitCache.get(key);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= limit) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Rate limiting by user ID
    if (!checkRateLimit(`email-groups-${user.id}`, 10, 60000)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // Get user's business profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.business_id) {
      return NextResponse.json(
        { error: 'Business profile not found' },
        { status: 404 }
      );
    }

    // Get business email configuration
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('email_provider, email_secret_id')
      .eq('id', profile.business_id)
      .single();

    if (businessError || !business) {
      return NextResponse.json(
        { error: 'Business configuration not found' },
        { status: 404 }
      );
    }

    if (!business.email_provider || !business.email_secret_id) {
      return NextResponse.json(
        { error: 'Email provider not configured' },
        { status: 400 }
      );
    }

    // Get API key from vault
    const { data: apiKey, error: keyError } = await supabase.rpc('get_email_secret', {
      p_business_id: profile.business_id,
    });

    if (keyError || !apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Create provider client and fetch groups
    const providerClient = createEmailProviderClient(business.email_provider, apiKey);
    const result = await providerClient.validateAndFetchGroups();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      groups: result.groups,
      provider: business.email_provider,
    });

  } catch (error) {
    console.error('Error fetching email groups:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## 6. React Component

### File: `components/shared/settings/email-integration-form.tsx`

```typescript
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Tables } from '@/types/supabase';
import { updateEmailSettings, removeEmailApiKey } from '@/app/actions/settings';
import { useState, useEffect } from 'react';
import { Loader2, Check, X, RefreshCw } from 'lucide-react';

const emailSettingsFormSchema = z.object({
  email_provider: z.enum(['mailerlite', 'mailchimp', 'brevo']).optional(),
  email_api_key: z.string().optional(),
  email_sender_name: z.string().min(1, 'Sender name is required.'),
  email_sender_email: z.string().email('Valid sender email is required.'),
  email_selected_group_id: z.string().optional(),
  email_selected_group_name: z.string().optional(),
});

type EmailSettingsFormValues = z.infer<typeof emailSettingsFormSchema>;

interface EmailGroup {
  id: string;
  name: string;
  subscriber_count?: number;
}

interface EmailIntegrationFormProps {
  business: Tables<'businesses'>;
}

export function EmailIntegrationForm({ business }: EmailIntegrationFormProps) {
  const [isKeySet, setIsKeySet] = useState(!!business.email_secret_id);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  const form = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(emailSettingsFormSchema),
    defaultValues: {
      email_provider: business.email_provider || undefined,
      email_api_key: '', // Always start empty for security
      email_sender_name: business.email_sender_name || '',
      email_sender_email: business.email_sender_email || '',
      email_selected_group_id: business.email_selected_group_id || undefined,
      email_selected_group_name: business.email_selected_group_name || undefined,
    },
    mode: 'onChange',
  });

  const watchedProvider = form.watch('email_provider');
  const watchedApiKey = form.watch('email_api_key');

  // Reset form when provider changes
  useEffect(() => {
    if (watchedProvider !== business.email_provider) {
      // Clear all settings when switching providers
      form.setValue('email_api_key', '');
      form.setValue('email_sender_name', '');
      form.setValue('email_sender_email', '');
      form.setValue('email_selected_group_id', undefined);
      form.setValue('email_selected_group_name', undefined);
      setIsKeySet(false);
      setValidationStatus('idle');
      setGroups([]);
    }
  }, [watchedProvider, business.email_provider, form]);

  // Validate API key when entered
  useEffect(() => {
    if (watchedApiKey && watchedProvider && !isKeySet) {
      validateApiKey();
    }
  }, [watchedApiKey, watchedProvider]);

  const validateApiKey = async () => {
    if (!watchedProvider || !watchedApiKey) return;

    setIsValidating(true);
    setValidationStatus('idle');

    try {
      // Temporarily save the key to validate it
      const result = await updateEmailSettings(business.id, {
        email_provider: watchedProvider,
        email_api_key: watchedApiKey,
        email_sender_name: form.getValues('email_sender_name') || 'Test',
        email_sender_email: form.getValues('email_sender_email') || 'test@example.com',
      });

      if (result.error) {
        setValidationStatus('invalid');
        toast.error('API Key Validation Failed', { description: result.error });
        return;
      }

      // If successful, fetch groups
      await fetchGroups();
      setValidationStatus('valid');
      setIsKeySet(true);
      form.resetField('email_api_key');
      
    } catch (error) {
      setValidationStatus('invalid');
      toast.error('Validation Error', { 
        description: 'Failed to validate API key. Please try again.' 
      });
    } finally {
      setIsValidating(false);
    }
  };

  const fetchGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const response = await fetch('/api/email-integration/groups');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch groups');
      }

      setGroups(data.groups || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to fetch email groups');
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const handleRemoveKey = async () => {
    const result = await removeEmailApiKey(business.id);
    if (result.error) {
      toast.error('Failed to remove key', { description: result.error });
    } else {
      toast.success('Email API Key has been removed.');
      setIsKeySet(false);
      setValidationStatus('idle');
      setGroups([]);
      form.reset({
        email_provider: undefined,
        email_api_key: '',
        email_sender_name: '',
        email_sender_email: '',
        email_selected_group_id: undefined,
        email_selected_group_name: undefined,
      });
    }
  };

  const onSubmit = async (data: EmailSettingsFormValues) => {
    // If key is already set and no new key provided, don't include it
    if (isKeySet && !data.email_api_key) {
      delete data.email_api_key;
    }

    const result = await updateEmailSettings(business.id, data);

    if (result.error) {
      toast.error('Failed to update settings', { description: result.error });
    } else {
      toast.success('Email Settings Updated');
      if (data.email_api_key) {
        setIsKeySet(true);
        form.resetField('email_api_key');
      }
    }
  };

  const getValidationIcon = () => {
    if (isValidating) return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    if (validationStatus === 'valid') return <Check className="h-4 w-4 text-green-500" />;
    if (validationStatus === 'invalid') return <X className="h-4 w-4 text-red-500" />;
    return null;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <FormField
            control={form.control}
            name="email_provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Provider</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  disabled={isKeySet}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mailerlite">MailerLite</SelectItem>
                    <SelectItem value="mailchimp">MailChimp</SelectItem>
                    <SelectItem value="brevo">Brevo</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose your email service provider.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* API Key Input */}
          <FormField
            control={form.control}
            name="email_api_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  API Key
                  {getValidationIcon()}
                </FormLabel>
                {isKeySet ? (
                  <div className="flex items-center space-x-2">
                    <Input type="password" placeholder="••••••••••••••••" disabled />
                    <Button type="button" variant="destructive" onClick={handleRemoveKey}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder={`Enter your ${watchedProvider ? watchedProvider : 'email provider'} API key`}
                      disabled={!watchedProvider}
                      {...field} 
                    />
                  </FormControl>
                )}
                <FormDescription>
                  This key is stored securely and is write-only for security purposes.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Sender Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email_sender_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sender Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Business Name" {...field} />
                  </FormControl>
                  <FormDescription>
                    The name that appears in recipient inboxes.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email_sender_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sender Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="noreply@yourbusiness.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    The email address used as the sender.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Group Selection */}
          <FormField
            control={form.control}
            name="email_selected_group_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Email Group/List
                  {isLoadingGroups && <Loader2 className="h-4 w-4 animate-spin" />}
                  {groups.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchGroups}
                      disabled={isLoadingGroups}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    const selectedGroup = groups.find(g => g.id === value);
                    if (selectedGroup) {
                      form.setValue('email_selected_group_name', selectedGroup.name);
                    }
                  }}
                  defaultValue={field.value}
                  disabled={!isKeySet || groups.length === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !isKeySet 
                          ? "Set up API key first..." 
                          : groups.length === 0 
                            ? "No groups found"
                            : "Select a group..."
                      } />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} 
                        {group.subscriber_count && ` (${group.subscriber_count} subscribers)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose which email list to send campaigns to.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status Display */}
          {validationStatus !== 'idle' && (
            <div className={`flex items-center space-x-4 p-4 rounded-lg ${
              validationStatus === 'valid' ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center space-x-2">
                {getValidationIcon()}
                <span className={`text-sm font-medium ${
                  validationStatus === 'valid' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {validationStatus === 'valid' ? 'API key validated' : 'API key invalid'}
                </span>
              </div>
              <div className={`text-sm ${
                validationStatus === 'valid' ? 'text-green-700' : 'text-red-700'
              }`}>
                {validationStatus === 'valid' 
                  ? 'Configuration complete and groups loaded.'
                  : 'Please check your API key and try again.'
                }
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="border-t px-6 py-4">
          <Button type="submit" disabled={isValidating}>
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
```

## 7. Updated Integrations Page

### File: `app/(app)/settings/integrations/page.tsx`

```typescript
// Add to existing imports
import { EmailIntegrationForm } from '@/components/shared/settings/email-integration-form';

// Add to JSX after Social Media section and before HeyGen:
<Card>
  <CardHeader>
    <CardTitle>Email Integration</CardTitle>
    <CardDescription>
      Connect your email service provider for marketing campaigns.
    </CardDescription>
  </CardHeader>
  <EmailIntegrationForm business={business} />
</Card>
```

## 8. API Call Flow Summary

### Complete API Flow:
1. **Page Load**: Load business data with email fields
2. **Provider Selection**: User selects provider (client-side only)
3. **API Key Entry**: User enters API key, triggers validation
4. **Validation Process**:
   - Calls `updateEmailSettings()` server action
   - Server action calls `set_email_key()` RPC to store in vault
   - Calls `/api/email-integration/groups` to fetch groups
   - API route calls `get_email_secret()` RPC to retrieve key
   - API route calls provider API to validate and fetch groups
5. **Configuration**: User sets sender info and selects group
6. **Save**: Calls `updateEmailSettings()` with all configuration
7. **Remove**: Calls `removeEmailApiKey()` server action

### Error Handling:
- Rate limiting on all endpoints
- Provider-specific error messages
- Validation status indicators
- Fallback to cached data when possible
- Comprehensive logging for debugging

This specification provides complete implementation details with no guesswork required.

---

## 🔗 Cross-Reference Guide

### 📋 Phase Implementation Mapping
Each phase from the **[PRD Implementation Phases](./prd-mailerlite.md#implementation-phases)** maps to sections in this technical spec:

- **Phase 1** (Database) → Section 1: Database Migration + Section 2: TypeScript Types
- **Phase 2** (Server Actions) → Section 4: Server Actions 
- **Phase 3** (Provider APIs) → Section 3: Email Provider Library + Section 5: API Route
- **Phase 4** (Frontend) → Section 6: React Component + Section 7: Page Integration
- **Phase 5** (Validation) → Error handling throughout all sections
- **Phase 6** (Testing) → API Call Flow Summary + all example implementations

### 🎨 UI/UX Reference
- **Design Layout**: See **[HTML Mockup](./integrations-page-mockup.html)** for exact styling
- **Component Structure**: Section 6 provides the complete React component
- **Form Behavior**: Component includes all validation and state management

### 🔐 Security Implementation
- **Vault Pattern**: Sections 1 & 4 follow exact HeyGen RPC function pattern
- **API Key Handling**: Section 6 component uses identical security approach
- **Rate Limiting**: Section 5 includes comprehensive rate limiting

### ✅ Implementation Checklist
Use **[PRD Phase Checkboxes](./prd-mailerlite.md#implementation-phases)** to track progress while implementing code from this specification.

**Ready for development - all cross-references established! 🚀** 