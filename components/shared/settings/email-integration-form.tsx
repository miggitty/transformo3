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
  email_sender_name: z.string().optional(),
  email_sender_email: z.string().email('Please enter a valid email address.').optional().or(z.literal('')),
  email_selected_group_id: z.string().optional(),
  email_selected_group_name: z.string().optional(),
});

type EmailSettingsFormValues = z.infer<typeof emailSettingsFormSchema>;

interface EmailIntegrationFormProps {
  business: Tables<'businesses'>;
}

export function EmailIntegrationForm({ business }: EmailIntegrationFormProps) {
  const [isKeySet, setIsKeySet] = useState(!!business.email_secret_id);
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');



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

  // Load groups when provider changes or component mounts
  useEffect(() => {
    if (selectedProvider && isKeySet) {
      loadGroups();
    } else {
      setGroups([]);
    }
  }, [selectedProvider, isKeySet]);

  async function loadGroups() {
    if (!selectedProvider || !isKeySet) return;

    setIsLoadingGroups(true);
    try {
      const response = await fetch('/api/email-integration/groups');
      const result = await response.json();

      if (result.success) {
        setGroups(result.groups || []);
        if (result.groups?.length === 0) {
          toast.info(`No email groups found in your ${selectedProvider} account. Please create a group first.`);
        }
      } else {
        toast.error('Failed to load groups', { description: result.error });
        setGroups([]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      toast.error('Failed to load groups', { description: 'Please check your internet connection.' });
      setGroups([]);
    } finally {
      setIsLoadingGroups(false);
    }
  }

  async function validateApiKey(apiKey: string, provider: string) {
    if (!apiKey || !provider) return;

    setIsValidating(true);
    setValidationStatus('validating');

    try {
      // Temporarily save settings to validate
      const tempResult = await updateEmailSettings(business.id, {
        email_api_key: apiKey,
        email_provider: provider as 'mailerlite' | 'mailchimp' | 'brevo',
      });

      if (tempResult.error) {
        setValidationStatus('invalid');
        toast.error('Invalid API key', { description: tempResult.error });
        return false;
      }

      setValidationStatus('valid');
      setIsKeySet(true);
      
      // Load groups after successful validation
      setTimeout(() => loadGroups(), 500);
      
      return true;
    } catch (error) {
      setValidationStatus('invalid');
      toast.error('Validation failed', { description: 'Please try again.' });
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

          {/* Validation Status */}
          {validationStatus !== 'idle' && (
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  validationStatus === 'validating' ? 'bg-yellow-400' :
                  validationStatus === 'valid' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm font-medium">
                  {validationStatus === 'validating' ? 'Validating...' :
                   validationStatus === 'valid' ? 'API Key Valid' : 'Invalid API Key'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {validationStatus === 'validating' ? 'Checking API key and fetching available groups...' :
                 validationStatus === 'valid' ? 'API key validated and groups loaded successfully.' :
                 'Please check your credentials and try again.'}
              </div>
            </div>
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
                    <FormLabel>Email Group/List</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        const selectedGroup = groups.find(g => g.id === value);
                        form.setValue('email_selected_group_name', selectedGroup?.name || '');
                      }}
                      defaultValue={field.value}
                      disabled={isLoadingGroups || groups.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={
                            isLoadingGroups ? "Loading groups..." :
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
                    <FormDescription>
                      Choose which email list to send campaigns to.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </CardContent>
        
        <CardFooter className="border-t px-6 py-4">
          <Button type="submit" disabled={isValidating || isLoadingGroups}>
            Save Changes
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
} 