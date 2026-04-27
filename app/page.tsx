import { redirect } from 'next/navigation';

// Root → dashboard. The proxy bounces unauthenticated users to /login.
export default function Home() {
  redirect('/dashboard');
}
