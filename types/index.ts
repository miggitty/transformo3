import { Database, Tables } from './supabase';

export type ContentAsset = Database['public']['Tables']['content_assets']['Row'];

export type ContentWithBusiness = Tables<'content'> & {
  businesses: (Tables<'businesses'> & {
    ai_avatar_integrations: Tables<'ai_avatar_integrations'>[];
  }) | null;
};

// Text editing interfaces
export interface FieldConfig {
  label: string;
  value: string;
  fieldKey: string;
  inputType: 'text' | 'textarea' | 'html';
  placeholder?: string;
  maxLength?: number;
  assetType?: string; // For content_assets fields, specify the content_type
} 