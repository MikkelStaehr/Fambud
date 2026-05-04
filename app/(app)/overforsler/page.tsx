// /overforsler - strukturel oversigt over hvor pengene skal hen i husstanden.
//
//   1. Header: hvor mange faste overførsler, hvor mange kr/md i alt
//   2. Stats-kort: total, til fælles, til opsparing, antal idle-konti
//   3. Smart insights: konkrete observationer ("X har +Y i surplus", "Z er
//      aldrig blevet sat op", osv) - kun når relevant
//   4. Faste overførsler grupperet efter formål:
//        Til fælles-økonomien · Til opsparing & investering · Til afdrag på
//        lån · Andre
//   5. Engangs-overførsler i den valgte måned (mindre, sekundær)
//
// Vi droppede den interaktive graf - tabel-grupperingen viser samme
// information mere kompakt og er nemmere at scanne. Drag-to-create var
// fancy men sjældent brugt; "Ny overførsel"-knappen + de pre-fyldte links
// fra CashflowAdvisor er nu det primære oprettelses-flow.
//
// Vi bruger stadig getTransferGraph() fra DAL fordi den allerede flader
// transfers ud pr. (from, to)-par med metadata vi har brug for til
// grupperingen.

import Link from 'next/link';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Repeat,
  Home,
  PiggyBank,
  Landmark,
  ArrowLeftRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { getTransferGraph, getTransfersForMonth } from '@/lib/dal';
import {
  RECURRENCE_LABEL_DA,
  currentYearMonth,
  formatAmount,
  formatShortDateDA,
  monthlyEquivalent,
} from '@/lib/format';
import type { Account, AccountKind, RecurrenceFreq } from '@/lib/database.types';
import { EmptyState } from '../_components/EmptyState';
import { MonthFilter } from '../_components/MonthFilter';
import { deleteTransfer } from './actions';

function normaliseYearMonth(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return currentYearMonth();
}

type EnrichedTransfer = {
  id: string;
  amount: number;
  recurrence: RecurrenceFreq;
  description: string | null;
  occurs_on: string;
  fromAccount: Pick<Account, 'id' | 'name' | 'kind' | 'owner_name'> | undefined;
  toAccount: Pick<Account, 'id' | 'name' | 'kind' | 'owner_name'> | undefined;
  monthly: number; // monthlyEquivalent(amount, recurrence)
};

type GroupKey = 'shared' | 'savings' | 'credit' | 'other';

const GROUP_META: Record<
  GroupKey,
  { title: string; description: string; icon: typeof Home; tone: string }
> = {
  shared: {
    title: 'Til fælles-økonomien',
    description:
      'Overførsler til budget- og husholdningskonti - det der dækker husstandens fælles forpligtelser.',
    icon: Home,
    tone: 'bg-emerald-50 text-emerald-800',
  },
  savings: {
    title: 'Til opsparing & investering',
    description:
      'Hvad I lægger til side hver måned. Aldersopsparing, ASK, aktiedepot, børneopsparing.',
    icon: PiggyBank,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  credit: {
    title: 'Til afdrag på lån',
    description:
      'Overførsler der dækker ydelsen på lån. Oprettes typisk automatisk når du pusher et lån til budget.',
    icon: Landmark,
    tone: 'bg-amber-50 text-amber-700',
  },
  other: {
    title: 'Andre overførsler',
    description: 'Resterende - typisk mellem private konti.',
    icon: ArrowLeftRight,
    tone: 'bg-neutral-100 text-neutral-700',
  },
};

function classify(toKind: AccountKind | undefined): GroupKey {
  if (toKind === 'budget' || toKind === 'household') return 'shared';
  if (toKind === 'savings' || toKind === 'investment') return 'savings';
  if (toKind === 'credit') return 'credit';
  return 'other';
}

export default async function OverforslerPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const month = normaliseYearMonth(sp.month);
  const [graph, transfersInMonth] = await Promise.all([
    getTransferGraph(),
    getTransfersForMonth(month),
  ]);

  const accountById = new Map(graph.accounts.map((a) => [a.id, a]));

  // Flatten recurring transfers - vi smider engangs ud her, de hører til
  // i deres egen sektion nederst.
  const recurring: EnrichedTransfer[] = graph.edges.flatMap((edge) =>
    edge.transfers
      .filter((t) => t.recurrence !== 'once')
      .map((t) => ({
        id: t.id,
        amount: t.amount,
        recurrence: t.recurrence,
        description: t.description,
        occurs_on: t.occurs_on,
        fromAccount: accountById.get(edge.from),
        toAccount: accountById.get(edge.to),
        monthly: monthlyEquivalent(t.amount, t.recurrence),
      }))
  );

  const totalMonthly = recurring.reduce((s, t) => s + t.monthly, 0);
  const oneTimers = transfersInMonth.filter((t) => t.recurrence === 'once');

  const groups: Record<GroupKey, EnrichedTransfer[]> = {
    shared: [],
    savings: [],
    credit: [],
    other: [],
  };
  for (const t of recurring) {
    groups[classify(t.toAccount?.kind)].push(t);
  }
  // Inden for hver gruppe sorteres efter månedligt beløb (størst først) så
  // de tunge transfers læses først.
  (Object.keys(groups) as GroupKey[]).forEach((k) => {
    groups[k].sort((a, b) => b.monthly - a.monthly);
  });

  // Smart insights - skal være konkrete og handlingsorienterede, ikke
  // generelle. Vi tjekker tre ting:
  //  1. Konti der hverken sender eller modtager overførsler men ikke er
  //     credit eller den primære lønkonto (måske glemt at sætte op)
  //  2. Konti hvor income > overført ud (potentielt surplus der bør
  //     allokeres)
  // Vi viser MAX 3 insights så sektionen ikke overdøver de andre.
  const insights = computeInsights(graph.accounts, recurring);

  const totalShared = groups.shared.reduce((s, t) => s + t.monthly, 0);
  const totalSavings = groups.savings.reduce((s, t) => s + t.monthly, 0);

  // Idle-konti tæller med i en stat-card - hjælper brugeren se "har jeg
  // glemt en konto?". Filtrer credit ud (de styres på /laan).
  const idleAccounts = graph.accounts.filter((a) => {
    if (a.kind === 'credit' || a.archived) return false;
    const hasFlow = recurring.some(
      (t) => t.fromAccount?.id === a.id || t.toAccount?.id === a.id
    );
    return !hasFlow;
  });

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Overførsler
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {recurring.length === 0
              ? 'Ingen faste overførsler endnu - opret din første via knappen til højre'
              : `${recurring.length} faste · ${formatAmount(totalMonthly)} kr/md i alt`}
          </p>
        </div>
        <Link
          href="/overforsler/ny"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Ny overførsel
        </Link>
      </header>

      {/* Stats-kort: kun når der ER overførsler. På tom side er header-CTAen
          bedre signal end fire 0-kort. */}
      {recurring.length > 0 && (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="I alt pr. måned" value={`${formatAmount(totalMonthly)} kr`} mono />
          <StatCard label="Til fælles" value={`${formatAmount(totalShared)} kr`} mono />
          <StatCard label="Til opsparing" value={`${formatAmount(totalSavings)} kr`} mono />
          <StatCard
            label="Konti uden flow"
            value={
              idleAccounts.length === 0
                ? '0'
                : `${idleAccounts.length}`
            }
            tone={idleAccounts.length > 0 ? 'amber' : undefined}
          />
        </section>
      )}

      {insights.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
            <Sparkles className="h-3 w-3" />
            Indsigter
          </h2>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </div>
        </section>
      )}

      {/* Grupperet liste over faste overførsler. Sektioner uden indhold
          renderes ikke - siden bliver så aldrig længere end nødvendigt. */}
      {(['shared', 'savings', 'credit', 'other'] as GroupKey[]).map((key) => {
        const items = groups[key];
        if (items.length === 0) return null;
        return <RecurringGroup key={key} groupKey={key} items={items} />;
      })}

      {recurring.length === 0 && (
        <section className="mt-8 rounded-md border border-dashed border-neutral-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">
            Ingen faste overførsler endnu. De er rygraden i jeres økonomi -
            de fortæller hvor lønnen skal hen hver måned.
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            Tryk på &ldquo;Ny overførsel&rdquo;-knappen for at oprette den
            første. Cashflow-tjekket på dashboard kan også foreslå konkrete
            overførsler du mangler.
          </p>
        </section>
      )}

      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Engangs-overførsler i denne måned
          </h2>
          <div className="flex items-center gap-3">
            <MonthFilter yearMonth={month} basePath="/overforsler" />
            <span className="text-xs text-neutral-500">
              {oneTimers.length}{' '}
              {oneTimers.length === 1 ? 'post' : 'poster'}
            </span>
          </div>
        </div>
        {oneTimers.length === 0 ? (
          <EmptyState
            message="Ingen engangs-overførsler i denne måned. Skift måned ovenfor eller opret én."
            cta={{ href: '/overforsler/ny', label: 'Ny overførsel' }}
          />
        ) : (
          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            <table className="w-full">
              <tbody>
                {oneTimers.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-neutral-100 last:border-b-0"
                  >
                    <td className="w-24 whitespace-nowrap px-4 py-3 text-xs text-neutral-500">
                      {formatShortDateDA(t.occurs_on)}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-900">
                        <span className="font-medium">{t.from_account?.name ?? '-'}</span>
                        <ArrowRight className="h-3 w-3 text-neutral-400" />
                        <span className="font-medium">{t.to_account?.name ?? '-'}</span>
                      </div>
                      {t.description && (
                        <div className="mt-0.5 text-xs text-neutral-500">{t.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="tabnum font-mono text-sm text-neutral-900">
                        {formatAmount(t.amount)}
                      </span>
                    </td>
                    <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/overforsler/${t.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                        >
                          <Pencil className="h-3 w-3" />
                        </Link>
                        <form action={deleteTransfer}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Komponenter
// ----------------------------------------------------------------------------

function StatCard({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'amber';
}) {
  const valueColor = tone === 'amber' ? 'text-amber-700' : 'text-neutral-900';
  return (
    <div className="rounded-md border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-semibold ${valueColor} ${mono ? 'tabnum font-mono' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function RecurringGroup({
  groupKey,
  items,
}: {
  groupKey: GroupKey;
  items: EnrichedTransfer[];
}) {
  const meta = GROUP_META[groupKey];
  const Icon = meta.icon;
  const total = items.reduce((s, t) => s + t.monthly, 0);

  return (
    <section className="mt-8">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded ${meta.tone}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          {meta.title}
        </h2>
        <span className="tabnum font-mono text-sm font-semibold text-neutral-900">
          {formatAmount(total)} kr/md
        </span>
      </div>
      <p className="mb-3 max-w-2xl text-xs text-neutral-500">{meta.description}</p>
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        {items.map((t) => (
          <RecurringRow key={t.id} t={t} />
        ))}
      </div>
    </section>
  );
}

function RecurringRow({ t }: { t: EnrichedTransfer }) {
  const isFromShared = t.fromAccount?.owner_name === 'Fælles';
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-neutral-900">
            {t.fromAccount?.name ?? '-'}
          </span>
          {!isFromShared && t.fromAccount?.owner_name && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
              {t.fromAccount.owner_name}
            </span>
          )}
          <ArrowRight className="h-3 w-3 text-neutral-400" />
          <span className="font-medium text-neutral-900">
            {t.toAccount?.name ?? '-'}
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
            <Repeat className="h-2.5 w-2.5" />
            {RECURRENCE_LABEL_DA[t.recurrence]}
          </span>
        </div>
        {t.description && (
          <div className="mt-0.5 text-xs text-neutral-500">{t.description}</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="tabnum font-mono text-sm text-neutral-900">
          {formatAmount(t.amount)} kr
        </div>
        {t.recurrence !== 'monthly' && (
          <div className="mt-0.5 tabnum font-mono text-[10px] text-neutral-500">
            {formatAmount(t.monthly)} kr/md
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={`/overforsler/${t.id}`}
          aria-label="Rediger"
          className="inline-flex items-center justify-center rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <form action={deleteTransfer}>
          <input type="hidden" name="id" value={t.id} />
          <button
            type="submit"
            aria-label="Slet"
            className="inline-flex items-center justify-center rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Insights
// ----------------------------------------------------------------------------

type Insight = {
  kind: 'idle' | 'no-incoming-savings' | 'partner-imbalance';
  message: string;
  detail?: string;
};

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-medium">{insight.message}</div>
        {insight.detail && (
          <div className="mt-0.5 text-xs text-amber-800">{insight.detail}</div>
        )}
      </div>
    </div>
  );
}

function computeInsights(
  accounts: Account[],
  recurring: EnrichedTransfer[]
): Insight[] {
  const insights: Insight[] = [];

  // 1. Investerings/opsparingskonti uden indkomst (overførsel ind)
  const noIncomingSavings = accounts.filter((a) => {
    if (a.archived) return false;
    if (a.kind !== 'savings' && a.kind !== 'investment') return false;
    return !recurring.some((t) => t.toAccount?.id === a.id);
  });
  for (const a of noIncomingSavings.slice(0, 2)) {
    insights.push({
      kind: 'no-incoming-savings',
      message: `${a.name} har ingen månedlig overførsel ind`,
      detail:
        'Hvis I sparer op her hver måned, så sæt en fast overførsel op - så lægger pengene sig selv til side.',
    });
  }

  return insights.slice(0, 3);
}
