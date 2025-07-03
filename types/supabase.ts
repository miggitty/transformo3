export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          query?: string
          extensions?: Json
          variables?: Json
          operationName?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_avatar_integrations: {
        Row: {
          avatar_id: string | null
          business_id: string
          created_at: string | null
          id: string
          last_synced_at: string | null
          provider: string
          provider_config: Json | null
          secret_id: string | null
          status: string | null
          updated_at: string | null
          validated_at: string | null
          voice_id: string | null
        }
        Insert: {
          avatar_id?: string | null
          business_id: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          provider_config?: Json | null
          secret_id?: string | null
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
          voice_id?: string | null
        }
        Update: {
          avatar_id?: string | null
          business_id?: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          provider_config?: Json | null
          secret_id?: string | null
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_avatar_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_integrations: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          provider: string
          provider_config: Json | null
          secret_id: string | null
          site_url: string
          status: string | null
          updated_at: string | null
          username: string | null
          validated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          provider: string
          provider_config?: Json | null
          secret_id?: string | null
          site_url: string
          status?: string | null
          updated_at?: string | null
          username?: string | null
          validated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          provider?: string
          provider_config?: Json | null
          secret_id?: string | null
          site_url?: string
          status?: string | null
          updated_at?: string | null
          username?: string | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          booking_link: string | null
          business_name: string
          color_background: string | null
          color_highlight: string | null
          color_primary: string | null
          color_secondary: string | null
          contact_email: string | null
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
          social_media_profiles: Json | null
          stripe_customer_id: string | null
          timezone: string | null
          website_url: string | null
          writing_style_guide: string | null
        }
        Insert: {
          booking_link?: string | null
          business_name: string
          color_background?: string | null
          color_highlight?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          contact_email?: string | null
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
          social_media_profiles?: Json | null
          stripe_customer_id?: string | null
          timezone?: string | null
          website_url?: string | null
          writing_style_guide?: string | null
        }
        Update: {
          booking_link?: string | null
          business_name?: string
          color_background?: string | null
          color_highlight?: string | null
          color_primary?: string | null
          color_secondary?: string | null
          contact_email?: string | null
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
          social_media_profiles?: Json | null
          stripe_customer_id?: string | null
          timezone?: string | null
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
          heygen_status: string | null
          heygen_url: string | null
          heygen_video_id: string | null
          id: string
          keyword: string | null
          project_type: string | null
          published_at: string | null
          research: string | null
          scheduled_at: string | null
          status: string | null
          transcript: string | null
          updated_at: string | null
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
          heygen_status?: string | null
          heygen_url?: string | null
          heygen_video_id?: string | null
          id?: string
          keyword?: string | null
          project_type?: string | null
          published_at?: string | null
          research?: string | null
          scheduled_at?: string | null
          status?: string | null
          transcript?: string | null
          updated_at?: string | null
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
          heygen_status?: string | null
          heygen_url?: string | null
          heygen_video_id?: string | null
          id?: string
          keyword?: string | null
          project_type?: string | null
          published_at?: string | null
          research?: string | null
          scheduled_at?: string | null
          status?: string | null
          transcript?: string | null
          updated_at?: string | null
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
          approved: boolean | null
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
          temporary_image_url: string | null
        }
        Insert: {
          approved?: boolean | null
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
          temporary_image_url?: string | null
        }
        Update: {
          approved?: boolean | null
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
          temporary_image_url?: string | null
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
      email_integrations: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          last_synced_at: string | null
          provider: string
          secret_id: string | null
          selected_group_id: string | null
          selected_group_name: string | null
          sender_email: string | null
          sender_name: string | null
          status: string | null
          updated_at: string | null
          validated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          secret_id?: string | null
          selected_group_id?: string | null
          selected_group_name?: string | null
          sender_email?: string | null
          sender_name?: string | null
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          secret_id?: string | null
          selected_group_id?: string | null
          selected_group_name?: string | null
          sender_email?: string | null
          sender_name?: string | null
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      stripe_events: {
        Row: {
          api_version: string | null
          created_at: string | null
          error_message: string | null
          event_data: Json | null
          event_type: string
          id: string
          processed_at: string | null
          processing_status: string | null
          stripe_event_id: string
        }
        Insert: {
          api_version?: string | null
          created_at?: string | null
          error_message?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          processed_at?: string | null
          processing_status?: string | null
          stripe_event_id: string
        }
        Update: {
          api_version?: string | null
          created_at?: string | null
          error_message?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          processed_at?: string | null
          processing_status?: string | null
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          business_id: string
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string
          current_period_start: string
          id: string
          price_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end: string | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end: string
          current_period_start: string
          id?: string
          price_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string
          current_period_start?: string
          id?: string
          price_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          trial_end?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_post_profiles: {
        Row: {
          business_id: string
          created_at: string | null
          facebook_page_id: string | null
          id: string
          last_synced_at: string | null
          social_accounts: Json | null
          updated_at: string | null
          upload_post_username: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          facebook_page_id?: string | null
          id?: string
          last_synced_at?: string | null
          social_accounts?: Json | null
          updated_at?: string | null
          upload_post_username: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          facebook_page_id?: string | null
          id?: string
          last_synced_at?: string | null
          social_accounts?: Json | null
          updated_at?: string | null
          upload_post_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_post_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
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
      cleanup_orphaned_email_secrets: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      delete_ai_avatar_integration: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      delete_blog_integration: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      delete_email_integration: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      generate_upload_post_username: {
        Args: { p_business_name: string; p_business_id: string }
        Returns: string
      }
      get_ai_avatar_integration: {
        Args: { p_business_id: string }
        Returns: {
          id: string
          provider: string
          avatar_id: string
          voice_id: string
          provider_config: Json
          status: string
          validated_at: string
        }[]
      }
      get_ai_avatar_secret: {
        Args: { p_business_id: string }
        Returns: string
      }
      get_blog_integration: {
        Args: { p_business_id: string }
        Returns: {
          id: string
          provider: string
          username: string
          site_url: string
          status: string
          validated_at: string
        }[]
      }
      get_blog_secret_v2: {
        Args: { p_business_id: string }
        Returns: string
      }
      get_business_secret: {
        Args: { p_business_id: string }
        Returns: string
      }
      get_email_integration: {
        Args: { p_business_id: string }
        Returns: {
          id: string
          provider: string
          sender_name: string
          sender_email: string
          selected_group_id: string
          selected_group_name: string
          status: string
          validated_at: string
        }[]
      }
      get_email_secret_v2: {
        Args: { p_business_id: string }
        Returns: string
      }
      set_ai_avatar_integration: {
        Args: {
          p_business_id: string
          p_provider: string
          p_api_key: string
          p_avatar_id?: string
          p_voice_id?: string
          p_config?: Json
        }
        Returns: string
      }
      set_blog_integration: {
        Args: {
          p_business_id: string
          p_provider: string
          p_credential: string
          p_username?: string
          p_site_url?: string
        }
        Returns: string
      }
      set_email_integration: {
        Args: {
          p_business_id: string
          p_provider: string
          p_api_key: string
          p_sender_name?: string
          p_sender_email?: string
        }
        Returns: string
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

