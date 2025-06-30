# Content Pages Implementation Guide: PHASE 2 - Component Usage & UI Patterns

**Companion to**: [Content Management Pages PRD](./content-pages-draft-schedule-completed.md)  
**Implementation Phase**: 2 of 3 (UI Components & User Interface)  
**Version**: 1.0  
**Date**: December 30, 2024

---

## **Phase 2 Overview: UI Foundation**

**Goal**: Build all UI components and integrate them with the server actions from Phase 1.

**Why Phase 2 Second?**
- Requires the solid server action foundation from Phase 1
- Components depend on the status determination logic and server actions
- UI patterns established here will be enhanced with real-time features in Phase 3
- Allows for component testing before adding complex real-time behavior

**Estimated Timeline**: 2-3 weeks  
**Dependencies**: Phase 1 must be complete  
**Prerequisites**: [Phase 1 - Server Actions Guide](./content-pages-phase1-server-actions-guide.md)  
**Next Phase**: [Phase 3 - Error Handling & Real-time Guide](./content-pages-phase3-error-realtime-guide.md)

---

## **1. Enhanced ContentTable Component**

### **1.1 Complete Component Implementation**

```typescript
// components/shared/enhanced-content-table.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { 
  Eye, 
  Edit, 
  Trash2, 
  RotateCcw, 
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { RealtimeContentUpdater } from './realtime-content-updater';
import { ContentDeleteModal } from './content-delete-modal';
import { Tables } from '@/types/supabase';
import { 
  determineContentStatus, 
  canScheduleContent,
  type ContentStatus 
} from '@/lib/content-status';

export interface ContentTableProps {
  serverContent: Tables<'content'>[];
  businessId: string;
  variant: 'drafts' | 'scheduled' | 'partially-published' | 'completed';
  onDelete?: (contentId: string) => Promise<void>;
  onRetry?: (contentId: string) => Promise<void>;
  showPagination?: boolean;
  pageSize?: 25 | 50 | 100;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function EnhancedContentTable({
  serverContent,
  businessId,
  variant,
  onDelete,
  onRetry,
  showPagination = true,
  pageSize = 50,
  searchQuery = '',
  onSearchChange,
}: ContentTableProps) {
  const router = useRouter();
  const [content, setContent] = useState(serverContent);
  const [currentPage, setCurrentPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(pageSize);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    content?: Tables<'content'>;
  }>({ open: false });

  // Update content when serverContent changes
  useEffect(() => {
    setContent(serverContent);
  }, [serverContent]);

  // Get status for each content item
  const getContentWithStatus = (contentItem: Tables<'content'>) => {
    // In real implementation, you'd fetch assets for each content
    // For this example, we'll use empty array - implement asset fetching
    const assets: Tables<'content_assets'>[] = []; // TODO: Fetch real assets
    const status = determineContentStatus(contentItem, assets);
    const canSchedule = canScheduleContent(assets);
    
    return { ...contentItem, status, canSchedule, assets };
  };

  // Filter content based on variant
  const filteredContent = content
    .map(getContentWithStatus)
    .filter(item => {
      // Filter by status
      if (variant === 'drafts') {
        return item.status === 'draft' || item.status === 'failed';
      }
      return item.status === variant;
    })
    .filter(item => {
      // Filter by search query
      if (!localSearchQuery) return true;
      return item.content_title?.toLowerCase().includes(localSearchQuery.toLowerCase());
    });

  // Pagination logic
  const totalItems = filteredContent.length;
  const totalPages = Math.ceil(totalItems / localPageSize);
  const startIndex = (currentPage - 1) * localPageSize;
  const endIndex = startIndex + localPageSize;
  const paginatedContent = filteredContent.slice(startIndex, endIndex);

  // Handlers
  const handleRowClick = (contentItem: ReturnType<typeof getContentWithStatus>) => {
    // Prevent navigation for processing or failed content
    if (contentItem.status === 'processing' || contentItem.status === 'failed') {
      toast.error('Cannot view content while processing or failed. Use retry button.');
      return;
    }
    
    router.push(`/content/${contentItem.id}`);
  };

  const handleDelete = async (contentItem: Tables<'content'>) => {
    if (!onDelete) return;
    
    setIsLoading(true);
    try {
      await onDelete(contentItem.id);
      toast.success('Content deleted successfully');
      setDeleteModal({ open: false });
    } catch (error) {
      toast.error('Failed to delete content');
      console.error('Delete error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (contentId: string) => {
    if (!onRetry) return;
    
    setIsLoading(true);
    try {
      await onRetry(contentId);
      toast.success('Content retry initiated');
    } catch (error) {
      toast.error('Failed to retry content');
      console.error('Retry error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatStatus = (status: ContentStatus) => {
    const statusMap = {
      'processing': 'Processing',
      'failed': 'Failed',
      'draft': 'Draft',
      'scheduled': 'Scheduled',
      'partially-published': 'Partially Published',
      'completed': 'Completed'
    };
    return statusMap[status] || status;
  };

  const getStatusVariant = (status: ContentStatus) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'scheduled':
        return 'secondary';
      case 'failed':
        return 'destructive';
      case 'processing':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getActionButtons = (item: ReturnType<typeof getContentWithStatus>) => {
    const buttons = [];

    // Edit/View button
    if (variant === 'completed') {
      buttons.push(
        <Button
          key="view"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/content/${item.id}`);
          }}
          disabled={item.status === 'processing' || item.status === 'failed'}
        >
          <Eye className="h-4 w-4" />
        </Button>
      );
    } else {
      buttons.push(
        <Button
          key="edit"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/content/${item.id}`);
          }}
          disabled={item.status === 'processing' || item.status === 'failed'}
        >
          <Edit className="h-4 w-4" />
        </Button>
      );
    }

    // Delete button (not for completed content)
    if (variant !== 'completed' && onDelete) {
      buttons.push(
        <Button
          key="delete"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteModal({ open: true, content: item });
          }}
          disabled={isLoading}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    }

    // Retry button (for failed content in drafts)
    if (item.status === 'failed' && onRetry) {
      buttons.push(
        <Button
          key="retry"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleRetry(item.id);
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
        </Button>
      );
    }

    return buttons;
  };

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={localSearchQuery}
            onChange={(e) => {
              setLocalSearchQuery(e.target.value);
              onSearchChange?.(e.target.value);
            }}
            className="flex-1"
          />
        </div>
        
        {showPagination && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Show:</span>
            <Select
              value={localPageSize.toString()}
              onValueChange={(value) => {
                setLocalPageSize(Number(value) as 25 | 50 | 100);
                setCurrentPage(1); // Reset to first page
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Real-time Updates */}
      <RealtimeContentUpdater
        businessId={businessId}
        serverContent={content}
        onUpdate={setContent}
      />

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Created At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedContent.length > 0 ? (
              paginatedContent.map((item) => (
                <TableRow
                  key={item.id}
                  onDoubleClick={() => handleRowClick(item)}
                  className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                    item.status === 'processing' || item.status === 'failed' 
                      ? 'opacity-60 cursor-not-allowed' 
                      : ''
                  }`}
                >
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div>
                        {item.status === 'processing'
                          ? 'Currently Processing Audio...'
                          : item.content_title || 'Untitled'}
                      </div>
                      {item.status === 'processing' && (
                        <div className="flex items-center gap-2 text-xs text-blue-600">
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600"></div>
                          Processing...
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(item.status)}>
                      {formatStatus(item.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(item.created_at || Date.now()).toLocaleDateString(
                      'en-AU',
                      {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1">
                      {getActionButtons(item)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="space-y-2">
                    <p className="text-muted-foreground">
                      {localSearchQuery 
                        ? `No content found matching "${localSearchQuery}"`
                        : `No ${variant} content yet.`
                      }
                    </p>
                    {variant === 'drafts' && !localSearchQuery && (
                      <Button
                        variant="outline"
                        onClick={() => router.push('/new')}
                      >
                        Create Your First Content
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} results
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ContentDeleteModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ open, content: open ? deleteModal.content : undefined })}
        content={deleteModal.content}
        onConfirm={() => deleteModal.content && handleDelete(deleteModal.content)}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### **1.2 Usage Examples for Each Page**

```typescript
// app/(app)/content/drafts/page.tsx
import { EnhancedContentTable } from '@/components/shared/enhanced-content-table';
import { deleteContent, retryContentProcessing } from '../[id]/actions';

export default function DraftsPage() {
  const handleDelete = async (contentId: string) => {
    const result = await deleteContent({ 
      contentId, 
      businessId: user.business_id 
    });
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  const handleRetry = async (contentId: string) => {
    const result = await retryContentProcessing({ 
      contentId, 
      businessId: user.business_id 
    });
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Draft Content</h1>
        <p className="text-muted-foreground">
          Content ready for review and approval before scheduling.
        </p>
      </div>

      <EnhancedContentTable
        serverContent={content}
        businessId={businessId}
        variant="drafts"
        onDelete={handleDelete}
        onRetry={handleRetry}
        showPagination={true}
        pageSize={50}
      />
    </div>
  );
}

// app/(app)/content/completed/page.tsx  
export default function CompletedPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Completed Content</h1>
        <p className="text-muted-foreground">
          Content that has been fully published across all platforms.
        </p>
      </div>

      <EnhancedContentTable
        serverContent={content}
        businessId={businessId}
        variant="completed"
        // No delete or retry for completed content
        showPagination={true}
        pageSize={50}
      />
    </div>
  );
}
```

---

## **2. Content Delete Modal Component**

### **2.1 Delete Confirmation Modal**

```typescript
// components/shared/content-delete-modal.tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Tables } from '@/types/supabase';

interface ContentDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content?: Tables<'content'>;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export function ContentDeleteModal({
  open,
  onOpenChange,
  content,
  onConfirm,
  isLoading = false,
}: ContentDeleteModalProps) {
  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <DialogTitle>Delete Content</DialogTitle>
          </div>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              This action cannot be undone. Deleting this content will permanently remove:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>All generated content assets (blog posts, emails, social media content)</li>
              <li>All associated images, videos, and audio files</li>
              <li>All scheduling information</li>
            </ul>
            <p className="font-medium">
              Are you sure you want to delete "{content.content_title || 'Untitled'}"?
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Forever'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## **3. Content Approval Components**

### **3.1 Approval Button Component**

```typescript
// components/shared/content-approval-button.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tables } from '@/types/supabase';

interface ContentApprovalButtonProps {
  asset: Tables<'content_assets'>;
  onApprove: (assetId: string) => Promise<void>;
  onUnapprove: (assetId: string) => Promise<void>;
  disabled?: boolean;
}

export function ContentApprovalButton({
  asset,
  onApprove,
  onUnapprove,
  disabled = false,
}: ContentApprovalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleApproval = async () => {
    setIsLoading(true);
    try {
      if (asset.approved) {
        await onUnapprove(asset.id);
        toast.success('Approval removed');
      } else {
        await onApprove(asset.id);
        toast.success('Content approved');
      }
    } catch (error) {
      toast.error(asset.approved ? 'Failed to remove approval' : 'Failed to approve content');
      console.error('Approval error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={asset.approved ? 'default' : 'outline'}
        size="sm"
        onClick={handleToggleApproval}
        disabled={disabled || isLoading}
        className="flex items-center space-x-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : asset.approved ? (
          <CheckCircle className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
        <span>{asset.approved ? 'Approved' : 'Approve'}</span>
      </Button>
      
      {asset.approved && (
        <Badge variant="secondary" className="text-green-700 bg-green-100">
          ✓ Ready to Schedule
        </Badge>
      )}
    </div>
  );
}
```

### **3.2 Approval Summary Component**

```typescript
// components/shared/content-approval-summary.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Tables } from '@/types/supabase';
import { canScheduleContent } from '@/lib/content-status';

interface ContentApprovalSummaryProps {
  assets: Tables<'content_assets'>[];
  onSchedule?: () => void;
  isScheduling?: boolean;
}

export function ContentApprovalSummary({
  assets,
  onSchedule,
  isScheduling = false,
}: ContentApprovalSummaryProps) {
  const approvedCount = assets.filter(asset => asset.approved).length;
  const totalCount = assets.length;
  const allApproved = canScheduleContent(assets);

  const getStatusIcon = () => {
    if (allApproved) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (approvedCount > 0) {
      return <Clock className="h-4 w-4 text-yellow-600" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusText = () => {
    if (allApproved) {
      return 'All content approved - ready to schedule';
    } else if (approvedCount > 0) {
      return `${approvedCount} of ${totalCount} content assets approved`;
    } else {
      return 'No content approved yet';
    }
  };

  const getStatusVariant = () => {
    if (allApproved) return 'default';
    if (approvedCount > 0) return 'secondary';
    return 'outline';
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
      <div className="flex items-center space-x-3">
        {getStatusIcon()}
        <div>
          <p className="font-medium">{getStatusText()}</p>
          <p className="text-sm text-muted-foreground">
            All content must be approved before scheduling
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <Badge variant={getStatusVariant()}>
          {approvedCount}/{totalCount} Approved
        </Badge>
        
        {onSchedule && (
          <Button
            onClick={onSchedule}
            disabled={!allApproved || isScheduling}
            className="min-w-24"
          >
            {isScheduling ? 'Scheduling...' : 'Schedule Content'}
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

## **4. Status-Aware Content Detail Wrapper**

### **4.1 Content Detail Mode Wrapper**

```typescript
// components/shared/content-detail-wrapper.tsx
'use client';

import { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Eye, Calendar, AlertTriangle } from 'lucide-react';
import { Tables } from '@/types/supabase';
import { ContentStatus, canScheduleContent } from '@/lib/content-status';

interface ContentDetailWrapperProps {
  content: Tables<'content'>;
  assets: Tables<'content_assets'>[];
  status: ContentStatus;
  children: ReactNode;
  onUnschedule?: () => Promise<void>;
  isUnscheduling?: boolean;
}

export function ContentDetailWrapper({
  content,
  assets,
  status,
  children,
  onUnschedule,
  isUnscheduling = false,
}: ContentDetailWrapperProps) {
  const canSchedule = canScheduleContent(assets);

  const getStatusBanner = () => {
    switch (status) {
      case 'processing':
        return (
          <Alert className="border-blue-200 bg-blue-50">
            <div className="animate-spin rounded-full h-4 w-4 border-b border-blue-600"></div>
            <AlertDescription>
              Content is currently being processed. Please wait for completion before editing.
            </AlertDescription>
          </Alert>
        );

      case 'failed':
        return (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Content generation failed. Use the retry button in the content list to try again.
            </AlertDescription>
          </Alert>
        );

      case 'scheduled':
        return (
          <Alert className="border-orange-200 bg-orange-50">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <Edit className="h-4 w-4" />
                <span>
                  ✏️ EDITING SCHEDULED CONTENT - Changes will auto-save to scheduled content
                </span>
              </div>
              {onUnschedule && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnschedule}
                  disabled={isUnscheduling}
                >
                  {isUnscheduling ? 'Unscheduling...' : 'Unschedule Content'}
                </Button>
              )}
            </div>
          </Alert>
        );

      case 'partially-published':
        const publishedCount = assets.filter(a => a.asset_status === 'Sent').length;
        return (
          <Alert className="border-yellow-200 bg-yellow-50">
            <Calendar className="h-4 w-4" />
            <AlertDescription>
              Partially published content - {publishedCount} of {assets.length} assets have been sent. 
              You can edit unpublished assets only.
            </AlertDescription>
          </Alert>
        );

      case 'completed':
        return (
          <Alert className="border-green-200 bg-green-50">
            <Eye className="h-4 w-4" />
            <AlertDescription>
              All content has been published successfully. This content is now view-only.
            </AlertDescription>
          </Alert>
        );

      default:
        return null;
    }
  };

  const getEditingMode = () => {
    switch (status) {
      case 'draft':
        return 'edit'; // Full editing
      case 'scheduled':
        return 'scheduled'; // Edit with auto-save
      case 'partially-published':
        return 'partially-published'; // Edit unpublished only
      case 'completed':
        return 'view'; // View only
      default:
        return 'view'; // Safe default
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {getStatusBanner()}

      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Badge variant={status === 'completed' ? 'default' : 'outline'}>
            {status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
          {!canSchedule && status === 'draft' && (
            <Badge variant="outline" className="text-yellow-700 bg-yellow-100">
              Requires Approval
            </Badge>
          )}
        </div>
      </div>

      {/* Content with editing mode context */}
      <div data-editing-mode={getEditingMode()}>
        {children}
      </div>
    </div>
  );
}
```

---

## **5. Page Layout Patterns**

### **5.1 Standard Content Page Layout**

```typescript
// app/(app)/content/layout.tsx
import { ReactNode } from 'react';

interface ContentLayoutProps {
  children: ReactNode;
}

export default function ContentLayout({ children }: ContentLayoutProps) {
  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
            <a href="/content" className="hover:text-foreground">Content</a>
            <span>/</span>
            <span className="text-foreground">Current Page</span>
          </nav>
        </div>
      </div>
      
      <main className="space-y-6">
        {children}
      </main>
    </div>
  );
}
```

### **5.2 Loading States Pattern**

```typescript
// app/(app)/content/drafts/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function DraftsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Filters skeleton */}
      <div className="flex items-center space-x-4">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## **Phase 2 Implementation Checklist**

### **✅ Enhanced ContentTable Component**
- [ ] Implement base `EnhancedContentTable` component with all variants
- [ ] Add pagination controls (25/50/100 items per page)
- [ ] Implement search functionality with debouncing
- [ ] Add hover effects and modern styling
- [ ] Implement double-click navigation with restrictions
- [ ] Add action buttons (edit/view, delete, retry) with proper states

### **✅ Delete Modal & Confirmation**
- [ ] Create `ContentDeleteModal` component
- [ ] Add comprehensive warning text
- [ ] Implement loading states during deletion
- [ ] Add proper error handling and user feedback
- [ ] Test delete restrictions for completed content

### **✅ Approval Workflow Components**
- [ ] Create `ContentApprovalButton` component
- [ ] Implement `ContentApprovalSummary` component  
- [ ] Add visual indicators for approved/unapproved content
- [ ] Implement approval status tracking
- [ ] Add scheduling enabled/disabled based on approvals

### **✅ Status-Aware Content Detail**
- [ ] Create `ContentDetailWrapper` component
- [ ] Implement status banners for all content states
- [ ] Add editing mode context (edit/view/scheduled)
- [ ] Implement "Unschedule Content" functionality
- [ ] Add visual indicators for scheduled content editing

### **✅ Page Layouts & Navigation**
- [ ] Create four content page components (drafts, scheduled, partially-published, completed)
- [ ] Implement proper page headers and descriptions
- [ ] Add breadcrumb navigation
- [ ] Create loading skeleton components
- [ ] Test responsive design on mobile/tablet/desktop

### **✅ Integration with Phase 1**
- [ ] Wire up all components with server actions from Phase 1
- [ ] Import and use status determination functions
- [ ] Connect delete modal with `deleteContent` action
- [ ] Connect retry buttons with `retryContentProcessing` action
- [ ] Connect approval buttons with `approveContentAsset` action

### **✅ Testing & Polish**
- [ ] Test all component interactions
- [ ] Verify proper loading states
- [ ] Test error handling scenarios
- [ ] Verify mobile responsiveness
- [ ] Test keyboard navigation and accessibility

---

## **Implementation Notes**

### **Component Reusability**
- All components use TypeScript interfaces for type safety
- Components are designed to be composable and reusable
- Consistent props patterns across similar components

### **Performance**
- Lazy loading where appropriate
- Memoization for expensive calculations
- Efficient re-renders with proper dependencies

### **Accessibility**
- Proper ARIA labels and roles
- Keyboard navigation support
- Focus management for modals and popups

### **Ready for Phase 3?**
Once Phase 2 is complete, you can move to:
**[Phase 3 - Error Handling & Real-time Guide](./content-pages-phase3-error-realtime-guide.md)**

Phase 2 provides the complete UI foundation that will be enhanced with real-time features and comprehensive error handling in Phase 3! 