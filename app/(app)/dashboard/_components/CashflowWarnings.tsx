// Kompakt advarsels-liste til dashboardets tier-1 sektion. Tidligere var
// dette del af CashflowAdvisor som også indeholdt Sankey-grafen - men i den
// nye dashboard-struktur er warnings og graf adskilt så warnings kan stå i
// en tæt række ved siden af "Næste 7 dage". Sankey er nu sin egen tier
// længere nede.
//
// To slags advarsler:
//   1. ACTIONABLE FIXES - issues hvor brugeren selv kan oprette en
//      overførsel der lukker hullet (egen konto, eller fælles-konto hvor
//      brugerens andel ikke er fuldt dækket endnu). Vises med Opret-knap.
//   2. OBJECTIVE DEFICITS - issues hvor brugerens egen andel ER dækket,
//      men kontoen samlet set stadig er i underskud. Typisk fordi partner
//      ikke har sat sin halvdel op. Vises med diagnostisk forklaring,
//      ingen Opret-knap (brugeren kan ikke selv fixe det).
//
// Komponenten er præsentations-only: alt data kommer pre-beregnet fra
// page.tsx.

import Link from 'next/link';
import { AlertTriangle, Sparkles, UserPlus } from 'lucide-react';
import { formatAmount } from '@/lib/format';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import type {
  CashflowFix,
  CashflowIssue,
  DeficitReason,
} from '@/lib/cashflow-analysis';
import type { PendingMember } from '@/lib/dal';

type FixEntry = { issue: CashflowIssue; fix: CashflowFix };
type ObjectiveDeficit = { issue: CashflowIssue; reason: DeficitReason };

type Props = {
  fixes: FixEntry[];
  objectiveDeficits: ObjectiveDeficit[];
  pendingMembers: PendingMember[];
};

export function CashflowWarnings({
  fixes,
  objectiveDeficits,
  pendingMembers,
}: Props) {
  const hasPending = pendingMembers.length > 0;
  const hasFixes = fixes.length > 0;
  const hasObjectiveDeficits = objectiveDeficits.length > 0;
  const totalIssues = fixes.length + objectiveDeficits.length;
  const hasAnyAlert = totalIssues > 0;

  return (
    <section data-tour="cashflow-warnings">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          <Sparkles className="h-3 w-3" />
          Cashflow-tjek
          <InfoTooltip>
            Tjekker om hver konto har nok månedlig indtægt til at dække
            sine faste udgifter. For fælleskonti deles underskuddet ud på
            alle bidragydere - hvis din egen halvdel er dækket men
            husstanden stadig har underskud, ser du en diagnostisk
            forklaring.
          </InfoTooltip>
        </h2>
        <span className="text-xs text-neutral-400">
          {!hasAnyAlert
            ? 'Alt dækket'
            : `${totalIssues} ${
                totalIssues === 1 ? 'opmærksomhedspunkt' : 'opmærksomhedspunkter'
              }`}
        </span>
      </div>

      {hasPending && (
        <div className="mb-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <UserPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <span className="font-medium">
              {pendingMembers.map((m) => m.name).join(', ')} er pre-godkendt men
              endnu ikke oprettet.
            </span>{' '}
            Tjekket viser kun din andel af fælles-konti.
          </div>
        </div>
      )}

      {!hasAnyAlert && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Alt på din side er dækket.
        </div>
      )}

      {/* Actionable fixes - du kan selv lukke hullet */}
      {hasFixes && (
        <ul className="overflow-hidden rounded-md border border-amber-200 bg-amber-50 divide-y divide-amber-100">
          {fixes.map(({ issue, fix }) => {
            const prefilledHref =
              `/overforsler/ny?from=${encodeURIComponent(fix.fromAccountId)}` +
              `&to=${encodeURIComponent(fix.toAccountId)}` +
              `&amount=${(fix.amountOere / 100).toFixed(2)}` +
              `&recurrence=monthly` +
              `&description=${encodeURIComponent('Til ' + fix.toAccountName)}`;
            const isPartial = fix.share === 'partial';
            return (
              <li
                key={issue.account.id + issue.type}
                className="flex items-start gap-3 px-3 py-2.5"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-amber-900">
                    <span className="truncate">{issue.account.name}</span>
                    <span className="tabnum font-mono text-xs font-normal text-amber-800">
                      −{formatAmount(fix.totalDeficit)} kr/md
                      {isPartial && (
                        <span className="text-amber-700"> (din 1/{fix.numContributors})</span>
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-amber-800">
                    Foreslået: overfør{' '}
                    <span className="tabnum font-mono font-medium">
                      {formatAmount(fix.amountOere)} kr
                    </span>{' '}
                    fra {fix.fromAccountName}
                  </p>
                </div>
                <Link
                  href={prefilledHref}
                  className="shrink-0 self-center rounded-md bg-amber-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-amber-800"
                >
                  Opret
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Objective deficits - husstands-niveau, brugeren kan ikke selv lukke */}
      {hasObjectiveDeficits && (
        <div className={hasFixes ? 'mt-2' : ''}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
            Husstanden har underskud
          </p>
          <ul className="overflow-hidden rounded-md border border-amber-200 bg-amber-50 divide-y divide-amber-100">
            {objectiveDeficits.map(({ issue, reason }) => {
              const deficit =
                issue.type === 'deficit' ? issue.deficit : issue.outflow;
              return (
                <li
                  key={issue.account.id + issue.type}
                  className="flex items-start gap-3 px-3 py-2.5"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-amber-900">
                      <span className="truncate">{issue.account.name}</span>
                      <span className="tabnum font-mono text-xs font-normal text-amber-800">
                        −{formatAmount(deficit)} kr/md
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                      <DiagnosticCopy reason={reason} accountName={issue.account.name} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

// Diagnostic-copy renderer - omsætter DeficitReason til menneskelæselig
// forklaring der hjælper brugeren forstå hvad der skal til.
function DiagnosticCopy({
  reason,
  accountName,
}: {
  reason: DeficitReason;
  accountName: string;
}) {
  void accountName;
  if (reason.kind === 'pending_member') {
    const names = reason.memberNames.join(', ');
    const verb = reason.memberNames.length === 1 ? 'har' : 'har';
    return (
      <>
        Din egen andel er dækket, men{' '}
        <strong className="font-semibold">{names}</strong> {verb} endnu
        ikke sat overførsler op. Når de gennemfører deres wizard kan de
        bidrage med deres del af de fælles udgifter.
      </>
    );
  }
  return (
    <>
      Din egen andel er dækket, men husstandens samlede overførsler er
      stadig under udgifterne. I kan øge en eksisterende månedlig
      overførsel eller skære ned på faste udgifter på kontoen.
    </>
  );
}
