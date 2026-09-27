'use client';

// Faner øverst i Famtask: Projekter / Sparks. Projekt-detaljesiderne
// (/famtask/[id]) hører under Projekter.

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/famtask', label: 'Projekter' },
  { href: '/famtask/sparks', label: 'Sparks' },
] as const;

export function FamtaskTabs() {
  const pathname = usePathname();
  const onSparks = pathname === '/famtask/sparks' || pathname.startsWith('/famtask/sparks/');

  return (
    <nav aria-label="Famtask" className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
      {TABS.map((tab) => {
        const active = tab.href === '/famtask/sparks' ? onSparks : !onSparks;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded px-3 py-1.5 text-sm transition ${
              active
                ? 'bg-neutral-100 font-medium text-neutral-900'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
