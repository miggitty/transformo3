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
import { updateBlogSettings, removeBlogCredentials } from '@/app/actions/settings';
import { useState, useEffect } from 'react';
import { Loader2, Check, X, ExternalLink } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

const blogSettingsFormSchema = z.object({
  blog_provider: z.enum(['wordpress', 'wix']).optional(),
  blog_username: z.string().min(1, 'Username is required').optional(),
  blog_credential: z.string().optional(),
  blog_site_url: z.string().url('Please enter a valid URL').optional(),
});

type BlogSettingsFormValues = z.infer<typeof blogSettingsFormSchema>;

interface SiteInfo {
  name: string;
  description?: string;
  url: string;
  version?: string;
  platform: 'wordpress' | 'wix';
  canPublishPosts: boolean;
  canUploadMedia: boolean;
}

interface BlogIntegrationFormProps {
  business: Tables<'businesses'>;
}

export function BlogIntegrationForm({ business }: BlogIntegrationFormProps) {
  const [isKeySet, setIsKeySet] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);

  const form = useForm<BlogSettingsFormValues>({
    resolver: zodResolver(blogSettingsFormSchema),
    defaultValues: {
      blog_provider: undefined,
      blog_username: '',
      blog_credential: '', // Always start empty for security
      blog_site_url: '',
    },
    mode: 'onChange',
  });

  // Check for existing blog integration
  useEffect(() => {
    const checkExistingIntegration = async () => {
      if (business.id) {
        try {
          const supabase = createClient();
          if (!supabase) return;
          
          const { data: integration, error } = await supabase
            .from('blog_integrations')
            .select('id, provider, username, site_url')
            .eq('business_id', business.id)
            .eq('status', 'active')
            .maybeSingle();
          
          if (integration && !error) {
            setIsKeySet(true);
            // Update form with existing data
            form.reset({
              blog_provider: integration.provider as 'wordpress' | 'wix',
              blog_username: integration.username || '',
              blog_credential: '', // Always keep empty for security
              blog_site_url: integration.site_url || '',
            });
          } else if (error) {
            console.error('Error fetching existing integration:', error);
          }
        } catch (err) {
          console.error('Error checking existing integration:', err);
        }
      }
    };
    
    checkExistingIntegration();
  }, [business.id, form]);

  const selectedProvider = form.watch('blog_provider');
  const credentialValue = form.watch('blog_credential');
  const siteUrlValue = form.watch('blog_site_url');
  const usernameValue = form.watch('blog_username');

  // Auto-validation on credential change (following Email integration pattern)
  useEffect(() => {
    if (credentialValue && selectedProvider && !isKeySet && credentialValue.length > 10) {
      // For WordPress, also need URL and username
      if (selectedProvider === 'wordpress' && (!siteUrlValue || !usernameValue)) {
        return;
      }
      
      const timeoutId = setTimeout(() => {
        validateCredentials(credentialValue, selectedProvider, siteUrlValue, usernameValue);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [credentialValue, selectedProvider, siteUrlValue, usernameValue, isKeySet]);

  const validateCredentials = async (
    credential: string, 
    provider: 'wordpress' | 'wix',
    siteUrl?: string,
    username?: string
  ) => {
    setIsValidating(true);
    setConnectionStatus('validating');

    try {
      const response = await fetch('/api/blog-integration/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          credential,
          siteUrl,
          username,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setConnectionStatus('invalid');
        toast.error('Blog Connection Failed', { description: result.error });
        setSiteInfo(null);
        return false;
      }

      setConnectionStatus('valid');
      setSiteInfo(result.siteInfo);
      toast.success('Blog connection validated successfully');
      return true;
    } catch (error) {
      console.error('Error validating blog credentials:', error);
      setConnectionStatus('invalid');
      toast.error('Validation failed', { description: 'Please check your internet connection and try again.' });
      setSiteInfo(null);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCredentials = async () => {
    const result = await removeBlogCredentials(business.id);
    if (result.error) {
      toast.error('Failed to remove credentials', { description: result.error });
    } else {
      toast.success('Blog credentials have been removed.');
      setIsKeySet(false);
      setConnectionStatus('idle');
      setSiteInfo(null);
      form.resetField('blog_credential');
    }
  };

  const handleProviderChange = (value: string) => {
    const provider = value as 'wordpress' | 'wix' | undefined;
    
    // Check if this matches current integration
    const currentProvider = form.getValues('blog_provider');
    
    if (provider !== currentProvider) {
      setIsKeySet(false);
      setConnectionStatus('idle');
      setSiteInfo(null);
      form.resetField('blog_credential');
      form.resetField('blog_username');
      form.resetField('blog_site_url');
      
      // Check if there's an existing integration for this provider
      if (provider && business.id) {
        const checkProviderIntegration = async () => {
          try {
            const supabase = createClient();
            if (!supabase) return;
            
            const { data: integration, error } = await supabase
              .from('blog_integrations')
              .select('id, username, site_url')
              .eq('business_id', business.id)
              .eq('provider', provider)
              .eq('status', 'active')
              .maybeSingle();
            
            if (integration && !error) {
              setIsKeySet(true);
              form.setValue('blog_username', integration.username || '');
              form.setValue('blog_site_url', integration.site_url || '');
            } else if (error) {
              console.error('Error fetching provider integration:', error);
            }
          } catch (err) {
            console.error('Error checking provider integration:', err);
          }
        };
        
        checkProviderIntegration();
      }
    }
    
    form.setValue('blog_provider', provider);
  };

  const onSubmit = async (data: BlogSettingsFormValues) => {
    try {
      // Prevent submission if credentials are being validated
      if (isValidating) {
        toast.error('Please wait for credential validation to complete');
        return;
      }

      // If credential is provided but validation failed, prevent submission
      if (data.blog_credential && connectionStatus === 'invalid') {
        toast.error('Please fix the credential validation errors before saving');
        return;
      }

      // Custom validation for required fields when no credential is already set
      if (data.blog_provider && !isKeySet && !data.blog_credential) {
        toast.error('Please provide credentials for the selected blog provider');
        return;
      }

      // For WordPress, ensure username and site URL are provided
      if (data.blog_provider === 'wordpress' && (!data.blog_username || !data.blog_site_url)) {
        toast.error('Please provide username and site URL for WordPress');
        return;
      }

      // If key is already set and no new credential provided, don't include it in the update
      if (isKeySet && !data.blog_credential) {
        delete data.blog_credential;
      }

      const result = await updateBlogSettings(business.id, data);

      if (result.error) {
        toast.error('Failed to update settings', { description: result.error });
      } else {
        toast.success('Blog Settings Updated');
        if (data.blog_credential) {
          setIsKeySet(true);
          form.resetField('blog_credential');
        }
      }
    } catch (error) {
      console.error('Error saving blog settings:', error);
      toast.error('Failed to save settings', { description: 'Please try again.' });
    }
  };

  const getValidationIcon = () => {
    if (isValidating) return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    if (connectionStatus === 'valid') return <Check className="h-4 w-4 text-green-500" />;
    if (connectionStatus === 'invalid') return <X className="h-4 w-4 text-red-500" />;
    return null;
  };

  const getProviderDocumentationLink = () => {
    if (selectedProvider === 'wordpress') {
      return (
        <div className="text-sm text-blue-600 space-y-1">
          <a 
            href="https://wordpress.org/support/article/application-passwords/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline"
          >
            How to generate Application Passwords <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-gray-600">Generate an Application Password in your WordPress admin (Users → Profile → Application Passwords).</p>
        </div>
      );
    } else if (selectedProvider === 'wix') {
      return (
        <div className="text-sm text-blue-600 space-y-1">
          <a 
            href="https://support.wix.com/en/article/wix-enterprise-using-wix-api-keys" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline"
          >
            How to get Wix API Key <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-gray-600">Generate an API key from your Wix Enterprise dashboard (Settings → API Keys).</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <FormField
            control={form.control}
            name="blog_provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Blog Provider</FormLabel>
                <Select 
                  onValueChange={handleProviderChange} 
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a blog platform..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="wordpress">WordPress</SelectItem>
                    <SelectItem value="wix">Wix</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose your blog platform.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Provider-specific fields */}
          {selectedProvider && (
            <>
              {/* WordPress fields */}
              {selectedProvider === 'wordpress' && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="blog_site_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://yourblog.com" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Your WordPress site URL (without trailing slash).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="blog_username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Your WordPress username" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Your WordPress admin username.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Credential field (for both providers) */}
              <FormField
                control={form.control}
                name="blog_credential"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      {selectedProvider === 'wordpress' ? 'Application Password' : 'API Key'}
                      {getValidationIcon()}
                    </FormLabel>
                    {isKeySet ? (
                      <div className="flex items-center space-x-2">
                        <Input type="password" placeholder="••••••••••••••••" disabled />
                        <Button type="button" variant="destructive" onClick={handleRemoveCredentials}>
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder={
                            selectedProvider === 'wordpress' 
                              ? 'Enter your WordPress Application Password' 
                              : 'Enter your Wix API Key'
                          }
                          {...field} 
                        />
                      </FormControl>
                    )}
                    <FormDescription>
                      This credential is stored securely and is write-only for security purposes.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Documentation Links */}
              {getProviderDocumentationLink()}
            </>
          )}

          {/* Connection Status */}
          {connectionStatus !== 'idle' && (
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'validating' ? 'bg-yellow-400' :
                  connectionStatus === 'valid' ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm font-medium">
                  {connectionStatus === 'validating' ? 'Validating...' :
                   connectionStatus === 'valid' ? 'Connection Valid' : 'Invalid Credentials'}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                {connectionStatus === 'validating' ? 'Testing connection and fetching site information...' :
                 connectionStatus === 'valid' ? 'Connection validated successfully.' :
                 'Please check your credentials and try again.'}
              </div>
            </div>
          )}

          {/* Site Information Display */}
          {siteInfo && connectionStatus === 'valid' && (
            <div className="p-4 bg-green-50 rounded-lg space-y-2">
              <h4 className="font-medium text-green-800">Connected Site Information</h4>
              <div className="text-sm space-y-1">
                <div><strong>Site Name:</strong> {siteInfo.name}</div>
                <div><strong>URL:</strong> <a href={siteInfo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{siteInfo.url}</a></div>
                <div><strong>Platform:</strong> {siteInfo.platform === 'wordpress' ? 'WordPress' : 'Wix'}</div>
                {siteInfo.version && <div><strong>Version:</strong> {siteInfo.version}</div>}
                <div className="flex items-center gap-4">
                  <span className={`text-xs px-2 py-1 rounded ${siteInfo.canPublishPosts ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {siteInfo.canPublishPosts ? '✓ Can Publish Posts' : '✗ Cannot Publish Posts'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${siteInfo.canUploadMedia ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {siteInfo.canUploadMedia ? '✓ Can Upload Media' : '✗ Cannot Upload Media'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="border-t px-6 py-4">
          <Button 
            type="submit" 
            disabled={isValidating || (!!credentialValue && connectionStatus === 'invalid')}
          >
            {isValidating ? 'Validating...' : 'Save Changes'}
          </Button>
          {connectionStatus === 'invalid' && !!credentialValue && (
            <p className="text-sm text-red-600 ml-4">
              Please fix validation errors before saving
            </p>
          )}
        </CardFooter>
      </form>
    </Form>
  );
} 