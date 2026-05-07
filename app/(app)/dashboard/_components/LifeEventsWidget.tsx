// Dashboard-widget: 1-3 nærmeste begivenheder med deadline, månedlig
// opsparingsrate og agent-alerts. Kun planning/active vises - completed
// og cancelled ekskluderes.
//
// Post-migration 0059: ingen saldo-baseret progress-bar. Vi viser
// "X måneder tilbage" som primært tids-signal og en alert per række
// hvis agenten finder et issue (no_budget / no_active_transfer /
// underfunded).
//
// Hvis der findes alerts på begivenheder der IKKE er blandt de 3
// viste, opsummeres det i header'en så agentens budskab ikke skjules.

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  Goal,
  Plus,
} from 'lucide-react';
import {
  formatAmount,
  formatShortDateDA,
  lifeEventAlert,
  lifeEventLiveStatus,
  lifeEventMonthlyTarget,
  lifeEventMonthsRemaining,
  lifeEventTotalBudget,
  LIFE_EVENT_TIMEFRAME_LABEL_DA,
  LIFE_EVENT_TYPE_LABEL_DA,
  type LifeEventAlert,
} from '@/lib/format';
import type { LifeEventWithItems } from '@/lib/dal';

type Props = {
  events: LifeEventWithItems[];
};

const MAX_EVENTS_ON_DASHBOARD = 3;

function buildAlert(event: LifeEventWithItems): LifeEventAlert | null {
  return lifeEventAlert(
    event,
    event.items,
    event.monthlyTotal,
    event.transfers.length
  );
}

function alertCopy(alert: LifeEventAlert): string {
  switch (alert.kind) {
    case 'no_budget':
      return 'Mangler budget';
    case 'no_active_transfer':
      return alert.required != null
        ? `Ingen overførsel opsat, forslag ${formatAmount(alert.required)} kr/md`
        : 'Ingen overførsel opsat endnu';
    case 'underfunded':
      return `Sparer ${formatAmount(alert.actual)} kr/md, mangler ${formatAmount(alert.required - alert.actual)} kr/md`;
  }
}

export function LifeEventsWidget({ events }: Props) {
  const active = events.filter((e) => {
    const live = lifeEventLiveStatus(e.status, e.transfers.length);
    return live === 'planning' || live === 'active';
  });
  const sorted = [...active].sort((a, b) => {
    const aMonths = lifeEventMonthsRemaining(a) ?? Infinity;
    const bMonths = lifeEventMonthsRemaining(b) ?? Infinity;
    return aMonths - bMonths;
  });
  const visible = sorted.slice(0, MAX_EVENTS_ON_DASHBOARD);
  const hidden = sorted.slice(MAX_EVENTS_ON_DASHBOARD);

  const hiddenAlertCount = hidden.reduce((count, event) => {
    return buildAlert(event) !== null ? count + 1 : count;
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
              const monthlyTarget = lifeEventMonthlyTarget(event, event.items);
              const alert = buildAlert(event);

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
                      ) : null}
                      {months != null && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {months} mdr tilbage
                        </span>
                      )}
                      {monthlyTarget != null && monthlyTarget > 0 && (
                        <span>
                          {formatAmount(monthlyTarget)} kr/md
                        </span>
                      )}
                    </div>

                    {alert && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{alertCopy(alert)}</span>
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
              <Link
                href="/begivenheder"
                className="underline hover:text-amber-900"
              >
                se alle
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
