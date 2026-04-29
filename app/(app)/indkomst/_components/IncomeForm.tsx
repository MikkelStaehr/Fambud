'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AmountInput } from '../../_components/AmountInput';
import { RecurrenceField } from '../../_components/RecurrenceField';
import { formatAmount, formatOereForInput, parseAmountToOere } from '@/lib/format';
import type { Account, IncomeRole, RecurrenceFreq } from '@/lib/database.types';
import type { FamilyMemberRow } from '@/lib/dal';

type Props = {
  action: (formData: FormData) => Promise<void>;
  accounts: Pick<Account, 'id' | 'name' | 'archived'>[];
  familyMembers: FamilyMemberRow[];
  defaultValues?: {
    family_member_id?: string | null;
    account_id?: string;
    amount?: number;
    description?: string | null;
    occurs_on?: string;
    recurrence?: RecurrenceFreq;
    recurrence_until?: string | null;
    gross_amount?: number | null;
    pension_own_pct?: number | null;
    pension_employer_pct?: number | null;
    other_deduction_amount?: number | null;
    other_deduction_label?: string | null;
    income_role?: IncomeRole | null;
  };
  submitLabel: string;
  cancelHref: string;
  error?: string;
};

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "1 234.56" / "1234,56" / "" → øre or null. Same parser as parseAmountToOere
// — reused here so the live-summary can interpret what's currently in the
// AmountInput fields without going through form serialisation.
function parseLooseAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  return parseAmountToOere(t);
}

function parseLoosePct(raw: string): number | null {
  const t = raw.trim().replace(/,/g, '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function IncomeForm({
  action,
  accounts,
  familyMembers,
  defaultValues = {},
  submitLabel,
  cancelHref,
  error,
}: Props) {
  const dv = defaultValues;
  const visibleAccounts = accounts.filter(
    (a) => !a.archived || a.id === dv.account_id
  );

  // We mirror every numeric field's current text into state so the live
  // lønseddel-summary can recompute on every keystroke. AmountInput is
  // uncontrolled — we use onInput on the form to capture changes.
  const [grossStr, setGrossStr] = useState(
    dv.gross_amount != null ? formatOereForInput(dv.gross_amount) : ''
  );
  const [netStr, setNetStr] = useState(
    dv.amount != null ? formatOereForInput(dv.amount) : ''
  );
  const [pensionOwnStr, setPensionOwnStr] = useState(
    dv.pension_own_pct != null ? String(dv.pension_own_pct) : ''
  );
  const [pensionEmployerStr, setPensionEmployerStr] = useState(
    dv.pension_employer_pct != null ? String(dv.pension_employer_pct) : ''
  );
  const [deductionStr, setDeductionStr] = useState(
    dv.other_deduction_amount != null ? formatOereForInput(dv.other_deduction_amount) : ''
  );
  const [deductionLabelStr, setDeductionLabelStr] = useState(dv.other_deduction_label ?? '');

  function handleInput(e: React.FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLInputElement;
    switch (t.name) {
      case 'gross_amount':            setGrossStr(t.value); break;
      case 'amount':                  setNetStr(t.value); break;
      case 'pension_own_pct':         setPensionOwnStr(t.value); break;
      case 'pension_employer_pct':    setPensionEmployerStr(t.value); break;
      case 'other_deduction_amount':  setDeductionStr(t.value); break;
      case 'other_deduction_label':   setDeductionLabelStr(t.value); break;
    }
  }

  const gross = parseLooseAmount(grossStr);
  const net = parseLooseAmount(netStr);
  const pensionOwnPct = parseLoosePct(pensionOwnStr);
  const deduction = parseLooseAmount(deductionStr);

  // Lønseddel-math (only meaningful when bruttoløn is set):
  //   pension egen-bidrag = gross × pension_own_pct%
  //   skattepligtig efter pension = gross − pension egen − A-kasse − fagforening − andet
  //   beregnet skat = skattepligtig − netto  (kun vises hvis netto er sat)
  // Vi viser dem i den rækkefølge en lønseddel typisk er bygget op.
  const pensionOwnAmount =
    gross != null && pensionOwnPct != null && pensionOwnPct > 0
      ? Math.round((gross * pensionOwnPct) / 100)
      : null;

  const showSummary = gross != null && gross > 0;

  let runningTotal: number | null = null;
  if (showSummary) {
    runningTotal = gross;
    if (pensionOwnAmount != null) runningTotal -= pensionOwnAmount;
    if (deduction != null) runningTotal -= deduction;
  }
  const computedTax = runningTotal != null && net != null ? runningTotal - net : null;

  return (
    <form action={action} onInput={handleInput} className="space-y-5">
      {/* Hovedindkomst vs biindkomst — hidden hvis det er sat fra parent
          (lønudbetaling-flow forudvælger 'primary'). Ellers null = ikke
          klassificeret, og /indkomst-listen viser banneret "fordel disse poster". */}
      {dv.income_role && (
        <input type="hidden" name="income_role" value={dv.income_role} />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="family_member_id" className={labelClass}>
            Tilhører <span className="text-neutral-400">(valgfrit)</span>
          </label>
          <select
            id="family_member_id"
            name="family_member_id"
            defaultValue={dv.family_member_id ?? ''}
            className={fieldClass}
          >
            <option value="">Husstanden</option>
            {familyMembers.map((fm) => (
              <option key={fm.id} value={fm.id}>{fm.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="account_id" className={labelClass}>Indsættes på konto</label>
          <select
            id="account_id"
            name="account_id"
            required
            defaultValue={dv.account_id ?? ''}
            className={fieldClass}
          >
            <option value="" disabled>Vælg konto</option>
            {visibleAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? ' (arkiveret)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className={labelClass}>
            Nettoløn <span className="text-neutral-400">(kr.)</span>
          </label>
          <AmountInput
            id="amount"
            name="amount"
            required
            defaultValue={netStr}
          />
        </div>
        <div>
          <label htmlFor="occurs_on" className={labelClass}>Dato</label>
          <input
            id="occurs_on"
            name="occurs_on"
            type="date"
            required
            defaultValue={dv.occurs_on ?? todayISO()}
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Beskrivelse <span className="text-neutral-400">(valgfrit)</span>
        </label>
        <input
          id="description"
          name="description"
          type="text"
          defaultValue={dv.description ?? ''}
          placeholder="F.eks. Månedsløn, freelance, side-hustle"
          className={fieldClass}
        />
      </div>

      <RecurrenceField
        defaultRecurrence={dv.recurrence ?? 'monthly'}
        defaultUntil={dv.recurrence_until}
      />

      <fieldset className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
        <legend className="px-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Lønseddel <span className="lowercase text-neutral-400">(valgfrit — udfyld for fuldt billede)</span>
        </legend>
        <p className="mb-4 text-xs text-neutral-500">
          Indtast bruttoløn og de fradrag der trækkes via din lønseddel.
          Vi beregner nedenfor hvad der svarer til skat — så du kan
          sammenligne mod det faktiske beløb på din lønseddel.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="gross_amount" className={labelClass}>
              Bruttoløn <span className="text-neutral-400">(kr.)</span>
            </label>
            <AmountInput
              id="gross_amount"
              name="gross_amount"
              defaultValue={grossStr}
              placeholder="50 000.00"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label htmlFor="other_deduction_label" className={labelClass}>
                Fradrag <span className="text-neutral-400">(label — valgfrit)</span>
              </label>
              <input
                id="other_deduction_label"
                name="other_deduction_label"
                type="text"
                defaultValue={deductionLabelStr}
                placeholder="F.eks. A-kasse, fagforening, frokost"
                className={fieldClass}
              />
            </div>
            <div className="sm:w-40">
              <label htmlFor="other_deduction_amount" className={labelClass}>
                Beløb <span className="text-neutral-400">(kr.)</span>
              </label>
              <AmountInput
                id="other_deduction_amount"
                name="other_deduction_amount"
                defaultValue={deductionStr}
                placeholder="980.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pension_own_pct" className={labelClass}>
                Pension egen <span className="text-neutral-400">(%)</span>
              </label>
              <input
                id="pension_own_pct"
                name="pension_own_pct"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={pensionOwnStr}
                placeholder="5"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="pension_employer_pct" className={labelClass}>
                Pension firma <span className="text-neutral-400">(%)</span>
              </label>
              <input
                id="pension_employer_pct"
                name="pension_employer_pct"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={pensionEmployerStr}
                placeholder="10"
                className={fieldClass}
              />
            </div>
          </div>
        </div>

        {showSummary && (
          <div className="mt-5 rounded-md border border-neutral-300 bg-white p-3">
            <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Beregnet lønseddel
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              <SummaryRow label="Bruttoløn" amount={gross} sign="+" emphasis />
              {pensionOwnAmount != null && pensionOwnAmount > 0 && (
                <SummaryRow
                  label={`Pension egen (${pensionOwnPct}%)`}
                  amount={pensionOwnAmount}
                  sign="-"
                />
              )}
              {deduction != null && deduction > 0 && (
                <SummaryRow
                  label={deductionLabelStr.trim() || 'Fradrag'}
                  amount={deduction}
                  sign="-"
                />
              )}
              {runningTotal != null && (
                <SummaryRow
                  label="Skattepligtig efter fradrag"
                  amount={runningTotal}
                  divider
                  emphasis
                />
              )}
              {computedTax != null && computedTax > 0 && (
                <SummaryRow
                  label="Skat (beregnet)"
                  amount={computedTax}
                  sign="-"
                  hint="brutto − fradrag − netto"
                />
              )}
              {net != null && net > 0 && (
                <SummaryRow label="Nettoløn (du har)" amount={net} divider emphasis />
              )}
            </dl>
            {computedTax != null && computedTax < 0 && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                Den indtastede nettoløn er højere end brutto minus fradrag —
                tjek tallene en ekstra gang.
              </p>
            )}
          </div>
        )}
      </fieldset>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          {submitLabel}
        </button>
        <Link
          href={cancelHref}
          className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
        >
          Annullér
        </Link>
      </div>
    </form>
  );
}

function SummaryRow({
  label,
  amount,
  sign,
  emphasis = false,
  divider = false,
  hint,
}: {
  label: string;
  amount: number;
  sign?: '+' | '-';
  emphasis?: boolean;
  divider?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${
        divider ? 'border-t border-neutral-200 pt-1.5' : ''
      }`}
    >
      <dt className={`text-neutral-${emphasis ? '900 font-medium' : '600'}`}>
        {label}
        {hint && <span className="ml-1.5 text-xs text-neutral-400">({hint})</span>}
      </dt>
      <dd
        className={`font-mono tabnum text-right ${
          emphasis ? 'font-semibold text-neutral-900' : 'text-neutral-700'
        }`}
      >
        {sign === '-' ? '−' : sign === '+' ? '' : ''}
        {formatAmount(amount)} kr
      </dd>
    </div>
  );
}
