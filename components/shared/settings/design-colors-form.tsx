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
import { updateBusinessSettings } from '@/app/(app)/settings/business/actions';
import { toast } from 'sonner';

const formSchema = z.object({
  color_primary: z.string().nullable().optional(),
  color_secondary: z.string().nullable().optional(),
  color_background: z.string().nullable().optional(),
  color_highlight: z.string().nullable().optional(),
});

type DesignColorsFormValues = z.infer<typeof formSchema>;

interface DesignColorsFormProps {
  business: Tables<'businesses'>;
}

export function DesignColorsForm({ business }: DesignColorsFormProps) {
  const form = useForm<DesignColorsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      color_primary: business.color_primary || '#000000',
      color_secondary: business.color_secondary || '#000000',
      color_background: business.color_background || '#ffffff',
      color_highlight: business.color_highlight || '#ff0000',
    },
  });

  async function onSubmit(values: DesignColorsFormValues) {
    const result = await updateBusinessSettings(values, business.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Design colors updated successfully.');
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardContent className="pb-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <FormField
              control={form.control}
              name="color_primary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Color</FormLabel>
                  <FormControl>
                    <Input type="color" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color_secondary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Color</FormLabel>
                  <FormControl>
                    <Input type="color" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color_background"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Background Color</FormLabel>
                  <FormControl>
                    <Input type="color" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color_highlight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Highlight Color</FormLabel>
                  <FormControl>
                    <Input type="color" {...field} value={field.value ?? ''} />
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