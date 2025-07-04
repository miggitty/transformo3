/**
 * Upload-Post API Client
 * Handles integration with upload-post.com API for social media management
 */

const UPLOAD_POST_API_URL = 'https://api.upload-post.com/api/uploadposts';

// Custom error types for better error handling
export class UploadPostError extends Error {
  constructor(message: string, public statusCode?: number, public originalError?: Error) {
    super(message);
    this.name = 'UploadPostError';
  }
}

export class UploadPostAuthError extends UploadPostError {
  constructor(message: string = 'Invalid API key or authentication failed') {
    super(message, 401);
    this.name = 'UploadPostAuthError';
  }
}

export class UploadPostRateLimitError extends UploadPostError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429);
    this.name = 'UploadPostRateLimitError';
  }
}

export class UploadPostValidationError extends UploadPostError {
  constructor(message: string = 'Invalid request data') {
    super(message, 400);
    this.name = 'UploadPostValidationError';
  }
}

// Security validation functions
export function validateUsername(username: string): string {
  if (!username || typeof username !== 'string') {
    throw new UploadPostValidationError('Username is required and must be a string');
  }
  
  // Sanitize username - only allow alphanumeric characters, underscores, and hyphens
  const sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '');
  
  if (sanitized.length < 3 || sanitized.length > 50) {
    throw new UploadPostValidationError('Username must be between 3 and 50 characters');
  }
  
  // Ensure it contains underscore (business_name_id format)
  if (!sanitized.includes('_')) {
    throw new UploadPostValidationError('Invalid username format for business integration');
  }
  
  return sanitized;
}

export function validateRedirectUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new UploadPostValidationError('Redirect URL is required');
  }
  
  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTPS URLs or localhost for development
    if (parsedUrl.protocol !== 'https:' && !parsedUrl.hostname.includes('localhost')) {
      throw new UploadPostValidationError('Redirect URL must use HTTPS');
    }
    
    // Validate that the URL belongs to our domain or localhost
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (baseUrl) {
      const baseUrlObj = new URL(baseUrl);
      if (parsedUrl.hostname !== baseUrlObj.hostname && !parsedUrl.hostname.includes('localhost')) {
        throw new UploadPostValidationError('Redirect URL must be from the same domain');
      }
    }
    
    // Ensure it's pointing to our integration page
    if (!parsedUrl.pathname.includes('/settings/integrations')) {
      throw new UploadPostValidationError('Invalid redirect path');
    }
    
    return url;
  } catch (error) {
    if (error instanceof UploadPostValidationError) {
      throw error;
    }
    throw new UploadPostValidationError('Invalid redirect URL format');
  }
}

export function validateBusinessId(businessId: string): string {
  if (!businessId || typeof businessId !== 'string') {
    throw new UploadPostValidationError('Business ID is required');
  }
  
  // UUID v4 validation (basic)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(businessId)) {
    throw new UploadPostValidationError('Invalid business ID format');
  }
  
  return businessId;
}

export function sanitizeJsonData(data: unknown): Record<string, unknown> {
  if (data === null || data === undefined) {
    return {};
  }
  
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  
  return {};
}

interface SocialAccount {
  display_name: string;
  social_images: string;
  username: string;
}

interface SocialAccounts {
  facebook?: SocialAccount | "";
  instagram?: SocialAccount | "";
  x?: SocialAccount | "";
  youtube?: SocialAccount | "";
  linkedin?: SocialAccount | "";
  tiktok?: SocialAccount | "";
}

interface UploadPostProfile {
  created_at: string;
  social_accounts: SocialAccounts;
  username: string;
}

interface GetUserProfilesResponse {
  limit: number;
  plan: string;
  profiles: UploadPostProfile[];
  success: boolean;
}

interface CreateUserProfileResponse {
  success: boolean;
  profile: {
    username: string;
    created_at: string;
  };
}

interface GenerateJWTResponse {
  success: boolean;
  access_url: string;
}

interface FacebookPage {
  id: string;
  name: string;
  account_id: string;
  picture?: string;
}

interface FacebookPagesResponse {
  pages: FacebookPage[];
  success: boolean;
}

/**
 * Get the API key from environment variables
 */
function getApiKey(): string {
  const apiKey = process.env.UPLOAD_POST_API_KEY;
  if (!apiKey) {
    throw new UploadPostAuthError('UPLOAD_POST_API_KEY environment variable is not set');
  }
  return apiKey;
}

/**
 * Create headers for upload-post API requests with security headers
 */
function createHeaders(): HeadersInit {
  return {
    'Authorization': `ApiKey ${getApiKey()}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Transformo/1.0',
    'X-Requested-With': 'XMLHttpRequest',
  };
}

/**
 * Handle API response errors with specific error types
 */
async function handleApiError(response: Response): Promise<never> {
  let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
  
  try {
    const errorData = await response.json();
    if (errorData.error) {
      errorMessage = errorData.error;
    }
  } catch {
    // If we can't parse the error response, use the default message
  }

  switch (response.status) {
    case 401:
      throw new UploadPostAuthError(errorMessage);
    case 400:
      throw new UploadPostValidationError(errorMessage);
    case 429:
      throw new UploadPostRateLimitError(errorMessage);
    case 500:
    case 502:
    case 503:
      throw new UploadPostError(`Server error: ${errorMessage}`, response.status);
    default:
      throw new UploadPostError(errorMessage, response.status);
  }
}

/**
 * Retry logic with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Don't retry on authentication or validation errors
      if (error instanceof UploadPostAuthError || error instanceof UploadPostValidationError) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new UploadPostError('Max retries exceeded');
}

/**
 * Get all user profiles from upload-post
 */
export async function getUserProfiles(): Promise<GetUserProfilesResponse> {
  return withRetry(async () => {
    try {
      const response = await fetch(`${UPLOAD_POST_API_URL}/users`, {
        method: 'GET',
        headers: createHeaders(),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof UploadPostError) {
        throw error;
      }
      console.error('Error fetching user profiles:', error);
      throw new UploadPostError('Failed to fetch user profiles', undefined, error as Error);
    }
  });
}

/**
 * Create a new user profile on upload-post with validation
 */
export async function createUserProfile(username: string): Promise<CreateUserProfileResponse> {
  const validatedUsername = validateUsername(username);
  
  return withRetry(async () => {
    try {
      const response = await fetch(`${UPLOAD_POST_API_URL}/users`, {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({ username: validatedUsername }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof UploadPostError) {
        throw error;
      }
      console.error('Error creating user profile:', error);
      throw new UploadPostError('Failed to create user profile', undefined, error as Error);
    }
  });
}

/**
 * Generate JWT URL for social media connection with enhanced security
 */
export async function generateJWTUrl(
  username: string,
  options: {
    redirectUrl?: string;
    logoImage?: string;
    redirectButtonText?: string;
    platforms?: string[];
  } = {}
): Promise<GenerateJWTResponse> {
  const validatedUsername = validateUsername(username);
  
  const {
            redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?connected=true`,
        logoImage = `${process.env.NEXT_PUBLIC_APP_URL}/transformo-logo.webp`,
    redirectButtonText = 'Return to Transformo',
    platforms = ['facebook', 'instagram', 'linkedin', 'tiktok', 'x', 'youtube']
  } = options;

  // Validate redirect URL for security
  const validatedRedirectUrl = validateRedirectUrl(redirectUrl);
  
  // Validate platforms array
  const allowedPlatforms = ['facebook', 'instagram', 'linkedin', 'tiktok', 'x', 'youtube'];
  const validatedPlatforms = platforms.filter(platform => 
    allowedPlatforms.includes(platform.toLowerCase())
  );

  if (validatedPlatforms.length === 0) {
    throw new UploadPostValidationError('At least one valid platform must be specified');
  }

  // Add timestamp to prevent replay attacks
  const timestampedRedirectUrl = new URL(validatedRedirectUrl);
  timestampedRedirectUrl.searchParams.set('timestamp', Date.now().toString());

  return withRetry(async () => {
    try {
      const response = await fetch(`${UPLOAD_POST_API_URL}/users/generate-jwt`, {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({
          username: validatedUsername,
          redirect_url: timestampedRedirectUrl.toString(),
          logo_image: logoImage,
          redirect_button_text: redirectButtonText,
          platforms: validatedPlatforms,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof UploadPostError) {
        throw error;
      }
      console.error('Error generating JWT URL:', error);
      throw new UploadPostError('Failed to generate JWT URL', undefined, error as Error);
    }
  });
}

/**
 * Find profile by username with validation
 */
export async function findProfileByUsername(username: string): Promise<UploadPostProfile | null> {
  const validatedUsername = validateUsername(username);
  
  return withRetry(async () => {
    try {
      const profiles = await getUserProfiles();
      const profile = profiles.profiles.find(p => p.username === validatedUsername);
      return profile || null;
    } catch (error) {
      if (error instanceof UploadPostError) {
        throw error;
      }
      console.error('Error finding profile by username:', error);
      throw new UploadPostError('Failed to find profile', undefined, error as Error);
    }
  });
}

/**
 * Test connection with enhanced security validation
 */
export async function testConnection(): Promise<boolean> {
  try {
    const response = await getUserProfiles();
    return response.success === true;
  } catch (error) {
    console.error('Upload-post connection test failed:', error);
    return false;
  }
}

/**
 * Validate JWT redirect parameters for security
 */
export function validateJWTRedirect(searchParams: URLSearchParams): {
  isValid: boolean;
  connected: boolean;
  timestamp?: number;
  error?: string;
} {
  try {
    const connected = searchParams.get('connected') === 'true';
    const timestampStr = searchParams.get('timestamp');
    
    if (!connected) {
      return { isValid: true, connected: false };
    }
    
    // Validate timestamp to prevent replay attacks (links valid for 1 hour)
    if (timestampStr) {
      const timestamp = parseInt(timestampStr, 10);
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

/**
 * Generate upload-post username from business name and business ID
 * Format: {sanitized_business_name}_{last_8_digits_of_business_id}
 */
export function generateUploadPostUsername(businessName: string, businessId: string): string {
  // Sanitize business name for username
  const sanitizedBusinessName = businessName
    .toLowerCase()
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, ''); // Remove any remaining non-alphanumeric characters except underscores
  
  // Get last 8 characters of business ID for uniqueness
  const businessIdSuffix = businessId.replace(/-/g, '').slice(-8);
  
  // Combine sanitized business name with business ID suffix
  const username = `${sanitizedBusinessName}_${businessIdSuffix}`;
  
  // Ensure we have a valid username (minimum length check only)
  if (sanitizedBusinessName.length === 0) {
    return `business_${businessIdSuffix}`;
  }
  
  return username;
}

/**
 * Fetch Facebook Page ID for a given upload-post username
 * Returns the first page ID if available, null otherwise
 */
export async function fetchFacebookPageId(username: string): Promise<string | null> {
  try {
    // Validate username before making API call
    const validatedUsername = validateUsername(username);
    
    console.log(`📡 Fetching Facebook pages for profile: ${validatedUsername}`);
    
    const response = await fetch(
      `${UPLOAD_POST_API_URL}/facebook/pages?profile=${encodeURIComponent(validatedUsername)}`,
      {
        method: 'GET',
        headers: createHeaders(),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      }
    );

    console.log(`📡 Facebook Pages API response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn(`❌ Failed to fetch Facebook pages for ${username}: ${response.status} - ${errorText}`);
      return null;
    }

    const data: FacebookPagesResponse = await response.json();
    console.log(`📡 Facebook Pages API response:`, JSON.stringify(data, null, 2));
    
    // Return the first page ID if available
    if (data.success && data.pages && data.pages.length > 0) {
      console.log(`✅ Found ${data.pages.length} Facebook page(s), using first: ${data.pages[0].id}`);
      return data.pages[0].id;
    }
    
    console.log(`⚠️ No Facebook pages found in response`);
    return null;
  } catch (error) {
    console.error('❌ Error fetching Facebook Page ID:', error);
    return null;
  }
} 