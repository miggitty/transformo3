import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from "next/image";

export default async function HomePage() {
  const cookieStore = cookies();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // If the user is logged in, redirect them to the new content dashboard.
    redirect('/dashboard/content');
  } else {
    // If the user is not logged in, redirect them to the sign-in page.
    redirect('/sign-in');
  }

  // This part will not be reached due to the redirects, but it's good practice
  // to have a fallback return statement.
  return null;
}
