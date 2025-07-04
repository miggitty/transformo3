'use client';

import { useState } from 'react';
import { ContentAsset, ContentWithBusiness } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar,
  Eye,
  Edit,
  MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EnhancedAssetCardProps {
  asset: ContentAsset;
  content: ContentWithBusiness;
  onApprovalToggle: (assetId: string, approved: boolean) => Promise<void>;
  onSchedule: (assetId: string) => void;
  onEdit: (assetId: string) => void;
  onView: (assetId: string) => void;
  isLoading?: boolean;
  showSchedulingActions?: boolean;
}

export function EnhancedAssetCard({
  asset,
  onApprovalToggle,
  onSchedule,
  onEdit,
  onView,
  isLoading = false,
  showSchedulingActions = true,
}: EnhancedAssetCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleApprovalToggle = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      await onApprovalToggle(asset.id, checked);
      toast.success(checked ? 'Asset approved' : 'Asset approval removed');
    } catch (error) {
      toast.error('Failed to update approval status');
      console.error('Approval toggle error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Asset display name mapping
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

  // Determine asset status
  const getAssetStatus = () => {
    if (!asset.approved) {
      return {
        status: 'pending_approval',
        label: 'Pending Approval',
        color: 'orange',
        icon: AlertCircle,
        description: 'Asset needs approval before scheduling'
      };
    }
    
    if (asset.approved && !asset.asset_scheduled_at) {
      return {
        status: 'ready_to_schedule',
        label: 'Ready to Schedule',
        color: 'blue',
        icon: Clock,
        description: 'Asset approved and ready for scheduling'
      };
    }
    
    if (asset.approved && asset.asset_scheduled_at) {
      return {
        status: 'scheduled',
        label: 'Scheduled',
        color: 'green',
        icon: CheckCircle,
        description: `Scheduled for ${new Date(asset.asset_scheduled_at).toLocaleDateString()}`
      };
    }
    
    return {
      status: 'unknown',
      label: 'Unknown',
      color: 'gray',
      icon: AlertCircle,
      description: 'Status unknown'
    };
  };

  const assetStatus = getAssetStatus();
  const StatusIcon = assetStatus.icon;

  // Get badge variant based on status
  const getBadgeVariant = (color: string) => {
    switch (color) {
      case 'green':
        return 'default';
      case 'blue':
        return 'secondary';
      case 'orange':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card className={cn(
      "relative transition-all duration-200 hover:shadow-md",
      assetStatus.status === 'scheduled' && "border-green-200 bg-green-50/50",
      assetStatus.status === 'ready_to_schedule' && "border-blue-200 bg-blue-50/50",
      assetStatus.status === 'pending_approval' && "border-orange-200 bg-orange-50/50"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <StatusIcon className={cn(
              "h-4 w-4",
              assetStatus.color === 'green' && "text-green-600",
              assetStatus.color === 'blue' && "text-blue-600",
              assetStatus.color === 'orange' && "text-orange-600",
              assetStatus.color === 'gray' && "text-gray-600"
            )} />
                         <CardTitle className="text-base font-medium">
               {getAssetDisplayName(asset.content_type || 'unknown')}
             </CardTitle>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant={getBadgeVariant(assetStatus.color)} className="text-xs">
              {assetStatus.label}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onView(asset.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(asset.id)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Content
                </DropdownMenuItem>
                {showSchedulingActions && asset.approved && !asset.asset_scheduled_at && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onSchedule(asset.id)}>
                      <Calendar className="mr-2 h-4 w-4" />
                      Schedule Asset
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground">
          {assetStatus.description}
        </p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Approval Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "w-2 h-2 rounded-full",
              asset.approved ? "bg-green-500" : "bg-orange-500"
            )} />
            <div>
              <Label htmlFor={`approval-${asset.id}`} className="font-medium">
                Content Approval
              </Label>
              <p className="text-xs text-muted-foreground">
                {asset.approved 
                  ? "This asset is approved and ready for scheduling" 
                  : "Approve this asset to enable scheduling"
                }
              </p>
            </div>
          </div>
          
          <Switch
            id={`approval-${asset.id}`}
            checked={asset.approved || false}
            onCheckedChange={handleApprovalToggle}
            disabled={isUpdating || isLoading}
          />
        </div>

        {/* Content Preview */}
        {asset.headline && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Headline
            </Label>
            <p className="text-sm line-clamp-2">
              {asset.headline}
            </p>
          </div>
        )}

        {/* Scheduling Info */}
        {asset.asset_scheduled_at && (
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Scheduled For
            </Label>
            <div className="flex items-center space-x-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {new Date(asset.asset_scheduled_at).toLocaleDateString('en-AU', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )}

        {/* Next Steps */}
        {!asset.approved && (
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <p className="text-sm font-medium text-orange-800">
                Next Step: Review and Approve
              </p>
            </div>
            <p className="text-xs text-orange-700 mt-1">
              Review the content and toggle approval when satisfied with the quality.
            </p>
          </div>
        )}

        {asset.approved && !asset.asset_scheduled_at && showSchedulingActions && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-medium text-blue-800">
                    Ready to Schedule
                  </p>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  This asset is approved and can be scheduled for publishing.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => onSchedule(asset.id)}
                className="ml-2"
              >
                Schedule
              </Button>
            </div>
          </div>
        )}

        {asset.approved && asset.asset_scheduled_at && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                Ready for Publishing
              </p>
            </div>
            <p className="text-xs text-green-700 mt-1">
              This asset is approved and scheduled for automatic publishing.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 