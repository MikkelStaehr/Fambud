'use client';

// Horisontal bar-chart over månedlige udgifter, rullet op til de tematiske
// kategori-grupper (Bolig & lån, Transport, …) i stedet for individuelle
// kategorier — giver et hurtigere "hvor går pengene hen?"-overblik på
// dashboardet.
//
// Tab-toggle skifter mellem private og fælles udgifter. Splittet sker ved
// konto-ejerskab i DAL'en (owner_name === 'Fælles' → fælles), så ingen
// genberegning her — vi bare viser den valgte bucket.

import Link from 'next/link';
import { useState } from 'react';
import { formatAmount } from '@/lib/format';
import type { CategoryGroupSummary } from '@/lib/dal';

type Tab = 'private' | 'shared';

type Props = {
  privateGroups: CategoryGroupSummary[];
  sharedGroups: CategoryGroupSummary[];
};

export function CategoryGroupChart({ privateGroups, sharedGroups }: Props) {
  const [tab, setTab] = useState<Tab>('shared');
  const data = tab === 'shared' ? sharedGroups : privateGroups;
  const total = data.reduce((s, g) => s + g.monthly, 0);
  const max = data[0]?.monthly ?? 0;

  return (
    <section className="flex h-full flex-col rounded-md border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Udgifter pr. gruppe
        </h3>
        <span className="tabnum font-mono text-xs text-neutral-500">
          {formatAmount(total)} kr/md
        </span>
      </div>

      {/* Tab toggle — privat / fælles */}
      <div className="mb-4 inline-flex rounded-md border border-neutral-200 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setTab('shared')}
          className={`rounded px-2.5 py-1 font-medium transition ${
            tab === 'shared'
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Fælles
        </button>
        <button
          type="button"
          onClick={() => setTab('private')}
          className={`rounded px-2.5 py-1 font-medium transition ${
            tab === 'private'
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Private
        </button>
      </div>

      {data.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          Ingen {tab === 'shared' ? 'fælles' : 'private'} udgifter endnu — opret dem under{' '}
          <Link href="/faste-udgifter" className="underline hover:text-neutral-900">
            Faste udgifter
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-2">
          {data.map((g) => {
            const pct = max > 0 ? (g.monthly / max) * 100 : 0;
            const sharePct = total > 0 ? Math.round((g.monthly / total) * 100) : 0;
            return (
              <li key={g.group} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: g.color }}
                      aria-hidden
                    />
                    <span className="truncate text-neutral-900">{g.group}</span>
                    <span className="text-xs text-neutral-400">{sharePct}%</span>
                  </span>
                  <span className="tabnum shrink-0 font-mono text-sm text-neutral-700">
                    {formatAmount(g.monthly)} kr
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: g.color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
