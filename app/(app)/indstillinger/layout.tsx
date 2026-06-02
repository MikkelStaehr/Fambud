// Shared layout for /indstillinger/* - viser header + tab-nav over alle
// sub-routes (profil, husstand, kategorier, aktivitet, samt sub-pages
// som kategorier/[id]-edit). Tab-nav fremhæver den aktive parent-tab
// baseret på usePathname() i klient-komponenten.

import { SettingsTabsNav } from './_components/SettingsTabsNav';

export default function IndstillingerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Indstillinger
        </h1>
      </header>
      <SettingsTabsNav />
      <div className="mt-6">{children}</div>
    </div>
  );
}
