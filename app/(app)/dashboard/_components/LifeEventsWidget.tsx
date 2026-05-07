// Dashboard-widget: 1-3 nærmeste begivenheder med progress, deadline og
// månedlig opsparingsrate. Viser kun planning/active - completed og
// cancelled ekskluderes. Sorteret efter deadline (target_date først,
// timeframe-bucket dernæst).
//
// Agent-alerts vises inline per række:
//   no_account     "Ikke tilknyttet en konto endnu"
//   no_budget      "Sæt et budget for at få månedlig opsparingsrate"
//   underfunded    "Sparer X kr/md, mangler Y kr/md for at nå målet"
//
// Hvis der findes alerts på begivenheder der IKKE er blandt de 3
// viste, opsummerer vi det i header'en ("+N flere har opmærksomheds-
// punkter") så agentens budskab ikke skjules af visuel limit.
//
// Empty state pumper brugeren mod /begivenheder/ny så feature'en bliver
// opdaget af nye brugere uden at de skal kende sidebaren.

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Calendar, Goal, Plus } from 'lucide-react';
import {
  formatAmount,
  formatShortDateDA,
  lifeEventAlert,
  lifeEventMonthsRemaining,
  lifeEventTotalBudget,
  LIFE_EVENT_TIMEFRAME_LABEL_DA,
  LIFE_EVENT_TYPE_LABEL_DA,
  type LifeEventAlert,
} from '@/lib/format';
import type { LifeEventWithItems } from '@/lib/dal';

type Props = {
  events: LifeEventWithItems[];
  // Map fra account_id -> månedlig nettotilstrømning (transfersIn) på
  // den konto. Bruges af lifeEventAlert til at detektere underfunded
  // events. Tom map er gyldig (giver ingen underfunded-alerts).
  accountInflows: Record<string, number>;
};

const MAX_EVENTS_ON_DASHBOARD = 3;

const ALERT_COPY: Record<LifeEventAlert['kind'], string> = {
  no_account: 'Ikke tilknyttet en konto - sparer ikke op endnu',
  no_budget: 'Sæt et budget for at få månedlig opsparingsrate',
  underfunded: '', // bygges per-event for at vise required vs actual
};

function buildAlert(
  event: LifeEventWithItems,
  accountInflows: Record<string, number>
): LifeEventAlert | null {
  const saldo = event.linked_account?.opening_balance ?? 0;
  const inflow = event.linked_account_id
    ? (accountInflows[event.linked_account_id] ?? 0)
    : null;
  return lifeEventAlert(event, event.items, saldo, inflow);
}

export function LifeEventsWidget({ events, accountInflows }: Props) {
  const active = events.filter(
    (e) => e.status === 'planning' || e.status === 'active'
  );
  const sorted = [...active].sort((a, b) => {
    const aMonths = lifeEventMonthsRemaining(a) ?? Infinity;
    const bMonths = lifeEventMonthsRemaining(b) ?? Infinity;
    return aMonths - bMonths;
  });
  const visible = sorted.slice(0, MAX_EVENTS_ON_DASHBOARD);
  const hidden = sorted.slice(MAX_EVENTS_ON_DASHBOARD);

  // Tæl alerts på SKJULTE events så header kan vise "+N flere har
  // opmærksomhedspunkter". Vi vil ikke at advisor-budskaber forsvinder
  // bare fordi widgeten har en visuel grænse på 3.
  const hiddenAlertCount = hidden.reduce((count, event) => {
    return buildAlert(event, accountInflows) !== null ? count + 1 : count;
  }, 0);

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          <Goal className="h-3 w-3" />
          Begivenheder
        </h3>
        <Link
          href="/begivenheder"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
        >
          Se alle
          <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-200 px-4 py-6 text-center">
          <p className="text-sm text-neutral-500">
            Ingen planlagte begivenheder. Tilføj jeres næste milepæl, fx
            konfirmation, bryllup eller en større rejse.
          </p>
          <Link
            href="/begivenheder/ny"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-neutral-900 hover:bg-neutral-50"
          >
            <Plus className="h-3 w-3" />
            Planlæg en
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-neutral-200">
            {visible.map((event) => {
              const budget = lifeEventTotalBudget(event, event.items);
              const months = lifeEventMonthsRemaining(event);
              const saldo = event.linked_account?.opening_balance ?? null;
              const progressPct =
                saldo != null && budget != null && budget > 0
                  ? Math.min(100, Math.round((saldo / budget) * 100))
                  : null;
              const monthlyTarget =
                budget != null && months != null && months > 0
                  ? Math.max(0, Math.ceil((budget - (saldo ?? 0)) / months))
                  : null;
              const alert = buildAlert(event, accountInflows);

              return (
                <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                  <Link
                    href={`/begivenheder/${event.id}`}
                    className="group block rounded-md transition hover:bg-neutral-50 -mx-2 px-2 py-1"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-neutral-900 group-hover:text-emerald-700">
                            {event.name}
                          </span>
                          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-700">
                            {LIFE_EVENT_TYPE_LABEL_DA[event.type]}
                          </span>
                        </div>
                      </div>
                      {budget != null && (
                        <span className="shrink-0 font-mono tabnum text-xs text-neutral-500">
                          {formatAmount(budget)} kr
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                      {event.target_date ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatShortDateDA(event.target_date)}
                        </span>
                      ) : event.timeframe ? (
                        <span>
                          {LIFE_EVENT_TIMEFRAME_LABEL_DA[event.timeframe]}
                        </span>
                      ) : (
                        <span className="italic">Ingen deadline</span>
                      )}
                      {monthlyTarget != null && monthlyTarget > 0 && (
                        <span>
                          {formatAmount(monthlyTarget)} kr/md for at nå målet
                        </span>
                      )}
                      {progressPct != null && (
                        <span className="font-medium text-emerald-700">
                          {progressPct}% nået
                        </span>
                      )}
                    </div>

                    {progressPct != null && (
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full bg-emerald-700"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}

                    {alert && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          {alert.kind === 'underfunded' ? (
                            <>
                              Sparer{' '}
                              <strong className="font-semibold">
                                {formatAmount(alert.actual)} kr/md
                              </strong>
                              , men har brug for{' '}
                              <strong className="font-semibold">
                                {formatAmount(alert.required)} kr/md
                              </strong>{' '}
                              for at nå målet
                            </>
                          ) : (
                            ALERT_COPY[alert.kind]
                          )}
                        </span>
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {hiddenAlertCount > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-amber-800">
              <AlertTriangle className="h-3 w-3" />
              {hiddenAlertCount}{' '}
              {hiddenAlertCount === 1
                ? 'yderligere begivenhed har opmærksomhedspunkter'
                : 'yderligere begivenheder har opmærksomhedspunkter'}
              {' - '}
              <Link href="/begivenheder" className="underline hover:text-amber-900">
                se alle
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
