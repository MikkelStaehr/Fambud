// Den lille "AI hjælper" på dashboardet — finder underdækkede konti og
// foreslår handlinger. Den henter selv sine data så page.tsx ikke skal tænke
// over det; samme query (getCashflowGraph + getAccounts) genbruges af
// CashflowGraph i samme stack.

import Link from 'next/link';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { getAccounts, getCashflowGraph } from '@/lib/dal';
import { detectCashflowIssues } from '@/lib/cashflow-analysis';
import { formatAmount } from '@/lib/format';
import { CashflowGraph } from './CashflowGraph';

export async function CashflowAdvisor() {
  const [accounts, graph] = await Promise.all([
    getAccounts(),
    getCashflowGraph(),
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

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          <Sparkles className="h-3 w-3" />
          Cashflow-tjek
        </h2>
        <span className="text-xs text-neutral-400">
          {issues.length === 0
            ? 'Alt ser dækket ud'
            : `${issues.length} ${issues.length === 1 ? 'advarsel' : 'advarsler'}`}
        </span>
      </div>

      {issues.length === 0 ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Alle konti er dækket — indkomst og overførsler holder dine udgifter
          flydende. Hold øje med grafen nedenfor for at se hvor pengene løber.
        </div>
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
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
                        −{formatAmount(issue.deficit)} kr./md
                      </span>
                    )}
                    {issue.type === 'no-inflow' && (
                      <span className="tabnum font-mono text-xs font-normal text-amber-800">
                        Ud {formatAmount(issue.outflow)} kr./md, intet ind
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-amber-800">{issue.message}</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Forslag: {issue.suggestion}
                  </p>
                </div>
              </div>
              {/* Handlinger ligger under teksten på mobil (vandret), og som
                  en lodret stak til højre på sm+. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1">
                <Link
                  href="/overforsler/ny"
                  className="rounded-md bg-amber-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-amber-800"
                >
                  Opret overførsel
                </Link>
                <Link
                  href={`/budget/${issue.account.id}`}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900"
                >
                  Se udgifter
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <CashflowGraph
          accounts={visibleAccounts}
          graph={graph}
          deficitAccountIds={new Set(issues.map((i) => i.account.id))}
        />
      </div>
    </section>
  );
}
