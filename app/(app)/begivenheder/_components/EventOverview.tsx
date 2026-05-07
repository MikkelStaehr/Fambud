// Read-only overblik øverst på begivenhedens detalje-side. Giver
// brugeren et hurtigt billede af status, fremdrift og deadline FØR de
// scroller ned i edit-formularen. Pendant til summary-cards på
// /begivenheder-listen, men med flere detaljer (aktuel månedlig
// opsparing, alert-banner) fordi vi har plads til det her.
//
// Rent præsentations-komponent: alle beregninger sker i parent-page
// så vi ikke fetcher data dobbelt.
//
// Ingen klient-state, men markeret 'use client' alligevel ikke - dette
// er en server-component. Ikoner fra lucide-react er server-safe.

import { AlertTriangle, Calendar, Wallet } from 'lucide-react';
import {
  formatAmount,
  formatShortDateDA,
  LIFE_EVENT_TIMEFRAME_LABEL_DA,
  type LifeEventAlert,
} from '@/lib/format';
import type { LifeEventWithItems } from '@/lib/dal';
import { ACCOUNT_KIND_LABEL_DA } from '@/lib/format';

type Props = {
  event: LifeEventWithItems;
  totalBudget: number | null;
  monthsRemaining: number | null;
  monthlyTarget: number | null;
  monthlyInflow: number | null;
  alert: LifeEventAlert | null;
};

export function EventOverview({
  event,
  totalBudget,
  monthsRemaining,
  monthlyTarget,
  monthlyInflow,
  alert,
}: Props) {
  const saldo = event.linked_account?.opening_balance ?? 0;
  const progressPct =
    totalBudget != null && totalBudget > 0
      ? Math.min(100, Math.round((saldo / totalBudget) * 100))
      : null;

  return (
    <section className="mt-6 rounded-md border border-neutral-200 bg-white p-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Overblik
      </h2>

      {/* Progress-bar: kun når der er en linked_account OG et budget */}
      {event.linked_account && totalBudget != null && totalBudget > 0 ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono tabnum text-sm text-neutral-900">
              <strong className="font-semibold">
                {formatAmount(saldo)} kr
              </strong>{' '}
              <span className="text-neutral-500">
                af {formatAmount(totalBudget)} kr
              </span>
            </span>
            <span className="text-sm font-semibold text-emerald-700">
              {progressPct}%
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full bg-emerald-700 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      ) : !event.linked_account ? (
        <p className="mt-3 text-sm text-neutral-500">
          Ingen tilknyttet konto endnu, så vi kan ikke vise fremdrift mod
          målet. Vælg en opsparingskonto under Detaljer for at komme i gang.
        </p>
      ) : null}

      {/* Stat-grid */}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-neutral-500">Deadline</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1 font-medium text-neutral-900">
            {event.target_date ? (
              <>
                <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                {formatShortDateDA(event.target_date)}
              </>
            ) : event.timeframe ? (
              LIFE_EVENT_TIMEFRAME_LABEL_DA[event.timeframe]
            ) : (
              <span className="text-neutral-400">Ikke sat</span>
            )}
          </dd>
          {monthsRemaining != null && monthsRemaining > 0 && (
            <dd className="text-[11px] text-neutral-500">
              ca. {monthsRemaining}{' '}
              {monthsRemaining === 1 ? 'måned tilbage' : 'måneder tilbage'}
            </dd>
          )}
        </div>

        <div>
          <dt className="text-xs text-neutral-500">Totalbudget</dt>
          <dd className="mt-0.5 font-mono tabnum font-semibold text-neutral-900">
            {totalBudget != null ? `${formatAmount(totalBudget)} kr` : '–'}
          </dd>
          {event.use_items_for_budget && (
            <dd className="text-[11px] text-neutral-500">
              Sum af {event.items.length}{' '}
              {event.items.length === 1 ? 'post' : 'poster'}
            </dd>
          )}
        </div>

        <div>
          <dt className="text-xs text-neutral-500">Krævet pr. måned</dt>
          <dd className="mt-0.5 font-mono tabnum font-semibold text-neutral-900">
            {monthlyTarget != null ? `${formatAmount(monthlyTarget)} kr` : '–'}
          </dd>
          {monthlyTarget == null && (
            <dd className="text-[11px] text-neutral-500">
              Mangler budget eller deadline
            </dd>
          )}
        </div>

        <div>
          <dt className="text-xs text-neutral-500">Aktuel pr. måned</dt>
          <dd className="mt-0.5 font-mono tabnum font-semibold text-neutral-900">
            {monthlyInflow != null
              ? `${formatAmount(monthlyInflow)} kr`
              : '–'}
          </dd>
          {monthlyInflow == null ? (
            <dd className="text-[11px] text-neutral-500">
              Ingen tilknyttet konto
            </dd>
          ) : monthlyInflow === 0 ? (
            <dd className="text-[11px] text-neutral-500">
              Ingen overførsler endnu
            </dd>
          ) : null}
        </div>
      </dl>

      {/* Tilknyttet konto */}
      {event.linked_account && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-stone-50 px-3 py-2 text-sm text-neutral-700">
          <Wallet className="h-3.5 w-3.5 text-neutral-400" />
          <span>
            Tilknyttet{' '}
            <strong className="font-medium text-neutral-900">
              {event.linked_account.name}
            </strong>{' '}
            <span className="text-neutral-500">
              ({ACCOUNT_KIND_LABEL_DA[event.linked_account.kind]})
            </span>
          </span>
        </div>
      )}

      {/* Alert-banner: agentens advarsel hvis den gælder. Samme tekst-
          mønster som dashboard-widget'en. */}
      {alert && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {alert.kind === 'no_account' && (
              <>
                <strong className="font-semibold">
                  Ingen tilknyttet konto endnu.
                </strong>{' '}
                Begivenheden står som idé indtil I linker en
                opsparingskonto under Detaljer.
              </>
            )}
            {alert.kind === 'no_budget' && (
              <>
                <strong className="font-semibold">Mangler budget.</strong> Sæt
                et totalbudget for at vi kan beregne en månedlig
                opsparingsrate.
              </>
            )}
            {alert.kind === 'underfunded' && (
              <>
                <strong className="font-semibold">
                  Sparer for lidt op til at nå målet.
                </strong>{' '}
                Aktuelt {formatAmount(alert.actual)} kr/md, men målet kræver{' '}
                {formatAmount(alert.required)} kr/md. Forskel:{' '}
                <strong className="font-semibold">
                  {formatAmount(alert.required - alert.actual)} kr/md
                </strong>
                .
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
