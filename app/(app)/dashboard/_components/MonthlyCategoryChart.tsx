// Horisontal bar-chart over faste udgifter pr. kategori, sorteret efter
// månedligt gennemsnit. Bruger kategoriens egen farve (sat i /budget) så
// chart'et matcher labels andre steder i appen.

import Link from 'next/link';
import { getMonthlyExpensesByCategory } from '@/lib/dal';
import { formatAmount } from '@/lib/format';

type Props = { limit?: number };

export async function MonthlyCategoryChart({ limit = 8 }: Props) {
  const data = await getMonthlyExpensesByCategory();

  if (data.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
        Ingen faste udgifter endnu — opret dem under{' '}
        <Link href="/budget" className="underline hover:text-neutral-900">
          Budget
        </Link>
        .
      </div>
    );
  }

  const top = data.slice(0, limit);
  const max = top[0].monthly;
  const total = data.reduce((s, c) => s + c.monthly, 0);
  const rest = data.length > limit ? data.slice(limit) : [];
  const restTotal = rest.reduce((s, c) => s + c.monthly, 0);

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Udgifter pr. kategori
        </h3>
        <span className="tabnum font-mono text-xs text-neutral-500">
          {formatAmount(total)} kr/md i alt
        </span>
      </div>
      <ul className="space-y-2">
        {top.map((c) => {
          const pct = (c.monthly / max) * 100;
          const sharePct = Math.round((c.monthly / total) * 100);
          return (
            <li key={c.category.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c.category.color }}
                    aria-hidden
                  />
                  <span className="truncate text-neutral-900">{c.category.name}</span>
                  <span className="text-xs text-neutral-400">{sharePct}%</span>
                </span>
                <span className="tabnum shrink-0 font-mono text-sm text-neutral-700">
                  {formatAmount(c.monthly)} kr
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: c.category.color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {rest.length > 0 && (
        <div className="mt-3 flex items-baseline justify-between text-xs text-neutral-500">
          <span>+ {rest.length} flere kategorier</span>
          <span className="tabnum font-mono">{formatAmount(restTotal)} kr/md</span>
        </div>
      )}
    </div>
  );
}
