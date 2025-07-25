'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mic, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { VideoSectionV2 } from '@/components/shared/video-section-v2';
import { EnhancedContentAssetsManager } from '@/components/shared/enhanced-content-assets-manager';
import { ContentWithBusiness, ContentAsset, PROJECT_TYPES, ProjectType } from '@/types';
import { createClient } from '@/utils/supabase/client';
import ImageWithRegeneration from '@/components/shared/image-with-regeneration';
import VideoWithUploadDownload from '@/components/shared/video-with-upload-download';
import TextActionButtons from '@/components/shared/text-action-buttons';
import ContentEditModal from '@/components/shared/content-edit-modal';
import { FieldConfig } from '@/types';
import { updateContentField, updateContentAsset, toggleAssetApproval } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import { DocumentGenerator } from '@/lib/document-generator';

// Simple URL helper - no cache busting needed (handled server-side)
const getImageUrl = (url: string | null): string => {
  return url || '';
};

// Video URL helper - cache busting now handled at database update time
const getVideoUrl = (url: string | null): string => {
  if (!url) return '';
  return url;
};

interface ContentClientPageProps {
  content: ContentWithBusiness;
}

export default function ContentClientPage({
  content: initialContent,
}: ContentClientPageProps) {
  const router = useRouter();
  const [content, setContent] = useState<ContentWithBusiness>(initialContent);
  const [contentAssets, setContentAssets] = useState<ContentAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [isContentGenerating, setIsContentGenerating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeStep, setActiveStep] = useState('video-script');
  
// Cache busting now handled server-side - no client state needed
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditField, setCurrentEditField] = useState<FieldConfig | null>(null);
  
  const supabase = createClient();

  const steps = [
    { id: 'video-script', title: 'Video Scripts' },
    { id: 'create-video', title: 'Video' },
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

  // Simplified refresh - updates the client state directly for instant feedback
  const handleImageUpdated = useCallback((updatedAsset: ContentAsset) => {
    setContentAssets(prevAssets => 
      prevAssets.map(asset => 
        asset.id === updatedAsset.id ? updatedAsset : asset
      )
    );
    console.log(`🔄 Client-side image updated for ${updatedAsset.content_type}`);
  }, []);

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

  // Map step IDs to content asset types
  const stepToContentType: Record<string, string> = {
    'blog': 'blog_post',
    'email': 'email',
    'youtube': 'youtube_video',
    'social-long-video': 'social_long_video',
    'social-short-video': 'social_short_video',
    'social-quote-card': 'social_quote_card',
    'social-rant-post': 'social_rant_post',
    'social-blog-post': 'social_blog_post',
  };

  // Check if a step is approved based on content assets
  const isStepApproved = (stepId: string): boolean => {
    const contentType = stepToContentType[stepId];
    if (!contentType) {
      // For schedule step, check if all assets are scheduled
      if (stepId === 'schedule') {
        return contentAssets.length > 0 && contentAssets.every(asset => asset.asset_scheduled_at);
      }
      // For video-script and create-video steps, no approval required
      if (stepId === 'video-script' || stepId === 'create-video') {
        return true;
      }
      return false;
    }
    
    const asset = contentAssets.find(asset => asset.content_type === contentType);
    return asset?.approved || false;
  };

  // Handle approval toggle for a specific asset
  const handleApprovalToggle = async (contentType: string, approved: boolean) => {
    const asset = contentAssets.find(asset => asset.content_type === contentType);
    if (!asset) return;

    try {
      const result = await toggleAssetApproval({ assetId: asset.id, approved });
      if (result.success) {
        // Refresh content assets to get updated approval status
        await fetchContentAssets();
        toast.success(approved ? 'Asset approved' : 'Asset unapproved');
      } else {
        toast.error(result.error || 'Failed to update approval');
      }
    } catch (error) {
      toast.error('Failed to update approval');
      console.error('Approval toggle error:', error);
    }
  };

  // Edit handlers
  const handleEdit = (fieldConfig: FieldConfig) => {
    setCurrentEditField(fieldConfig);
    setIsEditModalOpen(true);
  };

  // Copy handler
  const handleCopy = async (fieldConfig: FieldConfig) => {
    try {
      const text = fieldConfig.value || '';
      
      // For HTML content, copy both HTML and plain text
      if (fieldConfig.inputType === 'html') {
        // Create a temporary div to convert HTML to plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        
        // Try to copy with both formats
        if (navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': new Blob([text], { type: 'text/html' }),
              'text/plain': new Blob([plainText], { type: 'text/plain' })
            })
          ]);
        } else {
          // Fallback to plain text
          await navigator.clipboard.writeText(plainText);
        }
      } else {
        // For plain text content
        await navigator.clipboard.writeText(text);
      }
      
      toast.success('Text copied to clipboard!');
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback for older browsers
      try {
        fallbackCopyTextToClipboard(fieldConfig.value || '');
      } catch {
        toast.error('Failed to copy text');
      }
    }
  };

  // Download handler
  const handleDownload = async (fieldConfig: FieldConfig) => {
    try {
      await DocumentGenerator.downloadAsDocx(fieldConfig, content.content_title || undefined);
      toast.success('Document downloaded successfully!');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download document');
    }
  };

  // Fallback copy function for older browsers
  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      toast.success('Text copied to clipboard!');
    } catch (error) {
      console.error('Fallback copy failed:', error);
      toast.error('Failed to copy text');
    }
    
    document.body.removeChild(textArea);
  };

  const handleSaveEdit = async (value: string) => {
    if (!currentEditField) return;

    try {
      // Determine if this is a content field or content asset field
      if (currentEditField.fieldKey === 'content_title' || 
          currentEditField.fieldKey === 'video_script' ||
          currentEditField.fieldKey === 'transcript' ||
          currentEditField.fieldKey === 'research') {
        // Content table field
        const result = await updateContentField({
          contentId: content.id,
          fieldName: currentEditField.fieldKey as 'content_title' | 'video_script' | 'transcript' | 'research',
          newValue: value,
        });
        
        if (result.success) {
          setContent(prev => ({
            ...prev,
            [currentEditField.fieldKey]: value,
          }));
        } else {
          throw new Error(result.error || 'Failed to update field');
        }
      } else {
        // Content asset field - use the assetType from the field config
        const assetType = currentEditField.assetType;

        if (!assetType) {
          throw new Error('Asset type not specified in field configuration');
        }

        const asset = contentAssets.find(a => a.content_type === assetType);
        if (!asset) {
          throw new Error('Content asset not found');
        }

        // Map field key to actual database column
        const fieldMap: Record<string, string> = {
          'headline': 'headline',
          'content': 'content',
          'blog_meta_description': 'blog_meta_description',
          'blog_url': 'blog_url',
        };

        const dbField = fieldMap[currentEditField.fieldKey] || currentEditField.fieldKey;
        
        const result = await updateContentAsset(asset.id, {
          [dbField]: value,
        });
        
        if (result.success) {
          setContentAssets(prev => 
            prev.map(a => 
              a.id === asset.id 
                ? { ...a, [dbField]: value }
                : a
            )
          );
        } else {
          throw new Error(result.error || 'Failed to update asset');
        }
      }
    } catch (error) {
      console.error('Error saving edit:', error);
      throw error; // Re-throw to let the modal handle the error display
    }
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
          setPermissionError(true);
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
  }, [content.id, supabase, content.business_id]);

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
      {/* Back Button */}
      <div className="mb-4">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-800 p-0 h-auto font-normal"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      {/* Compact Header */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-8">
        {/* Video Title Label */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-600">Video Name</span>
          <div className="flex items-center gap-3">
            {/* Content Status */}
            {(() => {
              const allAssetsScheduled = contentAssets.length > 0 && 
                contentAssets.every(asset => asset.asset_scheduled_at);
              const allAssetsApproved = contentAssets.length > 0 && 
                contentAssets.every(asset => asset.approved);
              
              if (allAssetsScheduled) {
                return (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-green-100 text-green-800 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    Ready to Publish
                  </span>
                );
              } else if (allAssetsApproved) {
                return (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    Ready to Schedule
                  </span>
                );
              } else {
                return (
                  <span className="inline-flex items-center px-3 py-1 text-sm font-medium bg-orange-100 text-orange-800 rounded-full">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                    Draft
                  </span>
                );
              }
            })()}
            
            {/* Project Type */}
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
              {(() => {
                const projectType = content.project_type as ProjectType;
                const Icon = projectType === 'video_upload' ? Video : Mic;
                const label = PROJECT_TYPES[projectType] || projectType || 'Voice Recording';
                
                return (
                  <>
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
        
        {/* Main Title with Actions */}
        <div className="relative group mb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">{content.content_title || 'Untitled Content'}</h1>
          <TextActionButtons
            fieldConfig={{
              label: 'Content Title',
              value: content.content_title || '',
              fieldKey: 'content_title',
              inputType: 'text',
              placeholder: 'Enter content title...',
            }}
            contentTitle={content.content_title || undefined}
            onEdit={handleEdit}
            onCopy={handleCopy}
            onDownload={handleDownload}
            disabled={isContentGenerating}
          />
        </div>

        {/* Research Section */}
        {content.research && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <span className="text-sm text-gray-600 block mb-2">Research Notes</span>
            <div className="bg-gray-50 rounded-lg p-4 relative group">
              <div className="whitespace-pre-wrap text-gray-900 text-sm">
                {content.research}
              </div>
              <TextActionButtons
                fieldConfig={{
                  label: 'Research Notes',
                  value: content.research ?? '',
                  fieldKey: 'research',
                  inputType: 'textarea',
                  placeholder: 'Enter research notes...',
                }}
                contentTitle={content.content_title || undefined}
                onEdit={handleEdit}
                onCopy={handleCopy}
                onDownload={handleDownload}
                disabled={isContentGenerating}
              />
            </div>
          </div>
        )}
        
        {isContentGenerating && (
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm mt-4">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-800"></div>
            Generating...
          </div>
        )}
      </div>

      <div className="flex gap-8">
        {/* Stepper Navigation - Hidden on mobile */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-8">
            <div className="relative">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center cursor-pointer group relative"
                  onClick={() => goToStep(step.id)}
                  style={{ paddingBottom: index < steps.length - 1 ? '20px' : '0' }}
                >
                  {/* Circle */}
                  <div className="relative z-10">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                      isStepApproved(step.id) || step.id === 'video-script' || step.id === 'create-video'
                        ? 'bg-green-500 border-green-500 text-white'
                        : activeStep === step.id
                          ? 'bg-blue-500 border-blue-500 text-white'
                          : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {isStepApproved(step.id) || step.id === 'video-script' || step.id === 'create-video' ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-xs font-medium">{index + 1}</span>
                      )}
                    </div>
                  </div>

                  {/* Label */}
                  <div className="ml-4 flex-1">
                    <div className={`text-sm font-medium transition-colors duration-200 ${
                      activeStep === step.id ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      {step.title}
                    </div>
                  </div>

                  {/* Connecting Line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-4 top-8 w-0.5 h-5 bg-gray-200"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
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
              {permissionError && (
                <div className="rounded-lg border border-destructive bg-destructive/10 p-4 mb-6">
                  <h3 className="font-semibold text-destructive">Permission Denied</h3>
                  <p className="text-sm text-destructive">
                    You do not have permission to view or edit the assets for this
                    content because it belongs to a different business.
                  </p>
                </div>
              )}

              {!permissionError && (
                <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                  {/* Section Status Cards - Modern integrated approach */}
                  <div className="mb-6">
                    {(() => {
                      const contentType = stepToContentType[activeStep];
                      const isApproved = isStepApproved(activeStep);
                      const canToggleApproval = contentType && contentAssets.find(asset => asset.content_type === contentType);
                      
                      // Get section title
                      const sectionTitle = steps.find(step => step.id === activeStep)?.title || 'Section';
                      
                      // Check if this is a video step that doesn't require approval
                      const isVideoStep = activeStep === 'video-script' || activeStep === 'create-video';
                      
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  isVideoStep ? 'bg-green-500' : (isApproved ? 'bg-green-500' : 'bg-orange-500')
                                }`}></div>
                                <span className="text-sm font-medium text-gray-900">{sectionTitle}</span>
                              </div>
                              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                isVideoStep 
                                  ? 'bg-green-100 text-green-800'
                                  : (isApproved 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-orange-100 text-orange-800')
                              }`}>
                                {isVideoStep ? 'No approval required' : (isApproved ? 'Approved' : 'Pending Review')}
                              </span>
                            </div>
                            
                            {canToggleApproval && (
                              <Button
                                onClick={() => handleApprovalToggle(contentType, !isApproved)}
                                size="sm"
                                className={isApproved 
                                  ? "bg-gray-600 hover:bg-gray-700" 
                                  : "bg-green-600 hover:bg-green-700"
                                }
                              >
                                {isApproved ? 'Unapprove' : 'Approve'}
                              </Button>
                            )}
                          </div>
                          
                          {/* Optional description */}
                          <p className="text-sm text-gray-600 mt-2">
                            {isVideoStep 
                              ? `${sectionTitle} does not need to be approved to schedule content.`
                              : (isApproved 
                                ? `${sectionTitle} has been approved and is ready for publishing.`
                                : `Review and approve ${sectionTitle} content before publishing.`)
                            }
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Video Script Section */}
                  {activeStep === 'video-script' && (
                    <div>
                      <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Video Scripts</h2>
                        <p className="text-gray-600">Review and edit your video scripts for different formats</p>
                      </div>
                      
                      {/* Scripts Grid Layout */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Long Video Script */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Video className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">Long Video Script</h3>
                              <p className="text-sm text-gray-500">For YouTube, LinkedIn, and other long-form content</p>
                            </div>
                          </div>
                          
                          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 relative group min-h-[300px]">
                            {content.video_script ? (
                              <div className="text-gray-900 whitespace-pre-wrap text-sm leading-relaxed">
                                {content.video_script}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                  <p className="text-gray-500 text-sm">No long video script generated yet</p>
                                </div>
                              </div>
                            )}
                            <TextActionButtons
                              fieldConfig={{
                                label: 'Long Video Script',
                                value: content.video_script || '',
                                fieldKey: 'video_script',
                                inputType: 'textarea',
                                placeholder: 'Enter long video script...',
                              }}
                              onEdit={handleEdit}
                              contentTitle={content.content_title || undefined}
                              onCopy={handleCopy}
                              onDownload={handleDownload}
                              disabled={isContentGenerating}
                            />
                          </div>
                        </div>

                        {/* Short Video Script */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                              <Video className="w-4 h-4 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">Short Video Script</h3>
                              <p className="text-sm text-gray-500">For Shorts, TikTok, and other short-form content</p>
                            </div>
                          </div>
                          
                          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 relative group min-h-[300px]">
                            {content.short_video_script ? (
                              <div className="text-gray-900 whitespace-pre-wrap text-sm leading-relaxed">
                                {content.short_video_script}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                  <p className="text-gray-500 text-sm">No short video script generated yet</p>
                                </div>
                              </div>
                            )}
                            <TextActionButtons
                              fieldConfig={{
                                label: 'Short Video Script',
                                value: content.short_video_script || '',
                                fieldKey: 'short_video_script',
                                inputType: 'textarea',
                                placeholder: 'Enter short video script...',
                              }}
                              onEdit={handleEdit}
                              contentTitle={content.content_title || undefined}
                              onCopy={handleCopy}
                              onDownload={handleDownload}
                              disabled={isContentGenerating}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Script Statistics */}
                      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Long Script Length</span>
                            <span className="text-sm text-gray-600">
                              {content.video_script ? `${content.video_script.trim().split(/\s+/).length} words` : '0 words'}
                            </span>
                          </div>
                          {content.video_script && (
                            <div className="mt-1">
                              <span className="text-xs text-gray-500">
                                ~{Math.ceil(content.video_script.trim().split(/\s+/).length / 150)} min read
                              </span>
                            </div>
                          )}
                        </div>
                        
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Short Script Length</span>
                            <span className="text-sm text-gray-600">
                              {content.short_video_script ? `${content.short_video_script.trim().split(/\s+/).length} words` : '0 words'}
                            </span>
                          </div>
                          {content.short_video_script && (
                            <div className="mt-1">
                              <span className="text-xs text-gray-500">
                                ~{Math.ceil(content.short_video_script.trim().split(/\s+/).length / 150)} min read
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Create Video Section */}
                  {activeStep === 'create-video' && (
                    <div>
                      <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Video</h2>
                        <p className="text-gray-600">Create and manage your video content for different platforms</p>
                      </div>
                      <VideoSectionV2 
                        content={content} 
                        onVideoUpdate={handleVideoUpdate}
                        onNavigateToScript={handleNavigateToScript}
                      />
                    </div>
                  )}

                  {/* Blog Section - Modern Card Layout */}
                  {activeStep === 'blog' && (
                    <div className="space-y-6">
                      {(() => {
                        const blogAsset = contentAssets.find(asset => asset.content_type === 'blog_post');
                        if (!blogAsset) {
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center">
                              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Blog Post Found</h3>
                              <p className="text-gray-500">No blog post has been generated for this content yet.</p>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                            {/* Blog Post Image */}
                            {blogAsset.image_url && (
                              <div className="mb-6">
                                <ImageWithRegeneration 
                                  contentAsset={blogAsset}
                                  className="block w-full"
                                  onImageUpdated={handleImageUpdated}
                                  enableDownload={true}
                                  enableUpload={true}
                                  enableRegeneration={true}
                                >
                                  <img 
                                    src={getImageUrl(blogAsset.image_url)} 
                                    alt={blogAsset.headline || 'Blog post image'}
                                    className="w-full object-cover rounded-lg"
                                  />
                                </ImageWithRegeneration>
                              </div>
                            )}
                            
                            {/* Blog Post Title */}
                            {blogAsset.headline && (
                              <div className="relative group mb-6">
                                <h1 className="text-4xl font-extrabold text-gray-900 my-6 leading-tight">
                                  {blogAsset.headline}
                                </h1>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'Blog Title',
                                    value: blogAsset.headline || '',
                                    fieldKey: 'headline',
                                    inputType: 'text',
                                    placeholder: 'Enter blog title...',
                                    assetType: 'blog_post',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            )}
                            
                            {/* Blog Post Content */}
                            {blogAsset.content && (
                              <div className="relative group mb-8">
                                <div 
                                  className="content-display text-gray-700"
                                  dangerouslySetInnerHTML={{ __html: blogAsset.content }}
                                />
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'Blog Content',
                                    value: blogAsset.content || '',
                                    fieldKey: 'content',
                                    inputType: 'html',
                                    placeholder: 'Enter blog content...',
                                    assetType: 'blog_post',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            )}
                            
                            {/* Meta Description Section */}
                            {blogAsset.blog_meta_description && (
                              <div className="mb-6 p-4 bg-gray-50 rounded-lg relative group">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Meta Description</h3>
                                <p className="text-gray-700">{blogAsset.blog_meta_description}</p>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'Meta Description',
                                    value: blogAsset.blog_meta_description || '',
                                    fieldKey: 'blog_meta_description',
                                    inputType: 'textarea',
                                    placeholder: 'Enter meta description...',
                                    assetType: 'blog_post',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            )}
                            
                            {/* URL Section */}
                            {blogAsset.blog_url && (
                              <div className="p-4 bg-gray-50 rounded-lg relative group">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">URL</h3>
                                <p className="text-blue-600 font-mono">{blogAsset.blog_url}</p>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'Blog URL',
                                    value: blogAsset.blog_url || '',
                                    fieldKey: 'blog_url',
                                    inputType: 'text',
                                    placeholder: 'Enter blog URL...',
                                    assetType: 'blog_post',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Social Long Video Section - Modern Card Layout */}
                  {activeStep === 'social-long-video' && (
                    <div className="space-y-6">
                      {(() => {
                        const socialAsset = contentAssets.find(asset => asset.content_type === 'social_long_video');
                        if (!socialAsset) {
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center">
                              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Social Long Video Found</h3>
                              <p className="text-gray-500">No social long video content has been generated yet.</p>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="max-w-xl bg-white border border-gray-200 rounded-lg shadow-sm">
                            {/* Post Header */}
                            <div className="flex items-center p-4">
                              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {content.businesses?.business_name?.[0] || 'B'}
                              </div>
                              <div className="ml-3">
                                <div className="font-semibold text-gray-900">
                                  {content.businesses?.business_name || 'Business Name'}
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
                              <div className="px-4 pb-3 relative group">
                                <p className="text-gray-900 whitespace-pre-wrap" style={{ fontSize: '15px', lineHeight: '24px' }}>{socialAsset.content}</p>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'Social Long Video Content',
                                    value: socialAsset.content || '',
                                    fieldKey: 'content',
                                    inputType: 'textarea',
                                    placeholder: 'Enter social media content...',
                                    assetType: 'social_long_video',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            )}

                            {/* Video/Image Content */}
                            {(content.video_long_url || socialAsset.image_url) && (
                              <div className="relative">
                                {content.video_long_url ? (
                                  <VideoWithUploadDownload
                                    content={content}
                                    videoType="long"
                                    onVideoUpdated={handleVideoUpdate}
                                  >
                                    <video 
                                      key={content.video_long_url} 
                                      src={getVideoUrl(content.video_long_url)}
                                      className="w-full object-cover"
                                      controls
                                      poster={getImageUrl(socialAsset.image_url)}
                                    />
                                  </VideoWithUploadDownload>
                                ) : (
                                  <ImageWithRegeneration 
                                    contentAsset={socialAsset}
                                    className="block w-full"
                                    onImageUpdated={handleImageUpdated}
                                    enableDownload={true}
                                    enableUpload={true}
                                    enableRegeneration={true}
                                  >
                                    <img 
                                      src={getImageUrl(socialAsset.image_url)} 
                                      alt="Social post content"
                                      className="w-full object-cover"
                                    />
                                  </ImageWithRegeneration>
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

                  {/* Social Short Video Section - Modern Card Layout */}
                  {activeStep === 'social-short-video' && (
                    <div className="space-y-6">
                      {(() => {
                        const socialAsset = contentAssets.find(asset => asset.content_type === 'social_short_video');
                        if (!socialAsset) {
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center">
                              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2h4a1 1 0 011 1v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a1 1 0 011-1h4zM9 12l3-2v4l-3-2z" />
                                </svg>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Social Short Video Found</h3>
                              <p className="text-gray-500">No social short video content has been generated yet.</p>
                            </div>
                          );
                        }
                        
                        return (
                          <div className="max-w-xl bg-white border border-gray-200 rounded-lg shadow-sm">
                            {/* Post Header */}
                            <div className="flex items-center p-4">
                              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {content.businesses?.business_name?.[0] || 'B'}
                              </div>
                              <div className="ml-3">
                                <div className="font-semibold text-gray-900">
                                  {content.businesses?.business_name || 'Business Name'}
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
                              <div className="px-4 pb-3 relative group">
                                <p className="text-gray-900 whitespace-pre-wrap" style={{ fontSize: '15px', lineHeight: '24px' }}>{socialAsset.content}</p>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'Social Short Video Content',
                                    value: socialAsset.content || '',
                                    fieldKey: 'content',
                                    inputType: 'textarea',
                                    placeholder: 'Enter social media content...',
                                    assetType: 'social_short_video',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            )}

                            {/* Video/Image Content */}
                            {(content.video_short_url || socialAsset.image_url) && (
                              <div className="relative">
                                {content.video_short_url ? (
                                  <VideoWithUploadDownload
                                    content={content}
                                    videoType="short"
                                    onVideoUpdated={handleVideoUpdate}
                                  >
                                    <video 
                                      key={content.video_short_url} 
                                      src={getVideoUrl(content.video_short_url)}
                                      className="w-full object-cover"
                                      controls
                                      poster={getImageUrl(socialAsset.image_url)}
                                    />
                                  </VideoWithUploadDownload>
                                ) : (
                                  <ImageWithRegeneration 
                                    contentAsset={socialAsset}
                                    className="block w-full"
                                    onImageUpdated={handleImageUpdated}
                                    enableDownload={true}
                                    enableUpload={true}
                                    enableRegeneration={true}
                                  >
                                    <img 
                                      src={getImageUrl(socialAsset.image_url)} 
                                      alt="Social post content"
                                      className="w-full object-cover"
                                    />
                                  </ImageWithRegeneration>
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
                          <div className="max-w-xl bg-white border border-gray-200 rounded-lg shadow-sm">
                            {/* Post Header */}
                            <div className="flex items-center p-4">
                              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {content.businesses?.business_name?.[0] || 'B'}
                              </div>
                              <div className="ml-3">
                                <div className="font-semibold text-gray-900">
                                  {content.businesses?.business_name || 'Business Name'}
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
                              <div className="px-4 pb-3 relative group">
                                <p className="text-gray-900 whitespace-pre-wrap consistent-text">{socialAsset.content}</p>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'Social Rant Post Content',
                                    value: socialAsset.content || '',
                                    fieldKey: 'content',
                                    inputType: 'textarea',
                                    placeholder: 'Enter social media content...',
                                    assetType: 'social_rant_post',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            )}

                            {/* Image Content (if available) */}
                            {socialAsset.image_url && (
                              <div className="px-4 pb-3">
                                <ImageWithRegeneration 
                                  contentAsset={socialAsset}
                                  className="block w-full"
                                  onImageUpdated={handleImageUpdated}
                                  enableDownload={true}
                                  enableUpload={true}
                                  enableRegeneration={true}
                                >
                                  <img 
                                    src={getImageUrl(socialAsset.image_url)} 
                                    alt="Social post content"
                                    className="w-full object-cover rounded-lg"
                                  />
                                </ImageWithRegeneration>
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
                          <div className="max-w-xl bg-white border border-gray-200 rounded-lg shadow-sm">
                            {/* Post Header */}
                            <div className="flex items-center p-4">
                              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {content.businesses?.business_name?.[0] || 'B'}
                              </div>
                              <div className="ml-3">
                                <div className="font-semibold text-gray-900">
                                  {content.businesses?.business_name || 'Business Name'}
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
                              <div className="px-4 pb-3 relative group">
                                <p className="text-gray-900 whitespace-pre-wrap consistent-text">{socialAsset.content}</p>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'Social Blog Post Content',
                                    value: socialAsset.content || '',
                                    fieldKey: 'content',
                                    inputType: 'textarea',
                                    placeholder: 'Enter social media content...',
                                    assetType: 'social_blog_post',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            )}

                            {/* Image Content (if available) */}
                            {socialAsset.image_url && (
                              <div className="px-4 pb-3">
                                <ImageWithRegeneration 
                                  contentAsset={socialAsset}
                                  className="block w-full"
                                  onImageUpdated={handleImageUpdated}
                                  enableDownload={true}
                                  enableUpload={true}
                                  enableRegeneration={true}
                                >
                                  <img 
                                    src={getImageUrl(socialAsset.image_url)} 
                                    alt="Social post content"
                                    className="w-full object-cover rounded-lg"
                                  />
                                </ImageWithRegeneration>
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
                          <div className="max-w-xl bg-white border border-gray-200 rounded-lg shadow-sm">
                            {/* Post Header */}
                            <div className="flex items-center p-4">
                              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                                {content.businesses?.business_name?.[0] || 'B'}
                              </div>
                              <div className="ml-3">
                                <div className="font-semibold text-gray-900">
                                  {content.businesses?.business_name || 'Business Name'}
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
                              <div className="px-4 pb-3 relative group">
                                <p className="text-gray-900 whitespace-pre-wrap consistent-text">{socialAsset.content}</p>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'Social Quote Card Content',
                                    value: socialAsset.content || '',
                                    fieldKey: 'content',
                                    inputType: 'textarea',
                                    placeholder: 'Enter quote card content...',
                                    assetType: 'social_quote_card',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            )}

                            {/* Image Content (if available) */}
                            {socialAsset.image_url && (
                              <div className="px-4 pb-3">
                                <ImageWithRegeneration 
                                  contentAsset={socialAsset}
                                  className="block w-full"
                                  onImageUpdated={handleImageUpdated}
                                  enableDownload={true}
                                  enableUpload={true}
                                  enableRegeneration={true}
                                >
                                  <img 
                                    src={getImageUrl(socialAsset.image_url)} 
                                    alt="Quote card visual"
                                    className="w-full object-cover rounded-lg"
                                  />
                                </ImageWithRegeneration>
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
                          <div className="max-w-4xl bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                            {/* Video Player Area */}
                            <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                              {youtubeAsset.image_url ? (
                                <ImageWithRegeneration 
                                  contentAsset={youtubeAsset}
                                  className="w-full h-full"
                                  onImageUpdated={handleImageUpdated}
                                  enableDownload={true}
                                  enableUpload={true}
                                  enableRegeneration={true}
                                >
                                  <div className="relative">
                                    <img 
                                      src={getImageUrl(youtubeAsset.image_url)} 
                                      alt="YouTube video thumbnail"
                                      className="w-full h-full object-cover"
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
                                </ImageWithRegeneration>
                              ) : (
                                <div className="w-full h-96 bg-gray-900 flex items-center justify-center">
                                  <div className="text-white text-lg">Video Player</div>
                                </div>
                              )}
                            </div>

                            {/* Text Content Section */}
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                              <div className="relative group mb-4">
                                <h3 className="text-lg font-semibold mb-2">Title</h3>
                                <p className="text-gray-900 consistent-text">{youtubeAsset.headline}</p>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'YouTube Title',
                                    value: youtubeAsset.headline || '',
                                    fieldKey: 'headline',
                                    inputType: 'text',
                                    placeholder: 'Enter YouTube title...',
                                    assetType: 'youtube_video',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>

                              <div className="relative group">
                                <h3 className="text-lg font-semibold mb-2">Description</h3>
                                <p className="text-gray-900 whitespace-pre-wrap consistent-text">{youtubeAsset.content}</p>
                                <TextActionButtons
                                  fieldConfig={{
                                    label: 'YouTube Description',
                                    value: youtubeAsset.content || '',
                                    fieldKey: 'content',
                                    inputType: 'textarea',
                                    placeholder: 'Enter YouTube description...',
                                    assetType: 'youtube_video',
                                  }}
                                  onEdit={handleEdit}
                                  
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                              </div>
                            </div>
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
                          <div className="max-w-4xl bg-white border border-gray-300 rounded-lg shadow-sm">
                            {/* Email Header */}
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 rounded-t-lg">
                              <div className="space-y-2">
                                <div className="flex items-center">
                                  <span className="text-sm font-medium text-gray-600 w-16">From:</span>
                                  <span className="text-sm text-gray-900">
                                    {(() => {
                                      // Get email integration data
                                      const emailIntegration = (content.businesses as unknown as { email_integrations?: Array<{ sender_name?: string; sender_email?: string }> })?.email_integrations?.[0];
                                      
                                      if (emailIntegration?.sender_name && emailIntegration?.sender_email) {
                                        return `${emailIntegration.sender_name} <${emailIntegration.sender_email}>`;
                                      }
                                      
                                      // Fallback to business details
                                      const name = content.businesses?.business_name || 'Business Name';
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
                                  <div className="relative group flex-1">
                                    <span className="text-sm font-semibold text-gray-900">
                                      {emailAsset.headline || 'Email Subject'}
                                    </span>
                                    <TextActionButtons
                                      fieldConfig={{
                                        label: 'Email Subject',
                                        value: emailAsset.headline || '',
                                        fieldKey: 'headline',
                                        inputType: 'text',
                                        placeholder: 'Enter email subject...',
                                        assetType: 'email',
                                      }}
                                      onEdit={handleEdit}
                                      
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Email Body */}
                            <div className="px-6 py-6 relative group">
                              {emailAsset.content && (
                                <div 
                                  className="content-display text-gray-900"
                                  dangerouslySetInnerHTML={{ __html: emailAsset.content }}
                                />
                              )}
                              <TextActionButtons
                                fieldConfig={{
                                  label: 'Email Content',
                                  value: emailAsset.content || '',
                                  fieldKey: 'content',
                                  inputType: 'html',
                                  placeholder: 'Enter email content...',
                                  assetType: 'email',
                                }}
                                onEdit={handleEdit}
                                
                          contentTitle={content.content_title || undefined}
                          onCopy={handleCopy}
                          onDownload={handleDownload}
                          disabled={isContentGenerating}/>
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
                      <EnhancedContentAssetsManager
                        assets={contentAssets}
                        content={content}
                        isLoading={isLoading}
                        error={error}
                        onRefresh={fetchContentAssets}
                        onAssetUpdate={(updatedAsset: ContentAsset) => {
                          setContentAssets(prev => 
                            prev.map(asset => 
                              asset.id === updatedAsset.id ? updatedAsset : asset
                            )
                          );
                        }}
                        onImageUpdated={handleImageUpdated}
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {currentEditField && (
        <ContentEditModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          fieldConfig={currentEditField}
          onSave={handleSaveEdit}
          isLoading={false}
        />
      )}
    </div>
  );
} 