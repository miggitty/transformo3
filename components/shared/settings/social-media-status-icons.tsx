'use client';

import { Facebook, Instagram, Twitter, Youtube, Linkedin, Music } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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

interface SocialMediaStatusIconsProps {
  socialAccounts?: SocialAccounts | null;
  className?: string;
}

const socialPlatforms = [
  {
    key: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    key: 'instagram',
    name: 'Instagram', 
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
  },
  {
    key: 'x',
    name: 'X',
    icon: Twitter,
    color: 'text-black',
    bgColor: 'bg-gray-50',
  },
  {
    key: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
  {
    key: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    icon: Music,
    color: 'text-black',
    bgColor: 'bg-gray-50',
  },
] as const;

export function SocialMediaStatusIcons({ socialAccounts, className }: SocialMediaStatusIconsProps) {
  const isConnected = (platformKey: string): boolean => {
    if (!socialAccounts) {
      return false;
    }
    
    const account = socialAccounts[platformKey as keyof SocialAccounts];
    return !!(account && typeof account === 'object' && (account.username || account.display_name));
  };

  const getDisplayName = (platformKey: string): string | null => {
    if (!socialAccounts) return null;
    
    const account = socialAccounts[platformKey as keyof SocialAccounts];
    if (account && typeof account === 'object') {
      return account.display_name || account.username || null;
    }
    return null;
  };

  const getTooltipContent = (platform: (typeof socialPlatforms)[number], connected: boolean, displayName: string | null) => {
    if (connected && displayName) {
      return (
        <div className="text-center">
          <p className="font-medium">{platform.name}</p>
          <p className="text-xs text-muted-foreground">Connected as {displayName}</p>
        </div>
      );
    } else if (connected) {
      return (
        <div className="text-center">
          <p className="font-medium">{platform.name}</p>
          <p className="text-xs text-muted-foreground">Connected</p>
        </div>
      );
    } else {
      return (
        <div className="text-center">
          <p className="font-medium">{platform.name}</p>
          <p className="text-xs text-muted-foreground">Not connected</p>
          <p className="text-xs text-muted-foreground mt-1">Click &quot;Connect Social Media&quot; to link this account</p>
        </div>
      );
    }
  };

  return (
    <TooltipProvider>
      <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-4", className)}>
        {socialPlatforms.map((platform) => {
          const connected = isConnected(platform.key);
          const displayName = getDisplayName(platform.key);
          const Icon = platform.icon;

          return (
            <Tooltip key={platform.key}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex flex-col items-center space-y-2 p-3 rounded-lg border transition-all cursor-help hover:shadow-sm",
                    connected 
                      ? `${platform.bgColor} border-current hover:scale-105` 
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  )}
                >
                  <div className="flex items-center space-x-2">
                    <Icon 
                      className={cn(
                        "h-5 w-5 transition-all",
                        connected ? platform.color : "text-muted-foreground"
                      )}
                    />
                    <span 
                      className={cn(
                        "text-sm font-medium",
                        connected ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {platform.name}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center space-y-1">
                    {connected ? (
                      <>
                        <Badge 
                          variant="default" 
                          className="bg-green-100 text-green-800 hover:bg-green-100 text-xs transition-colors"
                        >
                          Connected
                        </Badge>
                        {displayName && (
                          <span className="text-xs text-muted-foreground truncate max-w-full">
                            {displayName}
                          </span>
                        )}
                      </>
                    ) : (
                      <Badge variant="secondary" className="text-xs transition-colors">
                        Not Connected
                      </Badge>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {getTooltipContent(platform, connected, displayName)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
} 