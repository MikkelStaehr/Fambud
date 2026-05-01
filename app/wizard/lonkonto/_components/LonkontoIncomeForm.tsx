'use client';

import { useState } from 'react';
import { CalendarDays, CalendarCheck } from 'lucide-react';
import { AmountInput } from '@/app/(app)/_components/AmountInput';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

type DayRule = 'fixed' | 'last-banking-day';

type Props = {
  action: (formData: FormData) => Promise<void>;
  isOwner: boolean;
  error?: string;
};

export function LonkontoIncomeForm({ action, isOwner, error }: Props) {
  const [rule, setRule] = useState<DayRule>('fixed');

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
          // Owner ser ikke checkboxet (lønkontoen er pr. default privat),
          // men vi sender feltet med så server-action har stabil form-shape
          // og kan læse formData.get('editable_by_all').
          <input type="hidden" name="editable_by_all" value="" />
        )}
      </fieldset>

      {/* Sektion 2: månedsløn */}
      <fieldset className="space-y-4 rounded-md border border-neutral-200 bg-white p-4">
        <legend className="px-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Månedsløn
        </legend>

        <div>
          <label htmlFor="amount" className={labelClass}>
            Beløb pr. måned <span className="text-neutral-400">(kr. netto)</span>
          </label>
          <AmountInput id="amount" name="amount" required />
        </div>

        <div>
          <div className={labelClass}>Lønudbetaling</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <RuleCard
              value="fixed"
              label="Fast dato"
              desc="Samme dag hver måned. Rykkes til fredagen før hvis det er weekend."
              icon={<CalendarDays className="h-4 w-4" />}
              checked={rule === 'fixed'}
              onSelect={() => setRule('fixed')}
            />
            <RuleCard
              value="last-banking-day"
              label="Sidste bankdag"
              desc="Sidste hverdag i måneden — typisk for offentligt ansatte."
              icon={<CalendarCheck className="h-4 w-4" />}
              checked={rule === 'last-banking-day'}
              onSelect={() => setRule('last-banking-day')}
            />
          </div>
        </div>

        {rule === 'fixed' && (
          <div>
            <label htmlFor="day_of_month" className={labelClass}>
              Dag i måneden
            </label>
            <input
              id="day_of_month"
              name="day_of_month"
              type="number"
              min={1}
              max={31}
              defaultValue={1}
              required
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Hvis dagen falder på en lørdag eller søndag, bruges fredagen før.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="description" className={labelClass}>
            Beskrivelse <span className="text-neutral-400">(valgfrit)</span>
          </label>
          <input
            id="description"
            name="description"
            type="text"
            defaultValue="Månedsløn"
            className={fieldClass}
          />
        </div>
      </fieldset>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        Næste
      </button>
    </form>
  );
}

function RuleCard({
  value,
  label,
  desc,
  icon,
  checked,
  onSelect,
}: {
  value: DayRule;
  label: string;
  desc: string;
  icon: React.ReactNode;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-1.5 rounded-md border p-3 transition ${
        checked
          ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900'
          : 'border-neutral-200 bg-white hover:border-neutral-300'
      }`}
    >
      <input
        type="radio"
        name="day_rule"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <div
        className={`inline-flex h-6 w-6 items-center justify-center rounded ${
          checked ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'
        }`}
      >
        {icon}
      </div>
      <div className="text-sm font-medium text-neutral-900">{label}</div>
      <div className="text-xs text-neutral-500">{desc}</div>
    </label>
  );
}
