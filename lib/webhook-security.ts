import crypto from 'crypto';

/**
 * Generate HMAC signature for webhook payload
 * @param payload - The webhook payload
 * @param secret - The webhook secret
 * @param timestamp - The request timestamp
 * @returns The HMAC signature
 */
export function generateWebhookSignature(
  payload: string | object,
  secret: string,
  timestamp: number
): string {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const message = `${timestamp}.${payloadString}`;
  
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

/**
 * Verify webhook signature
 * @param payload - The webhook payload
 * @param signature - The signature to verify
 * @param secret - The webhook secret
 * @param timestamp - The request timestamp
 * @param maxAgeMs - Maximum age of the request in milliseconds (default: 5 minutes)
 * @returns Object with verification result and error message if failed
 */
export function verifyWebhookSignature(
  payload: string | object,
  signature: string,
  secret: string,
  timestamp: number,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes
): { valid: boolean; error?: string } {
  // Check timestamp to prevent replay attacks
  const now = Date.now();
  if (now - timestamp > maxAgeMs) {
    return { valid: false, error: 'Request timestamp too old' };
  }
  
  if (timestamp > now + 60000) { // Allow 1 minute clock skew
    return { valid: false, error: 'Request timestamp in the future' };
  }
  
  // Generate expected signature
  const expectedSignature = generateWebhookSignature(payload, secret, timestamp);
  
  // Use timing-safe comparison
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  
  return { valid };
}

/**
 * Extract webhook headers for verification
 * @param headers - The request headers
 * @returns Object with signature and timestamp
 */
export function extractWebhookHeaders(headers: Headers): {
  signature: string | null;
  timestamp: number | null;
} {
  const signature = headers.get('x-webhook-signature');
  const timestampStr = headers.get('x-webhook-timestamp');
  const timestamp = timestampStr ? parseInt(timestampStr, 10) : null;
  
  return { signature, timestamp };
}

/**
 * Validate webhook request
 * @param request - The incoming request
 * @param body - The request body
 * @param secret - The webhook secret
 * @returns Object with validation result and error message if failed
 */
export async function validateWebhookRequest(
  request: Request,
  body: unknown,
  secret: string
): Promise<{ valid: boolean; error?: string }> {
  const { signature, timestamp } = extractWebhookHeaders(request.headers);
  
  if (!signature || !timestamp) {
    return { valid: false, error: 'Missing webhook signature or timestamp' };
  }
  
  if (isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }
  
  return verifyWebhookSignature(body, signature, secret, timestamp);
}

/**
 * Generate a secure webhook secret
 * @param length - Length of the secret (default: 32)
 * @returns A cryptographically secure random string
 */
export function generateWebhookSecret(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Create webhook headers for outgoing requests
 * @param payload - The webhook payload
 * @param secret - The webhook secret
 * @returns Headers object with signature and timestamp
 */
export function createWebhookHeaders(
  payload: string | object,
  secret: string
): Record<string, string> {
  const timestamp = Date.now();
  const signature = generateWebhookSignature(payload, secret, timestamp);
  
  return {
    'x-webhook-signature': signature,
    'x-webhook-timestamp': timestamp.toString(),
    'content-type': 'application/json'
  };
}