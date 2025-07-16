'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Upload, Bot, Trash2, Loader2 } from 'lucide-react';
import { VideoPlayer } from './video-player';

interface VideoUploadCardProps {
  title: string;
  videoType: 'long' | 'short';
  videoUrl: string | null;
  scriptContent: string | null;
  scriptLabel: string;
  isGenerating: boolean;
  canGenerateAI: boolean;
  onUpload: () => void;
  onGenerate: () => void;
  onDelete: () => void;
  onConfigureIntegration: () => void;
  onReviewScript: () => void;
}

export function VideoUploadCard({
  title,
  videoType,
  videoUrl,
  scriptContent,
  scriptLabel,
  isGenerating,
  canGenerateAI,
  onUpload,
  onGenerate,
  onDelete,
  onConfigureIntegration,
  onReviewScript,
}: VideoUploadCardProps) {
  const canGenerate = canGenerateAI && !!scriptContent;
  
  return (
    <Card className="p-4 sm:p-6">
      <CardHeader className="p-0 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            videoType === 'long' ? 'bg-blue-100' : 'bg-purple-100'
          }`}>
            <Video className={`w-4 h-4 ${
              videoType === 'long' ? 'text-blue-600' : 'text-purple-600'
            }`} />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
              {title}
            </CardTitle>
            <p className="text-sm text-gray-500">
              {videoType === 'long' 
                ? 'For YouTube, LinkedIn, and other long-form content'
                : 'For YouTube Shorts, TikTok, and other short-form content'
              }
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        {/* Video display area */}
        <div className="w-full">
          {videoUrl ? (
            <div className="animate-in fade-in-50 duration-300">
              <VideoPlayer src={videoUrl} />
            </div>
          ) : (
            <div className={`h-48 border-2 border-dashed rounded-lg p-8 text-center flex flex-col items-center justify-center transition-all duration-300 ${
              isGenerating 
                ? 'border-purple-400 bg-purple-50 animate-pulse' 
                : 'border-gray-300 hover:border-gray-400'
            }`}>
              <Video className={`h-12 w-12 mb-4 transition-colors duration-300 ${
                isGenerating ? 'text-purple-500' : 'text-gray-400'
              }`} />
              <p className={`transition-colors duration-300 ${
                isGenerating ? 'text-purple-700' : 'text-gray-500'
              }`}>
                {isGenerating ? 'AI video generating...' : 'No video uploaded'}
              </p>
              {isGenerating && (
                <div className="mt-3">
                  <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-col xl:flex-row gap-3 xl:gap-2" role="group" aria-label={`${title} actions`}>
          <Button 
            onClick={onUpload} 
            className="flex-1 h-11 xl:h-10 transition-all duration-200 hover:scale-105 text-sm"
            aria-label={videoUrl ? `Upload new ${videoType} video` : `Upload ${videoType} video`}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          
          <Button 
            onClick={onGenerate}
            disabled={isGenerating || !canGenerate}
            className={`flex-1 h-11 xl:h-10 transition-all duration-300 hover:scale-105 disabled:hover:scale-100 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white border-0 shadow-lg hover:shadow-xl disabled:from-purple-600 disabled:to-purple-700 disabled:opacity-60 text-sm ${
              isGenerating ? 'animate-pulse ring-2 ring-purple-300 ring-opacity-60' : ''
            }`}
            aria-label={`Generate AI ${videoType} video`}
            aria-describedby={!canGenerate ? `${videoType}-generate-help` : undefined}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating AI
              </>
            ) : (
              <>
                <Bot className="w-4 h-4 mr-2" />
                Generate AI
              </>
            )}
          </Button>
          
          {videoUrl && (
            <Button 
              onClick={onDelete} 
              variant="destructive" 
              className="transition-all duration-200 hover:scale-105 flex-shrink-0 h-11 xl:h-10 px-4 xl:px-3"
              aria-label={`Delete ${videoType} video`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {/* Integration configuration prompt */}
        {!canGenerateAI && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800" id={`${videoType}-generate-help`}>
              <button 
                onClick={onConfigureIntegration}
                className="underline hover:no-underline text-amber-800"
              >
                Configure HeyGen integration
              </button> to enable AI video generation
            </p>
          </div>
        )}
        
        {/* Script required prompt */}
        {canGenerateAI && !scriptContent && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800" id={`${videoType}-generate-help`}>
              {scriptLabel} is required for AI video generation
            </p>
          </div>
        )}
        
        {/* Script source indicator with review link */}
        <div className="text-sm text-gray-500 space-y-1">
          <p>Based on: {scriptLabel}</p>
          {scriptContent ? (
            <button
              onClick={onReviewScript}
              className="text-purple-600 hover:text-purple-700 underline text-sm font-medium hover:no-underline transition-colors duration-200"
              aria-label={`Review ${scriptLabel.toLowerCase()}`}
            >
              Review Script
            </button>
          ) : (
            <span className="text-amber-600 text-sm">No script available</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 