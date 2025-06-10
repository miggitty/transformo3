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
import { CardContent, CardFooter } from '@/components/ui/card';
import { Tables } from '@/types/supabase';
import { updateBusinessSettings } from '@/app/(app)/settings/actions';
import { toast } from 'sonner';

const socialPlatforms = ["Facebook", "LinkedIn", "YouTube", "Instagram", "Twitter", "TikTok"];

const formSchema = z.object({
  upload_post_id: z.string().nullable().optional(),
  ...Object.fromEntries(socialPlatforms.map(platform => [
    platform.toLowerCase(), z.string().url().or(z.literal('')).nullable().optional()
  ]))
});

type SocialMediaFormValues = z.infer<typeof formSchema>;

interface SocialMediaFormProps {
  business: Tables<'businesses'>;
}

export function SocialMediaForm({ business }: SocialMediaFormProps) {
  const socialProfiles = business.social_media_profiles as { [key: string]: string } || {};

  const form = useForm<SocialMediaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      upload_post_id: business.upload_post_id || '',
      ...Object.fromEntries(socialPlatforms.map(platform => [
        platform.toLowerCase(), socialProfiles[platform] || ''
      ]))
    },
  });

  async function onSubmit(values: SocialMediaFormValues) {
    const { upload_post_id, ...socialLinks } = values;
    
    // Filter out empty values before saving
    const social_media_profiles = Object.fromEntries(
      Object.entries(socialLinks).filter(([, value]) => value)
    );

    const result = await updateBusinessSettings({
      upload_post_id,
      social_media_profiles,
    }, business.id);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Social media settings updated successfully.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6 pb-6">
          <FormField
            control={form.control}
            name="upload_post_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UploadPost.com User ID</FormLabel>
                <FormDescription>
                  Once your social media accounts are configured in UploadPost.com you need to add your username here
                </FormDescription>
                <FormControl>
                  <Input placeholder="your-username" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <FormLabel>Social Media Post Profiles</FormLabel>
            <FormDescription>
              Add your social media profile links so people can find you online
            </FormDescription>
            <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
              {socialPlatforms.map(platform => (
                <FormField
                  key={platform}
                  control={form.control}
                  name={platform.toLowerCase() as keyof SocialMediaFormValues}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{platform}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={`https://${platform.toLowerCase()}.com/your-profile`}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
} 