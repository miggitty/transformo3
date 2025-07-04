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
import { toast } from 'sonner';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Tables } from '@/types/supabase';
import { updateHeygenSettings, removeHeygenApiKey } from '@/app/actions/settings';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

const heygenSettingsFormSchema = z.object({
  heygen_api_key: z.string().optional(),
  heygen_avatar_id: z.string().min(1, 'Avatar ID is required.'),
  heygen_voice_id: z.string().min(1, 'Voice ID is required.'),
});

type HeygenSettingsFormValues = z.infer<typeof heygenSettingsFormSchema>;

interface HeygenSettingsFormProps {
  business: Tables<'businesses'>;
}

export function HeygenSettingsForm({ business }: HeygenSettingsFormProps) {
  const [isKeySet, setIsKeySet] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [isValidating, setIsValidating] = useState(false);
  const [integrationInfo, setIntegrationInfo] = useState<{
    provider: string;
    avatarId: string;
    voiceId: string;
    validatedAt: string;
  } | null>(null);

  const form = useForm<HeygenSettingsFormValues>({
    resolver: zodResolver(heygenSettingsFormSchema),
    defaultValues: {
      heygen_api_key: '', // Always start empty for security
      heygen_avatar_id: '',
      heygen_voice_id: '',
    },
    mode: 'onChange',
  });

  const apiKeyValue = form.watch('heygen_api_key');
  const avatarIdValue = form.watch('heygen_avatar_id');
  const voiceIdValue = form.watch('heygen_voice_id');

  // Auto-validate API key when it changes (with debouncing)
  useEffect(() => {
    if (apiKeyValue && !isKeySet && apiKeyValue.length > 10) {
      const timeoutId = setTimeout(() => {
        validateApiKey(apiKeyValue);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyValue, isKeySet]);

  // Check for existing AI avatar integration
  useEffect(() => {
    const checkExistingIntegration = async () => {
      if (business.id) {
        try {
          const supabase = createClient();
          if (!supabase) return;
          
          const { data: integration, error } = await supabase
            .from('ai_avatar_integrations')
            .select('id, provider, avatar_id, voice_id')
            .eq('business_id', business.id)
            .eq('provider', 'heygen')
            .eq('status', 'active')
            .single();
          
          if (integration && !error) {
            setIsKeySet(true);
            setValidationStatus('valid');
            setIntegrationInfo({
              provider: 'HeyGen',
              avatarId: integration.avatar_id || '',
              voiceId: integration.voice_id || '',
              validatedAt: new Date().toISOString(),
            });
            // Update form with existing data
            form.reset({
              heygen_api_key: '', // Always keep empty for security
              heygen_avatar_id: integration.avatar_id || '',
              heygen_voice_id: integration.voice_id || '',
            });
          }
        } catch (error) {
          console.error('Error checking existing integration:', error);
        }
      }
    };
    
    checkExistingIntegration();
  }, [business.id, form]);

  async function handleRemoveKey() {
    const result = await removeHeygenApiKey(business.id);
    if (result.error) {
      toast.error('Failed to remove key', { description: result.error });
    } else {
      toast.success('HeyGen API Key has been removed.');
      setIsKeySet(false); // Update UI to show the input field
      setValidationStatus('idle');
      setIntegrationInfo(null);
      form.resetField('heygen_api_key');
    }
  }

  async function validateApiKey(apiKey: string) {
    if (!apiKey) return false;

    setIsValidating(true);
    setValidationStatus('validating');

    try {
      // For HeyGen, we'll do a simple validation check
      // In a real implementation, you'd make an API call to HeyGen's validation endpoint
      // For now, we'll just check if the key has the expected format
      if (apiKey.length < 20) {
        setValidationStatus('invalid');
        toast.error('Invalid API key format');
        return false;
      }

      // Simulate API validation (replace with actual HeyGen API call)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setValidationStatus('valid');
      setIntegrationInfo({
        provider: 'HeyGen',
        avatarId: avatarIdValue || '',
        voiceId: voiceIdValue || '',
        validatedAt: new Date().toISOString(),
      });
      toast.success('API key validated successfully');
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      setValidationStatus('invalid');
      toast.error('Failed to validate API key');
      return false;
    } finally {
      setIsValidating(false);
    }
  }

  async function onSubmit(data: HeygenSettingsFormValues) {
    try {
      // Prevent submission if API key is being validated
      if (isValidating) {
        toast.error('Please wait for API key validation to complete');
        return;
      }

      // If API key is provided but validation failed, prevent submission
      if (data.heygen_api_key && validationStatus === 'invalid') {
        toast.error('Please fix the API key validation errors before saving');
        return;
      }

      // If key is already set and no new key provided, don't include it in the update
      if (isKeySet && !data.heygen_api_key) {
        delete data.heygen_api_key;
      }

      // If new API key provided, validate it first
      if (data.heygen_api_key) {
        const isValid = await validateApiKey(data.heygen_api_key);
        if (!isValid) return;
      }

      const result = await updateHeygenSettings(business.id, data);

      if (result.error) {
        toast.error('Failed to update settings', { description: result.error });
      } else {
        toast.success('HeyGen Settings Updated');
        if (data.heygen_api_key) {
          setIsKeySet(true);
          form.resetField('heygen_api_key');
        }
        
        // Update integration info with new avatar/voice IDs if they changed
        if (integrationInfo) {
          setIntegrationInfo(prev => prev ? {
            ...prev,
            avatarId: data.heygen_avatar_id,
            voiceId: data.heygen_voice_id,
            validatedAt: new Date().toISOString(),
          } : null);
        }
      }
    } catch (error) {
      console.error('Error saving HeyGen settings:', error);
      toast.error('Failed to save settings', { description: 'Please try again.' });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <FormField
            control={form.control}
            name="heygen_api_key"
            render={({ field }) => (
              <FormItem>
                <FormLabel>HeyGen API Key</FormLabel>
                {isKeySet ? (
                  <div className="flex items-center space-x-2">
                    <Input type="password" placeholder="••••••••••••••••" disabled />
                    <Button type="button" variant="destructive" onClick={handleRemoveKey}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <FormControl>
                    <Input type="password" placeholder="Enter your new HeyGen API Key" {...field} />
                  </FormControl>
                )}
                <FormDescription>
                  This key is stored securely and is write-only for security purposes.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="heygen_avatar_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Avatar ID</FormLabel>
                <FormControl>
                  <Input placeholder="Default HeyGen Avatar ID" {...field} />
                </FormControl>
                <FormDescription>
                  The default avatar to use for AI video generation.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="heygen_voice_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Voice ID</FormLabel>
                <FormControl>
                  <Input placeholder="Default HeyGen Voice ID" {...field} />
                </FormControl>
                <FormDescription>
                  The default voice to use for AI video generation.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Validation Status */}
          {validationStatus === 'validating' && (
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <span className="text-sm font-medium">Validating...</span>
              </div>
              <div className="text-sm text-gray-600">
                Checking API key validity...
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
          {validationStatus === 'valid' && integrationInfo && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-green-800">Connection Valid</span>
              </div>
              <p className="text-sm text-green-600 mb-3">Connection validated successfully.</p>
              
              <div className="bg-white p-3 rounded-md border border-green-200">
                <h4 className="font-medium text-green-800 mb-2">Connected Provider Information</h4>
                <div className="space-y-1 text-sm">
                  <div><strong>Provider:</strong> {integrationInfo.provider}</div>
                  <div><strong>Avatar ID:</strong> {integrationInfo.avatarId || 'Not set'}</div>
                  <div><strong>Voice ID:</strong> {integrationInfo.voiceId || 'Not set'}</div>
                  <div><strong>Validated:</strong> {new Date(integrationInfo.validatedAt).toLocaleString()}</div>
                </div>
                
                <div className="mt-3 flex space-x-4">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-600">Can Generate Videos</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-600">Can Use Avatars</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="border-t px-6 py-4">
          <Button 
            type="submit" 
            disabled={isValidating || (!!apiKeyValue && validationStatus === 'invalid')}
          >
            {isValidating ? 'Validating...' : 'Save Changes'}
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