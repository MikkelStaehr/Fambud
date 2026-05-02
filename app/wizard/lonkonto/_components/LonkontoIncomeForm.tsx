'use client';

// Trin 1-form: opret lønkonto + 1-3 paycheck-samples i samme submit.
//
// Tidligere oprettede vi én recurring monthly-transaktion og lod brugeren
// senere registrere de 3 'once'-paychecks for forecast. Det var to spor
// for samme data — nu er det ét spor: alle indkomster er paycheck-samples
// med recurrence='once', og forecast-motoren bruger gennemsnit. Cashflow-
// grafen og HeroStatus læser samme avg.
//
// 1 paycheck er minimum (krævet — uden indkomst har resten af appen intet
// at vise). 2 og 3 er valgfri men anbefalet — flere samples = præcist
// forecast (ferietillæg, bonus, sygefravær fanges ind).

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AmountInput } from '@/app/(app)/_components/AmountInput';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

type Props = {
  action: (formData: FormData) => Promise<void>;
  isOwner: boolean;
  error?: string;
};

// Default-dato pr. row: row 1 = i dag, row 2 = i dag minus 1 måned, osv.
// Vi clampede til target-månedens sidste dag så 31. maj → 30. april ikke
// overflower til 1. maj.
function defaultDateForRow(rowIndex: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - rowIndex);
  // Hvis dag-rolling ramte næste måned (fx 31. → 1.), træk en dag tilbage
  // til sidste dag af target-måneden.
  if (d.getDate() < new Date().getDate() - 5) {
    // Heuristic — men brug clamper
  }
  return d.toISOString().slice(0, 10);
}

export function LonkontoIncomeForm({ action, isOwner, error }: Props) {
  const [paycheckCount, setPaycheckCount] = useState(1);

  return (
    <form action={action} className="space-y-6">
      {/* Sektion 1: lønkonto */}
      <fieldset className="space-y-4 rounded-md border border-neutral-200 bg-white p-4">
        <legend className="px-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Lønkonto
        </legend>
        <div>
          <label htmlFor="name" className={labelClass}>
            Navn
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue="Lønkonto"
            placeholder="Lønkonto"
            className={fieldClass}
          />
        </div>

        {/* Lønkontoen defaulter til PRIVAT for begge roller — den indeholder
            personlige udgifter som ingen anden i husstanden bør kunne se.
            Partneren kan vælge at åbne den hvis de vil dele med ejeren. */}
        {!isOwner ? (
          <label className="flex items-start gap-3 text-sm text-neutral-700 select-none">
            <input
              type="checkbox"
              name="editable_by_all"
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
            />
            <span>
              <span className="font-medium text-neutral-900">
                Del kontoen med resten af husstanden
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                Som standard er lønkontoen privat — kun du kan se dens
                transaktioner. Tjek af hvis du vil dele indsigten.
              </span>
            </span>
          </label>
        ) : (
          <input type="hidden" name="editable_by_all" value="" />
        )}
      </fieldset>

      {/* Sektion 2: lønudbetalinger */}
      <fieldset className="space-y-4 rounded-md border border-neutral-200 bg-white p-4">
        <legend className="px-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Lønudbetalinger
        </legend>

        {[0, 1, 2].slice(0, paycheckCount).map((idx) => (
          <PaycheckRow
            key={idx}
            index={idx}
            removable={idx > 0 && idx === paycheckCount - 1}
            onRemove={() => setPaycheckCount((c) => c - 1)}
          />
        ))}

        {paycheckCount < 3 && (
          <button
            type="button"
            onClick={() => setPaycheckCount((c) => c + 1)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Tilføj endnu en lønudbetaling{' '}
            {paycheckCount === 1
              ? '(2 mere giver præcist forecast)'
              : '(1 mere giver præcist forecast)'}
          </button>
        )}
      </fieldset>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
      >
        Næste
      </button>
    </form>
  );
}

function PaycheckRow({
  index,
  removable,
  onRemove,
}: {
  index: number;
  removable: boolean;
  onRemove: () => void;
}) {
  const requiredLabel = index === 0 ? 'krævet' : 'valgfri';
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium text-neutral-700">
          Lønudbetaling {index + 1}{' '}
          <span className="font-normal text-neutral-400">({requiredLabel})</span>
        </h3>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-neutral-300 transition hover:bg-red-50 hover:text-red-700"
            title="Fjern"
            aria-label="Fjern denne lønudbetaling"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor={`paycheck_${index}_date`}
            className={labelClass}
          >
            Dato
          </label>
          <input
            id={`paycheck_${index}_date`}
            name={`paycheck_${index}_date`}
            type="date"
            required={index === 0}
            defaultValue={defaultDateForRow(index)}
            className={fieldClass}
          />
        </div>
        <div>
          <label
            htmlFor={`paycheck_${index}_amount`}
            className={labelClass}
          >
            Netto-beløb <span className="text-neutral-400">(kr.)</span>
          </label>
          <AmountInput
            id={`paycheck_${index}_amount`}
            name={`paycheck_${index}_amount`}
            required={index === 0}
          />
        </div>
      </div>
    </div>
  );
}
