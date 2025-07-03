'use client';

import { ContentAsset, ContentWithBusiness } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Calendar,
  FileText,
  ArrowRight,
  Users,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentStatusFlowProps {
  content: ContentWithBusiness;
  assets: ContentAsset[];
  onBulkApprove: () => void;
  onScheduleAll: () => void;
  isLoading?: boolean;
}

export function ContentStatusFlow({
  content,
  assets,
  onBulkApprove,
  onScheduleAll,
  isLoading = false,
}: ContentStatusFlowProps) {
  // Calculate progress statistics
  const totalAssets = assets.length;
  const approvedAssets = assets.filter(asset => asset.approved).length;
  const scheduledAssets = assets.filter(asset => asset.asset_scheduled_at).length;
  const publishedAssets = assets.filter(asset => asset.asset_status === 'Sent').length;

  const approvalProgress = totalAssets > 0 ? (approvedAssets / totalAssets) * 100 : 0;
  const schedulingProgress = totalAssets > 0 ? (scheduledAssets / totalAssets) * 100 : 0;
  const publishingProgress = totalAssets > 0 ? (publishedAssets / totalAssets) * 100 : 0;

  // Determine current phase using simplified status logic
  const getCurrentPhase = () => {
    if (content.status === 'processing') {
      return 'generating';
    }
    if (content.status === 'failed') {
      return 'failed';
    }
    if (totalAssets === 0) {
      return 'no_assets';
    }
    if (approvedAssets === 0) {
      return 'needs_approval';
    }
    if (approvedAssets < totalAssets) {
      return 'partial_approval';
    }
    if (scheduledAssets === 0) {
      return 'needs_scheduling';
    }
    if (scheduledAssets < totalAssets) {
      return 'partial_scheduling';
    }
    if (publishedAssets === totalAssets) {
      return 'completed';
    }
    return 'scheduled';
  };

  const currentPhase = getCurrentPhase();

  // Get next action based on current phase
  const getNextAction = () => {
    switch (currentPhase) {
      case 'generating':
        return {
          title: 'Content is being generated',
          description: 'Please wait while AI creates your content assets.',
          action: null,
          urgent: false
        };
      case 'failed':
        return {
          title: 'Content generation failed',
          description: 'There was an issue generating your content. Please try again.',
          action: { label: 'Retry Generation', onClick: () => {/* TODO: Implement retry */} },
          urgent: true
        };
      case 'no_assets':
        return {
          title: 'No content assets found',
          description: 'Content generation may still be in progress or failed.',
          action: null,
          urgent: false
        };
      case 'needs_approval':
        return {
          title: 'All content needs approval',
          description: `Review and approve ${totalAssets} content assets to proceed with scheduling.`,
          action: { label: 'Approve All', onClick: onBulkApprove },
          urgent: true
        };
      case 'partial_approval':
        return {
          title: 'Some content needs approval',
          description: `${totalAssets - approvedAssets} of ${totalAssets} assets still need approval.`,
          action: { label: 'Approve Remaining', onClick: onBulkApprove },
          urgent: true
        };
      case 'needs_scheduling':
        return {
          title: 'Ready to schedule',
          description: `All ${totalAssets} assets are approved and ready for scheduling.`,
          action: { label: 'Schedule All', onClick: onScheduleAll },
          urgent: false
        };
      case 'partial_scheduling':
        return {
          title: 'Some content needs scheduling',
          description: `${totalAssets - scheduledAssets} of ${totalAssets} assets still need scheduling.`,
          action: { label: 'Schedule Remaining', onClick: onScheduleAll },
          urgent: false
        };
      case 'scheduled':
        return {
          title: 'All content scheduled',
          description: 'Your content is scheduled and will be published automatically.',
          action: null,
          urgent: false
        };
      case 'completed':
        return {
          title: 'Content publishing completed',
          description: 'All content has been successfully published.',
          action: null,
          urgent: false
        };
      default:
        return {
          title: 'Status unknown',
          description: 'Unable to determine current status.',
          action: null,
          urgent: false
        };
    }
  };

  const nextAction = getNextAction();

  // Flow steps for visualization
  const flowSteps = [
    {
      id: 'generation',
      title: 'Content Generation',
      icon: FileText,
      status: content.status === 'draft' && totalAssets > 0 ? 'completed' : 
             content.status === 'processing' ? 'active' : 
             content.status === 'failed' ? 'failed' : 'pending',
      description: `${totalAssets} assets generated`
    },
    {
      id: 'approval',
      title: 'Content Approval',
      icon: Users,
      status: approvedAssets === totalAssets && totalAssets > 0 ? 'completed' :
             approvedAssets > 0 ? 'active' : 'pending',
      description: `${approvedAssets}/${totalAssets} approved`
    },
    {
      id: 'scheduling',
      title: 'Content Scheduling',
      icon: Calendar,
      status: scheduledAssets === totalAssets && totalAssets > 0 ? 'completed' :
             scheduledAssets > 0 ? 'active' : 'pending',
      description: `${scheduledAssets}/${totalAssets} scheduled`
    },
    {
      id: 'publishing',
      title: 'Content Publishing',
      icon: Send,
      status: publishedAssets === totalAssets && totalAssets > 0 ? 'completed' :
             publishedAssets > 0 ? 'active' : 'pending',
      description: `${publishedAssets}/${totalAssets} published`
    }
  ];

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'active':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-100 border-red-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'active':
        return Clock;
      case 'failed':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Content Publishing Flow</CardTitle>
          <Badge variant={nextAction.urgent ? 'destructive' : 'secondary'}>
            {currentPhase.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Progress Flow Visualization */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {flowSteps.map((step, index) => {
            const StepIcon = step.icon;
            const StatusIcon = getStepIcon(step.status);
            
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center flex-1">
                  <div className={cn(
                    "w-12 h-12 rounded-full border-2 flex items-center justify-center mb-2 transition-all",
                    getStepStatusColor(step.status)
                  )}>
                    <StatusIcon className="h-6 w-6" />
                  </div>
                  <h3 className="font-medium text-sm text-center">{step.title}</h3>
                  <p className="text-xs text-muted-foreground text-center">{step.description}</p>
                </div>
                
                {index < flowSteps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground mx-2 hidden md:block" />
                )}
              </div>
            );
          })}
        </div>

        {/* Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Approval Progress</span>
              <span>{approvedAssets}/{totalAssets}</span>
            </div>
            <Progress value={approvalProgress} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Scheduling Progress</span>
              <span>{scheduledAssets}/{totalAssets}</span>
            </div>
            <Progress value={schedulingProgress} className="h-2" />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Publishing Progress</span>
              <span>{publishedAssets}/{totalAssets}</span>
            </div>
            <Progress value={publishingProgress} className="h-2" />
          </div>
        </div>

        {/* Next Action Card */}
        <div className={cn(
          "p-4 rounded-lg border",
          nextAction.urgent ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className={cn(
                "font-medium mb-1",
                nextAction.urgent ? "text-orange-800" : "text-blue-800"
              )}>
                {nextAction.title}
              </h3>
              <p className={cn(
                "text-sm",
                nextAction.urgent ? "text-orange-700" : "text-blue-700"
              )}>
                {nextAction.description}
              </p>
            </div>
            
            {nextAction.action && (
              <Button
                onClick={nextAction.action.onClick}
                disabled={isLoading}
                variant={nextAction.urgent ? "destructive" : "default"}
                className="ml-4"
              >
                {nextAction.action.label}
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{approvedAssets}</div>
            <div className="text-xs text-muted-foreground">Approved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{scheduledAssets}</div>
            <div className="text-xs text-muted-foreground">Scheduled</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{publishedAssets}</div>
            <div className="text-xs text-muted-foreground">Published</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{totalAssets}</div>
            <div className="text-xs text-muted-foreground">Total Assets</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 