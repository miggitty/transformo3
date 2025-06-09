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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CardContent } from '@/components/ui/card';
import { Tables } from '@/types/supabase';
import { updateBusinessSettings } from '@/app/(app)/settings/actions';
import { toast } from 'sonner';

// Common timezone options
const timezones = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Toronto', label: 'Toronto' },
  { value: 'America/Vancouver', label: 'Vancouver' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Europe/Rome', label: 'Rome' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Shanghai', label: 'Shanghai' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Kolkata', label: 'Mumbai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
  { value: 'Australia/Melbourne', label: 'Melbourne' },
  { value: 'Australia/Brisbane', label: 'Brisbane' },
  { value: 'Australia/Perth', label: 'Perth' },
];

const formSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters.'),
  website_url: z.string().url('Please enter a valid URL.').nullable().optional(),
  contact_email: z.string().email('Please enter a valid email.').nullable().optional(),
  writing_style_guide: z.string().nullable().optional(),
  cta_youtube: z.string().nullable().optional(),
  cta_email: z.string().nullable().optional(),
  timezone: z.string().min(1, 'Please select a timezone.'),
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
      business_name: business.business_name || '',
      website_url: business.website_url || '',
      contact_email: business.contact_email || '',
      writing_style_guide: business.writing_style_guide || '',
      cta_youtube: business.cta_youtube || '',
      cta_email: business.cta_email || '',
      timezone: business.timezone || 'UTC',
    },
  });

  async function onSubmit(values: SettingsFormValues) {
    const result = await updateBusinessSettings(values, business.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Settings updated successfully.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }: { field: ControllerRenderProps<SettingsFormValues, "business_name"> }) => (
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
              name="timezone"
              render={({ field }: { field: ControllerRenderProps<SettingsFormValues, "timezone"> }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    All content scheduling will be based on this timezone.
                  </FormDescription>
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