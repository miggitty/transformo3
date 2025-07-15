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
import { updateBusinessSettings } from '@/app/(app)/settings/business/actions';
import { toast } from 'sonner';
import { timezoneGroups } from '@/lib/timezones';

const formSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters.'),
  website_url: z.string()
    .optional()
    .refine((val) => {
      if (!val || val.trim() === '') return true; // Allow empty
      return !/^https?:\/\//i.test(val.trim()); // Reject if it includes protocol
    }, {
      message: "Please enter just the domain (e.g., 'example.com'). Remove 'https://' as it's already included."
    })
    .refine((val) => {
      if (!val || val.trim() === '') return true; // Allow empty
      // Validate domain format - must have at least one dot and valid TLD
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])*\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})*$/;
      return domainRegex.test(val.trim());
    }, {
      message: "Please enter a valid domain name (e.g., 'example.com'). Make sure it includes a valid extension like .com, .org, etc."
    })
    .nullable(),
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
    mode: 'onBlur',
    defaultValues: {
      business_name: business.business_name || '',
      website_url: business.website_url ? business.website_url.replace(/^https?:\/\//, '') : '',
      contact_email: business.contact_email || '',
      timezone: business.timezone || 'UTC',
    },
  });

  async function onSubmit(values: CompanyDetailsFormValues) {
    // Check if form has validation errors
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }

    // Construct the full URL with https:// prefix if website_url exists
    let websiteUrl = values.website_url;
    if (websiteUrl && websiteUrl.trim() !== '') {
      // Remove any protocol that might have been entered (shouldn't happen due to validation)
      websiteUrl = websiteUrl.replace(/^https?:\/\//, '');
      // Add https:// prefix
      websiteUrl = `https://${websiteUrl}`;
    } else {
      // If empty, set to null
      websiteUrl = null;
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
                  <FormDescription>
                    Your company or brand name
                  </FormDescription>
                  <div className="min-h-[1.25rem]">
                    <FormMessage />
                  </div>
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
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm">
                        https://
                      </span>
                      <Input
                        placeholder="example.com"
                        {...field}
                        value={field.value?.replace(/^https?:\/\//, '') ?? ''}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                        }}
                        className="pl-20"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Enter your domain name only (e.g., example.com)
                  </FormDescription>
                  <div className="min-h-[1.25rem]">
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business Email</FormLabel>
                  <FormControl>
                    <Input placeholder="contact@example.com" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormDescription>
                    Enter the business email address
                  </FormDescription>
                  <div className="min-h-[1.25rem]">
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      {timezoneGroups.map((group) => (
                        <div key={group.label}>
                          <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                            {group.label}
                          </div>
                          {group.options.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value} className="pl-6">
                              {tz.label}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the timezone you will be scheduling your content in
                  </FormDescription>
                  <div className="min-h-[1.25rem]">
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </div>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button 
            type="submit" 
            disabled={form.formState.isSubmitting || !form.formState.isValid}
          >
            {form.formState.isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
} 