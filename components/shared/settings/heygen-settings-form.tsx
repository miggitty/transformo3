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

  const form = useForm<HeygenSettingsFormValues>({
    resolver: zodResolver(heygenSettingsFormSchema),
    defaultValues: {
      heygen_api_key: '', // Always start empty for security
      heygen_avatar_id: '',
      heygen_voice_id: '',
    },
    mode: 'onChange',
  });

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
      form.resetField('heygen_api_key');
    }
  }

  async function onSubmit(data: HeygenSettingsFormValues) {
    // If key is already set and no new key provided, don't include it in the update
    if (isKeySet && !data.heygen_api_key) {
      delete data.heygen_api_key;
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
        </CardContent>
        
        <CardFooter className="border-t px-6 py-4">
          <Button type="submit">Save Changes</Button>
        </CardFooter>
      </form>
    </Form>
  );
} 