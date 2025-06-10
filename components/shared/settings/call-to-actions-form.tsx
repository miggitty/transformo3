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
import { Textarea } from '@/components/ui/textarea';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Tables } from '@/types/supabase';
import { updateBusinessSettings } from '@/app/(app)/settings/actions';
import { toast } from 'sonner';

const formSchema = z.object({
  cta_youtube: z.string().nullable().optional(),
  cta_email: z.string().nullable().optional(),
  cta_social_long: z.string().nullable().optional(),
  cta_social_short: z.string().nullable().optional(),
  booking_link: z.string().url('Please enter a valid URL.').nullable().optional(),
});

type CallToActionsFormValues = z.infer<typeof formSchema>;

interface CallToActionsFormProps {
  business: Tables<'businesses'>;
}

export function CallToActionsForm({ business }: CallToActionsFormProps) {
  const form = useForm<CallToActionsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cta_youtube: business.cta_youtube || '',
      cta_email: business.cta_email || '',
      cta_social_long: business.cta_social_long || '',
      cta_social_short: business.cta_social_short || '',
      booking_link: business.booking_link || '',
    },
  });

  async function onSubmit(values: CallToActionsFormValues) {
    const result = await updateBusinessSettings(values, business.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Call to action settings updated successfully.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6 pb-6">
          <FormField
            control={form.control}
            name="cta_youtube"
            render={({ field }) => (
              <FormItem>
                <FormLabel>YouTube Call To Action</FormLabel>
                <FormDescription>
                  This is the first line of the YouTube description, which should have a call to action to your next step
                </FormDescription>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cta_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Call To Action</FormLabel>
                <FormDescription>
                  This is the main call to action you want a reader of your emails to take after reading your email.
                </FormDescription>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cta_social_long"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Social Media Long Video Call To Action</FormLabel>
                <FormDescription>
                  This is a call to action you want to place on every long video on social media. (Optional)
                </FormDescription>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cta_social_short"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Social Media Short Video Call To Action</FormLabel>
                <FormDescription>
                  This is a call to action you want to place on every short video on social media. (Optional)
                </FormDescription>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="booking_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Booking Link</FormLabel>
                <FormDescription>
                  This is the link where someone can book an appointment with you
                </FormDescription>
                <FormControl>
                  <Input placeholder="https://your-booking-link.com" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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