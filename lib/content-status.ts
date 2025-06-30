import { Tables } from '@/types/supabase';

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
 */
export function determineContentStatus(
  content: Tables<'content'>, 
  assets: Tables<'content_assets'>[]
): ContentStatus {
  // Processing: Audio still being processed or content generation in progress
  if (content.status === 'processing' || content.content_generation_status === 'generating') {
    return 'processing';
  }
  
  // Failed: Content generation failed or has no assets after completion
  if (content.content_generation_status === 'failed' || 
      (content.status === 'completed' && assets.length === 0)) {
    return 'failed';
  }
  
  // Asset-based status determination
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