'use client';

import { useState } from 'react';
import {
  CalendarRange,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarCheck,
} from 'lucide-react';
import { AmountInput } from '@/app/(app)/_components/AmountInput';
import { MONTHS_DA } from '@/lib/format';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

type Recurrence = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
type DayRule = 'fixed' | 'last-banking-day';

type Props = {
  action: (formData: FormData) => Promise<void>;
  accountId: string;
  categories: { id: string; name: string; color: string }[];
  groupSuggestions: string[];
  familyMembers: { id: string; name: string }[];
  resetKey: number;
  error?: string;
};

const RECURRENCE_CARDS: {
  value: Recurrence;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'monthly',    label: 'Månedligt',    desc: 'Husleje, abonnementer, faste regninger.', Icon: CalendarRange },
  { value: 'quarterly',  label: 'Kvartalvis',   desc: 'Hver tredje måned.',                       Icon: CalendarClock },
  { value: 'semiannual', label: 'Halvårligt',   desc: 'To gange om året.',                        Icon: CalendarClock },
  { value: 'yearly',     label: 'Årligt',       desc: 'Forsikringer, ejendomsskat, kontingent.',  Icon: Calendar },
];

export function ExpenseForm({
  action,
  accountId,
  categories,
  groupSuggestions,
  familyMembers,
  resetKey,
  error,
}: Props) {
  const [recurrence, setRecurrence] = useState<Recurrence>('monthly');
  const [dayRule, setDayRule] = useState<DayRule>('fixed');

  const isMonthly = recurrence === 'monthly';

  return (
    <form
      key={resetKey}
      action={action}
      className="space-y-5 rounded-md border border-neutral-200 bg-white p-5"
    >
      <input type="hidden" name="account_id" value={accountId} />

      <div>
        <label htmlFor="exp_desc" className={labelClass}>Navn</label>
        <input
          id="exp_desc"
          name="description"
          type="text"
          required
          placeholder="F.eks. Husleje, Bilforsikring"
          className={fieldClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="exp_amount" className={labelClass}>
            Beløb <span className="text-neutral-400">(kr.)</span>
          </label>
          <AmountInput id="exp_amount" name="amount" required />
        </div>
        <div>
          <label htmlFor="exp_category" className={labelClass}>Kategori</label>
          <select
            id="exp_category"
            name="category_id"
            required
            defaultValue=""
            className={fieldClass}
          >
            <option value="" disabled>Vælg kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className={labelClass}>Hvor ofte</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {RECURRENCE_CARDS.map((c) => (
            <Card
              key={c.value}
              checked={recurrence === c.value}
              onSelect={() => setRecurrence(c.value)}
              radioName="recurrence"
              radioValue={c.value}
              icon={<c.Icon className="h-4 w-4" />}
              label={c.label}
              desc={c.desc}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="exp_group" className={labelClass}>
            Gruppe / udbyder <span className="text-neutral-400">(valgfrit)</span>
          </label>
          <input
            id="exp_group"
            name="group_label"
            type="text"
            list="exp_group_suggestions"
            placeholder="F.eks. Popermo, TopDanmark"
            className={fieldClass}
          />
          <datalist id="exp_group_suggestions">
            {groupSuggestions.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="exp_family" className={labelClass}>
            Tilhører <span className="text-neutral-400">(valgfrit)</span>
          </label>
          <select
            id="exp_family"
            name="family_member_id"
            defaultValue=""
            className={fieldClass}
          >
            <option value="">Hele familien</option>
            {familyMembers.map((fm) => (
              <option key={fm.id} value={fm.id}>{fm.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isMonthly ? (
        <>
          <div>
            <div className={labelClass}>Dato</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Card
                checked={dayRule === 'fixed'}
                onSelect={() => setDayRule('fixed')}
                radioName="day_rule"
                radioValue="fixed"
                icon={<CalendarDays className="h-4 w-4" />}
                label="Fast dato"
                desc="Samme dag hver måned. Rykkes til fredagen før hvis det er weekend."
              />
              <Card
                checked={dayRule === 'last-banking-day'}
                onSelect={() => setDayRule('last-banking-day')}
                radioName="day_rule"
                radioValue="last-banking-day"
                icon={<CalendarCheck className="h-4 w-4" />}
                label="Sidste bankdag"
                desc="Sidste hverdag i måneden."
              />
            </div>
          </div>

          {dayRule === 'fixed' && (
            <div>
              <label htmlFor="exp_day" className={labelClass}>
                Dag i måneden
              </label>
              <input
                id="exp_day"
                name="day_of_month"
                type="number"
                min={1}
                max={31}
                defaultValue={1}
                required
                className={fieldClass}
              />
            </div>
          )}
        </>
      ) : (
        // For non-monthly we don't ask for a precise day - just the month
        // when the first payment is due. The action stamps the 1st of that
        // month as occurs_on (this year if future, else next year).
        <div>
          <label htmlFor="exp_first_month" className={labelClass}>
            Første betaling i måned
          </label>
          <select
            id="exp_first_month"
            name="first_month"
            required
            defaultValue=""
            className={fieldClass}
          >
            <option value="" disabled>Vælg måned</option>
            {MONTHS_DA.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-neutral-200 bg-neutral-50/50 p-3 text-sm select-none">
        <input
          type="checkbox"
          name="components_mode_breakdown"
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
        />
        <span className="min-w-0">
          <span className="font-medium text-neutral-900">
            Underposterne er allerede med i beløbet
          </span>
          <span className="mt-0.5 block text-xs text-neutral-500">
            Slå til for forsikringer, realkreditlån og lignende, hvor du kender
            den samlede regning og bare vil bryde den ned. Slå fra (default)
            når underposter er tilkøb der lægges oven i.
          </span>
        </span>
      </label>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="w-full rounded-md border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
      >
        Tilføj
      </button>
    </form>
  );
}

function Card({
  checked,
  onSelect,
  icon,
  label,
  desc,
  radioName,
  radioValue,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
  radioName: string;
  radioValue: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition ${
        checked
          ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900'
          : 'border-neutral-200 bg-white hover:border-neutral-300'
      }`}
    >
      <input
        type="radio"
        name={radioName}
        value={radioValue}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <div
        className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded ${
          checked ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        <div className="text-xs text-neutral-500">{desc}</div>
      </div>
    </label>
  );
}
