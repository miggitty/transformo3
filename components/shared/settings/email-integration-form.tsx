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
import { EmailGroup } from '@/lib/email-providers';



const emailSettingsFormSchema = z.object({
  email_api_key: z.string().optional(),
  email_provider: z.enum(['mailerlite', 'mailchimp', 'brevo']).optional(),
  email_sender_name: z.string().min(1, 'Sender name is required when API key is set.').optional().or(z.literal('')),
  email_sender_email: z.string().email('Please enter a valid email address.').min(1, 'Sender email is required when API key is set.').optional().or(z.literal('')),
  email_selected_group_id: z.string().optional(),
  email_selected_group_name: z.string().optional(),
}).refine((data) => {
  // If no provider is selected, all fields are optional
  if (!data.email_provider) return true;
  
  // If provider is selected but no API key is being set, sender fields are optional
  if (!data.email_api_key) return true;
  
  // If API key is being set, sender fields are required
  if (data.email_api_key) {
    return data.email_sender_name && data.email_sender_name.length > 0 &&
           data.email_sender_email && data.email_sender_email.length > 0;
  }
  
  return true;
}, {
  message: "Sender name and email are required when setting up a new API key.",
  path: ["email_sender_name"]
});

type EmailSettingsFormValues = z.infer<typeof emailSettingsFormSchema>;

interface EmailIntegrationFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  business: Tables<'businesses'> & any;
}

export function EmailIntegrationForm({ business }: EmailIntegrationFormProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [isKeySet, setIsKeySet] = useState(!!(business as any).email_secret_id);
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [providerInfo, setProviderInfo] = useState<{
    provider: string;
    groupCount: number;
    validatedAt: string;
  } | null>(null);



  const form = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(emailSettingsFormSchema),
    defaultValues: {
      email_api_key: '', // Always start empty for security
      email_provider: (business.email_provider as 'mailerlite' | 'mailchimp' | 'brevo') || undefined,
      email_sender_name: business.email_sender_name || '',
      email_sender_email: business.email_sender_email || '',
      email_selected_group_id: business.email_selected_group_id || '',
      email_selected_group_name: business.email_selected_group_name || '',
    },
    mode: 'onChange',
  });

  const selectedProvider = form.watch('email_provider');
  const apiKeyValue = form.watch('email_api_key');

  // Auto-validate API key when it changes (with debouncing)
  useEffect(() => {
    if (apiKeyValue && selectedProvider && !isKeySet && apiKeyValue.length > 10) {
      const timeoutId = setTimeout(() => {
        validateApiKey(apiKeyValue, selectedProvider);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyValue, selectedProvider, isKeySet]);

  // Load groups when provider changes or component mounts
  useEffect(() => {
    if (selectedProvider && isKeySet) {
      loadGroups();
      // Set provider info for existing integration
      if (!providerInfo) {
        setProviderInfo({
          provider: selectedProvider,
          groupCount: 0, // Will be updated when groups are loaded
          validatedAt: new Date().toISOString(),
        });
        setValidationStatus('valid');
      }
    } else {
      setGroups([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, isKeySet]);

  async function loadGroups() {
    if (!selectedProvider || !isKeySet) return;

    setIsLoadingGroups(true);
    setGroupsError(null);
    
    try {
      const response = await fetch('/api/email-integration/groups');
      const result = await response.json();

      if (result.success) {
        setGroups(result.groups || []);
        setGroupsError(null);
        
        // Update provider info with group count
        if (providerInfo) {
          setProviderInfo(prev => prev ? { ...prev, groupCount: result.groups?.length || 0 } : null);
        }
        
        if (result.groups?.length === 0) {
          setGroupsError(`No email groups found in your ${selectedProvider} account. Please create a group first.`);
          toast.info(`No email groups found in your ${selectedProvider} account. Please create a group first.`);
        }
      } else {
        setGroupsError(result.error || 'Failed to load groups');
        toast.error('Failed to load groups', { description: result.error });
        setGroups([]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      const errorMessage = 'Please check your internet connection.';
      setGroupsError(errorMessage);
      toast.error('Failed to load groups', { description: errorMessage });
      setGroups([]);
    } finally {
      setIsLoadingGroups(false);
    }
  }

  async function refreshGroups() {
    if (!selectedProvider || !isKeySet) return;
    await loadGroups();
    toast.success('Groups refreshed successfully');
  }

  async function validateApiKey(apiKey: string, provider: string) {
    if (!apiKey || !provider) return false;

    setIsValidating(true);
    setValidationStatus('validating');

    try {
      // First validate the API key by testing the connection
      const response = await fetch('/api/email-integration/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          apiKey,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setValidationStatus('invalid');
        toast.error('API Key Validation Failed', { description: result.error });
        return false;
      }

      // If validation successful, save the settings
      const saveResult = await updateEmailSettings(business.id, {
        email_api_key: apiKey,
        email_provider: provider as 'mailerlite' | 'mailchimp' | 'brevo',
      });

      if (saveResult.error) {
        setValidationStatus('invalid');
        toast.error('Failed to save API key', { description: saveResult.error });
        return false;
      }

      setValidationStatus('valid');
      setIsKeySet(true);
      setProviderInfo({
        provider: provider,
        groupCount: 0, // Will be updated when groups are loaded
        validatedAt: new Date().toISOString(),
      });
      toast.success('API key validated and saved successfully');
      
      // Load groups after successful validation
      setTimeout(() => loadGroups(), 500);
      
      return true;
    } catch {
      setValidationStatus('invalid');
      toast.error('Validation failed', { description: 'Please check your internet connection and try again.' });
      return false;
    } finally {
      setIsValidating(false);
    }
  }

  async function handleRemoveKey() {
    const result = await removeEmailApiKey(business.id);
    if (result.error) {
      toast.error('Failed to remove key', { description: result.error });
    } else {
      toast.success('Email API Key has been removed.');
      setIsKeySet(false);
      setValidationStatus('idle');
      setGroups([]);
      setProviderInfo(null);
      form.resetField('email_api_key');
      form.resetField('email_selected_group_id');
      form.resetField('email_selected_group_name');
    }
  }

  function handleProviderChange(value: string) {
    const provider = value as 'mailerlite' | 'mailchimp' | 'brevo' | undefined;
    
    // Only clear settings if switching to a different provider than what's in the database
    // or if no provider was previously set
    if (provider !== business.email_provider) {
      setIsKeySet(false);
      setValidationStatus('idle');
      setGroups([]);
      setProviderInfo(null);
      form.resetField('email_api_key');
      form.resetField('email_sender_name');
      form.resetField('email_sender_email');
      form.resetField('email_selected_group_id');
      form.resetField('email_selected_group_name');
    } else {
      // If switching back to the original provider, restore the key state
      setIsKeySet(!!business.email_secret_id);
      if (business.email_secret_id) {
        // Load groups for the restored provider
        setTimeout(() => loadGroups(), 100);
      }
    }
    
    form.setValue('email_provider', provider);
  }

  async function onSubmit(data: EmailSettingsFormValues) {
    try {
      // Prevent submission if API key is being validated
      if (isValidating) {
        toast.error('Please wait for API key validation to complete');
        return;
      }

      // If API key is provided but validation failed, prevent submission
      if (data.email_api_key && validationStatus === 'invalid') {
        toast.error('Please fix the API key validation errors before saving');
        return;
      }

      // If key is already set and no new key provided, don't include it in the update
      if (isKeySet && !data.email_api_key) {
        delete data.email_api_key;
      }

      // If new API key provided, validate it first
      if (data.email_api_key && data.email_provider) {
        const isValid = await validateApiKey(data.email_api_key, data.email_provider);
        if (!isValid) return;
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
    } catch (error) {
      console.error('Error saving email settings:', error);
      toast.error('Failed to save settings', { description: 'Please try again.' });
    }
  }

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
                  onValueChange={handleProviderChange} 
                  defaultValue={field.value}
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
          {selectedProvider && (
            <FormField
              control={form.control}
              name="email_api_key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
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
                        placeholder={`Enter your ${selectedProvider} API key`} 
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
          )}

          {/* Sender Configuration */}
          {isKeySet && (
            <>
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
                    <div className="flex items-center justify-between">
                      <FormLabel>Email Group/List</FormLabel>
                      {groups.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={refreshGroups}
                          disabled={isLoadingGroups}
                        >
                          {isLoadingGroups ? 'Refreshing...' : 'Refresh'}
                        </Button>
                      )}
                    </div>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        const selectedGroup = groups.find(g => g.id === value);
                        form.setValue('email_selected_group_name', selectedGroup?.name || '');
                      }}
                      defaultValue={field.value}
                      disabled={isLoadingGroups || (groups.length === 0 && !groupsError)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            isLoadingGroups ? "Loading groups..." :
                            groupsError ? "Error loading groups" :
                            groups.length === 0 ? "No groups available" :
                            "Select a group..."
                          } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name} 
                            {group.subscriber_count !== undefined && ` (${group.subscriber_count} subscribers)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {groupsError && (
                      <div className="text-sm text-red-600 mt-1">
                        {groupsError}
                        {groups.length === 0 && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            onClick={refreshGroups}
                            disabled={isLoadingGroups}
                            className="h-auto p-0 ml-2 text-red-600 underline"
                          >
                            Try again
                          </Button>
                        )}
                      </div>
                    )}
                    <FormDescription>
                      Choose which email list to send campaigns to.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* Validation Status */}
          {validationStatus === 'validating' && (
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <span className="text-sm font-medium">Validating...</span>
              </div>
              <div className="text-sm text-gray-600">
                Checking API key and fetching available groups...
              </div>
            </div>
          )}
          
          {validationStatus === 'invalid' && (
            <div className="flex items-center space-x-4 p-4 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm font-medium text-red-800">Invalid API Key</span>
              </div>
              <div className="text-sm text-red-600">
                Please check your credentials and try again.
              </div>
            </div>
          )}

          {/* Connection Valid Status */}
          {validationStatus === 'valid' && providerInfo && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-green-800">Connection Valid</span>
              </div>
              <p className="text-sm text-green-600 mb-3">Connection validated successfully.</p>
              
              <div className="bg-white p-3 rounded-md border border-green-200">
                <h4 className="font-medium text-green-800 mb-2">Connected Provider Information</h4>
                <div className="space-y-1 text-sm">
                  <div><strong>Provider:</strong> {providerInfo.provider.charAt(0).toUpperCase() + providerInfo.provider.slice(1)}</div>
                  <div><strong>Available Groups:</strong> {providerInfo.groupCount}</div>
                  <div><strong>Validated:</strong> {new Date(providerInfo.validatedAt).toLocaleString()}</div>
                </div>
                
                <div className="mt-3 flex space-x-4">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-600">Can Send Emails</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-600">Can Access Groups</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="border-t px-6 py-4">
          <Button 
            type="submit" 
            disabled={isValidating || isLoadingGroups || (!!apiKeyValue && validationStatus === 'invalid')}
          >
            {isValidating ? 'Validating...' : 
             isLoadingGroups ? 'Loading...' : 
             'Save Changes'}
          </Button>
          {validationStatus === 'invalid' && !!apiKeyValue && (
            <p className="text-sm text-red-600 ml-4">
              Please fix validation errors before saving
            </p>
          )}
        </CardFooter>
      </form>
    </Form>
  );
} 