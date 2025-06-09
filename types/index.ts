import { Database, Tables } from './supabase';

export type ContentAsset = Database['public']['Tables']['content_assets']['Row'];

export type ContentWithBusiness = Tables<'content'> & {
  businesses: Tables<'businesses'> | null;
}; 