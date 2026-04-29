import Link from 'next/link';
import { Plus, Pencil, Trash2, Repeat } from 'lucide-react';
import { getIncomeTransactions } from '@/lib/dal';
import {
  RECURRENCE_LABEL_DA,
  formatAmount,
  formatShortDateDA,
  monthlyEquivalent,
} from '@/lib/format';
import { deleteIncome } from './actions';

export default async function IndkomstPage() {
  const incomes = await getIncomeTransactions();

  // Aggregate to "kr/md" so users see the household's recurring monthly
  // income at a glance — single one-shots count zero, weeklies are *4.345 etc.
  const monthlyTotal = incomes.reduce(
    (sum, i) => sum + monthlyEquivalent(i.amount, i.recurrence),
    0
  );

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Indkomst
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {incomes.length === 0
              ? 'Ingen indkomstposter endnu'
              : `${incomes.length} ${incomes.length === 1 ? 'post' : 'poster'} · ${formatAmount(monthlyTotal)} kr/md i alt`}
          </p>
        </div>
        <Link
          href="/indkomst/ny"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          <Plus className="h-4 w-4" />
          Tilføj indkomst
        </Link>
      </header>

      {incomes.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">
            Ingen indkomstposter endnu. Tilføj din første lønudbetaling — du
            kan også indtaste bruttoløn og pension hvis du vil have det fulde
            billede.
          </p>
          <Link
            href="/indkomst/ny"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            Tilføj indkomst
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          <table className="w-full">
            <tbody>
              {incomes.map((i) => {
                const monthly =
                  i.recurrence === 'monthly'
                    ? null
                    : monthlyEquivalent(i.amount, i.recurrence);
                return (
                  <tr
                    key={i.id}
                    className="border-b border-neutral-100 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">
                          {i.description ?? 'Lønudbetaling'}
                        </span>
                        {i.family_member && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                            {i.family_member.name}
                          </span>
                        )}
                        {i.recurrence !== 'once' && (
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                            <Repeat className="h-3 w-3" />
                            {RECURRENCE_LABEL_DA[i.recurrence]}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-500">
                        {i.account?.name ?? 'Ukendt konto'} ·{' '}
                        {formatShortDateDA(i.occurs_on)}
                        {i.gross_amount != null && (
                          <> · brutto {formatAmount(i.gross_amount)} kr</>
                        )}
                        {i.pension_own_pct != null && (
                          <> · pension egen {i.pension_own_pct}%</>
                        )}
                        {i.pension_employer_pct != null && (
                          <> · firma {i.pension_employer_pct}%</>
                        )}
                        {i.other_deduction_amount != null &&
                          i.other_deduction_amount > 0 && (
                            <>
                              {' · '}
                              {i.other_deduction_label ?? 'fradrag'}{' '}
                              {formatAmount(i.other_deduction_amount)}
                            </>
                          )}
                      </div>
                    </td>
                    <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                      <div className="font-mono tabnum text-sm font-semibold text-emerald-700">
                        {formatAmount(i.amount)} kr
                      </div>
                      {monthly != null && (
                        <div className="mt-0.5 text-xs text-neutral-500">
                          {formatAmount(monthly)} kr/md
                        </div>
                      )}
                    </td>
                    <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/indkomst/${i.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                        >
                          <Pencil className="h-3 w-3" />
                          Rediger
                        </Link>
                        <form action={deleteIncome}>
                          <input type="hidden" name="id" value={i.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            Slet
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
