import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { BetaNotice } from './_components/BetaNotice';
import { FambudMark } from '@/app/_components/FambudMark';
import { FeedbackModal } from './_components/FeedbackModal';
import { MobileNav } from './_components/MobileNav';
import { SidebarNav } from './_components/SidebarNav';
import { Toast } from './_components/Toast';
import { signOut } from './actions';

// Belt-and-braces: the proxy already redirects unauthenticated users to /login
// before this layout renders, but we re-check here so any future direct render
// of an (app) page in tests or RSC streams still gates correctly. We also
// gate the whole app behind the onboarding wizard until setup is complete.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Wizard gate. We don't go through the full DAL here because the (app)
  // layout runs on every page load - keep this query minimal.
  const { data: membership } = await supabase
    .from('family_members')
    .select('setup_completed_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership?.setup_completed_at) redirect('/wizard');

  return (
    // App-shell:
    // - Mobile (< md): MobileNav top-bar med hamburger; sidebaren er
    //   skjult og åbner som drawer ved klik. Stack vertikalt så main
    //   får fuld bredde.
    // - md+ (tablet/desktop): klassisk side-by-side med fast sidebar
    //   til venstre. Sidebar holder samme størrelse uanset hvor langt
    //   indholdet er - det er kun <main> der scroller.
    <div className="flex h-screen flex-col md:flex-row">
      <MobileNav userEmail={user.email ?? ''} />

      <aside className="hidden w-56 shrink-0 flex-col border-r border-neutral-200 bg-stone-100 px-3 py-4 md:flex">
        <div className="px-2 pb-6">
          <FambudMark size="lg" />
        </div>

        {/* Nav-området kan scrolle internt hvis det nogensinde bliver længere
            end viewporten (mange værktøjer eller smal højde) - sign-out
            forbliver klistret til bunden via mt-auto på det næste blok. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>

        <div className="mt-auto px-1 pt-4">
          <FeedbackModal />
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              <LogOut className="h-4 w-4" />
              Log ud
            </button>
          </form>
          <div className="mt-3 truncate px-2.5 text-xs text-neutral-400">
            {user.email}
          </div>
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

      {/* Toast hænger på URL search-params; Suspense er påkrævet fordi
          useSearchParams ellers vil bailout client-side for hele route'en. */}
      <Suspense fallback={null}>
        <Toast />
      </Suspense>

      <BetaNotice />
    </div>
  );
}
