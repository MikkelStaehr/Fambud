// /begivenheder - observationssiden.
//
// Liste over alle planlagte og aktive begivenheder med deadline,
// månedlig opsparingsrate og evt. agent-alert. CRUD-handlinger
// (oprettelse, redigering, poster) lever på detalje-siden / "Værktøjer"-
// menuen, ikke her.
//
// Post-migration 0059: vi viser ikke længere saldo/progress baseret på
// kontosaldo. Status og opsparing trackes via overførsler tied til
// event'et.

import Link from 'next/link';
import { Plus, Pencil, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { getLifeEvents } from '@/lib/dal';
import {
  formatAmount,
  formatShortDateDA,
  lifeEventAlert,
  lifeEventLiveStatus,
  lifeEventMonthlyTarget,
  lifeEventMonthsRemaining,
  lifeEventTotalBudget,
  LIFE_EVENT_STATUS_LABEL_DA,
  LIFE_EVENT_TIMEFRAME_LABEL_DA,
  LIFE_EVENT_TYPE_LABEL_DA,
} from '@/lib/format';
import type { LifeEventStatus } from '@/lib/database.types';

const STATUS_BADGE_CLASS: Record<LifeEventStatus, string> = {
  planning: 'bg-neutral-100 text-neutral-700',
  active: 'bg-emerald-50 text-emerald-800',
  completed: 'bg-blue-50 text-blue-800',
  cancelled: 'bg-amber-50 text-amber-800',
};

export default async function BegivenhederPage() {
  const events = await getLifeEvents();

  // Total budget på tværs af aktive (ikke-aflyste, ikke-gennemførte) for
  // header-tælleren. Bruger live status så terminale events ekskluderes.
  const activeEvents = events.filter((e) => {
    const live = lifeEventLiveStatus(e.status, e.transfers.length);
    return live === 'planning' || live === 'active';
  });
  const totalBudget = activeEvents.reduce((sum, e) => {
    const budget = lifeEventTotalBudget(e, e.items);
    return sum + (budget ?? 0);
  }, 0);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Begivenheder
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {events.length === 0
              ? 'Ingen begivenheder endnu'
              : `${activeEvents.length} aktive · ${formatAmount(totalBudget)} kr i samlet budget`}
          </p>
        </div>
        <Link
          href="/begivenheder/ny"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Ny begivenhed
        </Link>
      </header>

      {events.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">
            Ingen begivenheder endnu. Tilføj jeres planlagte konfirmationer,
            bryllupper, rejser eller boligkøb her, så har I budget,
            deadline og fremdrift samlet ét sted.
          </p>
          <Link
            href="/begivenheder/ny"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Tilføj jeres første
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {events.map((event) => {
            const liveStatus = lifeEventLiveStatus(
              event.status,
              event.transfers.length
            );
            const budget = lifeEventTotalBudget(event, event.items);
            const months = lifeEventMonthsRemaining(event);
            const monthlyTarget = lifeEventMonthlyTarget(event, event.items);
            const alert = lifeEventAlert(
              event,
              event.items,
              event.monthlyTotal,
              event.transfers.length
            );

            return (
              <div
                key={event.id}
                className="rounded-md border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-neutral-900">
                        {event.name}
                      </span>
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                        {LIFE_EVENT_TYPE_LABEL_DA[event.type]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[liveStatus]}`}
                      >
                        {LIFE_EVENT_STATUS_LABEL_DA[liveStatus]}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/begivenheder/${event.id}`}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                    >
                      <Pencil className="h-3 w-3" />
                      Åbn
                    </Link>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-neutral-500">Budget</dt>
                    <dd className="font-mono tabnum text-sm font-semibold text-neutral-900">
                      {budget != null ? `${formatAmount(budget)} kr` : '–'}
                    </dd>
                    {event.use_items_for_budget && (
                      <dd className="text-[11px] text-neutral-500">
                        Sum af {event.items.length}{' '}
                        {event.items.length === 1 ? 'post' : 'poster'}
                      </dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-neutral-500">Deadline</dt>
                    <dd className="inline-flex items-center gap-1 text-sm text-neutral-700">
                      {event.target_date ? (
                        <>
                          <Calendar className="h-3 w-3 text-neutral-400" />
                          {formatShortDateDA(event.target_date)}
                        </>
                      ) : event.timeframe ? (
                        LIFE_EVENT_TIMEFRAME_LABEL_DA[event.timeframe]
                      ) : (
                        <span className="text-neutral-400">Ikke sat</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Måneder tilbage</dt>
                    <dd className="inline-flex items-center gap-1 font-mono tabnum text-sm font-semibold text-neutral-900">
                      <Clock className="h-3 w-3 text-neutral-400" />
                      {months != null ? months : '–'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Pr. måned</dt>
                    <dd className="font-mono tabnum text-sm text-neutral-700">
                      {monthlyTarget != null
                        ? `${formatAmount(monthlyTarget)} kr`
                        : '–'}
                    </dd>
                    {event.transfers.length > 0 && (
                      <dd className="text-[11px] text-neutral-500">
                        Aktuelt {formatAmount(event.monthlyTotal)} kr/md
                      </dd>
                    )}
                  </div>
                </dl>

                {alert && (
                  <div className="mt-3 inline-flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      {alert.kind === 'no_budget' && 'Mangler budget'}
                      {alert.kind === 'no_active_transfer' && (
                        <>
                          Ingen overførsel opsat
                          {alert.required != null && (
                            <>
                              , forslag: {formatAmount(alert.required)} kr/md
                            </>
                          )}
                        </>
                      )}
                      {alert.kind === 'underfunded' && (
                        <>
                          Sparer {formatAmount(alert.actual)} kr/md, mangler{' '}
                          {formatAmount(alert.required - alert.actual)} kr/md
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
