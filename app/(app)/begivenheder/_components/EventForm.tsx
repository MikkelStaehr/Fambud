'use client';

// Form til oprettelse + redigering af en begivenhed.
//
// Post-migration 0059: form'en har INGEN kontovalg. Tilknytning sker via
// overførsler (transfers.life_event_id) - se /overforsler/ny?life_event_id=X
// flowet for hvordan en begivenhed bindes til en konto via en konkret
// månedlig overførsel.
//
// To toggle-grupper styrer hvad der vises:
//   - budget_mode: 'total' (vis frit beløb-felt) eller 'items' (skjul, brug
//     items-summen). Default 'total' for nye begivenheder så den almindelige
//     start "jeg ved cirka hvad det koster" virker uden ekstra klik.
//   - date_mode: 'date' (konkret dato) eller 'timeframe' (bucket). Begge
//     tvinger en deadline (DB-constraint life_events_must_have_deadline,
//     migration 0058).
//
// Status er IKKE et brugervalg - terminale states sættes via dedikerede
// knapper på detalje-siden, planning/active beregnes live fra transfers.

import Link from 'next/link';
import { useState } from 'react';
import { AmountInput } from '../../_components/AmountInput';
import { SubmitButton } from '../../_components/SubmitButton';
import {
  formatOereForInput,
  LIFE_EVENT_TIMEFRAME_LABEL_DA,
  LIFE_EVENT_TYPE_LABEL_DA,
} from '@/lib/format';
import type { LifeEventTimeframe, LifeEventType } from '@/lib/database.types';

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    name?: string;
    type?: LifeEventType;
    total_budget?: number | null;
    use_items_for_budget?: boolean;
    target_date?: string | null;
    timeframe?: LifeEventTimeframe | null;
    notes?: string | null;
  };
  submitLabel: string;
  cancelHref: string;
  error?: string;
};

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

const TYPE_OPTIONS: { value: LifeEventType; label: string }[] = (
  Object.keys(LIFE_EVENT_TYPE_LABEL_DA) as LifeEventType[]
).map((value) => ({ value, label: LIFE_EVENT_TYPE_LABEL_DA[value] }));

const TIMEFRAME_OPTIONS: { value: LifeEventTimeframe; label: string }[] = (
  Object.keys(LIFE_EVENT_TIMEFRAME_LABEL_DA) as LifeEventTimeframe[]
).map((value) => ({ value, label: LIFE_EVENT_TIMEFRAME_LABEL_DA[value] }));

type BudgetMode = 'total' | 'items';
type DateMode = 'date' | 'timeframe';

function initialDateMode(
  target_date: string | null | undefined,
  timeframe: LifeEventTimeframe | null | undefined
): DateMode {
  if (timeframe) return 'timeframe';
  void target_date;
  return 'date';
}

export function EventForm({
  action,
  defaultValues = {},
  submitLabel,
  cancelHref,
  error,
}: Props) {
  const dv = defaultValues;
  const [budgetMode, setBudgetMode] = useState<BudgetMode>(
    dv.use_items_for_budget ? 'items' : 'total'
  );
  const [dateMode, setDateMode] = useState<DateMode>(
    initialDateMode(dv.target_date, dv.timeframe)
  );

  return (
    <form action={action} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Navn + type */}
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="name" className={labelClass}>
            Navn
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={dv.name ?? ''}
            placeholder="Lottes konfirmation, Vores bryllup, …"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="type" className={labelClass}>
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={dv.type ?? 'andet'}
            className={fieldClass}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Budget-mode + felt */}
      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-medium text-neutral-600">
          Budget
        </legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
            <input
              type="radio"
              name="budget_mode"
              value="total"
              checked={budgetMode === 'total'}
              onChange={() => setBudgetMode('total')}
              className="accent-emerald-700"
            />
            Et samlet beløb
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
            <input
              type="radio"
              name="budget_mode"
              value="items"
              checked={budgetMode === 'items'}
              onChange={() => setBudgetMode('items')}
              className="accent-emerald-700"
            />
            Sum af poster (tilføj efter oprettelse)
          </label>
        </div>

        {budgetMode === 'total' && (
          <div className="mt-3">
            <label htmlFor="total_budget" className={labelClass}>
              Forventet totalbudget (kr)
            </label>
            <AmountInput
              id="total_budget"
              name="total_budget"
              defaultValue={
                dv.total_budget != null
                  ? formatOereForInput(dv.total_budget)
                  : ''
              }
              placeholder="30 000.00"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Lad stå tomt hvis I ikke har et tal endnu, vi opdaterer efterhånden
              som I får priser ind.
            </p>
          </div>
        )}
        {budgetMode === 'items' && (
          <p className="mt-3 text-xs text-neutral-500">
            Totalbudgettet beregnes som summen af poster (lokale, mad, foto, …)
            som I tilføjer på begivenhedens detaljeside.
          </p>
        )}
      </fieldset>

      {/* Tidshorisont - obligatorisk */}
      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-medium text-neutral-600">
          Hvornår
        </legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
            <input
              type="radio"
              name="date_mode"
              value="date"
              checked={dateMode === 'date'}
              onChange={() => setDateMode('date')}
              className="accent-emerald-700"
            />
            Konkret dato
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
            <input
              type="radio"
              name="date_mode"
              value="timeframe"
              checked={dateMode === 'timeframe'}
              onChange={() => setDateMode('timeframe')}
              className="accent-emerald-700"
            />
            Cirka tidsramme
          </label>
        </div>

        {dateMode === 'date' && (
          <div className="mt-3">
            <label htmlFor="target_date" className={labelClass}>
              Dato for begivenheden
            </label>
            <input
              id="target_date"
              name="target_date"
              type="date"
              required
              defaultValue={dv.target_date ?? ''}
              className={fieldClass}
            />
          </div>
        )}
        {dateMode === 'timeframe' && (
          <div className="mt-3">
            <label htmlFor="timeframe" className={labelClass}>
              Tidsramme
            </label>
            <select
              id="timeframe"
              name="timeframe"
              required
              defaultValue={dv.timeframe ?? 'within_1y'}
              className={fieldClass}
            >
              {TIMEFRAME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="mt-3 text-xs text-neutral-500">
          En deadline er obligatorisk - uden den kan vi ikke beregne en
          månedlig opsparingsrate. Vælg cirka tidsramme hvis I ikke har en
          konkret dato endnu.
        </p>
      </fieldset>

      {/* Noter */}
      <div>
        <label htmlFor="notes" className={labelClass}>
          Noter (valgfri)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={dv.notes ?? ''}
          maxLength={1000}
          placeholder="Hvad I tænker, links til lokaler, idéer …"
          className={fieldClass}
        />
      </div>

      <p className="rounded-md border border-neutral-200 bg-stone-50 px-3 py-2 text-xs text-neutral-600">
        Begivenheden står som idé indtil I opsætter en månedlig overførsel
        for den. Det gør I på detaljesiden bagefter, eller via
        Overførsler.
      </p>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Link
          href={cancelHref}
          className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        >
          Annuller
        </Link>
        <SubmitButton pendingLabel="Gemmer…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
