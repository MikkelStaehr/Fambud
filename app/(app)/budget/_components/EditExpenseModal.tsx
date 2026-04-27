'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { AmountInput } from '@/app/(app)/_components/AmountInput';
import {
  RECURRENCE_LABEL_DA,
  formatOereForInput,
} from '@/lib/format';
import type { RecurrenceFreq } from '@/lib/database.types';
import { updateBudgetExpense, type UpdateState } from '../actions';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

// Edit-mode is intentionally simpler than the add form: no card-select for
// recurrence, no fast-dato/sidste-bankdag. The user picks recurrence from a
// dropdown and adjusts the next-occurrence date directly. We don't store
// the day-rule in the schema yet, so reconstructing the full add-form state
// for editing isn't possible without losing fidelity. This is a pragmatic
// tradeoff — re-creating the expense is the path for changing the rule.
const RECURRENCE_OPTIONS: { value: RecurrenceFreq; label: string }[] = [
  { value: 'monthly', label: RECURRENCE_LABEL_DA.monthly },
  { value: 'quarterly', label: RECURRENCE_LABEL_DA.quarterly },
  { value: 'semiannual', label: RECURRENCE_LABEL_DA.semiannual },
  { value: 'yearly', label: RECURRENCE_LABEL_DA.yearly },
];

type Props = {
  expense: {
    id: string;
    description: string | null;
    amount: number;
    occurs_on: string;
    recurrence: RecurrenceFreq;
    category: { id: string } | null;
    group_label: string | null;
    components_mode: 'additive' | 'breakdown';
    family_member_id: string | null;
  };
  accountId: string;
  categories: { id: string; name: string }[];
  groupSuggestions: string[];
  familyMembers: { id: string; name: string }[];
};

export function EditExpenseModal({
  expense,
  accountId,
  categories,
  groupSuggestions,
  familyMembers,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Bumped each time the dialog opens so the form remounts with fresh
  // defaultValues — without this, an aborted edit (close without save)
  // would persist the unsaved input values into the next open.
  const [openCount, setOpenCount] = useState(0);

  const [state, formAction] = useActionState<UpdateState, FormData>(
    updateBudgetExpense.bind(null, expense.id, accountId),
    null
  );

  useEffect(() => {
    if (state?.ok) {
      dialogRef.current?.close();
    }
  }, [state]);

  const open = () => {
    setOpenCount((c) => c + 1);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
        title="Rediger udgift"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <dialog
        ref={dialogRef}
        className="w-[min(92vw,520px)] rounded-lg border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-neutral-900/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">Rediger udgift</h2>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Luk"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          key={openCount}
          action={formAction}
          className="space-y-4 px-5 py-4"
        >
          <div>
            <label htmlFor={`edit_desc_${expense.id}`} className={labelClass}>
              Navn
            </label>
            <input
              id={`edit_desc_${expense.id}`}
              name="description"
              type="text"
              required
              defaultValue={expense.description ?? ''}
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`edit_amount_${expense.id}`} className={labelClass}>
                Beløb <span className="text-neutral-400">(kr.)</span>
              </label>
              <AmountInput
                id={`edit_amount_${expense.id}`}
                name="amount"
                required
                defaultValue={formatOereForInput(expense.amount)}
              />
            </div>
            <div>
              <label htmlFor={`edit_cat_${expense.id}`} className={labelClass}>
                Kategori
              </label>
              <select
                id={`edit_cat_${expense.id}`}
                name="category_id"
                required
                defaultValue={expense.category?.id ?? ''}
                className={fieldClass}
              >
                <option value="" disabled>Vælg</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`edit_rec_${expense.id}`} className={labelClass}>
                Hvor ofte
              </label>
              <select
                id={`edit_rec_${expense.id}`}
                name="recurrence"
                required
                defaultValue={expense.recurrence}
                className={fieldClass}
              >
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`edit_date_${expense.id}`} className={labelClass}>
                Næste betaling
              </label>
              <input
                id={`edit_date_${expense.id}`}
                name="occurs_on"
                type="date"
                required
                defaultValue={expense.occurs_on}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor={`edit_group_${expense.id}`} className={labelClass}>
              Gruppe / udbyder <span className="text-neutral-400">(valgfrit)</span>
            </label>
            <input
              id={`edit_group_${expense.id}`}
              name="group_label"
              type="text"
              list={`edit_group_suggestions_${expense.id}`}
              defaultValue={expense.group_label ?? ''}
              placeholder="F.eks. Popermo, TopDanmark"
              className={fieldClass}
            />
            <datalist id={`edit_group_suggestions_${expense.id}`}>
              {groupSuggestions.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor={`edit_family_${expense.id}`} className={labelClass}>
              Tilhører <span className="text-neutral-400">(valgfrit)</span>
            </label>
            <select
              id={`edit_family_${expense.id}`}
              name="family_member_id"
              defaultValue={expense.family_member_id ?? ''}
              className={fieldClass}
            >
              <option value="">Hele familien</option>
              {familyMembers.map((fm) => (
                <option key={fm.id} value={fm.id}>{fm.name}</option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-neutral-200 bg-neutral-50/50 p-3 text-sm select-none">
            <input
              type="checkbox"
              name="components_mode_breakdown"
              defaultChecked={expense.components_mode === 'breakdown'}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
            />
            <span className="min-w-0">
              <span className="font-medium text-neutral-900">
                Underposterne er allerede med i beløbet
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                Slå til for forsikringer/realkreditlån hvor du kender den
                samlede regning og bare vil bryde den ned.
              </span>
            </span>
          </label>

          {state && state.ok === false && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <div className="-mx-5 -mb-4 mt-4 flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              Annullér
            </button>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Gem
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
