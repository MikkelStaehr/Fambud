'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  ArrowLeftRight,
  ClipboardList,
  Settings,
  type LucideIcon,
} from 'lucide-react';

// Defined inside the client component because Lucide icon components can't
// be passed as props from a Server Component.
type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/konti', label: 'Konti', icon: Wallet },
  { href: '/budget', label: 'Budget', icon: ClipboardList },
  { href: '/poster', label: 'Poster', icon: Receipt },
  { href: '/overforsler', label: 'Overførsler', icon: ArrowLeftRight },
  { href: '/indstillinger', label: 'Indstillinger', icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
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
      })}
    </nav>
  );
}
