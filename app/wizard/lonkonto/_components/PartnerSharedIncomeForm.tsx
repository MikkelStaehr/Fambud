'use client';

// Indkomst-only-form for partner i fællesøkonomi-mode. Vi opretter ikke
// en lønkonto — den fælles eksisterer fra ejer's wizard. Vi registrerer
// 1-3 paycheck-samples med family_member_id sat til partneren, så forecast-
// motoren kan beregne hendes månedlige andel separat fra ejer's.

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AmountInput } from '@/app/(app)/_components/AmountInput';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

type Props = {
  action: (formData: FormData) => Promise<void>;
  error?: string;
};

function defaultDateForRow(rowIndex: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - rowIndex);
  return d.toISOString().slice(0, 10);
}

export function PartnerSharedIncomeForm({ action, error }: Props) {
  const [paycheckCount, setPaycheckCount] = useState(1);

  return (
    <form
      action={action}
      className="space-y-4 rounded-md border border-neutral-200 bg-white p-4"
    >
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
          <label htmlFor={`paycheck_${index}_date`} className={labelClass}>
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
          <label htmlFor={`paycheck_${index}_amount`} className={labelClass}>
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
