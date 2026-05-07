// /begivenheder/[id] - detalje + redigering + linje-poster.
//
// Layout:
//   - Header med navn + status-pille + back-link
//   - Hovedformular (EventForm) til metadata
//   - Items-sektion (ItemList) til linje-poster
//   - Footer med "slet begivenhed"-action

import Link from 'next/link';
import { ArrowLeft, CheckCircle2, RotateCcw, Trash2, XCircle } from 'lucide-react';
import {
  getCashflowGraph,
  getLifeEventById,
  getLifeEventEligibleAccounts,
  getLifeEvents,
} from '@/lib/dal';
import {
  lifeEventAlert,
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

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [event, accounts, allEvents, graph] = await Promise.all([
    getLifeEventById(id),
    getLifeEventEligibleAccounts(),
    getLifeEvents(),
    getCashflowGraph(),
  ]);

  // Map fra account_id -> navnet på en ANDEN begivenhed der bruger
  // samme konto. Ekskluderer denne event så vi ikke advarer mod os
  // selv ved redigering.
  const linkedElsewhere: Record<string, string> = {};
  for (const otherEvent of allEvents) {
    if (otherEvent.id === id) continue;
    if (otherEvent.linked_account_id) {
      linkedElsewhere[otherEvent.linked_account_id] = otherEvent.name;
    }
  }

  // Bind id som første argument på update-actionen så form'en bare kan
  // sende formData.
  const updateAction = updateLifeEvent.bind(null, id);
  const addItemAction = addLifeEventItem.bind(null, id);

  const totalBudget = lifeEventTotalBudget(event, event.items);
  const monthsRemaining = lifeEventMonthsRemaining(event);
  const monthlyTarget = lifeEventMonthlyTarget(
    event,
    event.items,
    event.linked_account?.opening_balance ?? 0
  );
  const monthlyInflow = event.linked_account_id
    ? (graph.perAccount.get(event.linked_account_id)?.transfersIn ?? 0)
    : null;
  const alert = lifeEventAlert(
    event,
    event.items,
    event.linked_account?.opening_balance ?? 0,
    monthlyInflow
  );
  const isTerminal =
    event.status === 'completed' || event.status === 'cancelled';

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
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[event.status]}`}
          >
            {LIFE_EVENT_STATUS_LABEL_DA[event.status]}
          </span>
        </div>
        {event.notes && (
          <p className="mt-2 text-sm text-neutral-600">{event.notes}</p>
        )}
      </header>

      {/* Overblik - read-only stats + alert. Det første brugeren ser
          så de ikke skal læse formularen for at forstå tilstanden. */}
      <EventOverview
        event={event}
        totalBudget={totalBudget}
        monthsRemaining={monthsRemaining}
        monthlyTarget={monthlyTarget}
        monthlyInflow={monthlyInflow}
        alert={alert}
      />

      {/* Status-actions: terminale skift (Aflys / Markér gennemført) +
          Genåbn fra terminal state. Status auto-deriveres ellers fra
          linked_account_id når metadata gemmes. */}
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
          accounts={accounts}
          linkedElsewhere={linkedElsewhere}
          defaultValues={{
            name: event.name,
            type: event.type,
            total_budget: event.total_budget,
            use_items_for_budget: event.use_items_for_budget,
            target_date: event.target_date,
            timeframe: event.timeframe,
            linked_account_id: event.linked_account_id,
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
          budget-mode er sat til &quot;Sum af poster&quot; på detaljerne ovenfor,
          udgør summen her det samlede totalbudget.
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
          Sletter begivenheden og alle dens poster. Tilknyttede konti
          påvirkes ikke. Dette kan ikke fortrydes.
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
