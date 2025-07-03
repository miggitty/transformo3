import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

interface ContentPageProps {
  searchParams: Promise<{ trial_setup?: string }>;
}

export default async function ContentPage(props: ContentPageProps) {
  const searchParams = await props.searchParams;
  
  // Handle trial setup success with enhanced session recovery
  if (searchParams.trial_setup === 'success') {
    console.log('🎉 Trial setup success - performing session recovery...');
    
    try {
      // Force session refresh by creating a fresh client
      const supabase = await createClient();
      
      // Get fresh session data
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      console.log('Session recovery status:', {
        hasSession: !!session,
        hasUser: !!user,
        sessionError: sessionError?.message,
        userError: userError?.message
      });
      
      if (session && user) {
        console.log('✅ Session recovery successful for user:', user.email);
        // Session is valid, redirect to content with success message
        redirect('/content/drafts?trial_setup=success');
      } else {
        // Try to refresh the session one more time
        console.log('🔄 Attempting session refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshData.session && refreshData.user) {
          console.log('✅ Session refresh successful for user:', refreshData.user.email);
          redirect('/content/drafts?trial_setup=success');
        } else {
          console.error('❌ Session refresh failed:', refreshError);
          // Clear any corrupted session data
          const cookieStore = await cookies();
          const cookieNames = [
            'sb-access-token',
            'sb-refresh-token', 
            'supabase.auth.token',
            'supabase-auth-token'
          ];
          
          cookieNames.forEach(name => {
            try {
              cookieStore.delete(name);
            } catch {
              // Cookie might not exist
            }
          });
          
          redirect('/sign-in?message=Your session expired during payment processing. Please sign in again to access your account.');
        }
      }
    } catch (error) {
      console.error('❌ Unexpected error during session recovery:', error);
      redirect('/sign-in?message=An error occurred. Please sign in again.');
    }
  }
  
  // Default redirect to drafts page  
  redirect('/content/drafts');
} 