'use client';


import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Share2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { SocialMediaStatusIcons } from './social-media-status-icons';

interface SocialAccount {
  display_name: string;
  social_images: string;
  username: string;
}

interface SocialAccounts {
  facebook?: SocialAccount | "";
  instagram?: SocialAccount | "";
  twitter?: SocialAccount | "";
  youtube?: SocialAccount | "";
  linkedin?: SocialAccount | "";
  tiktok?: SocialAccount | "";
}

interface SocialMediaData {
  profile: Record<string, unknown> & {
    facebook_page_id?: string | null;
  };
  social_accounts: SocialAccounts;
  synced: boolean;
  last_synced_at?: string;
  error?: string;
}

interface SocialMediaIntegrationCardProps {
  socialMediaData?: SocialMediaData | null;
  loading?: boolean;
  connecting?: boolean;
  refreshing?: boolean;
  onConnect?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export function SocialMediaIntegrationCard({ 
  socialMediaData,
  loading = false,
  connecting = false,
  refreshing = false,
  onConnect,
  onRefresh
}: SocialMediaIntegrationCardProps) {

  const handleConnect = async () => {
    if (!onConnect) {
      toast.error('Connection functionality not available');
      return;
    }

    try {
      await onConnect();
    } catch (error) {
      console.error('Error connecting social media:', error);
      // Error handling is done in the parent component
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;

    try {
      await onRefresh();
    } catch (error) {
      console.error('Error refreshing social media accounts:', error);
      // Error handling is done in the parent component
    }
  };

  const getConnectedCount = (): number => {
    if (!socialMediaData?.social_accounts) return 0;
    return Object.values(socialMediaData.social_accounts).filter(
      (account): account is SocialAccount => account && typeof account === 'object' && 'username' in account
    ).length;
  };

  const connectedCount = getConnectedCount();
  const totalPlatforms = 6;

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="rounded-lg border bg-white shadow-sm">
          {/* Header skeleton */}
          <div className="p-6 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="h-5 w-5 bg-gray-200 rounded"></div>
                <div className="h-6 w-40 bg-gray-200 rounded"></div>
              </div>
              <div className="h-5 w-20 bg-gray-200 rounded-full"></div>
            </div>
            <div className="h-4 w-80 bg-gray-200 rounded"></div>
          </div>
          
          {/* Content skeleton */}
          <div className="px-6 pb-6">
            <div className="mb-4">
              <div className="h-4 w-32 bg-gray-200 rounded mb-4"></div>
            </div>
            
            {/* Icons grid skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex flex-col items-center space-y-2 p-3 bg-gray-50 rounded-lg border">
                  <div className="flex items-center space-x-2">
                    <div className="h-5 w-5 bg-gray-200 rounded"></div>
                    <div className="h-4 w-16 bg-gray-200 rounded"></div>
                  </div>
                  <div className="h-5 w-20 bg-gray-200 rounded-full"></div>
                </div>
              ))}
            </div>
            
            {/* Button skeleton */}
            <div className="pt-4 border-t">
              <div className="h-10 w-full bg-gray-200 rounded-md"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Share2 className="h-5 w-5" />
            <CardTitle>Social Media Integration</CardTitle>
          </div>
          <Badge variant={connectedCount > 0 ? "default" : "secondary"} className="text-xs">
            {connectedCount}/{totalPlatforms} Connected
          </Badge>
        </div>
        <CardDescription>
          Connect your social media accounts through Upload-Post to manage your social media presence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium">Connected Platforms</h4>
            <div className="flex items-center space-x-2">
              {socialMediaData?.last_synced_at && (
                <span className="text-xs text-muted-foreground">
                  Last synced: {new Date(socialMediaData.last_synced_at).toLocaleString()}
                </span>
              )}
              {onRefresh && (
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                  title="Refresh social media connections"
                >
                  <RefreshCw 
                    className={`h-4 w-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} 
                  />
                </button>
              )}
            </div>
          </div>
          
          <SocialMediaStatusIcons socialAccounts={socialMediaData?.social_accounts} />
          

        </div>

        <div className="pt-4 border-t">
          <Button
            onClick={handleConnect}
            disabled={connecting || !onConnect}
            className="w-full"
            size="lg"
          >
            {connecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Share2 className="mr-2 h-4 w-4" />
                Connect Social Media
              </>
            )}
          </Button>
          
          <p className="text-xs text-muted-foreground mt-2 text-center">
            You&apos;ll be redirected to Upload-Post to connect your accounts
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 