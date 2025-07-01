'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tables } from '@/types/supabase';
import { RealtimeContentUpdater } from './realtime-content-updater';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PROJECT_TYPES, ProjectType } from '@/types/index';
import { Mic, Video } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Edit, 
  Eye, 
  Trash2, 
  RotateCcw, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { 
  getStatusLabel, 
  getStatusBadgeVariant, 
  getStatusActions,
  type ContentStatus 
} from '@/lib/content-status';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';

// Project type display helper
function getProjectTypeDisplay(projectType: ProjectType | null) {
  if (!projectType) return null;
  
  const Icon = projectType === 'video_upload' ? Video : Mic;
  const label = PROJECT_TYPES[projectType] || projectType;
  
  return (
    <div className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export interface ContentTableProps {
  serverContent: Tables<'content'>[];
  businessId: string;
  variant: 'drafts' | 'scheduled' | 'partially-published' | 'completed';
  onDelete?: (contentId: string) => Promise<{ success: boolean; error: string | null }>;
  onRetry?: (contentId: string) => Promise<{ success: boolean; error: string | null }>;
  showPagination?: boolean;
  pageSize?: 25 | 50 | 100;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

interface DeleteModalState {
  open: boolean;
  content?: Tables<'content'>;
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
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({ open: false });
  
  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300);

  // Update content when serverContent changes
  useEffect(() => {
    setContent(serverContent);
  }, [serverContent]);

  // Get status for each content item (simplified for now - in real implementation, fetch assets)
  const getContentWithStatus = (contentItem: Tables<'content'>) => {
    // TODO: In real implementation, fetch assets for each content item
    // For now, we'll determine status based on content fields only
    const assets: Tables<'content_assets'>[] = []; // Placeholder
    
    let status: ContentStatus = 'draft';
    
    // Determine status based on actual content fields, not variant
    if (contentItem.status === 'processing' || contentItem.content_generation_status === 'generating') {
      status = 'processing';
    } else if (contentItem.content_generation_status === 'failed') {
      status = 'failed';
    } else if (contentItem.status === 'completed' && contentItem.content_generation_status === 'completed') {
      // Content generation is complete - determine final status based on assets
      // For now, since we don't have assets loaded, default to 'draft' for completed content
      // This will be refined when assets are properly loaded
      status = 'draft';
    } else {
      // Default to draft for other cases
      status = 'draft';
    }
    
    let actions = getStatusActions(status);
    
    // Override actions for stuck processing content (older than 10 minutes)
    if (status === 'processing' && contentItem.created_at) {
      const createdAt = new Date(contentItem.created_at);
      const now = new Date();
      const minutesOld = (now.getTime() - createdAt.getTime()) / (1000 * 60);
      
      if (minutesOld > 10) {
        // Enable delete and retry actions for stuck processing content
        actions = {
          ...actions,
          canDelete: true,
          canRetry: true,
          showRetry: true,
        };
      }
    }
    
    return { ...contentItem, status, actions, assets, isStuck: status === 'processing' && contentItem.created_at && (new Date().getTime() - new Date(contentItem.created_at).getTime()) / (1000 * 60) > 10 };
  };

  // Filter content based on debounced search query
  const filteredContent = content
    .map(getContentWithStatus)
    .filter(item => {
      if (!debouncedSearchQuery) return true;
      return item.content_title?.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
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
    if (!contentItem.actions.canNavigate) {
      toast.error('Cannot view content while processing or failed. Use retry button if available.');
      return;
    }
    
    router.push(`/content/${contentItem.id}`);
  };

  const handleDelete = async (contentItem: Tables<'content'>) => {
    if (!onDelete) return;
    
    setIsLoading(true);
    try {
      const result = await onDelete(contentItem.id);
      if (result.success) {
        toast.success('Content deleted successfully');
        setDeleteModal({ open: false });
      } else {
        toast.error(result.error || 'Failed to delete content');
      }
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
      const result = await onRetry(contentId);
      if (result.success) {
        toast.success('Content retry initiated');
      } else {
        toast.error(result.error || 'Failed to retry content');
      }
    } catch (error) {
      toast.error('Failed to retry content');
      console.error('Retry error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value);
    setCurrentPage(1); // Reset to first page when searching
    onSearchChange?.(value);
  };

  const getActionButtons = (item: ReturnType<typeof getContentWithStatus>) => {
    const buttons = [];

    // Edit/View button
    if (item.actions.canNavigate) {
      const isViewOnly = variant === 'completed';
      buttons.push(
        <Button
          key={isViewOnly ? "view" : "edit"}
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/content/${item.id}`);
          }}
          className="h-8 w-8"
        >
          {isViewOnly ? <Eye className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
        </Button>
      );
    }

    // Delete button (not for completed content)
    if (item.actions.canDelete && variant !== 'completed') {
      buttons.push(
        <Button
          key="delete"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteModal({ open: true, content: item });
          }}
          className="h-8 w-8 text-destructive hover:text-destructive"
          disabled={isLoading}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    }

    // Retry button (for failed content)
    if (item.actions.showRetry) {
      buttons.push(
        <Button
          key="retry"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleRetry(item.id);
          }}
          className="h-8 w-8 text-blue-600 hover:text-blue-700"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        </Button>
      );
    }

    return buttons;
  };

  const formatStatus = (status: ContentStatus, isStuck?: boolean) => {
    if (status === 'processing') {
      return (
        <div className="flex items-center gap-2">
          <div className={`animate-spin rounded-full h-3 w-3 border-b ${isStuck ? 'border-orange-600' : 'border-blue-600'}`}></div>
          <span>Processing...</span>
          {isStuck && <AlertTriangle className="h-3 w-3 text-orange-600" />}
        </div>
      );
    }
    return getStatusLabel(status);
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
            onChange={(e) => handleSearchChange(e.target.value)}
            className="flex-1"
          />
        </div>
        
        {showPagination && totalItems > 0 && (
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
              <TableHead>Type</TableHead>
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
                    !item.actions.canNavigate 
                      ? 'opacity-60 cursor-not-allowed' 
                      : ''
                  }`}
                >
                  <TableCell className="font-medium">
                    <div className="space-y-1">
                      <div>
                        {item.status === 'processing'
                          ? (item.project_type === 'video_upload' ? 'Processing Video...' : 'Processing Audio...')
                          : item.content_title || 'Untitled'}
                      </div>
                      {item.status === 'failed' && (
                        <div className="flex items-center gap-2 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Content generation failed
                        </div>
                      )}
                      {item.isStuck && (
                        <div className="flex items-center gap-2 text-xs text-orange-600">
                          <AlertTriangle className="h-3 w-3" />
                          Processing for {Math.round((new Date().getTime() - new Date(item.created_at || Date.now()).getTime()) / (1000 * 60))} minutes - may be stuck
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getProjectTypeDisplay(item.project_type as ProjectType)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(item.status)}>
                      {formatStatus(item.status, !!item.isStuck)}
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
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="space-y-2">
                    <p className="text-muted-foreground">
                      {debouncedSearchQuery 
                        ? `No content found matching "${debouncedSearchQuery}"`
                        : `No ${variant.replace('-', ' ')} content yet.`
                      }
                    </p>
                    {variant === 'drafts' && !debouncedSearchQuery && (
                      <Button
                        variant="outline"
                        onClick={() => router.push('/voice-recording')}
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
      <AlertDialog open={deleteModal.open} onOpenChange={(open) => setDeleteModal({ open, content: open ? deleteModal.content : undefined })}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDialogTitle>Delete Content</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-3 pt-2">
              <div>
                This action cannot be undone. Deleting this content will permanently remove:
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All generated content assets (blog posts, emails, social media content)</li>
                <li>All associated images, videos, and audio files</li>
                <li>All scheduling information</li>
              </ul>
              <div className="font-medium">
                Are you sure you want to delete &quot;{deleteModal.content?.content_title || 'Untitled'}&quot;?
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteModal.content && handleDelete(deleteModal.content)}
              className="bg-red-600 hover:bg-red-700"
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
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 