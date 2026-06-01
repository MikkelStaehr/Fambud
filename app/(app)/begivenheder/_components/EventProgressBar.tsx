// Slim progress-bar: items_sum vs. total_budget. Tekst-loggen ovenover
// bar'en kan slås fra (compact-mode) hvis bar'en sidder på et kort hvor
// labelen allerede er andetsteds.
//
// Brugt tre steder:
//   - /begivenheder/[id] (inde i ItemBudgetMeter, fuld variant)
//   - /begivenheder liste-kort (compact-variant, lige under stat-grid)
//   - Dashboard LifeEventsWidget (compact, under meta-linjen)
//
// Returnerer null hvis der ikke er nogen post-data ELLER hvis loftet ikke
// er sat - vi viser ingen tom bar.

import { formatAmount } from '@/lib/format';
import type { LifeEventItem } from '@/lib/database.types';

type Props = {
  items: Pick<LifeEventItem, 'amount'>[];
  totalBudget: number | null;
  useItemsForBudget: boolean;
  // compact = ingen "Bogført af planlagt"-header, mindre tal-størrelse,
  // tyndere bar. Bruges på liste-kort og dashboard hvor pladsen er knap.
  compact?: boolean;
};

export function EventProgressBar({
  items,
  totalBudget,
  useItemsForBudget,
  compact = false,
}: Props) {
  // Use_items_for_budget = poster ER budgettet, så progress er pr. definition
  // 100%. Vi viser bar'en ikke i den mode - den ville være misvisende.
  if (useItemsForBudget) return null;
  if (items.length === 0) return null;
  if (totalBudget == null || totalBudget <= 0) return null;

  const itemsSum = items.reduce((sum, it) => sum + it.amount, 0);
  const ratio = itemsSum / totalBudget;
  const pct = Math.round(ratio * 100);
  const overBudget = itemsSum > totalBudget;
  const overAmount = itemsSum - totalBudget;
  const remaining = totalBudget - itemsSum;

  const barWidthPct = Math.min(100, pct);
  const barColorClass = overBudget
    ? 'bg-red-600'
    : pct >= 90
      ? 'bg-amber-500'
      : 'bg-emerald-600';

  if (compact) {
    return (
      <div className="mt-2">
        <div className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-neutral-500">
            <strong className="font-semibold text-neutral-900">
              {formatAmount(itemsSum)} kr
            </strong>{' '}
            planlagt på poster
          </span>
          <span
            className={
              overBudget ? 'font-medium text-red-700' : 'text-neutral-500'
            }
          >
            {overBudget
              ? `${formatAmount(overAmount)} kr over`
              : `${formatAmount(remaining)} kr tilbage`}
            <span className="ml-1 text-neutral-400">({pct}%)</span>
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full transition-all ${barColorClass}`}
            style={{ width: `${barWidthPct}%` }}
          />
        </div>
      </div>
    );
  }

  // Fuld variant: header + større tal + større bar. Bruges som standalone
  // panel på detalje-siden.
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Planlagt på poster
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
              {formatAmount(overAmount)} kr over budgettet.
            </strong>{' '}
            Justér budgettet op, eller skær en post.
          </span>
        ) : (
          <span className="text-neutral-500">
            {formatAmount(remaining)} kr tilbage at planlægge
          </span>
        )}
      </div>
    </div>
  );
}
