// =================================================================
//          Email Provider API Clients
// =================================================================
// This library provides API clients for email service providers
// (MailerLite, MailChimp, Brevo) with standardized interfaces for
// API key validation and group/list fetching.
// =================================================================

export type EmailProvider = 'mailerlite' | 'mailchimp' | 'brevo';

export interface EmailGroup {
  id: string;
  name: string;
  subscriber_count?: number;
}

export interface EmailProviderResponse {
  success: boolean;
  groups?: EmailGroup[];
  error?: string;
}

// Base class for email provider clients
abstract class BaseEmailProvider {
  constructor(protected apiKey: string) {}
  
  abstract validateAndFetchGroups(): Promise<EmailProviderResponse>;
}

// MailerLite API Client
export class MailerLiteProvider extends BaseEmailProvider {
  private readonly baseUrl = 'https://connect.mailerlite.com/api';

  async validateAndFetchGroups(): Promise<EmailProviderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/groups`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid API key. Please check your credentials and try again.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Too many requests. Please wait a moment and try again.' };
        }
        return { success: false, error: `Service temporarily unavailable. Please try again later. (Status: ${response.status})` };
      }

      const data = await response.json();
      
      // MailerLite returns groups in data.data array
      const groups: EmailGroup[] = (data.data || []).map((group: any) => ({
        id: group.id,
        name: group.name,
        subscriber_count: group.active_count,
      }));

      return { success: true, groups };
    } catch (error) {
      console.error('MailerLite API error:', error);
      return { 
        success: false, 
        error: 'Unable to connect to MailerLite. Please check your internet connection.' 
      };
    }
  }
}

// MailChimp API Client
export class MailChimpProvider extends BaseEmailProvider {
  private getBaseUrl(): string {
    // Extract datacenter from API key (last part after the dash)
    const dc = this.apiKey.split('-').pop();
    if (!dc) {
      throw new Error('Invalid MailChimp API key format');
    }
    return `https://${dc}.api.mailchimp.com/3.0`;
  }

  async validateAndFetchGroups(): Promise<EmailProviderResponse> {
    try {
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/lists`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`anystring:${this.apiKey}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid API key. Please check your credentials and try again.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Too many requests. Please wait a moment and try again.' };
        }
        return { success: false, error: `Service temporarily unavailable. Please try again later. (Status: ${response.status})` };
      }

      const data = await response.json();
      
      // MailChimp returns lists in lists array
      const groups: EmailGroup[] = (data.lists || []).map((list: any) => ({
        id: list.id,
        name: list.name,
        subscriber_count: list.stats?.member_count,
      }));

      return { success: true, groups };
    } catch (error) {
      console.error('MailChimp API error:', error);
      return { 
        success: false, 
        error: 'Unable to connect to MailChimp. Please check your internet connection.' 
      };
    }
  }
}

// Brevo API Client
export class BrevoProvider extends BaseEmailProvider {
  private readonly baseUrl = 'https://api.brevo.com/v3';

  async validateAndFetchGroups(): Promise<EmailProviderResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/contacts/lists`, {
        method: 'GET',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid API key. Please check your credentials and try again.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Too many requests. Please wait a moment and try again.' };
        }
        return { success: false, error: `Service temporarily unavailable. Please try again later. (Status: ${response.status})` };
      }

      const data = await response.json();
      
      // Brevo returns lists in lists array
      const groups: EmailGroup[] = (data.lists || []).map((list: any) => ({
        id: list.id.toString(),
        name: list.name,
        subscriber_count: list.totalSubscribers,
      }));

      return { success: true, groups };
    } catch (error) {
      console.error('Brevo API error:', error);
      return { 
        success: false, 
        error: 'Unable to connect to Brevo. Please check your internet connection.' 
      };
    }
  }
}

// Factory function to create provider instances
export function createEmailProvider(provider: EmailProvider, apiKey: string): BaseEmailProvider {
  switch (provider) {
    case 'mailerlite':
      return new MailerLiteProvider(apiKey);
    case 'mailchimp':
      return new MailChimpProvider(apiKey);
    case 'brevo':
      return new BrevoProvider(apiKey);
    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}

// Utility function to validate API key and fetch groups
export async function validateEmailProviderAndFetchGroups(
  provider: EmailProvider,
  apiKey: string
): Promise<EmailProviderResponse> {
  try {
    const providerClient = createEmailProvider(provider, apiKey);
    return await providerClient.validateAndFetchGroups();
  } catch (error) {
    console.error('Email provider validation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
} 