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
  Settings,
  type LucideIcon,
} from 'lucide-react';

// Defined inside the client component because Lucide icon components can't
// be passed as props from a Server Component.
type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/konti', label: 'Konti', icon: Wallet },
  { href: '/laan', label: 'Lån', icon: Landmark },
  { href: '/indkomst', label: 'Indkomst', icon: Coins },
  // Budget renders separately below so we can nest the household's budget
  // accounts under it. Everything else stays in this flat list.
  { href: '/poster', label: 'Poster', icon: Receipt },
  { href: '/overforsler', label: 'Overførsler', icon: ArrowLeftRight },
  { href: '/indstillinger', label: 'Indstillinger', icon: Settings },
];

type BudgetAccountLink = { id: string; name: string };

export function SidebarNav({
  budgetAccounts,
}: {
  budgetAccounts: BudgetAccountLink[];
}) {
  const pathname = usePathname();
  const budgetActive = pathname === '/budget' || pathname.startsWith('/budget/');

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.slice(0, 4).map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}

      {/* Budget + nested account links. Sub-items always render so the user
          can see the full structure even when not on a /budget page. */}
      <Link
        href="/budget"
        className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition ${
          pathname === '/budget'
            ? 'bg-neutral-100 font-medium text-neutral-900'
            : budgetActive
              ? 'font-medium text-neutral-900 hover:bg-neutral-100'
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
        }`}
      >
        <ClipboardList
          className={`h-4 w-4 ${budgetActive ? 'text-neutral-900' : 'text-neutral-400'}`}
        />
        Budget
      </Link>
      {budgetAccounts.length > 0 && (
        <div className="ml-3.5 mt-0.5 flex flex-col gap-0.5 border-l border-neutral-200 pl-3">
          {budgetAccounts.map((a) => {
            const active = pathname === `/budget/${a.id}`;
            return (
              <Link
                key={a.id}
                href={`/budget/${a.id}`}
                className={`truncate rounded-md px-2 py-1 text-xs transition ${
                  active
                    ? 'bg-neutral-100 font-medium text-neutral-900'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {a.name}
              </Link>
            );
          })}
        </div>
      )}

      {NAV.slice(4).map((item) => (
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
