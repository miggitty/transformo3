'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, ControllerRenderProps } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { CardContent } from '@/components/ui/card';
import { Tables } from '@/types/supabase';
import { updateBusinessSettings } from '@/app/(app)/settings/actions';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  website_url: z.string().url('Please enter a valid URL.').nullable().optional(),
  contact_email: z.string().email('Please enter a valid email.').nullable().optional(),
  social_username: z.string().nullable().optional(),
  writing_style_guide: z.string().nullable().optional(),
  cta_youtube: z.string().nullable().optional(),
  cta_email: z.string().nullable().optional(),
  cta_social: z.string().nullable().optional(),
  social_media_profiles: z.any().optional(),
  social_media_integrations: z.any().optional(),
});

type SettingsFormValues = z.infer<typeof formSchema>;

interface SettingsFormProps {
  business: Tables<'businesses'>;
}

export function SettingsForm({ business }: SettingsFormProps) {
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ...business,
      name: business.name || '',
      website_url: business.website_url || '',
      contact_email: business.contact_email || '',
      social_username: business.social_username || '',
      writing_style_guide: business.writing_style_guide || '',
      cta_youtube: business.cta_youtube || '',
      cta_email: business.cta_email || '',
      cta_social: business.cta_social || '',
    },
  });

  async function onSubmit(values: SettingsFormValues) {
    const result = await updateBusinessSettings(values, business.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(result.message || 'Settings updated successfully.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }: { field: ControllerRenderProps<SettingsFormValues, "name"> }) => (
                <FormItem>
                  <FormLabel>Business Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Company" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website_url"
              render={({ field }: { field: ControllerRenderProps<SettingsFormValues, "website_url"> }) => (
                <FormItem>
                  <FormLabel>Website URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }: { field: ControllerRenderProps<SettingsFormValues, "contact_email"> }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input placeholder="contact@example.com" {...field} value={field.value ?? ''}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="social_username"
              render={({ field }: { field: ControllerRenderProps<SettingsFormValues, "social_username"> }) => (
                <FormItem>
                  <FormLabel>Social Username</FormLabel>
                  <FormControl>
                    <Input placeholder="@yourhandle" {...field} value={field.value ?? ''}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="writing_style_guide"
              render={({ field }: { field: ControllerRenderProps<SettingsFormValues, "writing_style_guide"> }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Writing Style Guide</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[150px]"
                      placeholder="Describe your brand's tone of voice..."
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Provide guidelines on tone, style, and voice.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? 'Saving...'
                : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </form>
    </Form>
  );
} 