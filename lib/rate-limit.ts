import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  keyPrefix?: string;   // Optional prefix for the key
}

interface RateLimitStore {
  requests: number;
  resetTime: number;
}

// In-memory store for rate limiting
// In production, you should use Redis or a similar distributed cache
const store = new Map<string, RateLimitStore>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetTime < now) {
      store.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Get a unique identifier for the request
 * Uses IP address and optionally user ID
 */
function getRequestIdentifier(request: NextRequest, userId?: string): string {
  // Try to get real IP from various headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  const ip = forwardedFor?.split(',')[0] || realIp || cfConnectingIp || 'unknown';
  
  // If we have a user ID, include it in the key
  if (userId) {
    return `${ip}:${userId}`;
  }
  
  return ip;
}

/**
 * Check if a request should be rate limited
 * @param request - The incoming request
 * @param config - Rate limit configuration
 * @param userId - Optional user ID for user-specific rate limiting
 * @returns Object with allowed status and retry-after time if limited
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  userId?: string
): { allowed: boolean; retryAfter?: number; remaining?: number } {
  const identifier = getRequestIdentifier(request, userId);
  const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier;
  const now = Date.now();
  
  const record = store.get(key);
  
  // If no record exists or window has expired, create new record
  if (!record || record.resetTime < now) {
    store.set(key, {
      requests: 1,
      resetTime: now + config.windowMs
    });
    
    return { 
      allowed: true, 
      remaining: config.maxRequests - 1 
    };
  }
  
  // If within the window, check if limit exceeded
  if (record.requests >= config.maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { 
      allowed: false, 
      retryAfter,
      remaining: 0
    };
  }
  
  // Increment request count
  record.requests++;
  store.set(key, record);
  
  return { 
    allowed: true,
    remaining: config.maxRequests - record.requests
  };
}

/**
 * Rate limiter for authentication endpoints
 */
export const authRateLimiter = {
  // Sign in: 5 attempts per 15 minutes per IP
  signIn: (request: NextRequest) => checkRateLimit(request, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'auth:signin'
  }),
  
  // Sign up: 3 attempts per hour per IP
  signUp: (request: NextRequest) => checkRateLimit(request, {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyPrefix: 'auth:signup'
  }),
  
  // Password reset: 3 attempts per hour per IP
  passwordReset: (request: NextRequest) => checkRateLimit(request, {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyPrefix: 'auth:reset'
  }),
  
  // Email verification: 5 attempts per hour per IP
  emailVerification: (request: NextRequest) => checkRateLimit(request, {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyPrefix: 'auth:verify'
  })
};

/**
 * API rate limiter for general endpoints
 */
export const apiRateLimiter = {
  // Default: 100 requests per minute per IP
  default: (request: NextRequest, userId?: string) => checkRateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'api:default'
  }, userId),
  
  // Upload: 10 requests per minute per user
  upload: (request: NextRequest, userId?: string) => checkRateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyPrefix: 'api:upload'
  }, userId),
  
  // Webhook: 50 requests per minute per IP
  webhook: (request: NextRequest) => checkRateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 50,
    keyPrefix: 'api:webhook'
  })
};

/**
 * Create a custom rate limiter
 */
export function createRateLimiter(config: RateLimitConfig) {
  return (request: NextRequest, userId?: string) => 
    checkRateLimit(request, config, userId);
}