// Progress-meter ovenfor ItemList: relaterer linje-posternes sum til
// begivenhedens "Planlagt budget"-loft + viser status-fordeling.
//
// Selve bar'en + over/under-loft-teksten er trukket ud i EventProgressBar
// så listen og dashboardet kan vise samme bar i en compact-variant.
// Denne komponent tilføjer: rammer, mode-skift for use_items_for_budget,
// "mangler loft"-fallback, og status-fordelings-pills nederst.

import {
  formatAmount,
  LIFE_EVENT_ITEM_STATUS_LABEL_DA,
} from '@/lib/format';
import type {
  LifeEventItem,
  LifeEventItemStatus,
} from '@/lib/database.types';
import { EventProgressBar } from './EventProgressBar';

type Props = {
  totalBudget: number | null;
  useItemsForBudget: boolean;
  items: Pick<LifeEventItem, 'amount' | 'status'>[];
};

const STATUS_DOT: Record<LifeEventItemStatus, string> = {
  planlagt: 'bg-neutral-400',
  booket: 'bg-amber-500',
  betalt: 'bg-emerald-600',
};

export function ItemBudgetMeter({
  totalBudget,
  useItemsForBudget,
  items,
}: Props) {
  if (items.length === 0) return null;

  const itemsSum = items.reduce((sum, it) => sum + it.amount, 0);

  const byStatus: Record<LifeEventItemStatus, number> = {
    planlagt: 0,
    booket: 0,
    betalt: 0,
  };
  for (const it of items) byStatus[it.status] += it.amount;
  const statusEntries = (
    ['planlagt', 'booket', 'betalt'] as LifeEventItemStatus[]
  )
    .map((s) => ({ status: s, amount: byStatus[s] }))
    .filter((e) => e.amount > 0);

  // Mode A: items udgør budgettet. Ingen progress - bare sum + status.
  if (useItemsForBudget) {
    return (
      <div className="mb-3 rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Planlagt på poster
          </span>
          <span className="font-mono tabnum text-base font-semibold text-neutral-900">
            {formatAmount(itemsSum)} kr
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Posterne udgør jeres samlede budget - tilføj eller fjern for at
          justere det.
        </p>
        {statusEntries.length > 0 && (
          <StatusBreakdown entries={statusEntries} />
        )}
      </div>
    );
  }

  // Mode B uden loft: vis sum + "sæt budget"-hint. EventProgressBar
  // ville returnere null her, så vi laver et eksplicit fallback-panel.
  if (totalBudget == null || totalBudget <= 0) {
    return (
      <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>
          <strong className="font-semibold">
            {formatAmount(itemsSum)} kr planlagt på poster
          </strong>{' '}
          - men I har ikke sat et budget endnu, så vi kan ikke vise jer
          hvor langt I er. Sæt &quot;Totalbudget&quot; under Detaljer for
          at få progress.
        </p>
        {statusEntries.length > 0 && (
          <StatusBreakdown entries={statusEntries} />
        )}
      </div>
    );
  }

  // Mode B med loft: fuld progress-bar + status.
  return (
    <div className="mb-3 rounded-md border border-neutral-200 bg-white p-4">
      <EventProgressBar
        items={items}
        totalBudget={totalBudget}
        useItemsForBudget={false}
      />
      {statusEntries.length > 0 && (
        <StatusBreakdown entries={statusEntries} />
      )}
    </div>
  );
}

function StatusBreakdown({
  entries,
}: {
  entries: { status: LifeEventItemStatus; amount: number }[];
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-100 pt-2 text-xs text-neutral-600">
      {entries.map((e) => (
        <span key={e.status} className="inline-flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[e.status]}`}
          />
          <span className="font-mono tabnum">
            {formatAmount(e.amount)} kr
          </span>
          <span className="text-neutral-500">
            {LIFE_EVENT_ITEM_STATUS_LABEL_DA[e.status].toLowerCase()}
          </span>
        </span>
      ))}
    </div>
  );
}
