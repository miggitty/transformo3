'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Facebook, 
  Instagram, 
  Twitter, 
  Youtube, 
  Linkedin,
  Clock,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';

const socialPlatforms = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600',
    description: 'Connect your Facebook page to post content'
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    description: 'Share photos and stories to Instagram'
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: Twitter,
    color: 'bg-black',
    description: 'Post tweets and engage with your audience'
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'bg-red-600',
    description: 'Upload and manage your video content'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700',
    description: 'Share professional content and updates'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: Clock, // Using Clock as placeholder for TikTok
    color: 'bg-black',
    description: 'Create and share short-form videos'
  }
];

export default function DevConnectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  
  const username = searchParams.get('username');
  const businessId = searchParams.get('business_id');
  const timestamp = searchParams.get('timestamp');

  const handlePlatformToggle = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  const handleConnect = async () => {
    if (selectedPlatforms.length === 0) {
      alert('Please select at least one platform to connect');
      return;
    }

    setConnecting(true);
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Redirect back to integrations with success
    const callbackUrl = new URL(`${window.location.origin}/settings/integrations`);
    callbackUrl.searchParams.set('connected', 'true');
    callbackUrl.searchParams.set('timestamp', Date.now().toString());
    callbackUrl.searchParams.set('dev_mode', 'true');
    callbackUrl.searchParams.set('platforms', selectedPlatforms.join(','));
    
    window.location.href = callbackUrl.toString();
  };

  const handleCancel = () => {
    const callbackUrl = new URL(`${window.location.origin}/settings/integrations`);
    callbackUrl.searchParams.set('cancelled', 'true');
    router.push(callbackUrl.toString());
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={handleCancel}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Integrations
          </Button>
          
          <div className="text-center">
            <Badge variant="secondary" className="mb-4">
              Development Mode
            </Badge>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Connect Your Social Media Accounts
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              This is a development simulation of the upload-post connection flow. 
              Select the social media platforms you want to connect to Transformo.
            </p>
            {username && (
              <p className="text-sm text-gray-500 mt-2">
                Profile: {username}
              </p>
            )}
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Available Platforms</CardTitle>
            <CardDescription>
              Select the social media platforms you want to connect. In the real flow, 
              you would authenticate with each platform directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {socialPlatforms.map((platform) => {
                const Icon = platform.icon;
                const isSelected = selectedPlatforms.includes(platform.id);
                
                return (
                  <div
                    key={platform.id}
                    className={`relative border rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handlePlatformToggle(platform.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handlePlatformToggle(platform.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className={`w-8 h-8 rounded-full ${platform.color} flex items-center justify-center`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <h3 className="font-medium text-gray-900">
                            {platform.name}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600">
                          {platform.description}
                        </p>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center space-x-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={connecting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={connecting || selectedPlatforms.length === 0}
            className="min-w-[120px]"
          >
            {connecting ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Connecting...</span>
              </div>
            ) : (
              `Connect ${selectedPlatforms.length} Platform${selectedPlatforms.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>

        {selectedPlatforms.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600">
              Selected platforms: {selectedPlatforms.map(id => 
                socialPlatforms.find(p => p.id === id)?.name
              ).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 