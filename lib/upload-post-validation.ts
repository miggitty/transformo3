/**
 * Upload-Post Security Validation Schema
 * Comprehensive validation rules for all upload-post related operations
 */

import { z } from 'zod';

// Base validation schemas
const usernameSchema = z
  .string()
  .min(5, 'Username must be at least 5 characters')
  .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
  .refine(
    (value) => value.includes('_') && value.split('_').length >= 2,
    'Username must contain business identifier format (businessname_id)'
  );

export const businessIdSchema = z
  .string()
  .uuid('Business ID must be a valid UUID');

export const redirectUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(
    (url) => {
      try {
        const parsedUrl = new URL(url);
        // Only allow HTTPS URLs or localhost for development
        return parsedUrl.protocol === 'https:' || parsedUrl.hostname.includes('localhost');
      } catch {
        return false;
      }
    },
    'Redirect URL must use HTTPS'
  )
  .refine(
    (url) => {
      try {
        const parsedUrl = new URL(url);
        // Ensure it's pointing to our integration page
        return parsedUrl.pathname.includes('/settings/integrations');
      } catch {
        return false;
      }
    },
    'Invalid redirect path'
  );

export const platformsSchema = z
  .array(
    z.enum(['facebook', 'instagram', 'twitter', 'youtube', 'linkedin', 'tiktok'])
  )
  .min(1, 'At least one platform must be specified')
  .max(6, 'Maximum 6 platforms allowed');

// Social account schemas
export const socialAccountSchema = z.object({
  display_name: z.string().min(1).max(100),
  social_images: z.string().url().optional().or(z.literal('')),
  username: z.string().min(1).max(50),
});

export const socialAccountsSchema = z.object({
  facebook: socialAccountSchema.optional().or(z.literal('')),
  instagram: socialAccountSchema.optional().or(z.literal('')),
  twitter: socialAccountSchema.optional().or(z.literal('')),
  youtube: socialAccountSchema.optional().or(z.literal('')),
  linkedin: socialAccountSchema.optional().or(z.literal('')),
  tiktok: socialAccountSchema.optional().or(z.literal('')),
});

// Request/Response schemas
export const createProfileRequestSchema = z.object({
  username: usernameSchema,
});

export const generateJWTRequestSchema = z.object({
  username: usernameSchema,
  redirectUrl: redirectUrlSchema.optional(),
  logoImage: z.string().url().optional(),
  redirectButtonText: z.string().min(1).max(100).optional(),
  platforms: platformsSchema.optional(),
});

export const uploadPostProfileSchema = z.object({
  id: z.string().uuid(),
  business_id: businessIdSchema,
  upload_post_username: usernameSchema,
  social_accounts: socialAccountsSchema.default({}),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  last_synced_at: z.string().datetime().optional(),
});

// JWT redirect validation schema
export const jwtRedirectParamsSchema = z.object({
  connected: z.enum(['true', 'false']).optional(),
  timestamp: z.string().regex(/^\d+$/).optional(),
});

// Rate limiting schemas
export const rateLimitSchema = z.object({
  key: z.string().min(1),
  limit: z.number().positive(),
  windowMs: z.number().positive(),
});

// Security validation functions
export function validateUploadPostUsername(username: string): string {
  const result = usernameSchema.safeParse(username);
  if (!result.success) {
    throw new Error(`Invalid username: ${result.error.errors[0]?.message}`);
  }
  return result.data;
}

export function validateBusinessId(businessId: string): string {
  const result = businessIdSchema.safeParse(businessId);
  if (!result.success) {
    throw new Error(`Invalid business ID: ${result.error.errors[0]?.message}`);
  }
  return result.data;
}

export function validateRedirectUrl(url: string): string {
  const result = redirectUrlSchema.safeParse(url);
  if (!result.success) {
    throw new Error(`Invalid redirect URL: ${result.error.errors[0]?.message}`);
  }
  return result.data;
}

export function validateSocialAccounts(accounts: unknown): Record<string, unknown> {
  const result = socialAccountsSchema.safeParse(accounts);
  if (!result.success) {
    throw new Error(`Invalid social accounts: ${result.error.errors[0]?.message}`);
  }
  return result.data;
}

export function validatePlatforms(platforms: unknown): string[] {
  const result = platformsSchema.safeParse(platforms);
  if (!result.success) {
    throw new Error(`Invalid platforms: ${result.error.errors[0]?.message}`);
  }
  return result.data;
}

// Sanitization functions
export function sanitizeString(input: unknown, maxLength: number = 255): string {
  if (typeof input !== 'string') {
    return '';
  }
  // Remove potentially dangerous characters and limit length
  return input
    .replace(/[<>"/\\&]/g, '') // Remove potential XSS characters
    .trim()
    .slice(0, maxLength);
}

export function sanitizeJsonData(data: unknown): Record<string, unknown> {
  if (data === null || data === undefined) {
    return {};
  }
  
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return validateSocialAccounts(parsed);
    } catch {
      return {};
    }
  }
  
  if (typeof data === 'object' && !Array.isArray(data)) {
    return validateSocialAccounts(data);
  }
  
  return {};
}

// JWT token validation
export function validateJWTRedirectParams(searchParams: URLSearchParams): {
  isValid: boolean;
  connected: boolean;
  timestamp?: number;
  error?: string;
} {
  try {
    const params = {
      connected: searchParams.get('connected'),
      timestamp: searchParams.get('timestamp'),
    };
    
    const result = jwtRedirectParamsSchema.safeParse(params);
    if (!result.success) {
      return {
        isValid: false,
        connected: false,
        error: 'Invalid redirect parameters',
      };
    }
    
    const connected = result.data.connected === 'true';
    
    if (!connected) {
      return { isValid: true, connected: false };
    }
    
    // Validate timestamp to prevent replay attacks (links valid for 1 hour)
    if (result.data.timestamp) {
      const timestamp = parseInt(result.data.timestamp, 10);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      if (isNaN(timestamp) || (now - timestamp) > oneHour) {
        return { 
          isValid: false, 
          connected: false, 
          error: 'Connection link has expired' 
        };
      }
      
      return { isValid: true, connected: true, timestamp };
    }
    
    // Allow connections without timestamp for backward compatibility
    return { isValid: true, connected: true };
  } catch {
    return { 
      isValid: false, 
      connected: false, 
      error: 'Invalid redirect parameters' 
    };
  }
}

// Security headers
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Rate limit configurations
export const rateLimitConfigs = {
  profiles: {
    get: { limit: 30, windowMs: 60000 }, // 30 requests per minute
    create: { limit: 5, windowMs: 300000 }, // 5 requests per 5 minutes
  },
  connect: {
    generate: { limit: 10, windowMs: 300000 }, // 10 requests per 5 minutes
  },
  sync: {
    manual: { limit: 20, windowMs: 60000 }, // 20 requests per minute
  },
} as const;

export type RateLimitConfig = typeof rateLimitConfigs;
export type RateLimitKey = keyof RateLimitConfig; 