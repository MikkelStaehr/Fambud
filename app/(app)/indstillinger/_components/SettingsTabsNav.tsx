// Tab-navigation til /indstillinger/*. Klient-komponent fordi vi bruger
// usePathname() til at highlighte den aktive tab uanset hvilken
// sub-route brugeren er på. Sub-pages som kategorier/[id]-edit eller
// aktivitets-loggen aktiverer den tilsvarende parent-tab.

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, FolderTree, User, Users } from 'lucide-react';

const TABS = [
  { href: '/indstillinger/profil', label: 'Profil', icon: User },
  { href: '/indstillinger/husstand', label: 'Husstand', icon: Users },
  { href: '/indstillinger/kategorier', label: 'Kategorier', icon: FolderTree },
  { href: '/indstillinger/aktivitet', label: 'Aktivitet', icon: History },
] as const;

export function SettingsTabsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Indstillinger"
      className="mt-4 flex flex-wrap gap-1 border-b border-neutral-200"
    >
      {TABS.map((tab) => {
        // Active hvis path starter med tab.href - dækker også sub-routes
        // (kategorier/[id]-edit får Kategorier-fanen highlighted).
        const isActive = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-900'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
