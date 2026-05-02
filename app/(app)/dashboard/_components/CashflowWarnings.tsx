// Kompakt advarsels-liste til dashboardets tier-1 sektion. Tidligere var
// dette del af CashflowAdvisor som også indeholdt Sankey-grafen — men i den
// nye dashboard-struktur er warnings og graf adskilt så warnings kan stå i
// en tæt række ved siden af "Næste 7 dage". Sankey er nu sin egen tier
// længere nede.
//
// Komponenten er præsentations-only: den modtager fixes færdigberegnet fra
// page.tsx (som har lavet getAdvisorContext() + buildFixFor() én gang og
// deler resultatet). Det undgår dobbelt-fetch sammen med CashflowGraph.

import Link from 'next/link';
import { AlertTriangle, Sparkles, UserPlus } from 'lucide-react';
import { formatAmount } from '@/lib/format';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import type { CashflowFix, CashflowIssue } from '@/lib/cashflow-analysis';
import type { PendingMember } from '@/lib/dal';

type FixEntry = { issue: CashflowIssue; fix: CashflowFix };

type Props = {
  fixes: FixEntry[];
  pendingMembers: PendingMember[];
};

export function CashflowWarnings({
  fixes,
  pendingMembers,
}: Props) {
  const hasPending = pendingMembers.length > 0;
  const hasAnyAlert = fixes.length > 0;

  return (
    <section data-tour="cashflow-warnings">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          <Sparkles className="h-3 w-3" />
          Cashflow-tjek
          <InfoTooltip>
            Tjekker om hver konto har nok månedlig indtægt til at dække
            sine faste udgifter. For fælleskonti deles underskuddet ud på
            alle bidragydere og du ser kun din andel. Hver advarsel har en
            "Opret"-knap der pre-fylder en overførsel der lukker hullet.
          </InfoTooltip>
        </h2>
        <span className="text-xs text-neutral-400">
          {!hasAnyAlert
            ? 'Alt dækket'
            : `${fixes.length} ${
                fixes.length === 1 ? 'opmærksomhedspunkt' : 'opmærksomhedspunkter'
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

      {!hasAnyAlert ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Alt på din side er dækket.
        </div>
      ) : fixes.length === 0 ? null : (
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
    </section>
  );
}
