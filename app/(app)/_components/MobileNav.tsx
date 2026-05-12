'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { FambudMark } from '@/app/_components/FambudMark';
import { SidebarNav } from './SidebarNav';
import { FeedbackModal } from './FeedbackModal';
import { signOut } from '../actions';

// Mobile-shell der skjuler sidebaren bag en hamburger-knap. Vises kun
// under md (768px); på tablet/desktop falder vi tilbage til den
// almindelige sidebar-layout i parent.
//
// Drawer'en lukker automatisk når brugeren navigerer (pathname-skift),
// klikker backdrop, eller trykker Escape - alle tre er forventede UX-
// patterns på mobile-drawers.

type Props = {
  userEmail: string;
};

export function MobileNav({ userEmail }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Luk drawer ved navigation. Bruger pathname som dependency så hver
  // route-skift trigger'er close.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape lukker drawer
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    // Lås body-scroll mens drawer er åben - ellers kan brugeren scrolle
    // bag drawer'en hvilket føles ødelagt på iOS.
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Top-bar - sticky øverst, kun synlig på mobile */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Åbn menu"
          className="rounded-md p-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Menu className="h-5 w-5" />
        </button>
        <FambudMark size="sm" />
        {/* Spacer så Fambud-mark forbliver centreret */}
        <div className="w-9" />
      </div>

      {/* Drawer + backdrop, kun render'et når åben for performance */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel - 80% bredde fra venstre */}
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Hovedmenu"
            className="absolute inset-y-0 left-0 flex w-[80%] max-w-[320px] flex-col border-r border-neutral-200 bg-white"
          >
            <div className="flex items-center justify-between px-3 py-3">
              <FambudMark size="lg" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Luk menu"
                className="rounded-md p-2 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3">
              <SidebarNav />
            </div>

            <div className="border-t border-neutral-100 px-4 pt-3 pb-4">
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
                {userEmail}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
