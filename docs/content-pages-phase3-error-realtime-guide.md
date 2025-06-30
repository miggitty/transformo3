# Content Pages Implementation Guide: PHASE 3 - Error Handling & Real-time Updates

**Companion to**: [Content Management Pages PRD](./content-pages-draft-schedule-completed.md)  
**Implementation Phase**: 3 of 3 (Error Handling, Real-time, Polish)  
**Version**: 1.0  
**Date**: December 30, 2024

---

## **Phase 3 Overview: Polish & Production Readiness**

**Goal**: Add comprehensive error handling, real-time updates, and production-ready polish to the content management system.

**Why Phase 3 Last?**
- Builds on the solid foundation from Phase 1 (server actions) and Phase 2 (UI components)
- Error handling patterns benefit from understanding the full component interaction
- Real-time features require stable base functionality to avoid complexity
- Performance optimizations are easier once the core features are complete

**Estimated Timeline**: 1-2 weeks  
**Dependencies**: Phase 1 and Phase 2 must be complete  
**Prerequisites**: 
- [Phase 1 - Server Actions Guide](./content-pages-phase1-server-actions-guide.md)
- [Phase 2 - Component Usage Guide](./content-pages-phase2-component-guide.md)

---

## **1. Error Boundary Components**

### **1.1 Content Error Boundary**

```typescript
// components/shared/content-error-boundary.tsx
'use client';

import React, { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ContentErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ContentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class ContentErrorBoundary extends React.Component<
  ContentErrorBoundaryProps,
  ContentErrorBoundaryState
> {
  constructor(props: ContentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): ContentErrorBoundaryState {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    console.error('Content Error Boundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ContentErrorFallback
          error={this.state.error}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// Separate fallback component for better reusability
interface ContentErrorFallbackProps {
  error: Error | null;
  errorId: string | null;
  onRetry: () => void;
}

function ContentErrorFallback({ error, errorId, onRetry }: ContentErrorFallbackProps) {
  const router = useRouter();

  const getErrorMessage = () => {
    if (error?.message?.includes('Network')) {
      return 'Connection issue detected. Please check your internet connection and try again.';
    }
    if (error?.message?.includes('timeout')) {
      return 'Request timed out. The server might be busy, please try again in a moment.';
    }
    if (error?.message?.includes('Unauthorized')) {
      return 'Session expired. Please sign in again to continue.';
    }
    return 'An unexpected error occurred while loading your content.';
  };

  const getErrorActions = () => {
    const actions = [
      <Button key="retry" onClick={onRetry} className="flex items-center space-x-2">
        <RefreshCw className="h-4 w-4" />
        <span>Try Again</span>
      </Button>
    ];

    if (error?.message?.includes('Unauthorized')) {
      actions.push(
        <Button
          key="signin"
          variant="outline"
          onClick={() => router.push('/sign-in')}
        >
          Sign In
        </Button>
      );
    } else {
      actions.push(
        <Button
          key="home"
          variant="outline"
          onClick={() => router.push('/content')}
          className="flex items-center space-x-2"
        >
          <Home className="h-4 w-4" />
          <span>Go Home</span>
        </Button>
      );
    }

    return actions;
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span>Something went wrong</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>{getErrorMessage()}</AlertDescription>
          </Alert>

          {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Technical Details (Development)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                {error.message}
                {error.stack && `\n\nStack trace:\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="flex space-x-2">
            {getErrorActions()}
          </div>

          {errorId && (
            <p className="text-xs text-muted-foreground">
              Error ID: {errorId} (for support reference)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Hook for using error boundary in functional components
export function useContentErrorHandler() {
  const handleError = React.useCallback((error: Error, errorInfo: ErrorInfo) => {
    console.error('Content error handled:', error, errorInfo);
    // Add additional error handling logic here
  }, []);

  return handleError;
}
```

### **1.2 Page-Level Error Boundaries**

```typescript
// app/(app)/content/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ContentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Content page error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span>Content Loading Error</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We encountered an issue loading your content. This might be due to a temporary 
            server issue or a network connection problem.
          </p>

          <div className="flex flex-col space-y-2">
            <Button 
              onClick={reset} 
              className="flex items-center justify-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry Loading</span>
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => router.push('/content')}
              className="flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Content</span>
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Error Details (Development)
              </summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## **2. Enhanced Real-time Content Updater**

### **2.1 Robust Real-time Updates with Batching**

```typescript
// components/shared/enhanced-realtime-content-updater.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Tables } from '@/types/supabase';
import { toast } from 'sonner';

interface EnhancedRealtimeContentUpdaterProps {
  businessId: string;
  serverContent: Tables<'content'>[];
  onUpdate: (content: Tables<'content'>[]) => void;
  batchInterval?: number; // milliseconds to batch updates
  onConnectionStatusChange?: (connected: boolean) => void;
}

export function EnhancedRealtimeContentUpdater({
  businessId,
  serverContent,
  onUpdate,
  batchInterval = 7000, // 7 seconds batching
  onConnectionStatusChange,
}: EnhancedRealtimeContentUpdaterProps) {
  const supabase = createClient();
  const [isConnected, setIsConnected] = useState(true);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Tables<'content'>>>(new Map());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<any>(null);

  // Process batched updates
  const processBatchedUpdates = useCallback(() => {
    if (pendingUpdates.size === 0) return;

    // Get current content and apply all pending updates
    const currentContentMap = new Map(serverContent.map(item => [item.id, item]));
    
    // Apply all pending updates
    pendingUpdates.forEach((updatedContent, contentId) => {
      currentContentMap.set(contentId, updatedContent);
    });

    // Convert back to array and update
    const updatedContent = Array.from(currentContentMap.values());
    onUpdate(updatedContent);

    // Clear pending updates
    setPendingUpdates(new Map());

    // Clear the batch timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = null;
    }
  }, [pendingUpdates, serverContent, onUpdate]);

  // Schedule batch processing
  const scheduleBatchUpdate = useCallback((contentUpdate: Tables<'content'>) => {
    // Add to pending updates
    setPendingUpdates(prev => new Map(prev.set(contentUpdate.id, contentUpdate)));

    // Clear existing timeout
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    // Schedule new batch processing
    batchTimeoutRef.current = setTimeout(processBatchedUpdates, batchInterval);
  }, [batchInterval, processBatchedUpdates]);

  // Handle connection status changes
  const handleConnectionStatusChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
    onConnectionStatusChange?.(connected);

    if (connected) {
      toast.success('Real-time updates reconnected');
      // Clear any reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    } else {
      toast.error('Real-time updates disconnected, trying to reconnect...');
      // Schedule reconnection attempt
      reconnectTimeoutRef.current = setTimeout(() => {
        window.location.reload(); // Simple reconnection strategy
      }, 30000); // 30 seconds
    }
  }, [onConnectionStatusChange]);

  // Set up real-time subscription
  useEffect(() => {
    let mounted = true;

    const setupRealtimeSubscription = async () => {
      try {
        // Subscribe to content changes
        const contentSubscription = supabase
          .channel(`content_updates_${businessId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'content',
              filter: `business_id=eq.${businessId}`,
            },
            (payload) => {
              if (!mounted) return;

              console.log('Content change received:', payload);

              switch (payload.eventType) {
                case 'INSERT':
                case 'UPDATE':
                  if (payload.new) {
                    scheduleBatchUpdate(payload.new as Tables<'content'>);
                  }
                  break;
                case 'DELETE':
                  if (payload.old) {
                    // For deletes, immediately update to remove the item
                    const deletedId = (payload.old as Tables<'content'>).id;
                    const updatedContent = serverContent.filter(item => item.id !== deletedId);
                    onUpdate(updatedContent);
                  }
                  break;
              }
            }
          )
          .on('system', { event: 'error' }, (error) => {
            console.error('Realtime subscription error:', error);
            handleConnectionStatusChange(false);
          })
          .subscribe((status) => {
            console.log('Realtime subscription status:', status);
            if (status === 'SUBSCRIBED') {
              handleConnectionStatusChange(true);
            } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
              handleConnectionStatusChange(false);
            }
          });

        subscriptionRef.current = contentSubscription;

        // Also subscribe to content_assets changes for status updates
        const assetsSubscription = supabase
          .channel(`content_assets_updates_${businessId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'content_assets',
            },
            (payload) => {
              if (!mounted) return;

              console.log('Content assets change received:', payload);
              
              // When assets change, we need to refresh the parent content
              // to ensure status calculations are up to date
              const assetData = payload.new || payload.old;
              if (assetData && (assetData as any).content_id) {
                const contentId = (assetData as any).content_id;
                const affectedContent = serverContent.find(c => c.id === contentId);
                if (affectedContent) {
                  // Trigger a content update to recalculate status
                  scheduleBatchUpdate(affectedContent);
                }
              }
            }
          )
          .subscribe();

        return () => {
          contentSubscription.unsubscribe();
          assetsSubscription.unsubscribe();
        };

      } catch (error) {
        console.error('Failed to setup realtime subscription:', error);
        handleConnectionStatusChange(false);
      }
    };

    setupRealtimeSubscription();

    return () => {
      mounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [businessId, scheduleBatchUpdate, handleConnectionStatusChange, serverContent]);

  // Visual indicator of connection status
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isConnected && (
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 px-3 py-2 rounded-md text-sm flex items-center space-x-2">
          <div className="animate-pulse w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span>Reconnecting...</span>
        </div>
      )}
      {pendingUpdates.size > 0 && (
        <div className="bg-blue-100 border border-blue-300 text-blue-800 px-3 py-2 rounded-md text-sm flex items-center space-x-2 mt-2">
          <div className="animate-spin w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>{pendingUpdates.size} update(s) pending...</span>
        </div>
      )}
    </div>
  );
}
```

### **2.2 Network Status Monitoring**

```typescript
// hooks/use-network-status.ts
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string;
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlowConnection: false,
    connectionType: 'unknown',
  });

  useEffect(() => {
    const updateNetworkStatus = () => {
      const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
      
      setNetworkStatus({
        isOnline: navigator.onLine,
        isSlowConnection: connection ? connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g' : false,
        connectionType: connection?.effectiveType || 'unknown',
      });
    };

    const handleOnline = () => {
      updateNetworkStatus();
      toast.success('Connection restored');
    };

    const handleOffline = () => {
      updateNetworkStatus();
      toast.error('Connection lost - some features may not work');
    };

    const handleConnectionChange = () => {
      updateNetworkStatus();
    };

    // Initial status
    updateNetworkStatus();

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = (navigator as any)?.connection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, []);

  return networkStatus;
}
```

---

## **3. Server Action Hook with Error Handling**

### **3.1 Enhanced useServerAction Hook**

```typescript
// hooks/use-server-action.ts
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface ServerActionState<T = any> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

export interface UseServerActionOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
  errorMessage?: string;
}

export function useServerAction<T = any, P = any>(
  action: (params: P) => Promise<{ success: boolean; data?: T; error?: string }>,
  options: UseServerActionOptions = {}
) {
  const [state, setState] = useState<ServerActionState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const execute = useCallback(async (params: P) => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      isSuccess: false,
      isError: false,
    }));

    try {
      const result = await action(params);

      if (result.success) {
        setState({
          data: result.data || null,
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
        });

        if (options.showSuccessToast !== false) {
          toast.success(options.successMessage || 'Action completed successfully');
        }

        options.onSuccess?.(result.data);
      } else {
        const errorMessage = result.error || 'Action failed';
        setState({
          data: null,
          error: errorMessage,
          isLoading: false,
          isSuccess: false,
          isError: true,
        });

        if (options.showErrorToast !== false) {
          toast.error(options.errorMessage || errorMessage);
        }

        options.onError?.(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      setState({
        data: null,
        error: errorMessage,
        isLoading: false,
        isSuccess: false,
        isError: true,
      });

      if (options.showErrorToast !== false) {
        toast.error(options.errorMessage || errorMessage);
      }

      options.onError?.(errorMessage);
    }
  }, [action, options]);

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

// Usage examples:
export function useDeleteContent() {
  return useServerAction(
    async ({ contentId, businessId }: { contentId: string; businessId: string }) => {
      const { deleteContent } = await import('@/app/(app)/content/[id]/actions');
      return await deleteContent({ contentId, businessId });
    },
    {
      successMessage: 'Content deleted successfully',
      errorMessage: 'Failed to delete content',
    }
  );
}

export function useRetryContent() {
  return useServerAction(
    async ({ contentId, businessId }: { contentId: string; businessId: string }) => {
      const { retryContentProcessing } = await import('@/app/(app)/content/[id]/actions');
      return await retryContentProcessing({ contentId, businessId });
    },
    {
      successMessage: 'Content retry initiated',
      errorMessage: 'Failed to retry content',
    }
  );
}

export function useApproveAsset() {
  return useServerAction(
    async ({ assetId, businessId }: { assetId: string; businessId: string }) => {
      const { approveContentAsset } = await import('@/app/(app)/content/[id]/actions');
      return await approveContentAsset({ assetId, businessId });
    },
    {
      successMessage: 'Content approved',
      errorMessage: 'Failed to approve content',
    }
  );
}
```

---

## **4. Enhanced Toast Notifications**

### **4.1 Smart Toast Patterns**

```typescript
// lib/toast-utils.ts
import { toast } from 'sonner';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export function showSuccessToast(message: string, action?: ToastAction) {
  return toast.success(message, {
    action: action ? {
      label: action.label,
      onClick: action.onClick,
    } : undefined,
  });
}

export function showErrorToast(message: string, action?: ToastAction) {
  return toast.error(message, {
    action: action ? {
      label: action.label,
      onClick: action.onClick,
    } : undefined,
  });
}

export function showLoadingToast(message: string) {
  return toast.loading(message);
}

export function showProgressToast(message: string, promise: Promise<any>) {
  return toast.promise(promise, {
    loading: message,
    success: 'Completed successfully',
    error: 'Operation failed',
  });
}

// Content-specific toast helpers
export function showContentDeleteToast(contentTitle: string, onUndo?: () => void) {
  return showSuccessToast(
    `"${contentTitle}" has been deleted`,
    onUndo ? {
      label: 'Undo',
      onClick: onUndo,
    } : undefined
  );
}

export function showContentRetryToast(contentTitle: string, onViewProgress?: () => void) {
  return showSuccessToast(
    `Retry initiated for "${contentTitle}"`,
    onViewProgress ? {
      label: 'View Progress',
      onClick: onViewProgress,
    } : undefined
  );
}

export function showNetworkErrorToast(onRetry?: () => void) {
  return showErrorToast(
    'Network connection issue detected',
    onRetry ? {
      label: 'Retry',
      onClick: onRetry,
    } : undefined
  );
}

export function showAuthErrorToast(onSignIn?: () => void) {
  return showErrorToast(
    'Your session has expired',
    onSignIn ? {
      label: 'Sign In',
      onClick: onSignIn,
    } : undefined
  );
}
```

---

## **5. Form Error Handling Patterns**

### **5.1 Enhanced Form Error States**

```typescript
// components/shared/form-error-handler.tsx
'use client';

import { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface FormError {
  field?: string;
  message: string;
  code?: string;
}

interface FormErrorHandlerProps {
  errors: FormError[];
  onRetry?: () => void;
  children?: ReactNode;
}

export function FormErrorHandler({ errors, onRetry, children }: FormErrorHandlerProps) {
  if (errors.length === 0) return <>{children}</>;

  const generalErrors = errors.filter(error => !error.field);
  const fieldErrors = errors.filter(error => error.field);

  return (
    <div className="space-y-4">
      {/* General form errors */}
      {generalErrors.map((error, index) => (
        <Alert key={index} className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error.message}</span>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ))}

      {/* Field-specific errors */}
      {fieldErrors.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Please fix the following issues:</p>
              <ul className="list-disc list-inside space-y-1">
                {fieldErrors.map((error, index) => (
                  <li key={index}>
                    <strong>{error.field}:</strong> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {children}
    </div>
  );
}

// Hook for managing form errors
export function useFormErrors() {
  const [errors, setErrors] = useState<FormError[]>([]);

  const addError = useCallback((error: FormError) => {
    setErrors(prev => [...prev, error]);
  }, []);

  const removeError = useCallback((field?: string, message?: string) => {
    setErrors(prev => prev.filter(error => 
      error.field !== field || (message && error.message !== message)
    ));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const clearFieldErrors = useCallback((field: string) => {
    setErrors(prev => prev.filter(error => error.field !== field));
  }, []);

  return {
    errors,
    addError,
    removeError,
    clearErrors,
    clearFieldErrors,
    hasErrors: errors.length > 0,
    hasFieldError: (field: string) => errors.some(error => error.field === field),
  };
}
```

---

## **6. Loading States and Skeletons**

### **6.1 Content-Specific Loading Components**

```typescript
// components/shared/loading-states.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function ContentTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Search and filters skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Table skeleton */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

export function ContentDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Status banner skeleton */}
      <Skeleton className="h-12 w-full" />

      {/* Content assets skeleton */}
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SmallLoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="animate-spin rounded-full h-6 w-6 border-b border-primary"></div>
    </div>
  );
}

export function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b border-primary mx-auto"></div>
        <p className="text-muted-foreground">Loading your content...</p>
      </div>
    </div>
  );
}
```

---

## **Phase 3 Implementation Checklist**

### **✅ Error Boundaries**
- [ ] Implement `ContentErrorBoundary` class component
- [ ] Create `ContentErrorFallback` components for different error types
- [ ] Add page-level error boundaries for each content page
- [ ] Test error boundaries with intentional errors
- [ ] Add error reporting integration (Sentry, LogRocket, etc.)

### **✅ Real-time Updates**
- [ ] Implement `EnhancedRealtimeContentUpdater` with batching
- [ ] Add network status monitoring with `useNetworkStatus` hook
- [ ] Implement connection status indicators
- [ ] Add reconnection logic for failed subscriptions
- [ ] Test real-time updates with multiple browser tabs

### **✅ Server Action Error Handling**
- [ ] Create `useServerAction` hook with comprehensive error handling
- [ ] Implement specialized hooks for content operations
- [ ] Add retry logic with exponential backoff
- [ ] Test error scenarios (network failure, timeouts, auth errors)
- [ ] Add loading states for all async operations

### **✅ Toast Notifications**
- [ ] Implement smart toast patterns with actions
- [ ] Create content-specific toast helpers
- [ ] Add undo functionality for delete operations
- [ ] Test toast notifications across different scenarios
- [ ] Ensure toasts don't stack excessively

### **✅ Form Error Handling**
- [ ] Create `FormErrorHandler` component
- [ ] Implement `useFormErrors` hook
- [ ] Add field-specific error display
- [ ] Test form validation error scenarios
- [ ] Add error recovery mechanisms

### **✅ Loading States**
- [ ] Create skeleton components for all major UI patterns
- [ ] Implement progressive loading for large data sets
- [ ] Add loading spinners for async operations
- [ ] Test loading states across different connection speeds
- [ ] Ensure loading states don't flicker

### **✅ Performance & Accessibility**
- [ ] Add proper ARIA labels for loading states
- [ ] Implement keyboard navigation for error recovery
- [ ] Test with screen readers
- [ ] Optimize real-time update performance
- [ ] Add performance monitoring for slow operations

### **✅ Integration Testing**
- [ ] Test complete workflows end-to-end
- [ ] Verify error handling in all critical paths
- [ ] Test real-time updates under load
- [ ] Verify offline/online behavior
- [ ] Test cross-browser compatibility

---

## **Production Readiness Checklist**

### **Monitoring & Observability**
- [ ] Error tracking with Sentry or similar
- [ ] Performance monitoring for slow queries
- [ ] Real-time connection monitoring
- [ ] User action tracking for debugging

### **Security**
- [ ] Input validation on all forms
- [ ] Rate limiting on server actions
- [ ] Proper authentication checks
- [ ] XSS protection on user content

### **Performance**
- [ ] Database query optimization
- [ ] Image and asset optimization
- [ ] Proper caching strategies
- [ ] Bundle size optimization

### **User Experience**
- [ ] Consistent loading states
- [ ] Helpful error messages
- [ ] Smooth transitions and animations
- [ ] Mobile responsiveness

---

## **Final Implementation Notes**

### **Error Recovery Strategy**
- Always provide a way for users to recover from errors
- Include retry mechanisms for transient failures
- Clear error messages that help users understand what went wrong
- Graceful degradation when real-time features fail

### **Performance Considerations**
- Batch real-time updates to avoid UI thrashing
- Use skeleton loaders instead of blank pages
- Implement proper loading states for all async operations
- Monitor and optimize database queries

### **Accessibility**
- Proper focus management for modals and error states
- Clear error announcements for screen readers
- Keyboard navigation for all interactive elements
- High contrast and readable error messages

**Congratulations!** With Phase 3 complete, you have a production-ready content management system with:
- ✅ Solid backend foundation (Phase 1)
- ✅ Complete UI components (Phase 2)  
- ✅ Comprehensive error handling and real-time features (Phase 3)

The system is now ready for user testing and production deployment! 