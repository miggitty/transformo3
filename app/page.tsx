import { redirect } from 'next/navigation';

export default async function Index() {
  // This page is a simple redirect to the content page for logged-in users.
  // The actual authentication check and handling for unauthenticated users
  // is managed by the layout in the (app) group.
  return redirect('/content');
}
