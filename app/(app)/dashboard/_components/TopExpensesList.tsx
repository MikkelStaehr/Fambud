// Top-N enkelt-udgifter normaliseret til månedligt beløb. Hjælper brugeren
// med at lokalisere "de store sten" i budgettet — dem der flytter mest hvis
// de skæres eller forhandles.

import { getTopRecurringExpenses } from '@/lib/dal';
import { formatAmount, RECURRENCE_LABEL_DA } from '@/lib/format';

type Props = { limit?: number };

export async function TopExpensesList({ limit = 5 }: Props) {
  const rows = await getTopRecurringExpenses(limit);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Største udgifter
      </h3>
      <ol className="space-y-2">
        {rows.map((row, i) => (
          <li key={row.id} className="flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="tabnum w-5 shrink-0 font-mono text-xs text-neutral-400">
                {i + 1}.
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm text-neutral-900">
                  {row.description ?? row.category?.name ?? 'Uden navn'}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                  {row.category && (
                    <>
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: row.category.color }}
                        aria-hidden
                      />
                      <span className="truncate">{row.category.name}</span>
                      <span className="text-neutral-300">·</span>
                    </>
                  )}
                  <span>{RECURRENCE_LABEL_DA[row.recurrence] ?? row.recurrence}</span>
                </div>
              </div>
            </div>
            <span className="tabnum shrink-0 font-mono text-sm font-medium text-neutral-900">
              {formatAmount(row.monthly)} kr/md
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
