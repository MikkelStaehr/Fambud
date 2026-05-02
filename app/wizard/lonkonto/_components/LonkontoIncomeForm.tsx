'use client';

// Trin 1-form: opret lønkonto + 1-3 paycheck-samples i samme submit.
//
// Top: pay-day-regel ("hvornår får du løn?"). Auto-fylder hver row's
// dato baseret på reglen + offset-måned (row 0 = seneste, row 1 =
// forrige, osv.). Brugeren kan stadig override pr. row hvis en konkret
// udbetaling afveg (fx forskudt løn, ferie-tillæg).
//
// Hver paycheck er en 'once'-transaktion med income_role='primary'.
// Forecast-motoren bruger gennemsnittet — én er nok til at komme i gang,
// 3 giver præcist forecast.

import { useEffect, useState } from 'react';
import {
  CalendarDays,
  CalendarCheck,
  CalendarRange,
  CalendarPlus,
  Plus,
  X,
} from 'lucide-react';
import { AmountInput } from '@/app/(app)/_components/AmountInput';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

type Rule = 'fixed' | 'last-banking' | 'second-last-banking' | 'first-banking';

type Props = {
  action: (formData: FormData) => Promise<void>;
  isOwner: boolean;
  error?: string;
};

// ----------------------------------------------------------------------------
// Pay-day-beregning
// ----------------------------------------------------------------------------
function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function computePayDay(
  year: number,
  monthIndex: number,
  rule: Rule,
  day: number
): Date {
  switch (rule) {
    case 'fixed': {
      const d = new Date(year, monthIndex, Math.min(Math.max(day, 1), 31));
      // Hvis weekend, ryk til fredagen før
      if (d.getDay() === 0) d.setDate(d.getDate() - 2);
      else if (d.getDay() === 6) d.setDate(d.getDate() - 1);
      return d;
    }
    case 'last-banking': {
      const d = new Date(year, monthIndex + 1, 0); // sidste dag i måneden
      while (isWeekend(d)) d.setDate(d.getDate() - 1);
      return d;
    }
    case 'second-last-banking': {
      const last = computePayDay(year, monthIndex, 'last-banking', 1);
      const d = new Date(last);
      d.setDate(d.getDate() - 1);
      while (isWeekend(d)) d.setDate(d.getDate() - 1);
      return d;
    }
    case 'first-banking': {
      const d = new Date(year, monthIndex, 1);
      while (isWeekend(d)) d.setDate(d.getDate() + 1);
      return d;
    }
  }
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Find seneste pay-day på eller før i dag, derefter forrige måneder.
// Returnerer ISO-datoer for op til 3 rows (index 0 = seneste).
function paycheckDatesForRule(rule: Rule, day: number, today: Date): string[] {
  // Find første måned hvor pay-day <= today
  let year = today.getFullYear();
  let month = today.getMonth();
  for (let i = 0; i < 6; i++) {
    const candidate = computePayDay(year, month, rule, day);
    if (candidate <= today) break;
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
  }
  // Nu er (year, month) den måned hvis pay-day var seneste
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const d = computePayDay(year, month, rule, day);
    out.push(toISO(d));
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Komponent
// ----------------------------------------------------------------------------
export function LonkontoIncomeForm({ action, isOwner, error }: Props) {
  const [paycheckCount, setPaycheckCount] = useState(1);
  const [rule, setRule] = useState<Rule>('fixed');
  const [day, setDay] = useState(27);
  const [dates, setDates] = useState<string[]>(() =>
    paycheckDatesForRule('fixed', 27, new Date())
  );

  // Når regel eller dag ændrer sig, re-fyld alle rows. Vi accepterer at
  // dette overskriver manuelle ændringer — UX-trade-off for at holde
  // logikken simpel. Hvis brugeren har en konkret afvigelse kan de altid
  // editere igen efter regelvalget er låst.
  useEffect(() => {
    setDates(paycheckDatesForRule(rule, day, new Date()));
  }, [rule, day]);

  function setDateForRow(idx: number, value: string) {
    setDates((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

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

      {/* Sektion 2: pay-day-regel */}
      <fieldset className="space-y-4 rounded-md border border-neutral-200 bg-white p-4">
        <legend className="px-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Hvornår får du normalt løn?
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <RuleCard
            value="fixed"
            label="Fast dato"
            desc="Samme dag hver måned (rykkes til fredag hvis weekend)."
            icon={<CalendarDays className="h-4 w-4" />}
            checked={rule === 'fixed'}
            onSelect={() => setRule('fixed')}
          />
          <RuleCard
            value="last-banking"
            label="Sidste bankdag"
            desc="Sidste hverdag i måneden — typisk for offentligt ansatte."
            icon={<CalendarCheck className="h-4 w-4" />}
            checked={rule === 'last-banking'}
            onSelect={() => setRule('last-banking')}
          />
          <RuleCard
            value="second-last-banking"
            label="Næstsidste bankdag"
            desc="Hverdagen før sidste hverdag — fx mange privatansatte."
            icon={<CalendarRange className="h-4 w-4" />}
            checked={rule === 'second-last-banking'}
            onSelect={() => setRule('second-last-banking')}
          />
          <RuleCard
            value="first-banking"
            label="Første bankdag"
            desc="Første hverdag i måneden."
            icon={<CalendarPlus className="h-4 w-4" />}
            checked={rule === 'first-banking'}
            onSelect={() => setRule('first-banking')}
          />
        </div>

        {rule === 'fixed' && (
          <div>
            <label htmlFor="day_of_month" className={labelClass}>
              Dag i måneden
            </label>
            <input
              id="day_of_month"
              type="number"
              min={1}
              max={31}
              value={day}
              onChange={(e) => setDay(Number(e.target.value) || 1)}
              required
              className={fieldClass}
            />
          </div>
        )}
      </fieldset>

      {/* Sektion 3: lønudbetalinger */}
      <fieldset className="space-y-4 rounded-md border border-neutral-200 bg-white p-4">
        <legend className="px-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Lønudbetalinger
        </legend>

        {[0, 1, 2].slice(0, paycheckCount).map((idx) => (
          <PaycheckRow
            key={idx}
            index={idx}
            dateValue={dates[idx]}
            onDateChange={(v) => setDateForRow(idx, v)}
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

function RuleCard({
  value,
  label,
  desc,
  icon,
  checked,
  onSelect,
}: {
  value: Rule;
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

function PaycheckRow({
  index,
  dateValue,
  onDateChange,
  removable,
  onRemove,
}: {
  index: number;
  dateValue: string;
  onDateChange: (v: string) => void;
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
            value={dateValue}
            onChange={(e) => onDateChange(e.target.value)}
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
