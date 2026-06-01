// Progress-meter der relaterer linje-posternes sum til begivenhedens
// "Planlagt budget"-loft. Giver brugeren et visuelt anker: hvor stor en
// del af de aftalte 50.000 kr er allerede bogført som konkrete poster
// (flybillet, hotel, mad osv.) - og er vi over loftet?
//
// To modes baseret på event.use_items_for_budget:
//   false (default): manuelt loft. Vi viser progress = items_sum / total_budget,
//     med over-loft-advarsel hvis sum > budget. Det er sporings-værktøjet.
//   true: poster udgør budgettet. Progress giver ingen mening (de er pr.
//     definition 100%). Vi viser bare summen + status-fordeling.
//
// Status-fordeling under bar'en: hvor stor en del af det bogførte er
// "planlagt" (kun en intention) vs. "booket" (forpligtet) vs. "betalt"
// (penge ude af døren). Det giver et lille fremdriftsspor uden at vi
// behøver bygge en separat tidslinje.

import {
  formatAmount,
  LIFE_EVENT_ITEM_STATUS_LABEL_DA,
} from '@/lib/format';
import type {
  LifeEventItem,
  LifeEventItemStatus,
} from '@/lib/database.types';

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

  // Status-fordeling. Vi viser kun de statusser der faktisk har poster -
  // ingen grund til "0 betalt" når intet er betalt endnu.
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

  // Mode A: items udgør budgettet. Ingen loft - vis sum + status-fordeling.
  if (useItemsForBudget) {
    return (
      <div className="mb-3 rounded-md border border-neutral-200 bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Bogført
          </span>
          <span className="font-mono tabnum text-base font-semibold text-neutral-900">
            {formatAmount(itemsSum)} kr
          </span>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Posterne udgør jeres totalbudget - tilføj eller fjern for at
          justere det.
        </p>
        {statusEntries.length > 0 && (
          <StatusBreakdown entries={statusEntries} />
        )}
      </div>
    );
  }

  // Mode B: manuelt loft. Vis progress bar + over/under-indikator.
  if (totalBudget == null || totalBudget <= 0) {
    return (
      <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>
          <strong className="font-semibold">
            {formatAmount(itemsSum)} kr bogført
          </strong>{' '}
          - men I har ikke sat et planlagt budget endnu, så vi kan ikke
          vise jer hvor langt I er. Sæt &quot;Planlagt budget&quot; under
          Detaljer for at få progress.
        </p>
        {statusEntries.length > 0 && (
          <StatusBreakdown entries={statusEntries} />
        )}
      </div>
    );
  }

  const ratio = itemsSum / totalBudget;
  const pct = Math.round(ratio * 100);
  const overBudget = itemsSum > totalBudget;
  const overAmount = itemsSum - totalBudget;
  const remaining = totalBudget - itemsSum;

  // Bar-bredden er KAPPET ved 100% så over-budget ikke skubber layout.
  // Selve over-loft-advarslen vises i sin egen linje under bar'en.
  const barWidthPct = Math.min(100, pct);
  const barColorClass = overBudget
    ? 'bg-red-600'
    : pct >= 90
      ? 'bg-amber-500'
      : 'bg-emerald-600';

  return (
    <div className="mb-3 rounded-md border border-neutral-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Bogført af planlagt
        </span>
        <span className="font-mono tabnum text-sm text-neutral-700">
          <strong className="font-semibold text-neutral-900">
            {formatAmount(itemsSum)} kr
          </strong>{' '}
          / {formatAmount(totalBudget)} kr
          <span className="ml-1.5 text-xs text-neutral-500">({pct}%)</span>
        </span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full transition-all ${barColorClass}`}
          style={{ width: `${barWidthPct}%` }}
        />
      </div>

      <div className="mt-1.5 text-xs">
        {overBudget ? (
          <span className="text-red-700">
            <strong className="font-semibold">
              {formatAmount(overAmount)} kr over loftet.
            </strong>{' '}
            Justér det planlagte budget op, eller skær en post.
          </span>
        ) : (
          <span className="text-neutral-500">
            {formatAmount(remaining)} kr tilbage at planlægge
          </span>
        )}
      </div>

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
