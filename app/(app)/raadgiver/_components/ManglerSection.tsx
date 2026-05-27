// "Manglende opsætning": strukturelle huller i husstandens opsætning. Egne
// huller får en konkret Opret-handling; partneres huller en forklaring (de
// skal selv gøre det). Tom-tilstand fejrer at alt er på plads.

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';
import type { SetupGap } from '@/lib/economy-plan';

export function ManglerSection({ gaps }: { gaps: SetupGap[] }) {
  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Jeres opsætning ser komplet ud - alle bidragydere har lønkonto og
        registreret indkomst.
      </div>
    );
  }

  return (
    <ul className="overflow-hidden rounded-lg border border-amber-200 bg-white divide-y divide-amber-100">
      {gaps.map((g, i) => (
        <li key={i} className="flex items-start gap-3 px-4 py-3">
          {g.tone === 'action' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          ) : (
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-neutral-900">
              {g.title}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
              {g.body}
            </p>
          </div>
          {g.action && (
            <Link
              href={g.action.href}
              className="shrink-0 self-center rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-emerald-800"
            >
              {g.action.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
