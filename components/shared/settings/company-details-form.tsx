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
import { CardContent, CardFooter } from '@/components/ui/card';
import { Tables } from '@/types/supabase';
import { updateBusinessSettings } from '@/app/(app)/settings/actions';
import { toast } from 'sonner';
import { timezones } from '@/lib/timezones';

const formSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters.'),
  website_url: z.string().url('Please enter a valid URL.').nullable().optional(),
  contact_email: z.string().email('Please enter a valid email.').nullable().optional(),
  timezone: z.string().min(1, 'Please select a timezone.'),
});

type CompanyDetailsFormValues = z.infer<typeof formSchema>;

interface CompanyDetailsFormProps {
  business: Tables<'businesses'>;
}

export function CompanyDetailsForm({ business }: CompanyDetailsFormProps) {
  const form = useForm<CompanyDetailsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      business_name: business.business_name || '',
      website_url: business.website_url || '',
      contact_email: business.contact_email || '',
      timezone: business.timezone || 'UTC',
    },
  });

  async function onSubmit(values: CompanyDetailsFormValues) {
    // Ensure website_url starts with https:// if it exists
    let websiteUrl = values.website_url;
    if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
      websiteUrl = `https://${websiteUrl}`;
    }

    const result = await updateBusinessSettings(
      { ...values, website_url: websiteUrl },
      business.id,
    );
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Company details updated successfully.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="pb-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website Address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                        https://
                      </span>
                      <Input
                        placeholder="your-website.com"
                        {...field}
                        value={field.value?.replace(/^https?:\/\//, '') ?? ''}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                        }}
                        className="pl-20"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Email</FormLabel>
                  <FormDescription>
                    Enter the business email address
                  </FormDescription>
                  <FormControl>
                    <Input placeholder="contact@example.com" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                   <FormDescription>
                    Enter the timezone you will be scheduling your content in
                  </FormDescription>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timezones.map((tz: { value: string; label: string }) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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