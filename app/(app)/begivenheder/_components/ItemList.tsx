'use client';

// Liste over linje-poster på en begivenhed med inline edit/delete + en
// add-form i bunden. Hver række har en lille toggle: visnings-mode viser
// titel/beløb/status; redigerings-mode viser en inline form.
//
// State er rent UI-niveau (hvilken row redigeres lige nu). Server actions
// håndterer datamodellen - vi kalder bare den rigtige action med rigtige
// formData per række.

import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { AmountInput } from '../../_components/AmountInput';
import { SubmitButton } from '../../_components/SubmitButton';
import {
  formatAmount,
  formatOereForInput,
  LIFE_EVENT_ITEM_STATUS_LABEL_DA,
} from '@/lib/format';
import type {
  LifeEventItem,
  LifeEventItemStatus,
} from '@/lib/database.types';

type Props = {
  eventId: string;
  items: LifeEventItem[];
  addAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
};

const STATUS_OPTIONS: { value: LifeEventItemStatus; label: string }[] = (
  Object.keys(LIFE_EVENT_ITEM_STATUS_LABEL_DA) as LifeEventItemStatus[]
).map((value) => ({
  value,
  label: LIFE_EVENT_ITEM_STATUS_LABEL_DA[value],
}));

const STATUS_BADGE: Record<LifeEventItemStatus, string> = {
  planlagt: 'bg-neutral-100 text-neutral-700',
  booket: 'bg-amber-50 text-amber-800',
  betalt: 'bg-emerald-50 text-emerald-800',
};

const fieldClass =
  'block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

export function ItemList({
  eventId,
  items,
  addAction,
  updateAction,
  deleteAction,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="rounded-md border border-neutral-200 bg-white">
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-neutral-500">
          Ingen poster endnu. Tilføj fx lokale, mad, foto, tøj nedenfor, så
          summen automatisk udgør jeres totalbudget.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {items.map((item) =>
            editingId === item.id ? (
              <li key={item.id} className="px-4 py-3">
                <form
                  action={updateAction}
                  className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
                >
                  <input type="hidden" name="event_id" value={eventId} />
                  <div>
                    <label
                      htmlFor={`title-${item.id}`}
                      className="block text-[11px] font-medium text-neutral-600"
                    >
                      Titel
                    </label>
                    <input
                      id={`title-${item.id}`}
                      name="title"
                      type="text"
                      required
                      defaultValue={item.title}
                      className={fieldClass}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`amount-${item.id}`}
                      className="block text-[11px] font-medium text-neutral-600"
                    >
                      Beløb (kr)
                    </label>
                    <AmountInput
                      id={`amount-${item.id}`}
                      name="amount"
                      defaultValue={formatOereForInput(item.amount)}
                      className="block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-right font-mono tabnum text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`status-${item.id}`}
                      className="block text-[11px] font-medium text-neutral-600"
                    >
                      Status
                    </label>
                    <select
                      id={`status-${item.id}`}
                      name="status"
                      defaultValue={item.status}
                      className={fieldClass}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <SubmitButton pendingLabel="Gemmer…">
                      <Check className="h-3.5 w-3.5" /> Gem
                    </SubmitButton>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="hidden"
                    name="_item_id"
                    value={item.id}
                    readOnly
                  />
                </form>
              </li>
            ) : (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">
                      {item.title}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[item.status]}`}
                    >
                      {LIFE_EVENT_ITEM_STATUS_LABEL_DA[item.status]}
                    </span>
                  </div>
                </div>
                <div className="font-mono tabnum text-sm text-neutral-900">
                  {formatAmount(item.amount)} kr
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    <Pencil className="h-3 w-3" />
                    Rediger
                  </button>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="event_id" value={eventId} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </form>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-between border-t border-neutral-200 bg-stone-50 px-4 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Sum
          </span>
          <span className="font-mono tabnum text-sm font-semibold text-neutral-900">
            {formatAmount(total)} kr
          </span>
        </div>
      )}

      {/* Add new item-form */}
      <form
        action={addAction}
        className="grid gap-2 border-t border-neutral-200 bg-stone-50 px-4 py-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
      >
        <div>
          <label
            htmlFor="new-title"
            className="block text-[11px] font-medium text-neutral-600"
          >
            Ny post
          </label>
          <input
            id="new-title"
            name="title"
            type="text"
            placeholder="Lokale, mad, foto …"
            className={fieldClass}
          />
        </div>
        <div>
          <label
            htmlFor="new-amount"
            className="block text-[11px] font-medium text-neutral-600"
          >
            Beløb (kr)
          </label>
          <AmountInput
            id="new-amount"
            name="amount"
            placeholder="0.00"
            className="block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-right font-mono tabnum text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>
        <div>
          <label
            htmlFor="new-status"
            className="block text-[11px] font-medium text-neutral-600"
          >
            Status
          </label>
          <select
            id="new-status"
            name="status"
            defaultValue="planlagt"
            className={fieldClass}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pendingLabel="Tilføjer…">Tilføj</SubmitButton>
      </form>
    </div>
  );
}
