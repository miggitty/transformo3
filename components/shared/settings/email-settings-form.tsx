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
  email_name_token: z.string().nullable().optional(),
  email_sign_off: z.string().nullable().optional(),
});

type EmailSettingsFormValues = z.infer<typeof formSchema>;

interface EmailSettingsFormProps {
  business: Tables<'businesses'>;
}

export function EmailSettingsForm({ business }: EmailSettingsFormProps) {
  const form = useForm<EmailSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email_name_token: business.email_name_token || '',
      email_sign_off: business.email_sign_off || '',
    },
  });

  async function onSubmit(values: EmailSettingsFormValues) {
    const result = await updateBusinessSettings(values, business.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Email settings updated successfully.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="space-y-6 pb-6">
          <FormField
            control={form.control}
            name="email_name_token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Name Token</FormLabel>
                <FormDescription>
                  This is the token used by the email app in the greeting e.g. *|FNAME|*
                </FormDescription>
                <FormControl>
                  <Input placeholder="*|FNAME|*" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email_sign_off"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Sign Off</FormLabel>
                <FormDescription>
                  This is how you want to sign off from your emails.
                </FormDescription>
                <FormControl>
                  <Textarea
                    placeholder="Cheers,"
                    {...field}
                    value={field.value ?? ''}
                  />
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