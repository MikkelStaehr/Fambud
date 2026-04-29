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
  type LucideIcon,
} from 'lucide-react';

// Defined inside the client component because Lucide icon components can't
// be passed as props from a Server Component.
type NavItem = { href: string; label: string; icon: LucideIcon };

// Top-level items der står ALENE (ingen sub-items). Budget rendres separat
// fordi den har sin egen treenighed (Faste udgifter / Husholdning /
// Opsparinger) der vises som nestede sub-items.
const NAV_BEFORE_BUDGET: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/konti', label: 'Konti', icon: Wallet },
  { href: '/laan', label: 'Lån', icon: Landmark },
  { href: '/indkomst', label: 'Indkomst', icon: Coins },
];

const NAV_AFTER_BUDGET: NavItem[] = [
  { href: '/poster', label: 'Poster', icon: Receipt },
  { href: '/overforsler', label: 'Overførsler', icon: ArrowLeftRight },
  { href: '/indstillinger', label: 'Indstillinger', icon: Settings },
];

// De tre sub-items under Budget — den månedlige budget-treenighed: hvad der
// trækkes fast, hvad der bruges variabelt, og hvad der lægges til side.
const BUDGET_CHILDREN: NavItem[] = [
  { href: '/budget', label: 'Faste udgifter', icon: ClipboardList },
  { href: '/husholdning', label: 'Husholdning', icon: ShoppingBasket },
  { href: '/opsparinger', label: 'Opsparinger & buffer', icon: PiggyBank },
];

const BUDGET_PATHS = new Set(BUDGET_CHILDREN.map((c) => c.href));

export function SidebarNav() {
  const pathname = usePathname();

  // Budget er "aktiv" hvis vi er på /budget, /husholdning, /opsparinger
  // eller noget under dem. Sub-item highlight håndteres separat.
  const budgetActive =
    BUDGET_PATHS.has(pathname) ||
    [...BUDGET_PATHS].some((p) => pathname.startsWith(p + '/'));

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_BEFORE_BUDGET.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}

      {/* Budget-overskrift (ikke klikbar — er en gruppe-header, ikke en
          rute. Klik på en af de tre sub-items i stedet). Vi bruger en
          ikke-link span så der ikke opstår tvivl om hvor den fører hen. */}
      <div
        className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${
          budgetActive ? 'font-medium text-neutral-900' : 'text-neutral-600'
        }`}
      >
        <ClipboardList
          className={`h-4 w-4 ${budgetActive ? 'text-neutral-900' : 'text-neutral-400'}`}
        />
        Budget
      </div>
      <div className="ml-3.5 mt-0.5 flex flex-col gap-0.5 border-l border-neutral-200 pl-3">
        {BUDGET_CHILDREN.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 truncate rounded-md px-2 py-1 text-xs transition ${
                active
                  ? 'bg-neutral-100 font-medium text-neutral-900'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <item.icon
                className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-neutral-900' : 'text-neutral-400'}`}
              />
              {item.label}
            </Link>
          );
        })}
      </div>

      {NAV_AFTER_BUDGET.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
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
