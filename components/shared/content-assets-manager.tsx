'use client';

import { ContentAsset, ContentWithBusiness } from '@/types';
import YouTubeVideoForm from './content-asset-forms/youtube-video-form';
import EmailForm from './content-asset-forms/email-form';
import BlogPostForm from './content-asset-forms/blog-post-form';
import SocialRantPostForm from './content-asset-forms/social-rant-post-form';
import SocialBlogPostForm from './content-asset-forms/social-blog-post-form';
import SocialLongVideoForm from './content-asset-forms/social-long-video-form';
import SocialShortVideoForm from './content-asset-forms/social-short-video-form';
import SocialQuoteCardForm from './content-asset-forms/social-quote-card-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  TooltipProvider,
} from '@/components/ui/tooltip';
import { useState, useEffect, useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  scheduleContentAssets,
  updateAssetSchedule,
  getBusinessAssets,
  resetContentAssetSchedules
} from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface ContentAssetsManagerProps {
  assets: ContentAsset[];
  content: ContentWithBusiness;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => Promise<void>;
  onAssetUpdate?: (updatedAsset: ContentAsset) => void;
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
    content_title: string;
  };
}

export default function ContentAssetsManager({
  assets,
  content,
  isLoading,
  error,
  onRefresh,
  onAssetUpdate,
}: ContentAssetsManagerProps) {
  const router = useRouter();
  const [activeView, setActiveView] = useState('list');
  const [isScheduling, setIsScheduling] = useState(false);
  const [businessAssets, setBusinessAssets] = useState<BusinessAsset[]>([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [timeEditModal, setTimeEditModal] = useState<{
    open: boolean;
    assetId: string;
    currentTime: string;
    assetTitle: string;
  }>({
    open: false,
    assetId: '',
    currentTime: '',
    assetTitle: '',
  });
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [navigationModal, setNavigationModal] = useState<{
    open: boolean;
    contentId: string;
    contentTitle: string;
  }>({
    open: false,
    contentId: '',
    contentTitle: '',
  });
  
  const businessTimezone = content.businesses?.timezone || 'UTC';

  // Helper function for asset display names
  const getAssetDisplayName = (contentType: string): string => {
    const typeMap: Record<string, string> = {
      youtube_video: 'YouTube Video',
      blog_post: 'Blog Post',
      email: 'Email',
      social_rant_post: 'Social Rant',
      social_blog_post: 'Social Blog',
      social_long_video: 'Social Long Video',
      social_short_video: 'Social Short Video',
      social_quote_card: 'Quote Card',
    };
    return typeMap[contentType] || contentType;
  };

  // Get unscheduled assets count
  const unscheduledAssets = useMemo(() => {
    return assets.filter(asset => !asset.asset_scheduled_at);
  }, [assets]);

  // Get scheduled assets count
  const scheduledAssets = useMemo(() => {
    return assets.filter(asset => asset.asset_scheduled_at);
  }, [assets]);

  // Fetch business assets for the current month
  const fetchBusinessAssets = useCallback(async () => {
    if (!content.businesses?.id) return;

    const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);

    const result = await getBusinessAssets({
      businessId: content.businesses.id,
      startDate: startOfMonth.toISOString(),
      endDate: endOfMonth.toISOString(),
      excludeContentId: content.id,
    });

    if (result.success) {
      setBusinessAssets(result.data || []);
    }
  }, [content.businesses?.id, content.id, calendarDate]);

  useEffect(() => {
    if (activeView === 'calendar' && content.businesses?.id) {
      fetchBusinessAssets();
    }
  }, [activeView, calendarDate, content.businesses?.id, fetchBusinessAssets]);

  // Convert assets to calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    // Own content assets
    const ownedEvents: CalendarEvent[] = assets
      .filter(asset => asset.asset_scheduled_at !== null)
      .map(asset => ({
        id: asset.id,
        title: getAssetDisplayName(asset.content_type || ''),
        date: asset.asset_scheduled_at as string,
        backgroundColor: '#3b82f6',
        borderColor: '#1d4ed8',
        textColor: 'white',
        extendedProps: {
          assetType: asset.content_type || '',
          isOwned: true,
          contentId: content.id,
          assetId: asset.id,
        },
      }));

    // Other business assets
    const otherEvents: CalendarEvent[] = businessAssets
      .filter(asset => asset.asset_scheduled_at !== null)
      .map(asset => ({
        id: `other-${asset.id}`,
        title: getAssetDisplayName(asset.content_type || ''),
        date: asset.asset_scheduled_at as string,
        backgroundColor: '#6b7280',
        borderColor: '#4b5563',
        textColor: 'white',
        extendedProps: {
          assetType: asset.content_type || '',
          contentTitle: asset.content?.content_title || '',
          isOwned: false,
          contentId: asset.content?.id || '',
          assetId: asset.id,
        },
      }));

    const allEvents = [...ownedEvents, ...otherEvents];
    return allEvents;
  }, [assets, businessAssets, content.id]);

  const handleScheduleAll = async (startDate?: Date) => {
    if (unscheduledAssets.length === 0) {
      toast.error('No unscheduled assets to schedule.');
      return;
    }

    const scheduleDate = startDate || new Date();
    setIsScheduling(true);
    try {
      const result = await scheduleContentAssets({
        contentId: content.id,
        startDate: scheduleDate.toISOString(),
        businessTimezone,
      });

      if (result.success) {
        toast.success(`Scheduled ${result.scheduled} assets successfully!`);
        // Force calendar refresh
        setCalendarRefreshKey(prev => prev + 1);
        // Refresh the assets data
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        console.error('Scheduling failed:', result.error);
        toast.error(result.error || 'Failed to schedule assets.');
      }
    } catch (error) {
      console.error('Error scheduling assets:', error);
      toast.error('An error occurred while scheduling assets.');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleDateClick = (info: { date: Date }) => {
    if (unscheduledAssets.length > 0) {
      handleScheduleAll(info.date);
    }
  };

  const handleEventClick = (info: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { event } = info;
    
    if (!event.extendedProps.isOwned) {
      // For external events, don't do anything on single click
      return;
    }

    // Find the actual asset to get the correct scheduled time
    const asset = assets.find(a => a.id === event.extendedProps.assetId);
    if (!asset?.asset_scheduled_at) return;

    // Convert UTC time from database to business timezone for display
    const utcDate = new Date(asset.asset_scheduled_at);
    const zonedTime = toZonedTime(utcDate, businessTimezone);
    const timeString = format(zonedTime, 'HH:mm');

    setTimeEditModal({
      open: true,
      assetId: event.extendedProps.assetId,
      currentTime: timeString,
      assetTitle: event.title,
    });
  };

  const handleEventDoubleClick = (info: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { event } = info;
    
    // Only handle double-click for external events
    if (event.extendedProps.isOwned) {
      return;
    }

    const contentId = event.extendedProps.contentId;
    const contentTitle = event.extendedProps.contentTitle;

    if (contentId) {
      setNavigationModal({
        open: true,
        contentId,
        contentTitle: contentTitle || 'Unknown Content',
      });
    }
  };

  const handleNavigationConfirm = () => {
    router.push(`/content/${navigationModal.contentId}`);
  };

  const handleResetSchedules = async () => {
    const scheduledAssets = assets.filter(asset => asset.asset_scheduled_at);
    
    if (scheduledAssets.length === 0) {
      toast.error('No scheduled assets to reset.');
      return;
    }

    setIsResetting(true);
    try {
      // Optimistic update - clear all scheduled dates immediately
      const resetAssets = assets.map(asset => ({
        ...asset,
        asset_scheduled_at: null,
      }));

      // Update each asset locally
      scheduledAssets.forEach(originalAsset => {
        const resetAsset = resetAssets.find(a => a.id === originalAsset.id);
        if (onAssetUpdate && resetAsset) {
          onAssetUpdate(resetAsset);
        }
      });

      toast.success('Schedule reset successfully!');

      // Reset on server in background
      const result = await resetContentAssetSchedules({
        contentId: content.id,
      });

      if (!result.success) {
        // If server reset fails, revert the optimistic update
        assets.forEach(originalAsset => {
          if (onAssetUpdate && originalAsset.asset_scheduled_at) {
            onAssetUpdate(originalAsset);
          }
        });
        toast.error(result.error || 'Failed to reset schedule.');
      }
    } catch (error) {
      console.error('Error resetting schedules:', error);
      toast.error('An error occurred while resetting the schedule.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleEventDrop = async (info: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { event } = info;
    
    if (!event.extendedProps.isOwned) {
      info.revert();
      toast.error('You can only reschedule your own content assets.');
      return;
    }

    try {
      // Keep the same time, just change the date
      const originalAsset = assets.find(a => a.id === event.extendedProps.assetId);
      if (!originalAsset?.asset_scheduled_at) {
        console.error('No original asset or scheduled time found:', { 
          assetId: event.extendedProps.assetId, 
          originalAsset 
        });
        info.revert();
        return;
      }

      const originalDate = new Date(originalAsset.asset_scheduled_at);
      const newDate = new Date(event.start);
      
      // Convert original UTC time to business timezone to get the actual time
      const originalZonedTime = toZonedTime(originalDate, businessTimezone);
      
      // Create new date in business timezone preserving the time
      const newZonedDate = toZonedTime(newDate, businessTimezone);
      newZonedDate.setHours(originalZonedTime.getHours());
      newZonedDate.setMinutes(originalZonedTime.getMinutes());
      newZonedDate.setSeconds(originalZonedTime.getSeconds());
      newZonedDate.setMilliseconds(originalZonedTime.getMilliseconds());
      
      // Convert back to UTC for storage
      // Brisbane is GMT+10, so subtract 10 hours to get UTC
      const finalDate = new Date(Date.UTC(
        newZonedDate.getFullYear(),
        newZonedDate.getMonth(),
        newZonedDate.getDate(),
        newZonedDate.getHours() - 10,
        newZonedDate.getMinutes(),
        newZonedDate.getSeconds()
      ));

      const finalDateTime = finalDate.toISOString();

      // Optimistic update - update local state immediately
      if (onAssetUpdate && originalAsset) {
        const updatedAsset = {
          ...originalAsset,
          asset_scheduled_at: finalDateTime,
        };
        onAssetUpdate(updatedAsset);
      }

      toast.success('Asset rescheduled successfully!');

      // Update on server in background
      const result = await updateAssetSchedule({
        assetId: event.extendedProps.assetId,
        newDateTime: finalDateTime,
      });

      console.log('Update asset schedule result:', result);

      if (!result.success) {
        // If server update fails, revert the optimistic update
        if (onAssetUpdate && originalAsset) {
          onAssetUpdate(originalAsset); // Revert to original
        }
        toast.error(result.error || 'Failed to update schedule.');
      }
    } catch (error) {
      console.error('Drag drop error:', error);
      info.revert();
      toast.error('An error occurred while updating the schedule.');
    }
  };

  const handleTimeEdit = async (newTime: string) => {
    try {
      const asset = assets.find(a => a.id === timeEditModal.assetId);
      if (!asset?.asset_scheduled_at) return;

      const currentDate = new Date(asset.asset_scheduled_at);
      const [hours, minutes] = newTime.split(':').map(Number);
      
      // Create new date with updated time in business timezone
      const zonedDate = toZonedTime(currentDate, businessTimezone);
      zonedDate.setHours(hours, minutes, 0, 0);
      
      // Convert back to UTC
      const utcDate = fromZonedTime(zonedDate, businessTimezone);
      const newScheduledAt = utcDate.toISOString();

      // Optimistic update - update local state immediately
      const updatedAsset = {
        ...asset,
        asset_scheduled_at: newScheduledAt,
      };
      
      if (onAssetUpdate) {
        onAssetUpdate(updatedAsset);
      }

      // Close modal immediately 
      setTimeEditModal({ open: false, assetId: '', currentTime: '', assetTitle: '' });
      toast.success('Time updated successfully!');

      // Update on server in background
      const result = await updateAssetSchedule({
        assetId: timeEditModal.assetId,
        newDateTime: newScheduledAt,
      });

      if (!result.success) {
        // If server update fails, revert the optimistic update
        if (onAssetUpdate) {
          onAssetUpdate(asset); // Revert to original
        }
        toast.error(result.error || 'Failed to update time.');
      }
    } catch (error) {
      console.error('Time edit error:', error);
      toast.error('An error occurred while updating the time.');
    }
  };

  const renderAssetForm = (asset: ContentAsset) => {
    switch (asset.content_type) {
      case 'youtube_video':
        return <YouTubeVideoForm asset={asset} content={content} />;
      case 'email':
        return <EmailForm asset={asset} />;
      case 'blog_post':
        return <BlogPostForm asset={asset} />;
      case 'social_rant_post':
        return <SocialRantPostForm asset={asset} />;
      case 'social_blog_post':
        return <SocialBlogPostForm asset={asset} />;
      case 'social_long_video':
        return <SocialLongVideoForm asset={asset} content={content} />;
      case 'social_short_video':
        return <SocialShortVideoForm asset={asset} content={content} />;
      case 'social_quote_card':
        return <SocialQuoteCardForm asset={asset} />;
      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle>
                Unsupported Asset Type: &quot;{asset.content_type}&quot;
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This asset type does not have a dedicated editor yet. You can
                view its data below.
              </p>
              <pre className="mt-4 rounded-md bg-muted p-4 text-xs">
                {JSON.stringify(asset, null, 2)}
              </pre>
            </CardContent>
          </Card>
        );
    }
  };

  const renderListView = () => (
    <div className="space-y-8">
      {isLoading && <p>Loading content assets...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!isLoading && !error && assets.length === 0 && (
        <p>No content assets found for this item.</p>
      )}

      {!isLoading &&
        !error &&
        assets.map(asset => (
          <div key={asset.id}>{renderAssetForm(asset)}</div>
        ))}
    </div>
  );

  const renderCalendarView = () => (
    <div className="space-y-4">
      {(unscheduledAssets.length > 0 || scheduledAssets.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                {unscheduledAssets.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      You have {unscheduledAssets.length} unscheduled assets. Click on any date to start scheduling from that day.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Assets will be scheduled following a 5-day sequence starting at 10:00 AM in your timezone.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    All assets are scheduled. You can reset the schedule to reschedule them.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {unscheduledAssets.length > 0 && (
                  <Button 
                    onClick={() => handleScheduleAll()} 
                    disabled={isScheduling}
                    size="sm"
                  >
                    {isScheduling ? 'Scheduling...' : 'Schedule All Now'}
                  </Button>
                )}
                
                {scheduledAssets.length > 0 && (
                  <Button
                    onClick={handleResetSchedules}
                    disabled={isResetting}
                    variant="outline"
                    size="sm"
                  >
                    {isResetting ? 'Resetting...' : 'Reset Schedule'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Content Calendar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Blue events are your content assets (draggable). Gray events are from other content. 
            Click on your events to edit the time.
          </p>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <FullCalendar
              key={`calendar-${calendarRefreshKey}-${assets.length}`}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={calendarEvents}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              editable={true}
              droppable={true}
              height="auto"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth'
              }}
              datesSet={(dateInfo) => {
                setCalendarDate(dateInfo.start);
              }}
              eventDidMount={(info) => {
                const event = info.event;
                const isOwned = event.extendedProps.isOwned;
                const contentTitle = event.extendedProps.contentTitle;
                
                // Enhanced tooltip
                const tooltipText = isOwned 
                  ? `${event.title} - Click to edit time, drag to reschedule`
                  : `${event.title}${contentTitle ? ` - ${contentTitle}` : ''} - Double-click to view`;
                
                info.el.title = tooltipText;
                
                // Styling for different event types
                if (!isOwned) {
                  info.el.style.cursor = 'pointer';
                  info.el.style.opacity = '0.7';
                  
                  // Add double-click handler for external events
                  info.el.addEventListener('dblclick', () => {
                    handleEventDoubleClick({ event });
                  });
                } else {
                  info.el.style.cursor = 'grab';
                }
                
                // Add hover effects
                info.el.addEventListener('mouseenter', () => {
                  info.el.style.transform = 'scale(1.05)';
                  info.el.style.transition = 'transform 0.2s ease';
                  info.el.style.zIndex = '1000';
                });
                
                info.el.addEventListener('mouseleave', () => {
                  info.el.style.transform = 'scale(1)';
                  info.el.style.zIndex = 'auto';
                });
              }}
              eventStartEditable={true}
            />
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Content Assets</h2>
        </div>

        {renderListView()}
      </div>

      {/* Time Edit Modal */}
      <Dialog open={timeEditModal.open} onOpenChange={(open) => 
        setTimeEditModal(prev => ({ ...prev, open }))
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Schedule Time</DialogTitle>
            <DialogDescription>
              Update the scheduled time for {timeEditModal.assetTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="time" className="text-right">
                Time
              </Label>
              <Input
                id="time"
                type="time"
                value={timeEditModal.currentTime}
                onChange={(e) => 
                  setTimeEditModal(prev => ({ ...prev, currentTime: e.target.value }))
                }
                className="col-span-3"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Time will be scheduled in your business timezone: {businessTimezone}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTimeEditModal({ open: false, assetId: '', currentTime: '', assetTitle: '' })}
            >
              Cancel
            </Button>
            <Button onClick={() => handleTimeEdit(timeEditModal.currentTime)}>
              Update Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Navigation Confirmation Dialog */}
      <AlertDialog open={navigationModal.open} onOpenChange={(open) => 
        setNavigationModal(prev => ({ ...prev, open }))
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Navigate to Content?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to navigate to &quot;{navigationModal.contentTitle}&quot;. 
              Any unsaved changes on this page will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => 
              setNavigationModal({ open: false, contentId: '', contentTitle: '' })
            }>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleNavigationConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 