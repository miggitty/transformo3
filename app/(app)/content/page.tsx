import { redirect } from 'next/navigation';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface ContentPageProps {
  searchParams: Promise<{ trial_setup?: string }>;
}

export default async function ContentPage(props: ContentPageProps) {
  const searchParams = await props.searchParams;
  
  // Handle trial setup success - pass through to drafts page
  if (searchParams.trial_setup === 'success') {
    redirect('/content/drafts?trial_setup=success');
  }
  
  // Default redirect to drafts page  
  redirect('/content/drafts');
} 