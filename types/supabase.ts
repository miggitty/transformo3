export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          booking_link: string | null
          business_name: string
          contact_email: string | null
          contact_url: string | null
          created_at: string | null
          cta_email: string | null
          cta_social_long: string | null
          cta_social_short: string | null
          cta_youtube: string | null
          email_name_token: string | null
          email_sign_off: string | null
          first_name: string | null
          id: string
          last_name: string | null
          social_media_integrations: Json | null
          social_media_profiles: Json | null
          website_url: string | null
          writing_style_guide: string | null
        }
        Insert: {
          booking_link?: string | null
          business_name: string
          contact_email?: string | null
          contact_url?: string | null
          created_at?: string | null
          cta_email?: string | null
          cta_social_long?: string | null
          cta_social_short?: string | null
          cta_youtube?: string | null
          email_name_token?: string | null
          email_sign_off?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          social_media_integrations?: Json | null
          social_media_profiles?: Json | null
          website_url?: string | null
          writing_style_guide?: string | null
        }
        Update: {
          booking_link?: string | null
          business_name?: string
          contact_email?: string | null
          contact_url?: string | null
          created_at?: string | null
          cta_email?: string | null
          cta_social_long?: string | null
          cta_social_short?: string | null
          cta_youtube?: string | null
          email_name_token?: string | null
          email_sign_off?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          social_media_integrations?: Json | null
          social_media_profiles?: Json | null
          website_url?: string | null
          writing_style_guide?: string | null
        }
        Relationships: []
      }
      content: {
        Row: {
          audio_url: string | null
          business_id: string | null
          content_title: string | null
          created_at: string | null
          error_message: string | null
          heygen_url: string | null
          id: string
          keyword: string | null
          published_at: string | null
          research: string | null
          scheduled_at: string | null
          status: string | null
          transcript: string | null
          video_long_url: string | null
          video_script: string | null
          video_short_url: string | null
        }
        Insert: {
          audio_url?: string | null
          business_id?: string | null
          content_title?: string | null
          created_at?: string | null
          error_message?: string | null
          heygen_url?: string | null
          id?: string
          keyword?: string | null
          published_at?: string | null
          research?: string | null
          scheduled_at?: string | null
          status?: string | null
          transcript?: string | null
          video_long_url?: string | null
          video_script?: string | null
          video_short_url?: string | null
        }
        Update: {
          audio_url?: string | null
          business_id?: string | null
          content_title?: string | null
          created_at?: string | null
          error_message?: string | null
          heygen_url?: string | null
          id?: string
          keyword?: string | null
          published_at?: string | null
          research?: string | null
          scheduled_at?: string | null
          status?: string | null
          transcript?: string | null
          video_long_url?: string | null
          video_script?: string | null
          video_short_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      content_assets: {
        Row: {
          asset_published_at: string | null
          asset_scheduled_at: string | null
          asset_status: string | null
          blog_meta_description: string | null
          blog_url: string | null
          content: string | null
          content_id: string | null
          content_prompt: string | null
          content_type: string | null
          created_at: string | null
          error_message: string | null
          headline: string | null
          headline_prompt: string | null
          id: string
          image_prompt: string | null
          image_url: string | null
          name: string | null
        }
        Insert: {
          asset_published_at?: string | null
          asset_scheduled_at?: string | null
          asset_status?: string | null
          blog_meta_description?: string | null
          blog_url?: string | null
          content?: string | null
          content_id?: string | null
          content_prompt?: string | null
          content_type?: string | null
          created_at?: string | null
          error_message?: string | null
          headline?: string | null
          headline_prompt?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          name?: string | null
        }
        Update: {
          asset_published_at?: string | null
          asset_scheduled_at?: string | null
          asset_status?: string | null
          blog_meta_description?: string | null
          blog_url?: string | null
          content?: string | null
          content_id?: string | null
          content_prompt?: string | null
          content_type?: string | null
          created_at?: string | null
          error_message?: string | null
          headline?: string | null
          headline_prompt?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_assets_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_id: string | null
          first_name: string | null
          id: string
          is_admin: boolean | null
          last_name: string | null
        }
        Insert: {
          business_id?: string | null
          first_name?: string | null
          id: string
          is_admin?: boolean | null
          last_name?: string | null
        }
        Update: {
          business_id?: string | null
          first_name?: string | null
          id?: string
          is_admin?: boolean | null
          last_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
