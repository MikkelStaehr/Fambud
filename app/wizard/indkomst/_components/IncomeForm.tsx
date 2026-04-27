'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarDays, CalendarCheck } from 'lucide-react';
import { AmountInput } from '@/app/(app)/_components/AmountInput';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

type DayRule = 'fixed' | 'last-banking-day';

type Props = {
  action: (formData: FormData) => Promise<void>;
  accountId: string;
  accountName: string;
  skipHref: string;
  error?: string;
};

export function IncomeForm({ action, accountId, accountName, skipHref, error }: Props) {
  const [rule, setRule] = useState<DayRule>('fixed');

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="account_id" value={accountId} />

      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
        Indtægten knyttes til <span className="font-medium text-neutral-900">{accountName}</span>.
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
        <label htmlFor="amount" className={labelClass}>
          Beløb <span className="text-neutral-400">(kr.)</span>
        </label>
        <AmountInput id="amount" name="amount" required />
      </div>

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

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Tilføj og fortsæt
        </button>
        <Link
          href={skipHref}
          className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Hop over
        </Link>
      </div>
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
  // sr-only radio + visually-styled label is a more flexible pattern than
  // restyling the radio itself — full keyboard support comes for free.
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
