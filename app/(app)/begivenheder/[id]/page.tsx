// /begivenheder/[id] - detalje + redigering + linje-poster.
//
// Layout:
//   - Header med navn + status-pille + back-link
//   - EventOverview (read-only) med deadline, månedsrate, transfer-status,
//     agent-alert + "Opsæt overførsel"-CTA
//   - Status-actions (Markér gennemført / Aflys / Genåbn)
//   - Hovedformular (EventForm) til metadata
//   - Items-sektion (ItemList) til linje-poster
//   - Farezone (slet)

import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  getAdvisorContext,
  getLifeEventById,
} from '@/lib/dal';
import {
  formatOereForInput,
  lifeEventAlert,
  lifeEventLiveStatus,
  lifeEventMonthlyTarget,
  lifeEventMonthsRemaining,
  lifeEventTotalBudget,
  LIFE_EVENT_STATUS_LABEL_DA,
  LIFE_EVENT_TYPE_LABEL_DA,
} from '@/lib/format';
import { EventForm } from '../_components/EventForm';
import { EventOverview } from '../_components/EventOverview';
import { ItemList } from '../_components/ItemList';
import {
  addLifeEventItem,
  deleteLifeEvent,
  deleteLifeEventItem,
  reopenLifeEvent,
  setLifeEventStatus,
  updateLifeEvent,
  updateLifeEventItem,
} from '../actions';
import type { LifeEventStatus } from '@/lib/database.types';

const STATUS_BADGE_CLASS: Record<LifeEventStatus, string> = {
  planning: 'bg-neutral-100 text-neutral-700',
  active: 'bg-emerald-50 text-emerald-800',
  completed: 'bg-blue-50 text-blue-800',
  cancelled: 'bg-amber-50 text-amber-800',
};

// Bygger pre-fill-URL til /overforsler/ny baseret på event'ets monthly
// target og husstandens numContributors. Hvis det er en 50/50 separat-
// økonomi-husstand, foreslås halvdelen ("din andel") - matcher
// CashflowAdvisor's "partial share"-mønster.
function buildSetupTransferHref(
  eventId: string,
  monthlyTarget: number | null,
  numContributors: number,
  eventName: string
): string {
  const params = new URLSearchParams({
    life_event_id: eventId,
    recurrence: 'monthly',
    description: eventName,
  });
  if (monthlyTarget != null) {
    const share = Math.ceil(monthlyTarget / Math.max(1, numContributors));
    params.set('amount', formatOereForInput(share));
  }
  return `/overforsler/ny?${params.toString()}`;
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [event, advisorCtx] = await Promise.all([
    getLifeEventById(id),
    getAdvisorContext(),
  ]);

  const updateAction = updateLifeEvent.bind(null, id);
  const addItemAction = addLifeEventItem.bind(null, id);

  const totalBudget = lifeEventTotalBudget(event, event.items);
  const monthsRemaining = lifeEventMonthsRemaining(event);
  const monthlyTarget = lifeEventMonthlyTarget(event, event.items);
  const alert = lifeEventAlert(
    event,
    event.items,
    event.monthlyTotal,
    event.transfers.length
  );
  const liveStatus = lifeEventLiveStatus(event.status, event.transfers.length);
  const isTerminal =
    liveStatus === 'completed' || liveStatus === 'cancelled';

  const setupTransferHref = buildSetupTransferHref(
    event.id,
    monthlyTarget,
    advisorCtx.numContributors,
    event.name
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/begivenheder"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til begivenheder
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            {event.name}
          </h1>
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
            {LIFE_EVENT_TYPE_LABEL_DA[event.type]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[liveStatus]}`}
          >
            {LIFE_EVENT_STATUS_LABEL_DA[liveStatus]}
          </span>
        </div>
        {event.notes && (
          <p className="mt-2 text-sm text-neutral-600">{event.notes}</p>
        )}
      </header>

      {/* Overblik - read-only stats + alert + CTA */}
      <EventOverview
        event={event}
        totalBudget={totalBudget}
        monthsRemaining={monthsRemaining}
        monthlyTarget={monthlyTarget}
        alert={alert}
        setupTransferHref={setupTransferHref}
      />

      {/* Status-actions: terminale skift (Aflys / Markér gennemført) +
          Genåbn fra terminal state. Live status (planning vs active)
          beregnes ellers fra antal recurring transfers. */}
      <section className="mt-6 flex flex-wrap items-center gap-2">
        {!isTerminal && (
          <>
            <form action={setLifeEventStatus}>
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="status" value="completed" />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                Markér som gennemført
              </button>
            </form>
            <form action={setLifeEventStatus}>
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="status" value="cancelled" />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <XCircle className="h-4 w-4" />
                Aflys
              </button>
            </form>
          </>
        )}
        {isTerminal && (
          <form action={reopenLifeEvent}>
            <input type="hidden" name="id" value={event.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <RotateCcw className="h-4 w-4" />
              Genåbn
            </button>
          </form>
        )}
      </section>

      {/* Hovedform til metadata */}
      <section className="mt-6 max-w-2xl">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Detaljer
        </h2>
        <EventForm
          action={updateAction}
          defaultValues={{
            name: event.name,
            type: event.type,
            total_budget: event.total_budget,
            use_items_for_budget: event.use_items_for_budget,
            target_date: event.target_date,
            timeframe: event.timeframe,
            notes: event.notes,
          }}
          submitLabel="Gem ændringer"
          cancelHref="/begivenheder"
          error={error}
        />
      </section>

      {/* Items-sektion */}
      <section className="mt-10 max-w-3xl">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Poster
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          Brug poster til at bryde budgettet ned (lokale, mad, foto, …). Når
          budget-mode er sat til &quot;Sum af poster&quot; på detaljerne
          ovenfor, udgør summen her det samlede totalbudget.
        </p>
        <ItemList
          eventId={event.id}
          items={event.items}
          addAction={addItemAction}
          updateAction={updateLifeEventItem}
          deleteAction={deleteLifeEventItem}
        />
      </section>

      {/* Slet-handling */}
      <section className="mt-10 max-w-2xl border-t border-neutral-200 pt-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-red-700">
          Farezone
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Sletter begivenheden og alle dens poster. Tilknyttede overførsler
          beholder beløb og dato men mister linket til denne begivenhed.
          Dette kan ikke fortrydes.
        </p>
        <form action={deleteLifeEvent} className="mt-3">
          <input type="hidden" name="id" value={event.id} />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Slet begivenhed
          </button>
        </form>
      </section>
    </div>
  );
}
