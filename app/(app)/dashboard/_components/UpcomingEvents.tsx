'use client';

// "Næste 7 dage" — kompakt liste af kommende regninger og overførsler i den
// nære fremtid. Komplementerer cashflow-tjekket: hvor advisoren siger "din
// fælles-konto er underdækket på den lange bane", siger denne sektion "her
// er hvad der konkret rammer din konto i denne uge".
//
// Tab-toggle (Fælles / Private) matcher CategoryGroupChart. Splittet sker på
// kilde-kontoens owner_name og er allerede beregnet i DAL'en (event.scope),
// så vi bare filtrerer her.

import { useState } from 'react';
import { CalendarClock, ArrowRightLeft } from 'lucide-react';
import { formatAmount } from '@/lib/format';
import type { UpcomingEvent } from '@/lib/dal';
import { InfoTooltip } from '@/app/_components/InfoTooltip';

type Tab = 'private' | 'shared';

type Props = {
  events: UpcomingEvent[];
};

// Relativ dato-label til "Næste 7 dage"-listen.
function relativeDateLabel(iso: string, today: Date): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round(
    (target.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return 'I dag';
  if (diffDays === 1) return 'I morgen';
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(target);
}

export function UpcomingEvents({ events }: Props) {
  const [tab, setTab] = useState<Tab>('shared');
  const today = new Date();
  const filtered = events.filter((e) => e.scope === tab);
  const total = filtered
    .filter((e) => e.kind === 'expense')
    .reduce((s, e) => s + e.amount, 0);

  return (
    <section className="flex h-full flex-col rounded-md border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          <CalendarClock className="h-3 w-3" />
          Næste 7 dage
          <InfoTooltip>
            Konkrete regninger og overførsler der rammer jeres konti
            inden for de næste 7 dage. Recurring transaktioner rulles
            forlæns til næste forekomst. Toggle mellem Fælles og Private
            for at se hver side separat.
          </InfoTooltip>
        </h3>
        {filtered.length > 0 && (
          <span className="tabnum font-mono text-xs text-neutral-500">
            {filtered.length} {filtered.length === 1 ? 'post' : 'poster'} · −{formatAmount(total)} kr
          </span>
        )}
      </div>

      {/* Tab toggle — fælles / privat (default fælles, matcher kategori-chart) */}
      <div className="mb-3 inline-flex shrink-0 rounded-md border border-neutral-200 p-0.5 text-xs">
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

      {filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          Ingen kommende {tab === 'shared' ? 'fælles' : 'private'} regninger den næste uge.
        </div>
      ) : (
        <ul className="-mx-4 max-h-96 flex-1 overflow-y-auto divide-y divide-neutral-100 border-y border-neutral-100">
          {filtered.map((e) => {
            const dateLabel = relativeDateLabel(e.date, today);
            const isTransfer = e.kind === 'transfer';
            return (
              <li
                key={`${e.kind}-${e.id}`}
                className="flex items-center gap-3 px-4 py-1.5"
              >
                <div className="w-16 shrink-0 text-[11px] font-medium text-neutral-500 sm:w-20">
                  {dateLabel}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm text-neutral-900">
                    {isTransfer ? (
                      <ArrowRightLeft className="h-3 w-3 shrink-0 text-neutral-400" />
                    ) : e.category ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: e.category.color }}
                        aria-hidden
                      />
                    ) : null}
                    <span className="truncate">{e.description}</span>
                  </div>
                </div>
                <div
                  className={`tabnum shrink-0 font-mono text-sm font-semibold ${
                    isTransfer ? 'text-neutral-600' : 'text-red-900'
                  }`}
                >
                  {isTransfer ? '' : '− '}
                  {formatAmount(e.amount)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
