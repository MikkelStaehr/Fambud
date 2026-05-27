'use client';

// Indstillinger-link til den nederste utility-klynge (over Send Feedback +
// Log ud). Eget client-component fordi det skal kende pathname for at vise
// aktiv-tilstand, og fordi det genbruges i både desktop-sidebar (layout) og
// mobil-drawer (MobileNav).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';

export function SettingsLink() {
  const pathname = usePathname();
  const active =
    pathname === '/indstillinger' || pathname.startsWith('/indstillinger/');
  return (
    <Link
      href="/indstillinger"
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition ${
        active
          ? 'bg-neutral-100 font-medium text-neutral-900'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
      }`}
    >
      <Settings className="h-4 w-4" />
      Indstillinger
    </Link>
  );
}
