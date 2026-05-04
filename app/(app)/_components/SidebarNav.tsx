'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  ArrowLeftRight,
  ClipboardList,
  Coins,
  Landmark,
  ShoppingBasket,
  PiggyBank,
  Settings,
  Table2,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

// Defined inside the client component because Lucide icon components can't
// be passed as props from a Server Component.
type NavItem = { href: string; label: string; icon: LucideIcon };

// Hovednavigation - overblikssider og indkomst/udgift-flows. Budget er det
// hierarkiske overblik over alle faste udgifter; selve værktøjerne til at
// vedligeholde dem ligger samlet under "Værktøjer" nedenfor.
const NAV_MAIN: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/konti', label: 'Konti', icon: Wallet },
  { href: '/laan', label: 'Lån', icon: Landmark },
  { href: '/indkomst', label: 'Indkomst', icon: Coins },
  // Budget er det flade overblik (read-only tabel) - Table2-ikonet adskiller
  // den visuelt fra "Faste udgifter" (CRUD-værktøjet) der bruger ClipboardList.
  { href: '/budget', label: 'Budget', icon: Table2 },
  { href: '/poster', label: 'Poster', icon: Receipt },
  { href: '/overforsler', label: 'Overførsler', icon: ArrowLeftRight },
];

// Værktøjer - sider hvor brugeren beriger systemet med data (oprette faste
// udgifter, registrere husholdningskøb, sætte opsparingsmål). Adskilt fra
// hovedflow'et så sidebaren ikke blander "se" og "vedligehold".
const NAV_TOOLS: NavItem[] = [
  { href: '/faste-udgifter', label: 'Faste udgifter', icon: ClipboardList },
  { href: '/husholdning', label: 'Husholdning', icon: ShoppingBasket },
  { href: '/opsparinger', label: 'Opsparinger & buffer', icon: PiggyBank },
];

const NAV_BOTTOM: NavItem[] = [
  { href: '/indstillinger', label: 'Indstillinger', icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_MAIN.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}

      <div data-tour="sidebar-tools">
        <div className="mt-4 mb-1 flex items-center gap-1.5 px-2.5">
          <Wrench className="h-3 w-3 text-neutral-400" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
            Værktøjer
          </span>
        </div>
        {NAV_TOOLS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>

      <div className="mt-4">
        {NAV_BOTTOM.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const { href, label, icon: Icon } = item;
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition ${
        active
          ? 'bg-neutral-100 font-medium text-neutral-900'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
      }`}
    >
      <Icon
        className={`h-4 w-4 ${active ? 'text-neutral-900' : 'text-neutral-400'}`}
      />
      {label}
    </Link>
  );
}
