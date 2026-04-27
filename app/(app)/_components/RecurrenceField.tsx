'use client';

import { useState } from 'react';
import type { RecurrenceFreq } from '@/lib/database.types';

const FREQ_LABEL_DA: Record<RecurrenceFreq, string> = {
  once: 'Engangs',
  weekly: 'Ugentligt',
  monthly: 'Månedligt',
  quarterly: 'Kvartalvis',
  semiannual: 'Halvårligt',
  yearly: 'Årligt',
};

type Props = {
  defaultRecurrence?: RecurrenceFreq;
  defaultUntil?: string | null;
};

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

export function RecurrenceField({
  defaultRecurrence = 'once',
  defaultUntil,
}: Props) {
  const [recurrence, setRecurrence] = useState<RecurrenceFreq>(defaultRecurrence);
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label htmlFor="recurrence" className="block text-xs font-medium text-neutral-600">
          Gentagelse
        </label>
        <select
          id="recurrence"
          name="recurrence"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as RecurrenceFreq)}
          className={fieldClass}
        >
          {(Object.keys(FREQ_LABEL_DA) as RecurrenceFreq[]).map((k) => (
            <option key={k} value={k}>{FREQ_LABEL_DA[k]}</option>
          ))}
        </select>
      </div>

      {/* Hidden when 'once' so the form doesn't submit a stale until-date.
          Server action also nulls out this field when recurrence is 'once'. */}
      {recurrence !== 'once' && (
        <div>
          <label
            htmlFor="recurrence_until"
            className="block text-xs font-medium text-neutral-600"
          >
            Gentag indtil <span className="text-neutral-400">(valgfrit)</span>
          </label>
          <input
            id="recurrence_until"
            name="recurrence_until"
            type="date"
            defaultValue={defaultUntil ?? ''}
            className={fieldClass}
          />
        </div>
      )}
    </div>
  );
}
