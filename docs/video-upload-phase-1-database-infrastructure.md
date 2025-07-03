# Video Upload Project - Phase 1: Database & Infrastructure

## Overview
This phase establishes the database schema and core TypeScript infrastructure for the project type system. Complete this phase before moving to Phase 2.

## Implementation Steps

### Step 1: Create Database Migration

#### File: `supabase/migrations/YYYYMMDDHHMMSS_add-project-type-to-content.sql`

```sql
-- Add project_type field to content table
-- This enables differentiation between voice recording and video upload projects

ALTER TABLE content 
ADD COLUMN project_type TEXT DEFAULT 'voice_recording';

-- Add constraint to ensure only valid project types
ALTER TABLE content 
ADD CONSTRAINT content_project_type_check 
CHECK (project_type IN ('voice_recording', 'video_upload'));

-- Add index for performance when filtering by project type
CREATE INDEX idx_content_project_type ON content(project_type);

-- Add comment for documentation
COMMENT ON COLUMN content.project_type IS 'Type of project: voice_recording (audio) or video_upload (video). Determines workflow and UI behavior.';
```

**Migration Filename Convention**: Use Brisbane timezone
```bash
# Generate timestamp for Brisbane timezone
timestamp=$(TZ=Australia/Brisbane date +"%Y%m%d%H%M%S")
echo "Migration file: ${timestamp}_add-project-type-to-content.sql"
```

**Apply Migration**:
```bash
supabase db push
```

### Step 2: Update TypeScript Types

#### File: `types/index.ts`
Add project type constants and types:

```typescript
import { Database, Tables } from './supabase';

export type ContentAsset = Database['public']['Tables']['content_assets']['Row'];

export type ContentWithBusiness = Tables<'content'> & {
  businesses: (Tables<'businesses'> & {
    ai_avatar_integrations: Tables<'ai_avatar_integrations'>[];
  }) | null;
};

// Project Type System
export type ProjectType = 'voice_recording' | 'video_upload';

export const PROJECT_TYPES = {
  VOICE_RECORDING: 'voice_recording' as const,
  VIDEO_UPLOAD: 'video_upload' as const,
} as const;

export const PROJECT_TYPE_LABELS = {
  voice_recording: 'Voice Recording',
  video_upload: 'Video Upload',
} as const;

// Enhanced content type with project type
export type ContentWithProjectType = Tables<'content'> & {
  project_type: ProjectType;
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
```

#### File: `types/supabase.ts`
The Supabase CLI will automatically update this file when you run:
```bash
npx supabase gen types typescript --local > types/supabase.ts
```

**Verify the content table now includes**:
```typescript
content: {
  Row: {
    // ... existing fields ...
    project_type: string | null
  }
  Insert: {
    // ... existing fields ...
    project_type?: string | null
  }
  Update: {
    // ... existing fields ...
    project_type?: string | null
  }
}
```

### Step 3: Update Content Status Logic

#### File: `lib/content-status.ts`
Update the status determination to handle both project types:

```typescript
import { Tables } from '@/types/supabase';
import { ProjectType } from '@/types';

export type ContentStatus = 
  | 'processing' 
  | 'failed' 
  | 'draft' 
  | 'scheduled' 
  | 'partially-published' 
  | 'completed';

export type ContentWithAssets = {
  content: Tables<'content'>;
  assets: Tables<'content_assets'>[];
};

/**
 * Determines the status of content based on content record and its assets
 * Handles both voice_recording and video_upload project types
 */
export function determineContentStatus(
  content: Tables<'content'>, 
  assets: Tables<'content_assets'>[]
): ContentStatus {
  // Processing: Audio/Video still being processed or content generation in progress
  if (content.status === 'processing' || content.content_generation_status === 'generating') {
    return 'processing';
  }
  
  // Failed: Content generation failed or has no assets after completion
  if (content.content_generation_status === 'failed' || 
      (content.status === 'completed' && assets.length === 0)) {
    return 'failed';
  }
  
  // Asset-based status determination (same for both project types)
  const scheduledAssets = assets.filter(asset => asset.asset_scheduled_at);
  const sentAssets = assets.filter(asset => asset.asset_status === 'Sent');
  
  // Completed: All assets have been sent successfully
  if (assets.length > 0 && sentAssets.length === assets.length) {
    return 'completed';
  }
  
  // Partially Published: Some assets sent, some pending/failed
  if (sentAssets.length > 0 && sentAssets.length < assets.length) {
    return 'partially-published';
  }
  
  // Scheduled: Assets have scheduled dates but none sent yet
  if (scheduledAssets.length > 0 && sentAssets.length === 0) {
    return 'scheduled';
  }
  
  // Draft: Content is complete but no assets scheduled
  return 'draft';
}

/**
 * Determines if content can be scheduled (all assets must be approved)
 * Same logic for both project types
 */
export function canScheduleContent(assets: Tables<'content_assets'>[]): boolean {
  if (assets.length === 0) return false;
  return assets.every(asset => asset.approved === true);
}

// This function is moved to lib/project-type.ts to avoid duplication

/**
 * Check if content should show transcript section
 * Voice Recording: Show transcript
 * Video Upload: Hide transcript
 */
export function shouldShowTranscript(projectType: string | null): boolean {
  return projectType === 'voice_recording';
}

/**
 * Get processing status label based on project type
 */
export function getProcessingLabel(projectType: string | null): string {
  switch (projectType) {
    case 'voice_recording':
      return 'Processing Audio...';
    case 'video_upload':
      return 'Processing Video...';
    default:
      return 'Processing...';
  }
}

// ... existing functions remain unchanged ...
```

### Step 4: Create Project Type Utilities

#### File: `lib/project-type.ts`
Create utilities for working with project types:

```typescript
import { ProjectType, PROJECT_TYPES, PROJECT_TYPE_LABELS } from '@/types';

/**
 * Validates if a string is a valid project type
 */
export function isValidProjectType(type: string | null): type is ProjectType {
  return type === PROJECT_TYPES.VOICE_RECORDING || type === PROJECT_TYPES.VIDEO_UPLOAD;
}

/**
 * Gets the display label for a project type
 */
export function getProjectTypeLabel(type: ProjectType | string | null): string {
  if (!type || !isValidProjectType(type)) {
    return 'Unknown Project Type';
  }
  return PROJECT_TYPE_LABELS[type];
}

/**
 * Gets the route path for creating a project of the given type
 */
export function getCreateProjectRoute(type: ProjectType): string {
  switch (type) {
    case PROJECT_TYPES.VOICE_RECORDING:
      return '/voice-recording';
    case PROJECT_TYPES.VIDEO_UPLOAD:
      return '/video-upload';
    default:
      return '/voice-recording'; // fallback
  }
}

/**
 * Determines if transcript should be shown for this project type
 */
export function shouldShowTranscript(type: ProjectType | string | null): boolean {
  return type === PROJECT_TYPES.VOICE_RECORDING;
}

/**
 * Gets appropriate processing message for project type
 */
export function getProcessingMessage(type: ProjectType | string | null): string {
  switch (type) {
    case PROJECT_TYPES.VOICE_RECORDING:
      return 'Currently Processing Audio...';
    case PROJECT_TYPES.VIDEO_UPLOAD:
      return 'Currently Processing Video...';
    default:
      return 'Currently Processing...';
  }
}
```

## Testing Phase 1

### Database Verification
```sql
-- Verify the migration was applied correctly
\d content

-- Check constraint exists
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'content'::regclass 
AND conname = 'content_project_type_check';

-- Verify index was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'content' 
AND indexname = 'idx_content_project_type';

-- Test inserting valid project types
INSERT INTO content (project_type) VALUES ('voice_recording');
INSERT INTO content (project_type) VALUES ('video_upload');

-- Test constraint (should fail)
INSERT INTO content (project_type) VALUES ('invalid_type');
```

### TypeScript Verification
Create a test file to verify types work correctly:

#### File: `__tests__/project-types.test.ts`
```typescript
import { ProjectType, PROJECT_TYPES, PROJECT_TYPE_LABELS } from '@/types';
import { 
  isValidProjectType, 
  getProjectTypeLabel, 
  shouldShowTranscript,
  getCreateProjectRoute 
} from '@/lib/project-type';

describe('Project Type System', () => {
  test('PROJECT_TYPES constants are correct', () => {
    expect(PROJECT_TYPES.VOICE_RECORDING).toBe('voice_recording');
    expect(PROJECT_TYPES.VIDEO_UPLOAD).toBe('video_upload');
  });

  test('isValidProjectType works correctly', () => {
    expect(isValidProjectType('voice_recording')).toBe(true);
    expect(isValidProjectType('video_upload')).toBe(true);
    expect(isValidProjectType('invalid')).toBe(false);
    expect(isValidProjectType(null)).toBe(false);
  });

  test('getProjectTypeLabel returns correct labels', () => {
    expect(getProjectTypeLabel('voice_recording')).toBe('Voice Recording');
    expect(getProjectTypeLabel('video_upload')).toBe('Video Upload');
    expect(getProjectTypeLabel('invalid')).toBe('Unknown Project Type');
  });

  test('shouldShowTranscript logic', () => {
    expect(shouldShowTranscript('voice_recording')).toBe(true);
    expect(shouldShowTranscript('video_upload')).toBe(false);
  });

  test('getCreateProjectRoute returns correct paths', () => {
    expect(getCreateProjectRoute('voice_recording')).toBe('/voice-recording');
    expect(getCreateProjectRoute('video_upload')).toBe('/video-upload');
  });
});
```

Run tests:
```bash
npm test project-types
```

## Completion Checklist

- [ ] ✅ Database migration created and applied successfully
- [ ] ✅ Database constraints and indexes working correctly  
- [ ] ✅ TypeScript types updated and generated
- [ ] ✅ Content status logic updated for both project types
- [ ] ✅ Project type utility functions created
- [ ] ✅ Tests written and passing
- [ ] ✅ No TypeScript errors in existing codebase
- [ ] ✅ Database can accept both project types
- [ ] ✅ Database rejects invalid project types

## Next Steps

Once Phase 1 is complete and all checkboxes are ticked:
1. Verify all TypeScript compilation passes
2. Test database operations work correctly
3. Move to **Phase 2: Navigation & Routing**

## Troubleshooting

### Migration Issues
```bash
# If migration fails, check current state
supabase db reset --local

# Reapply all migrations
supabase db push
```

### TypeScript Issues
```bash
# Regenerate types if needed
npx supabase gen types typescript --local > types/supabase.ts

# Check for compilation errors
npm run type-check
```

### Database Constraint Issues
```sql
-- Drop constraint if needed to modify
ALTER TABLE content DROP CONSTRAINT content_project_type_check;

-- Recreate constraint
ALTER TABLE content 
ADD CONSTRAINT content_project_type_check 
CHECK (project_type IN ('voice_recording', 'video_upload'));
``` 