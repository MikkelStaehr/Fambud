// /begivenheder/[id] - detalje + redigering + linje-poster.
//
// Layout:
//   - Header med navn + status-pille + back-link
//   - Hovedformular (EventForm) til metadata
//   - Items-sektion (ItemList) til linje-poster
//   - Footer med "slet begivenhed"-action

import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { getLifeEventById, getLifeEventEligibleAccounts } from '@/lib/dal';
import {
  formatAmount,
  lifeEventTotalBudget,
  LIFE_EVENT_STATUS_LABEL_DA,
  LIFE_EVENT_TYPE_LABEL_DA,
} from '@/lib/format';
import { EventForm } from '../_components/EventForm';
import { ItemList } from '../_components/ItemList';
import {
  addLifeEventItem,
  deleteLifeEvent,
  deleteLifeEventItem,
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

  const [event, accounts] = await Promise.all([
    getLifeEventById(id),
    getLifeEventEligibleAccounts(),
  ]);

  // Bind id som første argument på update-actionen så form'en bare kan
  // sende formData.
  const updateAction = updateLifeEvent.bind(null, id);
  const addItemAction = addLifeEventItem.bind(null, id);

  const totalBudget = lifeEventTotalBudget(event, event.items);

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
        {totalBudget != null && (
          <p className="mt-2 text-sm text-neutral-500">
            Totalbudget:{' '}
            <span className="font-mono font-medium text-neutral-900">
              {formatAmount(totalBudget)} kr
            </span>
            {event.use_items_for_budget && (
              <span className="text-xs text-neutral-500">
                {' '}
                (sum af {event.items.length}{' '}
                {event.items.length === 1 ? 'post' : 'poster'})
              </span>
            )}
          </p>
        )}
      </header>

      {/* Hovedform til metadata */}
      <section className="mt-6 max-w-2xl">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Detaljer
        </h2>
        <EventForm
          action={updateAction}
          accounts={accounts}
          defaultValues={{
            name: event.name,
            type: event.type,
            total_budget: event.total_budget,
            use_items_for_budget: event.use_items_for_budget,
            target_date: event.target_date,
            timeframe: event.timeframe,
            linked_account_id: event.linked_account_id,
            status: event.status,
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
