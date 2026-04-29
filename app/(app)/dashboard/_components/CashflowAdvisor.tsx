// Den lille "AI hjælper" på dashboardet — finder underdækkede konti og
// foreslår en konkret overførsel der løser problemet (kilde, beløb, månedlig).
//
// Forslaget er per-bruger-personligt:
//   - For personlige konti: hele underskuddet
//   - For fælles-konti: kun den indloggede brugers manglende andel.
//     Hvis Mikkel og Louise begge er medlemmer (eller en af dem er pre-
//     godkendt), splittes 50/50. Når Mikkel har lagt sin halvdel ind,
//     forsvinder advarslen for ham — Louise ser sin egen halvdel når
//     hun logger ind.
//
// Klik på "Opret denne overførsel" lander brugeren på /overforsler/ny med
// alt pre-udfyldt — ét klik på "Opret" og det er gjort.

import Link from 'next/link';
import { AlertTriangle, Sparkles, UserPlus, Wand2 } from 'lucide-react';
import { getAccounts, getAdvisorContext, getCashflowGraph } from '@/lib/dal';
import { buildFixFor, detectCashflowIssues } from '@/lib/cashflow-analysis';
import { formatAmount } from '@/lib/format';
import { CashflowGraph } from './CashflowGraph';

export async function CashflowAdvisor() {
  const [accounts, graph, ctx] = await Promise.all([
    getAccounts(),
    getCashflowGraph(),
    getAdvisorContext(),
  ]);

  const issues = detectCashflowIssues(accounts, graph.perAccount);
  const visibleAccounts = accounts.filter(
    (a) => !a.archived && a.kind !== 'credit'
  );

  // Tom tilstand: hvis der hverken er konti eller flow at vise, dropper vi
  // hele sektionen — dashboard har en separat onboarding-CTA der dækker det.
  if (visibleAccounts.length === 0 && graph.edges.length === 0) {
    return null;
  }

  // Beregn fix-forslag pr. issue. buildFixFor filtrerer dem ud hvor den
  // indloggede brugers andel allerede er dækket (returnerer null) — typisk
  // når en partner skal lave sin egen halvdel.
  const fixes = issues
    .map((issue) => ({ issue, fix: buildFixFor(issue, accounts, graph.perAccount, ctx) }))
    .filter((entry) => entry.fix !== null) as {
    issue: typeof issues[number];
    fix: NonNullable<ReturnType<typeof buildFixFor>>;
  }[];

  const hasPending = ctx.pendingMembers.length > 0;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          <Sparkles className="h-3 w-3" />
          Cashflow-tjek
        </h2>
        <span className="text-xs text-neutral-400">
          {fixes.length === 0
            ? 'Alt ser dækket ud'
            : `${fixes.length} ${fixes.length === 1 ? 'forslag' : 'forslag'}`}
        </span>
      </div>

      {/* Banner når én eller flere familiemedlemmer er pre-godkendte men
          endnu ikke har oprettet sig. Forklarer at billedet er ufuldstændigt
          og at deres andel af fælles-udgifterne tilkommer dem selv. */}
      {hasPending && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <UserPlus className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <span className="font-medium">
              {ctx.pendingMembers.map((m) => m.name).join(', ')}{' '}
              {ctx.pendingMembers.length === 1 ? 'er' : 'er'} pre-godkendt men
              endnu ikke oprettet.
            </span>{' '}
            Cashflow-tjekket viser kun din andel af fælles-konti — resten
            beregner sig selv når{' '}
            {ctx.pendingMembers.length === 1 ? 'hun/han' : 'de'} signer up.
          </div>
        </div>
      )}

      {fixes.length === 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Alt på din side er dækket — indkomst og overførsler holder dine
          forpligtelser flydende. Hold øje med grafen nedenfor for at se hvor
          pengene løber.
        </div>
      ) : (
        <div className="space-y-2">
          {fixes.map(({ issue, fix }) => {
            const prefilledHref =
              `/overforsler/ny?from=${encodeURIComponent(fix.fromAccountId)}` +
              `&to=${encodeURIComponent(fix.toAccountId)}` +
              `&amount=${(fix.amountOere / 100).toFixed(2)}` +
              `&recurrence=monthly` +
              `&description=${encodeURIComponent('Til ' + fix.toAccountName)}`;

            const isPartial = fix.share === 'partial';

            return (
              <div
                key={issue.account.id + issue.type}
                className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start"
              >
                <div className="flex items-start gap-3 sm:flex-1">
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-amber-900">
                      <span>{issue.account.name}</span>
                      {issue.type === 'deficit' && (
                        <span className="tabnum font-mono text-xs font-normal text-amber-800">
                          −{formatAmount(fix.totalDeficit)} kr./md i alt
                        </span>
                      )}
                      {issue.type === 'no-inflow' && (
                        <span className="tabnum font-mono text-xs font-normal text-amber-800">
                          Ud {formatAmount(fix.totalDeficit)} kr./md, intet ind
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-amber-800">
                      {issue.message}
                    </p>
                    <p className="mt-1.5 inline-flex items-baseline gap-1 text-xs text-amber-900">
                      <Wand2 className="h-3 w-3 self-center" />
                      <span>
                        {isPartial ? (
                          <>
                            Foreslået fix:{' '}
                            <span className="font-medium">
                              månedlig overførsel på{' '}
                              <span className="tabnum font-mono">
                                {formatAmount(fix.amountOere)} kr
                              </span>{' '}
                              fra {fix.fromAccountName}
                            </span>
                            <span className="text-amber-700">
                              {' '}
                              (din 1/{fix.numContributors}
                              -andel — resten dækker{' '}
                              {fix.numContributors === 2 ? 'din partner' : 'de andre'})
                            </span>
                          </>
                        ) : (
                          <>
                            Foreslået fix:{' '}
                            <span className="font-medium">
                              månedlig overførsel på{' '}
                              <span className="tabnum font-mono">
                                {formatAmount(fix.amountOere)} kr
                              </span>{' '}
                              fra {fix.fromAccountName}
                            </span>
                          </>
                        )}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1">
                  <Link
                    href={prefilledHref}
                    className="rounded-md bg-amber-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-amber-800"
                  >
                    Opret denne overførsel
                  </Link>
                  <Link
                    href={`/budget/${issue.account.id}`}
                    className="text-xs font-medium text-amber-700 hover:text-amber-900"
                  >
                    Se udgifter
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <CashflowGraph
          accounts={visibleAccounts}
          graph={graph}
          deficitAccountIds={new Set(fixes.map((f) => f.issue.account.id))}
        />
      </div>
    </section>
  );
}
