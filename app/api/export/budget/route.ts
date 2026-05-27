// CSV-eksport af budgettet: alle faste udgifter på tværs af konti.
//
// Modsat /poster (faktiske posteringer i én måned) er budgettet et øjebliks-
// billede af de tilbagevendende udgifter. Vi tager både beløbet pr. gang
// (fx fuld årlig forsikring) og det normaliserede kr/md (monthlyEquivalent),
// præcis som /budget-tabellen viser dem - så regnearket matcher det brugeren
// ser i appen.
//
// Auth via getBudgetAccounts/getRecurringExpensesForAccount ->
// getHouseholdContext (redirecter til /login uden session). Samme
// rækkebygning som app/(app)/budget/page.tsx.

import {
  getBudgetAccounts,
  getRecurringExpensesForAccount,
} from '@/lib/dal';
import { categoryGroupFor } from '@/lib/categories';
import {
  effectiveAmount,
  monthlyEquivalent,
  RECURRENCE_LABEL_DA,
} from '@/lib/format';
import { buildCsv, csvAmountDA } from '@/lib/csv';

type BudgetExportRow = {
  group: string;
  description: string;
  categoryName: string;
  accountName: string;
  isShared: boolean;
  recurrence: string;
  effective: number;
  monthly: number;
};

export async function GET() {
  const accounts = await getBudgetAccounts();
  const perAccount = await Promise.all(
    accounts.map(async (a) => ({
      account: a,
      expenses: await getRecurringExpensesForAccount(a.id),
    }))
  );

  const rows: BudgetExportRow[] = perAccount.flatMap(({ account, expenses }) =>
    expenses.map((e) => {
      const eff = effectiveAmount(e.amount, e.components, e.components_mode);
      return {
        group: categoryGroupFor(e.category?.name ?? ''),
        description: e.description ?? e.category?.name ?? 'Udgift',
        categoryName: e.category?.name ?? '',
        accountName: account.name,
        isShared: account.owner_name === 'Fælles',
        recurrence: RECURRENCE_LABEL_DA[e.recurrence],
        effective: eff,
        monthly: monthlyEquivalent(eff, e.recurrence),
      };
    })
  );

  // Sortér grupperet (gruppe alfabetisk, dyreste poster først indenfor hver
  // gruppe) - samme overblik som tabellens grupperede visning.
  rows.sort(
    (a, b) =>
      a.group.localeCompare(b.group, 'da') || b.monthly - a.monthly
  );

  const headers = [
    'Gruppe',
    'Navn',
    'Kategori',
    'Konto',
    'Deling',
    'Interval',
    'Beløb pr. gang (kr)',
    'Beløb (kr/md)',
  ];

  const csvRows = rows.map((r) => [
    r.group,
    r.description,
    r.categoryName,
    r.accountName,
    r.isShared ? 'Fælles' : 'Privat',
    r.recurrence,
    csvAmountDA(r.effective),
    csvAmountDA(r.monthly),
  ]);

  const csv = buildCsv(headers, csvRows);
  const today = new Date().toISOString().slice(0, 10);
  const filename = `fambud-budget-${today}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
