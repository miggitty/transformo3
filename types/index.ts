import { Tables } from './supabase';

export type ContentWithBusiness = Tables<'content'> & {
  businesses: Tables<'businesses'> | null;
}; 