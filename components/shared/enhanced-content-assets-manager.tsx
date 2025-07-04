'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ContentAsset, ContentWithBusiness } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Calendar, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { 
  updateAssetSchedule,
  getBusinessAssets,
  resetContentAssetSchedules
} from '@/app/(app)/content/[id]/actions';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface EnhancedContentAssetsManagerProps {
  assets: ContentAsset[];
  content: ContentWithBusiness;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => Promise<void>;
  onAssetUpdate?: (updatedAsset: ContentAsset) => void;
  onImageUpdated?: (updatedAsset: ContentAsset) => void;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    assetType: string;
    contentTitle?: string;
    isOwned: boolean;
    contentId?: string;
    assetId?: string;
  };
}

interface BusinessAsset {
  id: string;
  content_type: string | null;
  asset_scheduled_at: string | null;
  content?: {
    id: string;
    content_title: string | null;
  };
}

export function EnhancedContentAssetsManager({
  assets,
  content,
  error,
  onRefresh,
}: EnhancedContentAssetsManagerProps) {
  const router = useRouter();
  
  // Calendar-related state
  const [businessAssets, setBusinessAssets] = useState<BusinessAsset[]>([]);
  const [isLoadingBusinessAssets, setIsLoadingBusinessAssets] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{
    assetId: string;
    currentDate: string;
    time: string;
  } | null>(null);
  const [navigationModal, setNavigationModal] = useState<{
    open: boolean;
    contentId: string;
    contentTitle: string;
  }>({ open: false, contentId: '', contentTitle: '' });

  // Batch scheduling state
  const [pendingChanges, setPendingChanges] = useState<Map<string, ContentAsset>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Approval validation state
  const [allAssetsApproved, setAllAssetsApproved] = useState(false);
  const [approvalProgress, setApprovalProgress] = useState({ approved: 0, total: 0 });

  // Utility function to convert field names to user-friendly format
  const formatContentType = (contentType: string): string => {
    const typeMap: Record<string, string> = {
      'blog_post': 'Blog Post',
      'email': 'Email',
      'youtube_video': 'YouTube Video',
      'social_long_video': 'Social Long Video',
      'social_short_video': 'Social Short Video',
      'social_quote_card': 'Social Quote Card',
      'social_rant_post': 'Social Rant Post',
      'social_blog_post': 'Social Blog Post',
    };
    
    return typeMap[contentType] || contentType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Check approval status using stepper menu logic
  const checkAllAssetsApproved = useCallback(() => {
    const approvedCount = assets.filter(asset => asset.approved).length;
    const totalCount = assets.length;
    
    setApprovalProgress({ approved: approvedCount, total: totalCount });
    setAllAssetsApproved(approvedCount === totalCount && totalCount > 0);
  }, [assets]);

  // Update approval status when assets change
  useEffect(() => {
    checkAllAssetsApproved();
  }, [checkAllAssetsApproved]);

  // Asset filtering - merge current assets with pending changes
  const getEffectiveAssets = () => {
    return assets.map(asset => {
      const pendingAsset = pendingChanges.get(asset.id);
      return pendingAsset || asset;
    });
  };

  const effectiveAssets = getEffectiveAssets();
  // const approvedAssets = effectiveAssets.filter(asset => asset.approved); // Unused for now
  const scheduledAssets = effectiveAssets.filter(asset => asset.asset_scheduled_at);
  const unscheduledAssets = effectiveAssets.filter(asset => asset.approved && !asset.asset_scheduled_at);
  const approvedUnscheduledCount = unscheduledAssets.length;

  // Load business assets for calendar context
  const loadBusinessAssets = useCallback(async () => {
    if (!content.business_id) return;
    
    setIsLoadingBusinessAssets(true);
    try {
      // Get date range for the calendar (3 months before and after today)
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
      const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

      const result = await getBusinessAssets({ 
        businessId: content.business_id,
        startDate,
        endDate,
        excludeContentId: content.id 
      });
      
      if (result.success && result.data) {
        setBusinessAssets(result.data);
      }
    } catch (error) {
      console.error('Failed to load business assets:', error);
    } finally {
      setIsLoadingBusinessAssets(false);
    }
  }, [content.business_id, content.id]);

  // Load business assets on mount and when view changes
  useEffect(() => {
    loadBusinessAssets();
  }, [loadBusinessAssets]);

  // Create calendar events from assets (using effective assets with pending changes)
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const businessTimezone = content.businesses?.timezone || 'UTC';

    // Add current content's scheduled assets (including pending changes)
    effectiveAssets
      .filter(asset => asset.asset_scheduled_at)
      .forEach(asset => {
        const scheduledDate = toZonedTime(new Date(asset.asset_scheduled_at!), businessTimezone);
        const hasPendingChanges = pendingChanges.has(asset.id);
        
        events.push({
          id: `current-${asset.id}`,
          title: `${formatContentType(asset.content_type || 'Content')}${hasPendingChanges ? ' (pending)' : ''}`,
          date: format(scheduledDate, 'yyyy-MM-dd'),
          backgroundColor: hasPendingChanges ? '#f97316' : '#ef4444', // Orange for pending, red for saved
          borderColor: hasPendingChanges ? '#ea580c' : '#dc2626',
          textColor: '#ffffff',
          extendedProps: {
            assetType: asset.content_type || 'unknown',
            contentTitle: content.content_title ?? undefined,
            isOwned: true,
            contentId: content.id,
            assetId: asset.id,
          },
        });
      });

    // Add other business assets (very faint gray)
    businessAssets
      .filter(asset => asset.asset_scheduled_at)
      .forEach(asset => {
        const scheduledDate = toZonedTime(new Date(asset.asset_scheduled_at!), businessTimezone);
        
        events.push({
          id: `business-${asset.id}`,
          title: `${formatContentType(asset.content_type || 'Content')}`,
          date: format(scheduledDate, 'yyyy-MM-dd'),
          backgroundColor: 'rgba(107, 114, 128, 0.15)', // Very faint gray
          borderColor: 'rgba(75, 85, 99, 0.2)',
          textColor: 'rgba(107, 114, 128, 0.6)',
          extendedProps: {
            assetType: asset.content_type || 'unknown',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            contentTitle: asset.content?.content_title as any,
            isOwned: false,
            contentId: asset.content?.id,
            assetId: asset.id,
          },
        });
      });

    return events;
  }, [effectiveAssets, businessAssets, content, pendingChanges]);

  // Validate scheduling is allowed
  const validateSchedulingAllowed = () => {
    if (!allAssetsApproved) {
      toast.error('All assets must be approved before scheduling');
      return false;
    }
    return true;
  };

  // Handle date drops on calendar (batch scheduling - don't save immediately)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDateDrop = async (info: any) => {
    const { event } = info;
    const assetId = event.extendedProps.assetId;
    const isOwned = event.extendedProps.isOwned;

    if (!isOwned || !assetId) {
      info.revert();
      toast.error('You can only reschedule assets from this content');
      return;
    }

    // Block scheduling if not all assets approved
    if (!validateSchedulingAllowed()) {
      info.revert();
      return;
    }

    // Past date validation
    const businessTimezone = content.businesses?.timezone || 'UTC';
    const newDate = toZonedTime(new Date(info.event.start), businessTimezone);
    const today = toZonedTime(new Date(), businessTimezone);
    
    if (newDate < today) {
      info.revert();
      toast.error('Cannot schedule content to a date in the past');
      return;
    }

    // Store change locally (don't save to database yet)
    const originalAsset = assets.find(a => a.id === assetId);
    if (!originalAsset) return;

    const newDateTime = fromZonedTime(new Date(info.event.start), businessTimezone);
    const updatedAsset = { 
      ...originalAsset, 
      asset_scheduled_at: newDateTime.toISOString() 
    };

    setPendingChanges(prev => new Map(prev.set(assetId, updatedAsset)));
    setHasUnsavedChanges(true);
    
    toast.success('Change staged - click &quot;Schedule&quot; to save');
  };

  // Handle calendar date select (for unscheduled assets)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDateSelect = (selectInfo: any) => {
    if (!validateSchedulingAllowed()) {
      return;
    }

    const unscheduledAsset = assets.find(asset => asset.approved && !asset.asset_scheduled_at);
    
    if (!unscheduledAsset) {
      toast.info('No approved assets available to schedule');
      return;
    }

    const businessTimezone = content.businesses?.timezone || 'UTC';
    const selectedDate = fromZonedTime(selectInfo.start, businessTimezone);

    // Past date validation
    const today = toZonedTime(new Date(), businessTimezone);
    if (selectedDate < today) {
      toast.error('Cannot schedule content to a date in the past');
      return;
    }

    // Store as pending change
    const updatedAsset = { 
      ...unscheduledAsset, 
      asset_scheduled_at: selectedDate.toISOString() 
    };

    setPendingChanges(prev => new Map(prev.set(unscheduledAsset.id, updatedAsset)));
    setHasUnsavedChanges(true);
    
    toast.success('Asset scheduled - click &quot;Schedule&quot; to save');
  };

  // Handle event click (for time editing or navigation)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEventClick = (clickInfo: any) => {
    const { event } = clickInfo;
    const assetId = event.extendedProps.assetId;
    const isOwned = event.extendedProps.isOwned;

    if (!isOwned || !assetId) {
      // Show navigation modal for other content
      const contentId = event.extendedProps.contentId;
      const contentTitle = event.extendedProps.contentTitle;

      if (contentId) {
        setNavigationModal({
          open: true,
          contentId,
          contentTitle: contentTitle || 'Unknown Content',
        });
      }
      return;
    }

    // Find asset (check pending changes first)
    const asset = pendingChanges.get(assetId) || assets.find(a => a.id === assetId);
    if (!asset?.asset_scheduled_at) return;

    const businessTimezone = content.businesses?.timezone || 'UTC';
    const scheduledDate = toZonedTime(new Date(asset.asset_scheduled_at), businessTimezone);

    setEditingEvent({
      assetId,
      currentDate: format(scheduledDate, 'yyyy-MM-dd'),
      time: format(scheduledDate, 'HH:mm'),
    });
    setIsEditModalOpen(true);
  };

  // Handle time edit save
  const handleTimeEditSave = async () => {
    if (!editingEvent) return;

    const businessTimezone = content.businesses?.timezone || 'UTC';
    const newDateTime = new Date(`${editingEvent.currentDate}T${editingEvent.time}`);
    const newDateTimeUTC = fromZonedTime(newDateTime, businessTimezone);

    // Store as pending change instead of immediate save
    const originalAsset = assets.find(a => a.id === editingEvent.assetId);
    if (!originalAsset) return;

    const updatedAsset = { 
      ...originalAsset, 
      asset_scheduled_at: newDateTimeUTC.toISOString() 
    };

    setPendingChanges(prev => new Map(prev.set(editingEvent.assetId, updatedAsset)));
    setHasUnsavedChanges(true);
    
    toast.success('Time change staged - click &quot;Schedule&quot; to save');
    setIsEditModalOpen(false);
    setEditingEvent(null);
  };

  // Handle batch save of pending changes
  const handleSaveBatchChanges = async () => {
    if (pendingChanges.size === 0) return;

    setIsSaving(true);
    try {
      const changes = Array.from(pendingChanges.values()).map(asset => ({
        assetId: asset.id,
        newDateTime: asset.asset_scheduled_at!,
      }));

      // Save each change individually (reusing existing logic)
      const results = await Promise.allSettled(
        changes.map(change => 
          updateAssetSchedule({
            assetId: change.assetId,
            newDateTime: change.newDateTime,
          })
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        toast.success(`Successfully scheduled ${successCount} asset${successCount !== 1 ? 's' : ''}`);
        setPendingChanges(new Map());
        setHasUnsavedChanges(false);
        await onRefresh?.();
        loadBusinessAssets();
      }

      if (failCount > 0) {
        toast.error(`Failed to schedule ${failCount} asset${failCount !== 1 ? 's' : ''}`);
      }
    } catch (error) {
      toast.error('Failed to save changes');
      console.error('Batch save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle reset pending changes
  const handleResetPendingChanges = () => {
    setPendingChanges(new Map());
    setHasUnsavedChanges(false);
    toast.success('Changes reset to saved state');
  };

  // Handle Schedule All (add to pending changes, don't save immediately)
  const handleScheduleAll = () => {
    if (!allAssetsApproved) {
      toast.error('All assets must be approved before scheduling');
      return;
    }

    if (unscheduledAssets.length === 0) {
      toast.info('No approved assets available to schedule');
      return;
    }

    // Replicate the scheduling logic locally (5-day sequence)
    const schedulingSequence = [
      { day: 0, types: ['youtube_video', 'blog_post', 'social_long_video'] },
      { day: 1, types: ['social_quote_card'] },
      { day: 2, types: ['email', 'social_blog_post'] },
      { day: 3, types: ['social_rant_post'] },
      { day: 4, types: ['social_short_video'] },
    ];

    // const businessTimezone = content.businesses?.timezone || 'UTC'; // Unused for now
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const newPendingChanges = new Map(pendingChanges);
    let scheduledCount = 0;

    // Schedule assets according to the sequence
    schedulingSequence.forEach(({ day, types }) => {
      types.forEach(type => {
        const asset = unscheduledAssets.find(asset => 
          asset.content_type === type && !pendingChanges.has(asset.id)
        );
        
        if (asset) {
          const scheduleDate = new Date(tomorrow);
          scheduleDate.setDate(tomorrow.getDate() + day);
          
          // Set time to 9:00 AM in business timezone (default)
          scheduleDate.setHours(9, 0, 0, 0);
          
          const updatedAsset = {
            ...asset,
            asset_scheduled_at: scheduleDate.toISOString()
          };
          
          newPendingChanges.set(asset.id, updatedAsset);
          scheduledCount++;
        }
      });
    });

    if (scheduledCount > 0) {
      setPendingChanges(newPendingChanges);
      setHasUnsavedChanges(true);
      toast.success(`${scheduledCount} assets staged for scheduling - click &quot;Schedule&quot; to save`);
    } else {
      toast.info('No assets available to schedule');
    }
  };

  // Handle reset schedules (clear both saved schedules AND pending changes)
  const handleResetSchedules = async () => {
    try {
      const result = await resetContentAssetSchedules({ contentId: content.id });

      if (result.success) {
        // Also clear pending changes (orange items)
        setPendingChanges(new Map());
        setHasUnsavedChanges(false);
        
        toast.success('All schedules cleared');
        setIsResetDialogOpen(false);
        await onRefresh?.();
        loadBusinessAssets();
      } else {
        toast.error(result.error || 'Failed to clear schedules');
      }
    } catch (error) {
      toast.error('Failed to clear schedules');
      console.error('Reset error:', error);
    }
  };

  // Navigation guard for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p className="font-medium">Error loading content assets</p>
            <p className="text-sm">{error}</p>
            {onRefresh && (
              <Button onClick={onRefresh} variant="outline" className="mt-2">
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const showScheduleAllBanner = allAssetsApproved && approvedUnscheduledCount > 0;
  const showSuccessBanner = allAssetsApproved && approvedUnscheduledCount === 0 && scheduledAssets.length > 0;

  return (
    <div className="space-y-6">
      {/* Success Banner (when all content is scheduled) */}
      {showSuccessBanner && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <h3 className="text-green-900 font-medium">Content Scheduled for Publishing</h3>
              <p className="text-green-700">All {scheduledAssets.length} assets are scheduled and will be published automatically.</p>
            </div>
          </div>
        </div>
      )}

      {/* Schedule All Banner (conditional - only when ALL assets approved) */}
      {showScheduleAllBanner && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-blue-900 font-medium">Ready to schedule</h3>
              <p className="text-blue-700">All {approvedUnscheduledCount} assets are approved and ready for scheduling.</p>
            </div>
            <Button 
              onClick={handleScheduleAll} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              Schedule All
            </Button>
          </div>
        </div>
      )}

      {/* Approval Required Banner (when assets not approved) */}
      {!allAssetsApproved && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-orange-900 font-medium">Approval required</h3>
              <p className="text-orange-700">Complete approval for all assets using the stepper menu before scheduling.</p>
            </div>
            <div className="text-orange-600 font-medium">
              {approvalProgress.approved}/{approvalProgress.total} approved
            </div>
          </div>
        </div>
      )}

      {/* Calendar Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Content Calendar</CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsResetDialogOpen(true)}
                disabled={scheduledAssets.length === 0 && pendingChanges.size === 0}
              >
                Clear All Schedules
              </Button>
              <Button size="sm" onClick={loadBusinessAssets}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="mb-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Saved Content</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span>Pending Changes</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-gray-400 rounded opacity-30"></div>
                <span>Other Content</span>
              </div>
            </div>
            <p className="mt-2">
              {unscheduledAssets.length > 0 
                ? `Click on any date to schedule the next approved asset (${unscheduledAssets.length} remaining)`
                : 'All approved assets are scheduled'
              }
            </p>
            <p>Drag and drop to reschedule. Changes are saved when you click &quot;Schedule&quot;.</p>
          </div>

          {/* Calendar */}
          {isLoadingBusinessAssets ? (
            <div className="text-center py-8">
              <p>Loading calendar...</p>
            </div>
          ) : (
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth',
              }}
              events={calendarEvents}
              editable={allAssetsApproved} // Only allow editing if all approved
              selectable={allAssetsApproved} // Only allow selecting if all approved
              selectMirror={true}
              eventDrop={handleDateDrop}
              eventClick={handleEventClick}
              select={handleDateSelect}
              height="auto"
              dayMaxEvents={3}
              eventDisplay="block"
              eventTimeFormat={{
                hour: 'numeric',
                minute: '2-digit',
                meridiem: 'short'
              }}
            />
          )}

          {/* Batch Scheduling Controls */}
          {hasUnsavedChanges && (
            <div className="mt-4 flex justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPendingChanges}
                disabled={isSaving}
              >
                Reset Changes
              </Button>
              <Button
                size="sm"
                onClick={handleSaveBatchChanges}
                disabled={isSaving || pendingChanges.size === 0}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-1" />
                    Schedule ({pendingChanges.size} {pendingChanges.size === 1 ? 'change' : 'changes'})
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Schedule Time</DialogTitle>
            <DialogDescription>
              Change the time for this scheduled content asset.
            </DialogDescription>
          </DialogHeader>
          {editingEvent && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editingEvent.currentDate}
                  onChange={(e) =>
                    setEditingEvent(prev => prev ? { ...prev, currentDate: e.target.value } : null)
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-time">Time</Label>
                <Input
                  id="edit-time"
                  type="time"
                  value={editingEvent.time}
                  onChange={(e) =>
                    setEditingEvent(prev => prev ? { ...prev, time: e.target.value } : null)
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTimeEditSave}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Schedules Confirmation */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Schedules?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all scheduling information from this content&apos;s assets, including both saved schedules and pending changes.
              You&apos;ll need to reschedule them manually. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetSchedules}
              className="bg-red-600 hover:bg-red-700"
            >
              Clear All Schedules
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Navigation Modal */}
      <AlertDialog open={navigationModal.open} onOpenChange={(open) => 
        setNavigationModal(prev => ({ ...prev, open }))
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>View Other Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This content asset is part of &quot;{navigationModal.contentTitle}&quot;. 
              This is shown here only to indicate what else is being posted on this day.
              <br /><br />
              Would you like to navigate to that content to view or edit it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => 
              setNavigationModal({ open: false, contentId: '', contentTitle: '' })
            }>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              router.push(`/content/${navigationModal.contentId}`);
            }}>
              Go to Content
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 