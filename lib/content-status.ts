import { Tables } from '@/types/supabase';
import { ProjectType } from '@/types/index';

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
 * Works uniformly for both voice_recording and video_upload project types
 */
export function determineContentStatus(
  content: Tables<'content'>, 
  assets: Tables<'content_assets'>[]
): ContentStatus {
  // Simplified single-status architecture
  switch (content.status) {
    case 'processing':
      return 'processing';
    
    case 'failed':
      return 'failed';
      
    case 'draft':
      // Asset-based sub-status determination for draft content
      const scheduledAssets = assets.filter(asset => asset.asset_scheduled_at);
      const sentAssets = assets.filter(asset => asset.asset_status === 'Sent');
      
      // All assets sent successfully
      if (sentAssets.length === assets.length && assets.length > 0) {
        return 'completed';
      }
      
      // Some assets sent, some pending
      if (sentAssets.length > 0) {
        return 'partially-published';
      }
      
      // Assets have scheduled dates but none sent yet
      if (scheduledAssets.length > 0) {
        return 'scheduled';
      }
      
      // Content is ready for review/scheduling
      return 'draft';
      
    default:
      // Handle any other status values directly
      return content.status as ContentStatus;
  }
}

/**
 * Get project type display name for UI
 */
export function getProjectTypeLabel(projectType: string | null): string {
  if (!projectType) return 'Voice Recording'; // Default for backward compatibility
  
  switch (projectType as ProjectType) {
    case 'voice_recording':
      return 'Voice Recording';
    case 'video_upload':
      return 'Video Upload';
    default:
      return 'Voice Recording';
  }
}

/**
 * Determines if content can be scheduled (all assets must be approved)
 */
export function canScheduleContent(assets: Tables<'content_assets'>[]): boolean {
  if (assets.length === 0) return false;
  return assets.every(asset => asset.approved === true);
}

/**
 * Gets content suitable for specific page/status
 */
export function filterContentByStatus(
  contentList: ContentWithAssets[], 
  targetStatus: ContentStatus
): ContentWithAssets[] {
  return contentList.filter(({ content, assets }) => {
    const status = determineContentStatus(content, assets);
    
    // Special case: failed content appears in drafts
    if (targetStatus === 'draft') {
      return status === 'draft' || status === 'failed';
    }
    
    return status === targetStatus;
  });
}

/**
 * Get status-appropriate action capabilities
 */
export function getStatusActions(status: ContentStatus) {
  switch (status) {
    case 'processing':
      return {
        canEdit: false,
        canDelete: false,
        canNavigate: false,
        canSchedule: false,
        canRetry: false,
        showRetry: false,
      };
    case 'failed':
      return {
        canEdit: false,
        canDelete: true,
        canNavigate: false,
        canSchedule: false,
        canRetry: true,
        showRetry: true,
      };
    case 'draft':
      return {
        canEdit: true,
        canDelete: true,
        canNavigate: true,
        canSchedule: true, // depends on approval
        canRetry: false,
        showRetry: false,
      };
    case 'scheduled':
      return {
        canEdit: true, // edit-in-place
        canDelete: true,
        canNavigate: true,
        canSchedule: false,
        canRetry: false,
        showRetry: false,
      };
    case 'partially-published':
      return {
        canEdit: true, // only unpublished assets
        canDelete: true,
        canNavigate: true,
        canSchedule: false,
        canRetry: true, // for failed assets
        showRetry: true,
      };
    case 'completed':
      return {
        canEdit: false, // view-only
        canDelete: false,
        canNavigate: true,
        canSchedule: false,
        canRetry: false,
        showRetry: false,
      };
    default:
      return {
        canEdit: false,
        canDelete: false,
        canNavigate: false,
        canSchedule: false,
        canRetry: false,
        showRetry: false,
      };
  }
}

/**
 * Get human-readable status labels
 */
export function getStatusLabel(status: ContentStatus): string {
  const statusMap = {
    'processing': 'Processing',
    'failed': 'Failed',
    'draft': 'Draft',
    'scheduled': 'Scheduled',
    'partially-published': 'Partially Published',
    'completed': 'Completed'
  };
  return statusMap[status] || status;
}

/**
 * Get appropriate badge variant for status
 */
export function getStatusBadgeVariant(status: ContentStatus) {
  switch (status) {
    case 'completed':
      return 'default';
    case 'scheduled':
      return 'secondary';
    case 'partially-published':
      return 'outline';
    case 'failed':
      return 'destructive';
    case 'processing':
      return 'outline';
    case 'draft':
    default:
      return 'outline';
  }
} 