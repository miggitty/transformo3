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
import { updateBusinessSettings } from '@/app/(app)/settings/business/actions';
import { toast } from 'sonner';

const formSchema = z.object({
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  writing_style_guide: z.string().nullable().optional(),
});

type SpeakerDetailsFormValues = z.infer<typeof formSchema>;

interface SpeakerDetailsFormProps {
  business: Tables<'businesses'>;
}

export function SpeakerDetailsForm({ business }: SpeakerDetailsFormProps) {
  const form = useForm<SpeakerDetailsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: business.first_name || '',
      last_name: business.last_name || '',
      writing_style_guide: business.writing_style_guide || '',
    },
  });

  async function onSubmit(values: SpeakerDetailsFormValues) {
    const result = await updateBusinessSettings(values, business.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Speaker details updated successfully.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="pb-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormDescription>This is the name of the person speaking in the videos</FormDescription>
                  <FormControl>
                    <Input placeholder="John" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="writing_style_guide"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Writing Style Guide</FormLabel>
                   <FormDescription>Enter your writing style, which the AI writer will use to mimic your writing</FormDescription>
                  <FormControl>
                    <Textarea
                      className="min-h-[150px]"
                      placeholder="Describe your brand's tone of voice..."
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
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