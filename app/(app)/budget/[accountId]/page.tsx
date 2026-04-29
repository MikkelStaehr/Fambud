import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Plus,
  X,
  Repeat,
} from 'lucide-react';
import {
  ensureStandardExpenseCategories,
  getBudgetAccounts,
  getCategories,
  getDistinctExpenseGroups,
  getFamilyMembers,
  getHouseholdContext,
  getRecurringExpensesForAccount,
  type RecurringExpenseRow,
} from '@/lib/dal';
import {
  ACCOUNT_KIND_LABEL_DA,
  RECURRENCE_LABEL_DA,
  effectiveAmount,
  formatAmount,
  formatShortDateDA,
  monthlyEquivalent,
} from '@/lib/format';
import { PRIVATE_ONLY_CATEGORY_NAMES } from '@/lib/categories';
import { ExpenseForm } from '../_components/ExpenseForm';
import { EditExpenseModal } from '../_components/EditExpenseModal';
import { ComponentRow } from '../_components/ComponentRow';
import { addExpense, addComponent, removeExpense } from '../actions';

export default async function BudgetAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { accountId } = await params;
  const { error } = await searchParams;

  // Make sure the standard categories exist even if the user lands here
  // directly via deep link without hitting /budget first.
  await ensureStandardExpenseCategories();

  const accounts = await getBudgetAccounts();
  const idx = accounts.findIndex((a) => a.id === accountId);
  if (idx === -1) {
    // Husholdningskonto har sin egen side. Andre kind=savings/investment/credit
    // havner også her — men /budget overview viser dem som links der peger
    // andre steder hen, så et direkte deep-link til /budget/[savingsId] er
    // sjældent og bouncer bare tilbage til oversigten.
    const { supabase, householdId } = await getHouseholdContext();
    const { data: a } = await supabase
      .from('accounts')
      .select('kind')
      .eq('id', accountId)
      .eq('household_id', householdId)
      .maybeSingle();
    if (a?.kind === 'household') redirect('/husholdning');
    redirect('/budget');
  }
  const account = accounts[idx];
  const prev = idx > 0 ? accounts[idx - 1] : null;
  const next = idx < accounts.length - 1 ? accounts[idx + 1] : null;

  // 'Fælles' is the marker we set on owner_name when an account is shared in
  // the wizard / fælleskonti flow. Anything else (null, a personal name) is
  // treated as a personal account.
  const isShared = account.owner_name === 'Fælles';

  const [expenses, allCategories, groupSuggestions, familyMembers] = await Promise.all([
    getRecurringExpensesForAccount(accountId),
    getCategories(),
    getDistinctExpenseGroups(),
    getFamilyMembers(),
  ]);


  // Filter the dropdown to the categories that make sense for this context.
  // Private add-ons (Træning, Frisør, …) only appear for personal accounts.
  const dropdownCategories = allCategories
    .filter((c) => c.kind === 'expense' && !c.archived)
    .filter((c) => !isShared || !PRIVATE_ONLY_CATEGORY_NAMES.has(c.name));

  // Group existing expenses by category for the right-hand list. Uncategorised
  // (shouldn't happen since we require a category, but defensive) goes last.
  type Group = { category: NonNullable<RecurringExpenseRow['category']>; items: RecurringExpenseRow[] };
  const groupsMap = new Map<string, Group>();
  const uncategorised: RecurringExpenseRow[] = [];
  for (const e of expenses) {
    if (e.category) {
      const existing = groupsMap.get(e.category.id);
      if (existing) existing.items.push(e);
      else groupsMap.set(e.category.id, { category: e.category, items: [e] });
    } else {
      uncategorised.push(e);
    }
  }
  const groups = Array.from(groupsMap.values()).sort((a, b) =>
    a.category.name.localeCompare(b.category.name, 'da')
  );

  // Per-month equivalent totals so we can compare across mixed recurrences
  // (yearly insurance + monthly subscription on the same line). Annual is
  // shown alongside as context. We use the effective amount (parent +
  // additive components) — components are tilkøb stacked on top, not a
  // breakdown of parent.
  const accountMonthly = expenses.reduce(
    (sum, e) =>
      sum +
      monthlyEquivalent(
        effectiveAmount(e.amount, e.components, e.components_mode),
        e.recurrence
      ),
    0
  );
  const accountYearly = accountMonthly * 12;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til dashboard
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Budget · Trin {idx + 1} af {accounts.length}
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isShared
                ? 'bg-blue-50 text-blue-700'
                : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            {isShared ? 'Fælles konto' : 'Personlig konto'}
          </span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
          {account.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {ACCOUNT_KIND_LABEL_DA[account.kind] ?? account.kind}
          {account.owner_name && (
            <>
              <span className="mx-1.5 text-neutral-300">·</span>
              {account.owner_name}
            </>
          )}
        </p>
        <p className="mt-3 text-sm text-neutral-700">
          {isShared ? (
            <>
              Tilføj de <span className="font-medium">fælles</span> faste udgifter der
              trækkes fra <span className="font-medium">{account.name}</span> — fx
              husleje, forsyning, fælles abonnementer.
            </>
          ) : (
            <>
              Tilføj de <span className="font-medium">private</span> faste udgifter
              der trækkes fra <span className="font-medium">{account.name}</span> —
              fx træning, eget abonnement, forsikringer du står alene for.
            </>
          )}
        </p>
      </header>

      {/* Two-column layout on lg+: form on the left (where the user works),
          existing-expenses list on the right (reference). On mobile they
          stack with the form first since that's the action surface. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:order-1 lg:col-span-3">
          <ExpenseForm
            action={addExpense}
            accountId={accountId}
            categories={dropdownCategories}
            groupSuggestions={groupSuggestions}
            familyMembers={familyMembers}
            resetKey={expenses.length}
            error={error}
          />

          <p className="mt-3 text-xs text-neutral-500">
            Du kan tilføje så mange du vil. Klik <span className="text-neutral-700">Næste konto</span>{' '}
            {next ? `for at fortsætte til ${next.name}` : 'når du er færdig'}.
          </p>

          <div className="mt-6 flex items-center gap-3">
            {prev ? (
              <Link
                href={`/budget/${prev.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Forrige
              </Link>
            ) : (
              <span />
            )}

            {next ? (
              <Link
                href={`/budget/${next.id}`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                Næste konto ({next.name})
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                Færdig
              </Link>
            )}
          </div>
        </div>

        <div className="lg:order-2 lg:col-span-2">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Tilføjet til {account.name}
            </h2>
            {expenses.length > 0 && (
              <div className="text-right text-xs">
                <div className="tabnum font-mono font-medium text-neutral-900">
                  {formatAmount(accountMonthly)} kr/md
                </div>
                <div className="tabnum font-mono text-neutral-500">
                  {formatAmount(accountYearly)} kr/år
                </div>
              </div>
            )}
          </div>

          {expenses.length === 0 ? (
            <div className="rounded-md border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-500">
              Ingen udgifter tilføjet endnu. Udfyld formen til venstre for at komme i gang.
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <CategoryGroup
                  key={group.category.id}
                  category={group.category}
                  items={group.items}
                  accountId={accountId}
                  editCategories={dropdownCategories}
                  groupSuggestions={groupSuggestions}
                  familyMembers={familyMembers}
                />
              ))}
              {uncategorised.length > 0 && (
                <CategoryGroup
                  category={{ id: 'none', name: 'Uden kategori', color: '#94a3b8' }}
                  items={uncategorised}
                  accountId={accountId}
                  editCategories={dropdownCategories}
                  groupSuggestions={groupSuggestions}
                  familyMembers={familyMembers}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Foldable category group. Uses native <details>/<summary> so we don't need
// client-side state or an "open"-tracking refactor — accessibility comes for
// free, and the chevron rotates via the `group-open:` Tailwind variant.
function CategoryGroup({
  category,
  items,
  accountId,
  editCategories,
  groupSuggestions,
  familyMembers,
}: {
  category: { id: string; name: string; color: string };
  items: RecurringExpenseRow[];
  accountId: string;
  editCategories: { id: string; name: string }[];
  groupSuggestions: string[];
  familyMembers: { id: string; name: string }[];
}) {
  // Same monthly-equivalent rollup as the account-level total, using the
  // effective amount so add-on components count toward the group total.
  const groupMonthly = items.reduce(
    (sum, e) =>
      sum +
      monthlyEquivalent(
        effectiveAmount(e.amount, e.components, e.components_mode),
        e.recurrence
      ),
    0
  );

  // Bucket items by group_label. Sub-groups render as nested <details>; items
  // without a group_label render directly inside the category.
  const subGroups = new Map<string, RecurringExpenseRow[]>();
  const direct: RecurringExpenseRow[] = [];
  for (const item of items) {
    if (item.group_label) {
      const existing = subGroups.get(item.group_label);
      if (existing) existing.push(item);
      else subGroups.set(item.group_label, [item]);
    } else {
      direct.push(item);
    }
  }
  const sortedSubGroups = Array.from(subGroups.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], 'da')
  );

  return (
    <details
      open
      className="group overflow-hidden rounded-md border border-neutral-200 bg-white"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm transition hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: category.color }}
            aria-hidden
          />
          <span className="truncate font-medium text-neutral-900">{category.name}</span>
          <span className="shrink-0 text-xs text-neutral-500">
            {items.length} {items.length === 1 ? 'udgift' : 'udgifter'}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2.5">
          <span className="tabnum font-mono text-xs text-neutral-700">
            {formatAmount(groupMonthly)} kr/md
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-neutral-400 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className="border-t border-neutral-100">
        {/* Sub-groups first (alphabetical), then ungrouped items directly. */}
        {sortedSubGroups.map(([label, groupItems]) => (
          <SubGroup
            key={label}
            label={label}
            items={groupItems}
            accountId={accountId}
            editCategories={editCategories}
            groupSuggestions={groupSuggestions}
            familyMembers={familyMembers}
          />
        ))}
        {direct.map((e) => (
          <ExpenseRow
            key={e.id}
            expense={e}
            accountId={accountId}
            editCategories={editCategories}
            groupSuggestions={groupSuggestions}
            familyMembers={familyMembers}
          />
        ))}
      </div>
    </details>
  );
}

// Foldable sub-group inside a category. Same <details>/<summary> trick as
// CategoryGroup but with a tinted background and a slightly smaller header
// to communicate the nesting level visually.
function SubGroup({
  label,
  items,
  accountId,
  editCategories,
  groupSuggestions,
  familyMembers,
}: {
  label: string;
  items: RecurringExpenseRow[];
  accountId: string;
  editCategories: { id: string; name: string }[];
  groupSuggestions: string[];
  familyMembers: { id: string; name: string }[];
}) {
  const subgroupMonthly = items.reduce(
    (sum, e) =>
      sum +
      monthlyEquivalent(
        effectiveAmount(e.amount, e.components, e.components_mode),
        e.recurrence
      ),
    0
  );

  return (
    // Closed by default — the summary with running total is enough overview.
    // Stronger bg-tint contrasts with the white items inside when expanded,
    // making the parent/child relationship visible at a glance.
    <details className="group/sub border-b border-neutral-100 bg-neutral-100/70 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2 text-xs transition hover:bg-neutral-200/50 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex min-w-0 items-center gap-2">
          <ChevronDown className="h-3 w-3 shrink-0 text-neutral-400 transition-transform -rotate-90 group-open/sub:rotate-0" />
          <span className="font-medium text-neutral-700">{label}</span>
          <span className="shrink-0 text-neutral-500">
            {items.length} {items.length === 1 ? 'udgift' : 'udgifter'}
          </span>
        </span>
        <span className="tabnum shrink-0 font-mono text-neutral-700">
          {formatAmount(subgroupMonthly)} kr/md
        </span>
      </summary>
      {/* Items get a left-border accent + extra indent so they read as
          children of the sub-group, not siblings of category-level items. */}
      <div className="border-t border-neutral-200/70 bg-white pl-6">
        <div className="border-l-2 border-neutral-200">
          {items.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              accountId={accountId}
              editCategories={editCategories}
              groupSuggestions={groupSuggestions}
              familyMembers={familyMembers}
            />
          ))}
        </div>
      </div>
    </details>
  );
}

// Single expense row + its components + an inline form to add another
// component. Components share the parent's recurrence and date — they're
// purely a breakdown of the parent amount.
function ExpenseRow({
  expense,
  accountId,
  editCategories,
  groupSuggestions,
  familyMembers,
}: {
  expense: RecurringExpenseRow;
  accountId: string;
  editCategories: { id: string; name: string }[];
  groupSuggestions: string[];
  familyMembers: { id: string; name: string }[];
}) {
  const hasComponents = expense.components.length > 0;
  const effective = effectiveAmount(
    expense.amount,
    expense.components,
    expense.components_mode
  );
  const componentsSum = expense.components.reduce((s, c) => s + c.amount, 0);
  const isBreakdown = expense.components_mode === 'breakdown';

  return (
    <div className="border-b border-neutral-100 px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="truncate font-medium text-neutral-900">
              {expense.description ?? expense.category?.name ?? 'Uden navn'}
            </span>
            {expense.family_member && (
              <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-normal text-neutral-600">
                {expense.family_member.name}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
            <span className="tabnum font-mono text-neutral-700">
              {formatAmount(effective)} kr.
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
              <Repeat className="h-2.5 w-2.5" />
              {RECURRENCE_LABEL_DA[expense.recurrence] ?? expense.recurrence}
            </span>
            <span>Næste: {formatShortDateDA(expense.occurs_on)}</span>
          </div>
          {hasComponents && (
            <div className="mt-0.5 text-[11px] text-neutral-400">
              {isBreakdown
                ? `Nedbrudt på ${expense.components.length} ${expense.components.length === 1 ? 'post' : 'poster'} (sum ${formatAmount(componentsSum)} kr.)`
                : `Grundbeløb ${formatAmount(expense.amount)} kr. + ${expense.components.length} tilkøb (${formatAmount(componentsSum)} kr.)`}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <EditExpenseModal
            expense={expense}
            accountId={accountId}
            categories={editCategories}
            groupSuggestions={groupSuggestions}
            familyMembers={familyMembers}
          />
          <form action={removeExpense}>
            <input type="hidden" name="id" value={expense.id} />
            <input type="hidden" name="account_id" value={accountId} />
            <button
              type="submit"
              className="rounded p-1 text-neutral-300 transition hover:bg-red-50 hover:text-red-700"
              title="Fjern udgift"
              aria-label={`Fjern ${expense.description ?? 'udgift'}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Components — indented breakdown of the parent amount. Each row is
          inline-editable via the ComponentRow client component. */}
      {hasComponents && (
        <ul className="mt-2 ml-3 space-y-1 border-l border-neutral-100 pl-3">
          {expense.components.map((c) => (
            <ComponentRow
              key={c.id}
              component={c}
              accountId={accountId}
              familyMembers={familyMembers}
            />
          ))}
        </ul>
      )}

      {/* Inline add-form via <details> — no client state needed. The form
          re-keys on the component count so it resets after each submit. */}
      <details className="group/comp mt-2 ml-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
          <Plus className="h-3 w-3" />
          <span className="group-open/comp:hidden">Tilføj underpost</span>
          <span className="hidden group-open/comp:inline">Annullér</span>
        </summary>
        <form
          key={expense.components.length}
          action={addComponent}
          className="mt-2 space-y-1.5"
        >
          <input type="hidden" name="transaction_id" value={expense.id} />
          <input type="hidden" name="account_id" value={accountId} />
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <input
              name="label"
              type="text"
              required
              placeholder="Fx Spotify family"
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              required
              placeholder="99.00"
              className="w-24 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right font-mono tabnum text-xs placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <select
              name="family_member_id"
              defaultValue=""
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            >
              <option value="">Tilhører hele familien</option>
              {familyMembers.map((fm) => (
                <option key={fm.id} value={fm.id}>{fm.name}</option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white transition hover:bg-neutral-800"
            >
              Tilføj
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
