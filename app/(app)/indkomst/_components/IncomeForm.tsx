'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AmountInput } from '../../_components/AmountInput';
import { RecurrenceField } from '../../_components/RecurrenceField';
import { SubmitButton } from '../../_components/SubmitButton';
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
    tax_rate_pct?: number | null;
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
// - reused here so the live-summary can interpret what's currently in the
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
  // uncontrolled - we use onInput on the form to capture changes.
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
  const [taxRateStr, setTaxRateStr] = useState(
    dv.tax_rate_pct != null ? String(dv.tax_rate_pct) : ''
  );

  function handleInput(e: React.FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLInputElement;
    switch (t.name) {
      case 'gross_amount':            setGrossStr(t.value); break;
      case 'amount':                  setNetStr(t.value); break;
      case 'pension_own_pct':         setPensionOwnStr(t.value); break;
      case 'pension_employer_pct':    setPensionEmployerStr(t.value); break;
      case 'other_deduction_amount':  setDeductionStr(t.value); break;
      case 'tax_rate_pct':            setTaxRateStr(t.value); break;
    }
  }

  const gross = parseLooseAmount(grossStr);
  const net = parseLooseAmount(netStr);
  const pensionOwnPct = parseLoosePct(pensionOwnStr);
  const skattefradrag = parseLooseAmount(deductionStr);
  const taxRatePct = parseLoosePct(taxRateStr);

  // AM-bidrag er fast 8% i Danmark - gælder for alle lønmodtagere.
  // Vi auto-beregner den så brugeren ikke skal indtaste den.
  const AM_RATE_PCT = 8;

  // Lønseddel-math:
  //   AM-grundlag           = brutto − pension egen
  //   AM-bidrag             = AM-grundlag × 8 %
  //   Skattegrundlag        = AM-grundlag − AM-bidrag
  //   Beskatningsgrundlag   = Skattegrundlag − skattefradrag
  //   A-skat                = Beskatningsgrundlag × trækprocent
  //   Forudsagt netto       = brutto − pension egen − AM-bidrag − A-skat
  //
  // Hvis brugeren har udfyldt netto OG vi har trækprocent, kan vi sammen-
  // ligne forudsagt vs faktisk og fange diskrepanser.
  const pensionOwnAmount =
    gross != null && pensionOwnPct != null && pensionOwnPct > 0
      ? Math.round((gross * pensionOwnPct) / 100)
      : null;

  const showSummary = gross != null && gross > 0;

  let amGrundlag: number | null = null;
  let amBidrag: number | null = null;
  let skattegrundlag: number | null = null;
  let beskatningsgrundlag: number | null = null;
  let predictedTax: number | null = null;
  let predictedNet: number | null = null;
  if (showSummary && gross != null) {
    amGrundlag = gross - (pensionOwnAmount ?? 0);
    amBidrag = Math.round((amGrundlag * AM_RATE_PCT) / 100);
    skattegrundlag = amGrundlag - amBidrag;
    if (skattefradrag != null) {
      beskatningsgrundlag = Math.max(0, skattegrundlag - skattefradrag);
    }
    if (taxRatePct != null && taxRatePct > 0 && beskatningsgrundlag != null) {
      predictedTax = Math.round((beskatningsgrundlag * taxRatePct) / 100);
      predictedNet = gross - (pensionOwnAmount ?? 0) - amBidrag - predictedTax;
    }
  }

  // Diff mellem forudsagt og faktisk netto. Tolerance ±150 kr fanger
  // småposter (ATP, kantinekøb) som vi ikke modellerer.
  const netDiff =
    predictedNet != null && net != null ? net - predictedNet : null;
  const NET_TOLERANCE_OERE = 15000; // 150 kr i øre

  return (
    <form action={action} onInput={handleInput} className="space-y-5">
      {/* Hovedindkomst vs biindkomst - hidden hvis det er sat fra parent
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
          Lønseddel <span className="lowercase text-neutral-400">(valgfrit - udfyld for fuldt billede)</span>
        </legend>
        <p className="mb-4 text-xs text-neutral-500">
          Indtast bruttoløn og de fradrag der trækkes via din lønseddel.
          Vi beregner nedenfor hvad der svarer til skat - så du kan
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

          <div>
            <label htmlFor="other_deduction_amount" className={labelClass}>
              Skattefradrag <span className="text-neutral-400">(kr. - fra din lønseddel)</span>
            </label>
            <AmountInput
              id="other_deduction_amount"
              name="other_deduction_amount"
              defaultValue={deductionStr}
              placeholder="4 800.00"
            />
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

          <div>
            <label htmlFor="tax_rate_pct" className={labelClass}>
              Trækprocent <span className="text-neutral-400">(% - fra din lønseddel)</span>
            </label>
            <input
              id="tax_rate_pct"
              name="tax_rate_pct"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={taxRateStr}
              placeholder="39"
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Sammen med skattefradrag forudsiger vi din netto. Hvis tallene
              ikke matcher din lønseddel, kan vi spotte hvad der mangler.
            </p>
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
              {amBidrag != null && (
                <SummaryRow
                  label={`AM-bidrag (${AM_RATE_PCT}%)`}
                  amount={amBidrag}
                  sign="-"
                  hint="fast i DK - beregnes af brutto efter pension"
                />
              )}
              {skattegrundlag != null && (
                <SummaryRow
                  label="Skattegrundlag"
                  amount={skattegrundlag}
                  divider
                  emphasis
                />
              )}
              {skattefradrag != null && skattefradrag > 0 && (
                <SummaryRow
                  label="Skattefradrag"
                  amount={skattefradrag}
                  sign="-"
                />
              )}
              {beskatningsgrundlag != null && skattefradrag != null && skattefradrag > 0 && (
                <SummaryRow
                  label="Beskatningsgrundlag"
                  amount={beskatningsgrundlag}
                  divider
                  emphasis
                />
              )}
              {predictedTax != null && (
                <SummaryRow
                  label={`A-skat (${taxRatePct}%)`}
                  amount={predictedTax}
                  sign="-"
                />
              )}
              {predictedNet != null && (
                <SummaryRow
                  label="Forudsagt netto"
                  amount={predictedNet}
                  divider
                  emphasis
                />
              )}
              {net != null && net > 0 && (
                <SummaryRow label="Nettoløn (du har)" amount={net} emphasis />
              )}
            </dl>

            {/* Diff-indikator når både forudsagt og faktisk netto er sat */}
            {netDiff != null && (
              Math.abs(netDiff) <= NET_TOLERANCE_OERE ? (
                <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
                  ✓ Stemmer med din lønseddel
                  {Math.abs(netDiff) > 0 && (
                    <> (forskel: {netDiff > 0 ? '+' : '−'}{formatAmount(Math.abs(netDiff))} kr)</>
                  )}
                </p>
              ) : (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                  Forskel: {netDiff > 0 ? '+' : '−'}{formatAmount(Math.abs(netDiff))} kr -
                  sandsynligvis ATP, kantinekøb eller andre småfradrag.
                  {netDiff > 0
                    ? ' (Din netto er højere end forudsagt - tjek pension/trækprocent.)'
                    : ' (Din netto er lavere end forudsagt - der er sandsynligvis ekstra fradrag.)'}
                </p>
              )
            )}

            {/* Sanity-check når trækprocent ikke er sat: viser stadig den
                bagudregnede skat så formen er bagudkompatibel. */}
            {predictedTax == null && net != null && net > 0 && skattegrundlag != null && (
              <p className="mt-3 text-xs text-neutral-500">
                Tilføj din trækprocent for at få en forudsagt netto og se om
                tallene matcher din lønseddel.
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
        <SubmitButton>{submitLabel}</SubmitButton>
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
