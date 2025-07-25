/**
 * File validation utilities for secure file uploads
 */

// Allowed MIME types for each file category
export const ALLOWED_MIME_TYPES = {
  audio: [
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav'
  ],
  image: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ],
  video: [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-ms-wmv'
  ]
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  audio: 50 * 1024 * 1024,    // 50MB
  image: 10 * 1024 * 1024,    // 10MB
  video: 400 * 1024 * 1024,   // 400MB
} as const;

// Map of MIME types to file extensions
export const MIME_TO_EXTENSION: Record<string, string> = {
  // Audio
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  // Image
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  // Video
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-ms-wmv': 'wmv',
};

// File signatures (magic bytes) for validation
const FILE_SIGNATURES: Record<string, { offset: number; signature: number[] }[]> = {
  'image/jpeg': [
    { offset: 0, signature: [0xFF, 0xD8, 0xFF] }
  ],
  'image/png': [
    { offset: 0, signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }
  ],
  'image/gif': [
    { offset: 0, signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { offset: 0, signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }  // GIF89a
  ],
  'image/webp': [
    { offset: 0, signature: [0x52, 0x49, 0x46, 0x46] }, // RIFF
    { offset: 8, signature: [0x57, 0x45, 0x42, 0x50] }  // WEBP
  ],
  'video/mp4': [
    { offset: 4, signature: [0x66, 0x74, 0x79, 0x70] } // ftyp
  ],
  'video/webm': [
    { offset: 0, signature: [0x1A, 0x45, 0xDF, 0xA3] } // EBML header
  ],
  'audio/webm': [
    { offset: 0, signature: [0x1A, 0x45, 0xDF, 0xA3] } // EBML header (same as video)
  ],
  'audio/mpeg': [
    { offset: 0, signature: [0xFF, 0xFB] }, // MP3 with frame sync
    { offset: 0, signature: [0xFF, 0xFA] }, // MP3 with frame sync
    { offset: 0, signature: [0x49, 0x44, 0x33] } // ID3 tag
  ],
  'audio/wav': [
    { offset: 0, signature: [0x52, 0x49, 0x46, 0x46] }, // RIFF
    { offset: 8, signature: [0x57, 0x41, 0x56, 0x45] }  // WAVE
  ]
};

/**
 * Validate file type based on MIME type
 */
export function validateFileType(
  mimeType: string,
  category: keyof typeof ALLOWED_MIME_TYPES
): { valid: boolean; error?: string } {
  const allowedTypes = ALLOWED_MIME_TYPES[category];
  
  if (!allowedTypes.includes(mimeType as (typeof allowedTypes)[number])) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    };
  }
  
  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(
  size: number,
  category: keyof typeof FILE_SIZE_LIMITS
): { valid: boolean; error?: string } {
  const maxSize = FILE_SIZE_LIMITS[category];
  
  if (size > maxSize) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
    };
  }
  
  if (size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }
  
  return { valid: true };
}

/**
 * Get safe file extension from MIME type
 */
export function getSafeFileExtension(mimeType: string): string {
  return MIME_TO_EXTENSION[mimeType] || 'bin';
}

/**
 * Validate file content matches declared MIME type
 * @param buffer - File content as ArrayBuffer
 * @param declaredMimeType - The MIME type claimed by the upload
 */
export async function validateFileContent(
  buffer: ArrayBuffer,
  declaredMimeType: string
): Promise<{ valid: boolean; error?: string }> {
  const signatures = FILE_SIGNATURES[declaredMimeType];
  
  if (!signatures) {
    // If we don't have signatures for this type, we can't validate
    // This is not necessarily an error, just means we can't verify
    return { valid: true };
  }
  
  const bytes = new Uint8Array(buffer);
  
  // Check if any of the signatures match
  const isValid = signatures.some(({ offset, signature }) => {
    // Check if file is large enough
    if (bytes.length < offset + signature.length) {
      return false;
    }
    
    // Check if bytes match signature
    return signature.every((byte, index) => bytes[offset + index] === byte);
  });
  
  if (!isValid) {
    return {
      valid: false,
      error: `File content does not match declared type: ${declaredMimeType}`
    };
  }
  
  return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove any path separators
  return filename
    .replace(/[\/\\]/g, '')
    .replace(/\.{2,}/g, '.')  // Remove multiple dots
    .replace(/^\./, '')       // Remove leading dot
    .trim();
}

/**
 * Complete file validation
 */
export async function validateFile(
  file: {
    buffer: ArrayBuffer;
    size: number;
    mimeType: string;
    filename?: string;
  },
  category: keyof typeof ALLOWED_MIME_TYPES
): Promise<{ valid: boolean; error?: string; extension?: string }> {
  // Validate file type
  const typeValidation = validateFileType(file.mimeType, category);
  if (!typeValidation.valid) {
    return typeValidation;
  }
  
  // Validate file size
  const sizeValidation = validateFileSize(file.size, category);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }
  
  // Validate file content matches MIME type
  const contentValidation = await validateFileContent(file.buffer, file.mimeType);
  if (!contentValidation.valid) {
    return contentValidation;
  }
  
  // Get safe extension
  const extension = getSafeFileExtension(file.mimeType);
  
  return { valid: true, extension };
}