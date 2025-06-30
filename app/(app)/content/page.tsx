import { redirect } from 'next/navigation';

export default function ContentPage() {
  // Redirect to the new drafts page as the default content view
  redirect('/content/drafts');
} 