'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
// Removed unused import

import { VideoSectionV2 } from '@/components/shared/video-section-v2';
import ContentAssetsManager from '@/components/shared/content-assets-manager';
import { ContentWithBusiness, ContentAsset } from '@/types';
import { createClient } from '@/utils/supabase/client';


interface ContentClientPageProps {
  content: ContentWithBusiness;
}

export default function ContentClientPage({
  content: initialContent,
}: ContentClientPageProps) {
  const [content, setContent] = useState<ContentWithBusiness>(initialContent);
  const [contentAssets, setContentAssets] = useState<ContentAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContentGenerating, setIsContentGenerating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [approvedSteps, setApprovedSteps] = useState<Set<string>>(new Set());
  const [activeStep, setActiveStep] = useState('video-script');
  
  const supabase = createClient();

  const steps = [
    { id: 'video-script', title: 'Video Script' },
    { id: 'create-video', title: 'Create Video' },
    { id: 'blog', title: 'Blog' },
    { id: 'email', title: 'Email' },
    { id: 'youtube', title: 'YouTube' },
    { id: 'social-long-video', title: 'Social Long Video' },
    { id: 'social-short-video', title: 'Social Short Video' },
    { id: 'social-quote-card', title: 'Social Quote Card' },
    { id: 'social-rant-post', title: 'Social Rant Post' },
    { id: 'social-blog-post', title: 'Social Blog Post' },
    { id: 'schedule', title: 'Schedule' }
  ];

  const fetchContentAssets = useCallback(async () => {
    if (!supabase) {
      setError('Database connection unavailable.');
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('content_assets')
      .select('*')
      .eq('content_id', content.id);

    if (fetchError) {
      console.error('Error fetching content assets:', fetchError);
      setError('Failed to load content assets.');
    } else {
      setContentAssets(data);
    }
  }, [supabase, content.id]);

  const handleVideoUpdate = (videoType: 'long' | 'short', videoUrl: string | null) => {
    setContent(prev => ({
      ...prev,
      [videoType === 'long' ? 'video_long_url' : 'video_short_url']: videoUrl,
    }));
  };

  const handleNavigateToScript = (scriptType: 'main' | 'short') => {
    const targetTab = scriptType === 'main' ? 'video-script' : 'short-video-script';
    setActiveStep(targetTab);
    
    // Smooth scroll to script section after navigation
    setTimeout(() => {
      const scriptElement = document.getElementById(`${targetTab}-content`);
      if (scriptElement) {
        scriptElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    }, 100);
  };

  // Note: handleContentUpdate was removed as it's no longer needed with VideoSectionV2

  const goToStep = (stepId: string) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveStep(stepId);
      setTimeout(() => setIsTransitioning(false), 150);
    }, 150);
  };

  const goToPrevious = () => {
    const currentIndex = steps.findIndex(step => step.id === activeStep);
    if (currentIndex > 0) {
      goToStep(steps[currentIndex - 1].id);
    }
  };

  const goToNext = () => {
    const currentIndex = steps.findIndex(step => step.id === activeStep);
    if (currentIndex < steps.length - 1) {
      goToStep(steps[currentIndex + 1].id);
    }
  };

  const handleApprove = (stepId: string) => {
    setApprovedSteps(prev => new Set([...prev, stepId]));
  };

  useEffect(() => {
    const checkPermissionsAndFetch = async () => {
      if (!supabase) {
        setError('Database connection unavailable.');
        setIsLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('business_id')
          .eq('id', user.id)
          .single();

        if (profile && profile.business_id !== content.business_id) {
          setIsLoading(false);
          return;
        }
      }

      // Fetch initial data
      try {
        // Fetch content status
        const { data: contentData } = await supabase
          .from('content')
          .select('status')
          .eq('id', content.id)
          .single();
        
        if (contentData?.status === 'processing') {
          setIsContentGenerating(true);
        }

        // Fetch content assets
        const { data: assetsData } = await supabase
          .from('content_assets')
          .select('*')
          .eq('content_id', content.id);
        
        if (assetsData) {
          setContentAssets(assetsData);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }

      setIsLoading(false);
    };

    checkPermissionsAndFetch();
  }, [content.business_id, content.id, supabase]);

  // Helper function to get content asset by type (currently unused)
  // const getAssetByType = (type: string) => {
  //   return contentAssets.find(asset => asset.content_type === type);
  // };

  return (
    <div className="min-h-screen bg-white px-4 md:px-6 lg:px-8 py-8">
      <style jsx>{`
        .consistent-text {
          font-size: 15px !important;
          line-height: 24px !important;
        }
        .consistent-text * {
          font-size: 15px !important;
          line-height: 24px !important;
        }
      `}</style>
      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {content.content_title}
        </h1>
        {isContentGenerating && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mt-2">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-800"></div>
            Generating...
          </div>
        )}
      </div>

      <div className="flex">
        {/* Stepper Navigation - Hidden on mobile */}
        <div className="hidden lg:block w-56">
          <div className="relative">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-center cursor-pointer group relative"
                onClick={() => goToStep(step.id)}
                style={{ paddingBottom: index < steps.length - 1 ? '16px' : '0' }}
              >
                {/* Circle */}
                <div className="relative z-10">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                    approvedSteps.has(step.id)
                      ? 'bg-green-500 border-green-500 text-white'
                      : activeStep === step.id
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {approvedSteps.has(step.id) ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>
                </div>

                {/* Label */}
                <div className="ml-3 flex-1">
                  <div className={`text-sm font-medium transition-colors duration-200 ${
                    activeStep === step.id ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {step.title}
                  </div>
                </div>

                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-3 top-6 w-0.5 h-4 bg-gray-200"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 lg:ml-8">
          {/* Mobile Bottom Navigation */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
            {/* Progress Bar */}
            <div className="h-1 bg-gray-200">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${((steps.findIndex(s => s.id === activeStep) + 1) / steps.length) * 100}%` }}
              />
            </div>
            
            {/* Navigation Controls */}
            <div className="flex items-center justify-between px-4 py-3">
              {/* Previous Button */}
              <button
                onClick={() => {
                  const currentIndex = steps.findIndex(s => s.id === activeStep);
                  if (currentIndex > 0) {
                    goToStep(steps[currentIndex - 1].id);
                  }
                }}
                disabled={steps.findIndex(s => s.id === activeStep) === 0}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              {/* Step Info */}
              <div className="flex flex-col items-center">
                <div className="text-xs text-gray-500">
                  Step {steps.findIndex(s => s.id === activeStep) + 1} of {steps.length}
                </div>
                <div className="text-sm font-medium text-gray-900 max-w-32 truncate">
                  {steps.find(s => s.id === activeStep)?.title}
                </div>
              </div>

              {/* Next Button */}
              <button
                onClick={() => {
                  const currentIndex = steps.findIndex(s => s.id === activeStep);
                  if (currentIndex < steps.length - 1) {
                    goToStep(steps[currentIndex + 1].id);
                  }
                }}
                disabled={steps.findIndex(s => s.id === activeStep) === steps.length - 1}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content with mobile bottom padding */}
          <div className="pb-20 lg:pb-0">
            <div className="space-y-6">
              {/* Test Content Display */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold mb-4">Test Content Page</h2>
                <p className="text-gray-600 mb-4">
                  This is a test implementation of the content client page. Current step: <strong>{activeStep}</strong>
                </p>
                <p className="text-gray-500 text-sm">
                  Steps approved: {approvedSteps.size} / {steps.length}
                </p>
              </div>

              {/* Mock step content */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-medium mb-2">Step: {steps.find(s => s.id === activeStep)?.title}</h3>
                <p className="text-gray-600">
                  This is mock content for the {activeStep} step. In the real implementation, this would contain the actual content forms and data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Approve Button - Top Right */}
      <div className="flex justify-end mb-6">
        <Button
          onClick={() => handleApprove(activeStep)}
          disabled={approvedSteps.has(activeStep)}
          className="bg-green-600 hover:bg-green-700"
        >
          {approvedSteps.has(activeStep) ? 'Approved' : 'Approve'}
        </Button>
      </div>

      {/* Video Script Section */}
      {activeStep === 'video-script' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Video Script</h2>
          <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            {content.video_script ? (
              <div 
                className="text-gray-900 consistent-text"
                dangerouslySetInnerHTML={{ __html: content.video_script }}
              />
            ) : (
              <p className="text-gray-500">No video script has been generated yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Create Video Section */}
      {activeStep === 'create-video' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Create Video</h2>
          <VideoSectionV2 
            content={content} 
            onVideoUpdate={handleVideoUpdate}
            onNavigateToScript={handleNavigateToScript}
          />
        </div>
      )}

      {/* Blog Section - Custom Display */}
      {activeStep === 'blog' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Blog</h2>
          {(() => {
            const blogAsset = contentAssets.find(asset => asset.content_type === 'blog_post');
            if (!blogAsset) {
              return <p className="text-gray-500">No blog post found for this content.</p>;
            }
            
            return (
              <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                {/* Blog Post Image */}
                {blogAsset.image_url && (
                  <div className="mb-6">
                    <img 
                      src={blogAsset.image_url} 
                      alt={blogAsset.headline || 'Blog post image'}
                      className="w-full object-cover rounded-lg"
                    />
                  </div>
                )}
                
                {/* Blog Post Title */}
                {blogAsset.headline && (
                  <h1 className="text-4xl font-extrabold text-gray-900 my-6 leading-tight">
                    {blogAsset.headline}
                  </h1>
                )}
                
                {/* Blog Post Content */}
                {blogAsset.content && (
                  <div 
                    className="prose prose-lg max-w-none mb-8 text-gray-700 consistent-text"
                    dangerouslySetInnerHTML={{ __html: blogAsset.content }}
                  />
                )}
                
                {/* Meta Description Section */}
                {blogAsset.blog_meta_description && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Meta Description</h3>
                    <p className="text-gray-700">{blogAsset.blog_meta_description}</p>
                  </div>
                )}
                
                {/* URL Section */}
                {blogAsset.blog_url && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">URL</h3>
                    <p className="text-blue-600 font-mono">{blogAsset.blog_url}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Social Long Video Section - Custom Display */}
      {activeStep === 'social-long-video' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Social Long Video</h2>
          {(() => {
            const socialAsset = contentAssets.find(asset => asset.content_type === 'social_long_video');
            if (!socialAsset) {
              return <p className="text-gray-500">No social long video found for this content.</p>;
            }
            
            return (
              <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
                {/* Post Header */}
                <div className="flex items-center p-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {content.businesses?.first_name?.[0] || 'M'}
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">
                      {content.businesses?.first_name} {content.businesses?.last_name}
                    </div>
                    <div className="text-xs text-gray-500">JUST NOW</div>
                  </div>
                  <div className="ml-auto">
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Post Content */}
                {socialAsset.content && (
                  <div className="px-4 pb-3">
                    <p className="text-gray-900 whitespace-pre-wrap" style={{ fontSize: '15px', lineHeight: '24px' }}>{socialAsset.content}</p>
                  </div>
                )}

                {/* Video/Image Content */}
                {(content.video_long_url || socialAsset.image_url) && (
                  <div className="relative">
                    {content.video_long_url ? (
                      <video 
                        src={content.video_long_url!}
                        className="w-full object-cover"
                        controls
                        poster={socialAsset.image_url ?? undefined}
                      />
                    ) : (
                      <img 
                        src={socialAsset.image_url ?? undefined} 
                        alt="Social post content"
                        className="w-full object-cover"
                      />
                    )}
                    {/* Play button overlay for video thumbnails */}
                    {!content.video_long_url && socialAsset.image_url && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 bg-black bg-opacity-60 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 5v10l8-5-8-5z"></path>
                            </svg>
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                          2:30
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Engagement Section */}
                <div className="border-t border-gray-100">
                  <div className="flex justify-around py-2">
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Like
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Comment
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                      Share
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Social Short Video Section - Custom Display */}
      {activeStep === 'social-short-video' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Social Short Video</h2>
          {(() => {
            const socialAsset = contentAssets.find(asset => asset.content_type === 'social_short_video');
            if (!socialAsset) {
              return <p className="text-gray-500">No social short video found for this content.</p>;
            }
            
            return (
              <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
                {/* Post Header */}
                <div className="flex items-center p-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {content.businesses?.first_name?.[0] || 'M'}
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">
                      {content.businesses?.first_name} {content.businesses?.last_name}
                    </div>
                    <div className="text-xs text-gray-500">JUST NOW</div>
                  </div>
                  <div className="ml-auto">
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Post Content */}
                {socialAsset.content && (
                  <div className="px-4 pb-3">
                    <p className="text-gray-900 whitespace-pre-wrap" style={{ fontSize: '15px', lineHeight: '24px' }}>{socialAsset.content}</p>
                  </div>
                )}

                {/* Video/Image Content */}
                {(content.video_short_url || socialAsset.image_url) && (
                  <div className="relative">
                    {content.video_short_url ? (
                      <video 
                        src={content.video_short_url as string}
                        className="w-full object-cover"
                        controls
                        poster={socialAsset.image_url ?? undefined}
                      />
                    ) : (
                      <img 
                        src={socialAsset.image_url ?? undefined} 
                        alt="Social post content"
                        className="w-full object-cover"
                      />
                    )}
                    {/* Play button overlay for video thumbnails */}
                    {!content.video_short_url && socialAsset.image_url && (
                      <>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 bg-black bg-opacity-60 rounded-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 5v10l8-5-8-5z"></path>
                            </svg>
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                          0:30
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Engagement Section */}
                <div className="border-t border-gray-100">
                  <div className="flex justify-around py-2">
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Like
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Comment
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                      Share
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Social Rant Post Section - Custom Display */}
      {activeStep === 'social-rant-post' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Social Rant Post</h2>
          {(() => {
            const socialAsset = contentAssets.find(asset => asset.content_type === 'social_rant_post');
            if (!socialAsset) {
              return <p className="text-gray-500">No social rant post found for this content.</p>;
            }
            
            return (
              <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
                {/* Post Header */}
                <div className="flex items-center p-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {content.businesses?.first_name?.[0] || 'M'}
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">
                      {content.businesses?.first_name} {content.businesses?.last_name}
                    </div>
                    <div className="text-xs text-gray-500">JUST NOW</div>
                  </div>
                  <div className="ml-auto">
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Post Content */}
                {socialAsset.content && (
                  <div className="px-4 pb-3">
                    <p className="text-gray-900 whitespace-pre-wrap consistent-text">{socialAsset.content}</p>
                  </div>
                )}

                {/* Image Content (if available) */}
                {socialAsset.image_url && (
                  <div className="px-4 pb-3">
                    <img 
                      src={socialAsset.image_url} 
                      alt="Social post content"
                      className="w-full object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Engagement Section */}
                <div className="border-t border-gray-100">
                  <div className="flex justify-around py-2">
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Like
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Comment
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                      Share
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Social Blog Post Section - Custom Display */}
      {activeStep === 'social-blog-post' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Social Blog Post</h2>
          {(() => {
            const socialAsset = contentAssets.find(asset => asset.content_type === 'social_blog_post');
            if (!socialAsset) {
              return <p className="text-gray-500">No social blog post found for this content.</p>;
            }
            
            return (
              <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
                {/* Post Header */}
                <div className="flex items-center p-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {content.businesses?.first_name?.[0] || 'M'}
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">
                      {content.businesses?.first_name} {content.businesses?.last_name}
                    </div>
                    <div className="text-xs text-gray-500">JUST NOW</div>
                  </div>
                  <div className="ml-auto">
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Post Content */}
                {socialAsset.content && (
                  <div className="px-4 pb-3">
                    <p className="text-gray-900 whitespace-pre-wrap consistent-text">{socialAsset.content}</p>
                  </div>
                )}

                {/* Image Content (if available) */}
                {socialAsset.image_url && (
                  <div className="px-4 pb-3">
                    <img 
                      src={socialAsset.image_url} 
                      alt="Social post content"
                      className="w-full object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Engagement Section */}
                <div className="border-t border-gray-100">
                  <div className="flex justify-around py-2">
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Like
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Comment
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                      Share
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Social Quote Card Section - Custom Display */}
      {activeStep === 'social-quote-card' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Social Quote Card</h2>
          {(() => {
            const socialAsset = contentAssets.find(asset => asset.content_type === 'social_quote_card');
            if (!socialAsset) {
              return <p className="text-gray-500">No social quote card found for this content.</p>;
            }
            
            return (
              <div className="max-w-xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm">
                {/* Post Header */}
                <div className="flex items-center p-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                    {content.businesses?.first_name?.[0] || 'M'}
                  </div>
                  <div className="ml-3">
                    <div className="font-semibold text-gray-900">
                      {content.businesses?.first_name} {content.businesses?.last_name}
                    </div>
                    <div className="text-xs text-gray-500">JUST NOW</div>
                  </div>
                  <div className="ml-auto">
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Post Content */}
                {socialAsset.content && (
                  <div className="px-4 pb-3">
                    <p className="text-gray-900 whitespace-pre-wrap consistent-text">{socialAsset.content}</p>
                  </div>
                )}

                {/* Image Content (if available) */}
                {socialAsset.image_url && (
                  <div className="px-4 pb-3">
                    <img 
                      src={socialAsset.image_url} 
                      alt="Quote card visual"
                      className="w-full object-cover rounded-lg"
                    />
                  </div>
                )}

                {/* Engagement Section */}
                <div className="border-t border-gray-100">
                  <div className="flex justify-around py-2">
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Like
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Comment
                    </button>
                    <button className="flex items-center justify-center flex-1 py-2 text-gray-600 hover:bg-gray-50">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                      Share
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* YouTube Section - Custom Display */}
      {activeStep === 'youtube' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">YouTube</h2>
          {(() => {
            const youtubeAsset = contentAssets.find(asset => asset.content_type === 'youtube_video');
            if (!youtubeAsset) {
              return <p className="text-gray-500">No YouTube video found for this content.</p>;
            }
            
            return (
              <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                {/* Video Player Area */}
                <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                  {youtubeAsset.image_url ? (
                    <div className="relative">
                      <img 
                        src={youtubeAsset.image_url} 
                        alt="YouTube video thumbnail"
                        className="w-full object-cover"
                      />
                      {/* YouTube Play Button */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <img 
                          src="/YouTube_play_button_icon.png" 
                          alt="YouTube Play Button"
                          className="w-20 h-14 cursor-pointer hover:scale-110 transition-transform duration-200"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-96 bg-gray-900 flex items-center justify-center">
                      <div className="text-white text-lg">Video Player</div>
                    </div>
                  )}
                </div>

                {/* Video Title */}
                <h1 className="text-xl font-semibold text-gray-900 mb-3 leading-tight">
                  {youtubeAsset.headline || 'YouTube Video Title'}
                </h1>

                {/* Simplified Channel Info - Skeleton Style */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center space-x-4">
                    {/* Channel Avatar Placeholder */}
                    <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                    
                    {/* Channel Info Placeholder */}
                    <div className="space-y-1">
                      <div className="w-24 h-4 bg-gray-300 rounded"></div>
                      <div className="w-16 h-3 bg-gray-200 rounded"></div>
                    </div>
                    
                    {/* Subscribe Button Placeholder */}
                    <div className="w-20 h-8 bg-gray-300 rounded-full"></div>
                  </div>

                  {/* Action Buttons Placeholder */}
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-8 bg-gray-200 rounded-full"></div>
                    <div className="w-16 h-8 bg-gray-200 rounded-full"></div>
                  </div>
                </div>

                {/* Video Description */}
                {youtubeAsset.content && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="whitespace-pre-wrap text-gray-900 consistent-text">
                      {youtubeAsset.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Email Section - Custom Display */}
      {activeStep === 'email' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Email</h2>
          {(() => {
            const emailAsset = contentAssets.find(asset => asset.content_type === 'email');
            if (!emailAsset) {
              return <p className="text-gray-500">No email found for this content.</p>;
            }
            
            return (
              <div className="max-w-4xl mx-auto bg-white border border-gray-300 rounded-lg shadow-sm">
                {/* Email Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 w-16">From:</span>
                      <span className="text-sm text-gray-900">
                        {(() => {
                          // Get email integration data
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const emailIntegration = (content.businesses as any)?.email_integrations?.[0];
                          
                          if (emailIntegration?.sender_name && emailIntegration?.sender_email) {
                            return `${emailIntegration.sender_name} <${emailIntegration.sender_email}>`;
                          }
                          
                          // Fallback to business details
                          const name = content.businesses?.first_name && content.businesses?.last_name 
                            ? `${content.businesses.first_name} ${content.businesses.last_name}`
                            : 'Business Owner';
                          const email = content.businesses?.contact_email || 'hello@business.com';
                          
                          return `${name} <${email}>`;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 w-16">To:</span>
                      <span className="text-sm text-gray-900">subscriber@example.com</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-600 w-16">Subject:</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {emailAsset.headline || 'Email Subject'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Email Body */}
                <div className="px-6 py-6">
                  {emailAsset.content && (
                    <div 
                      className="text-gray-900 whitespace-pre-wrap consistent-text"
                      dangerouslySetInnerHTML={{ __html: emailAsset.content }}
                    />
                  )}
                </div>

                {/* Email Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>Sent via Email Marketing Platform</span>
                    <span>Unsubscribe | Update Preferences</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Schedule Section */}
      {activeStep === 'schedule' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Schedule Content</h2>
          <ContentAssetsManager
            assets={contentAssets}
            content={content}
            isLoading={isLoading}
            error={error}
            onRefresh={fetchContentAssets}
            onAssetUpdate={(updatedAsset) => {
              setContentAssets(prev => 
                prev.map(asset => 
                  asset.id === updatedAsset.id ? updatedAsset : asset
                )
              );
            }}
            defaultView="calendar"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
        <Button
          onClick={goToPrevious}
          disabled={activeStep === steps[0].id}
          variant="outline"
        >
          Previous
        </Button>

        <Button
          onClick={goToNext}
          disabled={activeStep === steps[steps.length - 1].id}
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
} 