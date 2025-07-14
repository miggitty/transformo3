'use client';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import { VideoGenerationState } from '@/hooks/use-video-generation';

interface VideoGenerationProgressProps {
  state: VideoGenerationState;
  canRetry: boolean;
  onRetry: () => void;
}

const ErrorStateDisplay: React.FC<{
  error: VideoGenerationState['errorType'];
  onRetry: () => void;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
}> = ({ error, onRetry, retryCount, maxRetries, canRetry }) => {
  const errorMessages = {
    network: 'Network connection lost. Please check your internet connection.',
    api: 'AI service temporarily unavailable. Please try again.',
    timeout: 'Generation took longer than expected. You can try again.',
    quota: 'AI generation limit reached. Please try again later.',
    unknown: 'An unexpected error occurred. Please try again.'
  };

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-red-800">Generation Failed</h4>
          <p className="text-sm text-red-700 mt-1">
            {errorMessages[error || 'unknown']}
          </p>
          {canRetry && (
            <Button
              onClick={onRetry}
              size="sm"
              variant="outline"
              className="mt-3 text-red-700 border-red-300 hover:bg-red-100"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Try Again ({maxRetries - retryCount} attempts remaining)
            </Button>
          )}
          {!canRetry && (
            <p className="text-xs text-red-600 mt-2">
              Maximum retry attempts reached. Please try again later.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const ProgressIndicator: React.FC<{
  status: VideoGenerationState['status'];
  progress: number;
  estimatedTimeRemaining?: number;
}> = ({ status, progress, estimatedTimeRemaining }) => {
  if (status !== 'processing' && status !== 'starting') return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
          <span className="text-sm font-medium text-purple-800">
            {status === 'starting' ? 'Starting AI Video Generation...' : 'Creating AI Video'}
          </span>
        </div>
        {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
          <span className="text-xs text-purple-600">
            ~{formatTime(estimatedTimeRemaining)} remaining
          </span>
        )}
      </div>
      
      <div className="space-y-2">
        <Progress 
          value={progress} 
          className="w-full h-2 bg-purple-100"
        />
        <div className="flex justify-between text-xs text-purple-600">
          <span>{Math.round(progress)}% complete</span>
          <span>This usually takes 2-3 minutes</span>
        </div>
      </div>
      
      <p className="text-xs text-purple-700">
        You can continue working on other content while this generates.
      </p>
    </div>
  );
};

const CompletionIndicator: React.FC = () => (
  <div className="p-4 bg-green-50 border border-green-200 rounded-lg animate-in fade-in-50 duration-500">
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
        <div className="w-2 h-2 bg-white rounded-full"></div>
      </div>
      <span className="text-sm font-medium text-green-800">
        AI video generated successfully!
      </span>
    </div>
  </div>
);

export function VideoGenerationProgress({ 
  state, 
  canRetry, 
  onRetry 
}: VideoGenerationProgressProps) {
  const { status, progress, estimatedTimeRemaining, errorType, retryCount, maxRetries } = state;

  if (status === 'idle') return null;

  if (status === 'completed') {
    return <CompletionIndicator />;
  }

  if (status === 'failed' || status === 'timeout') {
    return (
      <ErrorStateDisplay
        error={errorType}
        onRetry={onRetry}
        retryCount={retryCount}
        maxRetries={maxRetries}
        canRetry={canRetry}
      />
    );
  }

  if (status === 'starting' || status === 'processing') {
    return (
      <ProgressIndicator
        status={status}
        progress={progress}
        estimatedTimeRemaining={estimatedTimeRemaining}
      />
    );
  }

  return null;
} 