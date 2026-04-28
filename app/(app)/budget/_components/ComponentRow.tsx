'use client';

import { useActionState, useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { formatAmount, formatOereForInput } from '@/lib/format';
import {
  removeComponent,
  updateComponent,
  type UpdateComponentState,
} from '../actions';

type Props = {
  component: {
    id: string;
    label: string;
    amount: number;
    family_member_id: string | null;
    family_member: { id: string; name: string } | null;
  };
  accountId: string;
  familyMembers: { id: string; name: string }[];
};

// Component rows have two modes:
//   - read: label + amount + family-tag (if set) + pencil/× icons
//   - edit: inline form with label + amount + family dropdown + Gem/Annullér
// useState toggles between them; useActionState closes the editor on a
// successful save so the user doesn't have to click away manually.
export function ComponentRow({ component, accountId, familyMembers }: Props) {
  const [editing, setEditing] = useState(false);

  const [state, formAction] = useActionState<UpdateComponentState, FormData>(
    updateComponent.bind(null, component.id, accountId),
    null
  );

  useEffect(() => {
    if (state?.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <li className="text-xs">
        <form
          action={formAction}
          className="space-y-1.5 rounded-md border border-neutral-200 bg-neutral-50/60 p-2"
        >
          <div className="grid grid-cols-[1fr_auto] items-center gap-1.5">
            <input
              name="label"
              type="text"
              required
              defaultValue={component.label}
              autoFocus
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              required
              defaultValue={formatOereForInput(component.amount)}
              className="w-20 rounded-md border border-neutral-300 bg-white px-2 py-1 text-right font-mono tabnum text-xs focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <select
            name="family_member_id"
            defaultValue={component.family_member_id ?? ''}
            className="block w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            <option value="">Tilhører hele familien</option>
            {familyMembers.map((fm) => (
              <option key={fm.id} value={fm.id}>{fm.name}</option>
            ))}
          </select>
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-50"
            >
              Annullér
            </button>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-neutral-800"
            >
              Gem
            </button>
          </div>
        </form>
        {state && state.ok === false && (
          <div className="mt-1 text-[11px] text-red-700">{state.error}</div>
        )}
      </li>
    );
  }

  // Negative amounts (e.g. rabat / KundeKroner) render in green with the
  // sign preserved so the row reads as a discount, not an addition.
  const isNegative = component.amount < 0;

  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <span className="truncate text-neutral-700">{component.label}</span>
        {component.family_member && (
          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
            {component.family_member.name}
          </span>
        )}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5">
        <span
          className={`tabnum font-mono ${isNegative ? 'text-emerald-700' : 'text-neutral-500'}`}
        >
          {formatAmount(component.amount)} kr.
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded p-0.5 text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-700"
          title="Rediger underpost"
          aria-label={`Rediger ${component.label}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <form action={removeComponent}>
          <input type="hidden" name="id" value={component.id} />
          <input type="hidden" name="account_id" value={accountId} />
          <button
            type="submit"
            className="rounded p-0.5 text-neutral-300 transition hover:bg-red-50 hover:text-red-700"
            title="Fjern underpost"
            aria-label={`Fjern ${component.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </form>
      </span>
    </li>
  );
}
