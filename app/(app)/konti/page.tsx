import Link from 'next/link';
import { Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import {
  getAccounts,
  getAccountFlows,
  getCurrentUserId,
  shouldShowTour,
  type AccountFlow,
} from '@/lib/dal';
import { classifyAccountTrack, type AccountTrack } from '@/lib/cashflow-analysis';
import { KontiTour } from './_components/KontiTour';
import {
  ACCOUNT_KIND_LABEL_DA,
  INVESTMENT_TYPE_LABEL_DA,
  INVESTMENT_TYPE_CAP_DA,
  formatAmount,
} from '@/lib/format';
import { archiveAccount, restoreAccount } from './actions';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import type { Account, AccountKind } from '@/lib/database.types';

// /konti følger appens gennemgående røde tråd: konti deles i to spor,
// Privat og Fælles. Inden for hvert spor grupperes efter formål (daglig
// brug / opsparing / andet) så man hurtigt kan se hvad der hører hvor.
// Lån (kind='credit') vises ikke her; de bor på /laan og linkes nederst.
const TRACKS: {
  track: Exclude<AccountTrack, 'other'>;
  label: string;
  description: string;
  badgeClass: string;
  borderClass: string;
}[] = [
  {
    track: 'privat',
    label: 'Privat',
    description: 'Dine egne konti',
    badgeClass: 'bg-emerald-700',
    borderClass: 'border-emerald-200',
  },
  {
    track: 'faelles',
    label: 'Fælles',
    description: 'Husstandens delte konti',
    badgeClass: 'bg-amber-700',
    borderClass: 'border-amber-200',
  },
];

const PURPOSE_GROUPS: {
  key: string;
  label: string;
  kinds: AccountKind[];
}[] = [
  { key: 'daily', label: 'Daglig brug', kinds: ['checking', 'budget', 'household', 'cash'] },
  { key: 'savings', label: 'Opsparing & investering', kinds: ['savings', 'investment'] },
  { key: 'other', label: 'Andet', kinds: ['other'] },
];

export default async function KontiPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const showArchived = sp.archived === '1';
  const [accounts, flows, currentUserId, autoStartTour] = await Promise.all([
    getAccounts({ includeArchived: showArchived }),
    getAccountFlows(),
    getCurrentUserId(),
    shouldShowTour('konti'),
  ]);

  // Lån filtreres ud af sektionerne - de bor på /laan. Vi tæller dem alligevel
  // så vi kan vise et lille link nederst når der findes lån i husstanden.
  const loanCount = accounts.filter((a) => a.kind === 'credit').length;
  const nonLoan = accounts.filter((a) => a.kind !== 'credit');

  // Skil arkiverede ud så de ikke spreder sig ind i de aktive grupper, men
  // får deres egen sektion sidst når flaget er sat.
  const activeAccounts = nonLoan.filter((a) => !a.archived);
  const archivedAccounts = nonLoan.filter((a) => a.archived);

  // Klassificér aktive konti i Privat / Fælles (samme regel som dashboardet).
  // 'other' = partnerens private konti; de vises ikke i mit overblik.
  const accountsByTrack = (track: Exclude<AccountTrack, 'other'>) =>
    activeAccounts.filter((a) => classifyAccountTrack(a, currentUserId) === track);
  const shownCount = TRACKS.reduce(
    (sum, t) => sum + accountsByTrack(t.track).length,
    0
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <KontiTour autoStart={autoStartTour} />
      <header className="flex items-center justify-between border-b border-neutral-200 pb-6">
        <div>
          <h1 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Konti
            <InfoTooltip>
              <span className="font-semibold text-neutral-900">Privat</span> er
              dine egne konti - kun du ser dem og deres forbrug.{' '}
              <span className="font-semibold text-neutral-900">Fælles</span> er
              husstandens delte konti (budget, husholdning, buffer) som I begge
              ser og bidrager til. Jeres indkomst er synlig for hinanden, men
              privat forbrug bliver mellem jer hver især.
            </InfoTooltip>
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {shownCount} {shownCount === 1 ? 'konto' : 'konti'}
            {showArchived && archivedAccounts.length > 0
              ? ` · ${archivedAccounts.length} arkiveret`
              : ''}
            {loanCount > 0
              ? ` · ${loanCount} ${loanCount === 1 ? 'lån' : 'lån'} på låneoversigten`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={showArchived ? '/konti' : '/konti?archived=1'}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            {showArchived ? 'Skjul arkiverede' : 'Vis arkiverede'}
          </Link>
          <Link
            href="/konti/ny"
            data-tour="konti-new"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Ny konto
          </Link>
        </div>
      </header>

      <div data-tour="konti-sections" className="mt-6 space-y-8">
        {TRACKS.map((t) => {
          const trackAccounts = accountsByTrack(t.track);
          return (
            <section key={t.track}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white ${t.badgeClass}`}
                  >
                    {t.label}
                  </span>
                  <span className="text-sm font-medium text-neutral-900">
                    {t.description}
                  </span>
                </div>
                <Link
                  href="/konti/ny"
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <Plus className="h-3 w-3" />
                  Tilføj
                </Link>
              </div>

              {trackAccounts.length === 0 ? (
                <div className={`overflow-hidden rounded-md border ${t.borderClass} bg-white px-4 py-6 text-center text-sm text-neutral-400`}>
                  {t.track === 'privat'
                    ? 'Ingen private konti endnu'
                    : 'Ingen fælleskonti endnu'}
                </div>
              ) : (
                <div className="space-y-4">
                  {PURPOSE_GROUPS.map((g) => {
                    const inGroup = trackAccounts.filter((a) =>
                      g.kinds.includes(a.kind)
                    );
                    if (inGroup.length === 0) return null;
                    return (
                      <div key={g.key}>
                        <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                          {g.label}
                        </h3>
                        <div className={`overflow-hidden rounded-md border ${t.borderClass} bg-white`}>
                          <ul className="divide-y divide-neutral-100">
                            {inGroup.map((a) => (
                              <li key={a.id}>
                                <AccountRow account={a} flow={flows.get(a.id)} />
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {showArchived && archivedAccounts.length > 0 && (
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Arkiverede konti
            </h2>
            <p className="mt-0.5 text-xs text-neutral-400">
              Skjult fra dashboard og budget
            </p>
            <div className="mt-2 overflow-hidden rounded-md border border-neutral-200 bg-white">
              <table className="w-full">
                <tbody>
                  {archivedAccounts.map((a) => (
                    <AccountRow key={a.id} account={a} flow={flows.get(a.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {loanCount > 0 && (
          <p className="text-sm text-neutral-500">
            Du har {loanCount} {loanCount === 1 ? 'lån' : 'lån'} - se{' '}
            <Link href="/laan" className="underline hover:text-neutral-900">
              låneoversigten
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

function AccountRow({
  account: a,
  flow,
}: {
  account: Account;
  flow: AccountFlow | undefined;
}) {
  const income = flow?.income ?? 0;
  const transfersIn = flow?.transfersIn ?? 0;
  const expense = flow?.expense ?? 0;
  const transfersOut = flow?.transfersOut ?? 0;
  const inAmount = income + transfersIn;
  const outAmount = expense + transfersOut;
  const hasFlow = inAmount > 0 || outAmount > 0;
  // Net flow: positive = overskud, negative = underskud. Vi viser kun
  // net-linjen når BÅDE in og out er > 0 (typisk daglig-brug-konti).
  // Rene opsparings-konti har kun in og skal ikke have net-linje.
  const hasBothFlows = inAmount > 0 && outAmount > 0;
  const net = inAmount - outAmount;
  const isDeficit = hasBothFlows && net < 0;
  const isSurplus = hasBothFlows && net > 0;
  return (
    <div
      // border-l-4 reserveres altid (transparent) så rækker med og uden
      // underskud-markør har samme indrykning. Underskud-rækker får
      // amber-tinted border for at kunne spottes ved scrolling.
      className={`flex flex-col gap-3 border-l-4 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${
        isDeficit ? 'border-l-amber-500' : 'border-l-transparent'
      } ${a.archived ? 'opacity-60' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-neutral-900">
          <span className="truncate">{a.name}</span>
          {a.archived && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-normal text-neutral-500">
              Arkiveret
            </span>
          )}
          {a.kind === 'investment' && a.investment_type && (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-900">
              {INVESTMENT_TYPE_LABEL_DA[a.investment_type]}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
          <span>{ACCOUNT_KIND_LABEL_DA[a.kind] ?? a.kind}</span>
          {a.owner_name && (
            <>
              <span className="text-neutral-300">·</span>
              <span>{a.owner_name}</span>
            </>
          )}
          {a.kind === 'investment' && a.investment_type && INVESTMENT_TYPE_CAP_DA[a.investment_type] && (
            <>
              <span className="text-neutral-300">·</span>
              <span className="text-amber-700">
                {INVESTMENT_TYPE_CAP_DA[a.investment_type]}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Flow + handlinger på samme række på mobil (under info), separat højre-
          stak på sm+. */}
      <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
        {hasFlow ? (
          <div className="flex flex-col items-start gap-0.5 text-xs sm:items-end">
            {inAmount > 0 && (
              <span className="tabnum font-mono text-emerald-700">
                Ind +{formatAmount(inAmount)} kr
              </span>
            )}
            {/* "Ud" splittet i to: faste udgifter (forbrug) og overførsler
                til andre konti (flytning af egne penge). Det er to vidt
                forskellige ting og blev tidligere lagt sammen til ét
                misvisende "Ud"-tal. */}
            {expense > 0 && (
              <span className="tabnum font-mono text-red-700">
                Udgifter −{formatAmount(expense)} kr
              </span>
            )}
            {transfersOut > 0 && (
              <span className="tabnum font-mono text-neutral-500">
                Overført −{formatAmount(transfersOut)} kr
              </span>
            )}
            {hasBothFlows && (
              <span
                className={`tabnum font-mono text-[11px] font-semibold ${
                  isSurplus ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {isSurplus
                  ? `+${formatAmount(net)} kr overskud`
                  : `−${formatAmount(Math.abs(net))} kr underskud`}
              </span>
            )}
            <span className="text-[10px] text-neutral-400">/ måned</span>
          </div>
        ) : (
          <span className="text-xs text-neutral-400">Ingen flow</span>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/konti/${a.id}`}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            title="Rediger"
            aria-label={`Rediger ${a.name}`}
          >
            <Pencil className="h-3 w-3" />
            <span className="hidden sm:inline">Rediger</span>
          </Link>
          {a.archived ? (
            <form action={restoreAccount}>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                aria-label={`Gendan ${a.name}`}
              >
                <ArchiveRestore className="h-3 w-3" />
                <span className="hidden sm:inline">Gendan</span>
              </button>
            </form>
          ) : (
            <form action={archiveAccount}>
              <input type="hidden" name="id" value={a.id} />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                aria-label={`Arkivér ${a.name}`}
              >
                <Archive className="h-3 w-3" />
                <span className="hidden sm:inline">Arkivér</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
