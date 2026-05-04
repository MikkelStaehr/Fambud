// /husholdning - månedligt forbrugsspor mod et manuelt sat rådighedsbeløb.
//
// Modsat /budget (faste recurring expenses) er husholdningskontoen variabel
// fra dag til dag og fra måned til måned. Sidens job er at vise:
//   - Hvad er mit månedlige rådighedsbeløb? (manuelt sat øverst)
//   - Hvor meget har jeg brugt af det indtil nu i denne måned?
//   - Liste over de enkelte køb i måneden, med dato
//
// Hver "post" er en transaction med recurrence='once', kategori 'Husholdning',
// dato = købsdatoen. Tabellen "genstarter sig selv" hver måned simpelthen
// fordi vi filtrerer på den valgte måned (default = nuværende). Historik
// findes stadig - bare ikke i fokus.
//
// Budgettet (accounts.monthly_budget, migration 0024) er en INTENTION der
// gemmes på kontoen. Det er bevidst adskilt fra de faktiske transfers ind -
// brugeren kan have overført 8.000 men have et mentalt loft på 9.000, eller
// omvendt.

import { ShoppingBasket, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getAccounts, getHouseholdContext, shouldShowTour } from '@/lib/dal';
import { HusholdningTour } from './_components/HusholdningTour';
import {
  currentYearMonth,
  formatAmount,
  formatMonthYearDA,
  formatOereForInput,
  formatShortDateDA,
  monthBounds,
} from '@/lib/format';
import { EmptyState } from '../_components/EmptyState';
import { MonthFilter } from '../_components/MonthFilter';
import { AmountInput } from '../_components/AmountInput';
import {
  addHouseholdPurchase,
  deleteHouseholdPurchase,
  setMonthlyBudget,
} from './actions';
import type { Account, RecurrenceFreq } from '@/lib/database.types';

function normaliseYearMonth(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return currentYearMonth();
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Purchase = {
  id: string;
  amount: number;
  description: string | null;
  occurs_on: string;
};

type HouseholdAccountData = {
  account: Account;
  purchases: Purchase[];
};

export default async function HusholdningPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const month = normaliseYearMonth(sp.month);
  const monthLabel = formatMonthYearDA(month);
  const monthCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const [allAccounts, autoStartTour] = await Promise.all([
    getAccounts(),
    shouldShowTour('husholdning'),
  ]);
  const householdAccounts = allAccounts.filter(
    (a) => a.kind === 'household' && !a.archived
  );

  if (householdAccounts.length === 0) {
    const createHref =
      '/konti/ny?kind=household&name=' + encodeURIComponent('Husholdning');
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b border-neutral-200 pb-6">
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Husholdning
          </h1>
        </header>
        <div className="mt-8 max-w-xl rounded-md border border-neutral-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-700">
              <ShoppingBasket className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-neutral-900">
                Opret jeres husholdningskonto
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                En <span className="font-medium text-neutral-900">husholdningskonto</span>{' '}
                er en separat konto til de variable hverdagsudgifter - typisk
                dagligvarer, takeaway, mindre indkøb. Modsat budgetkontoen er
                forbruget her ikke fast hver måned.
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                I sætter selv et månedligt rådighedsbeløb og logger købene
                løbende. Tabellen genstarter hver måned.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <Link
              href={createHref}
              className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Opret husholdningskonto
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const data = await loadPurchases(householdAccounts, month);
  const error = sp.error;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <HusholdningTour autoStart={autoStartTour} />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Husholdning
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Spor dit dagligvareforbrug. Hver måned starter med blank tabel -
            tidligere måneder kan stadig ses via filtret.
          </p>
        </div>
        <MonthFilter yearMonth={month} basePath="/husholdning" />
      </header>

      {error && (
        <div className="mt-4 max-w-2xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-8">
        {data.map((entry) => (
          <HouseholdAccountCard
            key={entry.account.id}
            entry={entry}
            monthCap={monthCap}
          />
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Account card
// ----------------------------------------------------------------------------

function HouseholdAccountCard({
  entry,
  monthCap,
}: {
  entry: HouseholdAccountData;
  monthCap: string;
}) {
  const { account, purchases } = entry;
  const budget = account.monthly_budget ?? 0;
  const spent = purchases.reduce((s, p) => s + p.amount, 0);
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const remaining = budget - spent;
  const overBudget = budget > 0 && remaining < 0;

  // Subtilt værdineutralt: emerald indtil 80% (fri kapital), amber 80-100%
  // (tæt på), rød over (cap brudt). Bevidst ikke "rød fra dag 1" - det
  // skal være OK at bruge.
  const barClass =
    pct >= 100
      ? 'bg-red-500'
      : pct >= 80
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  const handleAdd = addHouseholdPurchase.bind(null, account.id);
  const handleSetBudget = setMonthlyBudget.bind(null, account.id);

  return (
    <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-50 text-emerald-700">
              <ShoppingBasket className="h-3.5 w-3.5" />
            </span>
            {account.name}
          </h2>
          <span className="text-xs text-neutral-500">{monthCap}</span>
        </div>

        {/* Manuelt månedligt rådighedsbeløb. Inline form - beløbet kan
            ændres når som helst og gælder fremadrettet (ingen historik
            for budget-ændringer; det er en current-state-værdi). */}
        <form
          action={handleSetBudget}
          data-tour="husholdning-budget"
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <div className="flex-1 min-w-[200px]">
            <label
              htmlFor={`budget-${account.id}`}
              className="block text-xs font-medium text-neutral-600"
            >
              Månedligt rådighedsbeløb
            </label>
            <AmountInput
              id={`budget-${account.id}`}
              name="amount"
              defaultValue={budget > 0 ? formatOereForInput(budget) : ''}
              placeholder="9 000.00"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Gem
          </button>
        </form>

        {budget > 0 && (
          <div className="mt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <div className="text-neutral-700">
                Brugt{' '}
                <span className="tabnum font-mono font-semibold text-neutral-900">
                  {formatAmount(spent)} kr
                </span>{' '}
                af{' '}
                <span className="tabnum font-mono">
                  {formatAmount(budget)} kr
                </span>
              </div>
              <div
                className={`tabnum font-mono text-xs ${
                  overBudget ? 'text-red-700' : 'text-neutral-500'
                }`}
              >
                {overBudget
                  ? `${formatAmount(-remaining)} kr over`
                  : `${formatAmount(remaining)} kr tilbage`}
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full transition-all ${barClass}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tilføj-køb-formen */}
      <form
        action={handleAdd}
        data-tour="husholdning-add"
        className="border-b border-neutral-100 bg-neutral-50/50 p-4 sm:p-5"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
          <input
            id={`occurs_on-${account.id}`}
            name="occurs_on"
            type="date"
            required
            defaultValue={todayISO()}
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
          <input
            name="description"
            type="text"
            required
            placeholder="Hvad købte du? (Netto, Føtex, Rema...)"
            className="rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            required
            placeholder="0.00"
            className="w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-right font-mono tabnum text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 sm:w-28"
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Tilføj
          </button>
        </div>
      </form>

      {purchases.length === 0 ? (
        <div className="border-t border-neutral-100">
          <EmptyState
            message="Ingen køb registreret i denne måned. Tilføj dit første ovenfor."
            compact
          />
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {purchases.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-neutral-500">
                  {formatShortDateDA(p.occurs_on)}
                </span>
                <span className="truncate text-sm text-neutral-900">
                  {p.description ?? '-'}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="tabnum font-mono text-sm text-neutral-900">
                  {formatAmount(p.amount)} kr
                </span>
                <form action={deleteHouseholdPurchase}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    aria-label="Slet køb"
                    className="rounded-md p-1 text-neutral-300 transition hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// Data loading
// ----------------------------------------------------------------------------

async function loadPurchases(
  accounts: Account[],
  yearMonth: string
): Promise<HouseholdAccountData[]> {
  if (accounts.length === 0) return [];

  const { supabase, householdId } = await getHouseholdContext();
  const { start, end } = monthBounds(yearMonth);
  const accountIds = accounts.map((a) => a.id);

  const { data: purchasesRes, error } = await supabase
    .from('transactions')
    .select('id, account_id, amount, description, occurs_on, recurrence')
    .eq('household_id', householdId)
    .in('account_id', accountIds)
    .eq('recurrence', 'once')
    .gte('occurs_on', start)
    .lte('occurs_on', end)
    .order('occurs_on', { ascending: false })
    .returns<{
      id: string;
      account_id: string;
      amount: number;
      description: string | null;
      occurs_on: string;
      recurrence: RecurrenceFreq;
    }[]>();

  if (error) throw error;

  const purchasesByAccount = new Map<string, Purchase[]>();
  for (const p of purchasesRes ?? []) {
    const list = purchasesByAccount.get(p.account_id) ?? [];
    list.push({
      id: p.id,
      amount: p.amount,
      description: p.description,
      occurs_on: p.occurs_on,
    });
    purchasesByAccount.set(p.account_id, list);
  }

  return accounts.map((a) => ({
    account: a,
    purchases: purchasesByAccount.get(a.id) ?? [],
  }));
}
