'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { SocialMediaIntegrationCard } from './social-media-integration-card';
import { validateJWTRedirect } from '@/lib/upload-post';

interface SocialAccount {
  display_name: string;
  social_images: string;
  username: string;
}

interface SocialAccounts {
  facebook?: SocialAccount | "";
  instagram?: SocialAccount | "";
  x?: SocialAccount | "";
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

export function SocialMediaIntegrationWrapper() {
  const [socialMediaData, setSocialMediaData] = useState<SocialMediaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle manual sync with enhanced error handling
  const handleSync = useCallback(async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    
    try {
      const response = await fetch('/api/upload-post/profiles/sync', {
        method: 'POST',
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Sync rate limit reached. Please wait before trying again.');
        }
        if (response.status === 401) {
          throw new Error('Authentication failed. Please refresh the page and try again.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Sync failed`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setSocialMediaData({
          profile: result.data.profile,
          social_accounts: result.data.social_accounts,
          synced: true,
          last_synced_at: result.data.synced_at,
        });
      } else {
        throw new Error('Invalid sync response received');
      }
      
    } catch (error) {
      console.error('Error syncing social media accounts:', error);
      toast.error('Sync Failed', {
        description: error instanceof Error ? error.message : 'Failed to sync social media accounts',
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  // Handle return from upload-post with enhanced security validation
  useEffect(() => {
    const handleReturnFromUploadPost = async () => {
      const validation = validateJWTRedirect(searchParams);
      
      if (!validation.isValid) {
        if (validation.error) {
          toast.error('Connection Error', {
            description: validation.error,
          });
        }
        // Clean up URL parameters
        router.replace('/settings/integrations');
        return;
      }
      
      if (validation.connected) {
        const platforms = searchParams.get('platforms');
        const devMode = searchParams.get('dev_mode');
        
        // Show success message with platform info
        const platformList = platforms ? platforms.split(',').join(', ') : 'social media accounts';
        const description = devMode 
          ? `Development mode: Successfully simulated connection to ${platformList}`
          : `Successfully connected to upload-post. Connected platforms: ${platformList}. Syncing your accounts...`;
          
        toast.success('Social Media Connected!', {
          description,
        });

        // Trigger automatic sync
        try {
          await handleSync();
        } catch (error) {
          console.error('Auto-sync after connection failed:', error);
          // Still clean up URL even if sync fails
        }

        // Clean up URL parameters
        router.replace('/settings/integrations');
      }
    };

    handleReturnFromUploadPost();
  }, [searchParams, router, handleSync]);

  // Fetch social media data
  const fetchSocialMediaData = async () => {
    try {
      const response = await fetch('/api/upload-post/profiles', {
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Too many requests. Please wait a moment before trying again.');
        }
        if (response.status === 401) {
          throw new Error('Authentication failed. Please refresh the page and try again.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSocialMediaData(data);
    } catch (error) {
      console.error('Error fetching social media data:', error);
      toast.error('Error Loading Data', {
        description: error instanceof Error ? error.message : 'Failed to load social media connections',
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchSocialMediaData();
  }, []);

  // Handle connection flow with enhanced error handling
  const handleConnect = async () => {
    if (connecting) return;
    
    setConnecting(true);
    
    try {
      // First, ensure profile exists (try to create it, but ignore 409 conflicts)
      if (!socialMediaData?.profile) {
        const createResponse = await fetch('/api/upload-post/profiles', {
          method: 'POST',
          credentials: 'include', // Include cookies for authentication
        });
        
        if (!createResponse.ok) {
          if (createResponse.status === 429) {
            throw new Error('Too many profile creation attempts. Please wait before trying again.');
          }
          if (createResponse.status === 401) {
            throw new Error('Authentication failed. Please refresh the page and try again.');
          }
          if (createResponse.status === 409) {
            // Profile already exists - this is OK, continue to connection step
            console.log('Profile already exists, proceeding to connection...');
          } else {
            const errorData = await createResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to create upload-post profile');
          }
        }
      }

      // Generate JWT URL for connection
      const connectResponse = await fetch('/api/upload-post/connect', {
        method: 'POST',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          options: {} // Add any custom connection options here
        }),
      });
      
      if (!connectResponse.ok) {
        if (connectResponse.status === 429) {
          throw new Error('Too many connection attempts. Please wait before trying again.');
        }
        if (connectResponse.status === 401) {
          throw new Error('Authentication failed. Please refresh the page and try again.');
        }
        const errorData = await connectResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate connection URL');
      }
      
      const connectData = await connectResponse.json();
      const { access_url, dev_mode, message } = connectData;
      
      // Validate the access URL before redirecting
      try {
        new URL(access_url);
      } catch {
        throw new Error('Invalid connection URL received. Please try again.');
      }
      
      if (dev_mode) {
        console.log('Development mode detected:', message);
        toast.info('Development Mode', {
          description: message || 'Using development mode for testing.',
        });
      }
      
      // Redirect to upload-post (or development callback) for social media connection
      window.location.href = access_url;
      
    } catch (error) {
      console.error('Error connecting to upload-post:', error);
      toast.error('Connection Failed', {
        description: error instanceof Error ? error.message : 'Failed to connect to upload-post',
      });
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (refreshing) {
      handleSync();
    }
  }, [refreshing, handleSync]);

  return (
    <SocialMediaIntegrationCard
      socialMediaData={socialMediaData}
      loading={loading}
      connecting={connecting}
      refreshing={refreshing}
      onConnect={handleConnect}
      onRefresh={handleSync}
    />
  );
} 