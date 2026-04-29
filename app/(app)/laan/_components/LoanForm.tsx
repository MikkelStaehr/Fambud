'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AmountInput } from '../../_components/AmountInput';
import { SubmitButton } from '../../_components/SubmitButton';
import { formatAmount, formatOereForInput, parseAmountToOere } from '@/lib/format';
import type { LoanType, RecurrenceFreq } from '@/lib/database.types';

const LOAN_TYPE_LABELS: { value: LoanType; label: string; desc: string }[] = [
  { value: 'realkredit', label: 'Realkreditlån', desc: 'Boliglån via Realkredit Danmark, Nykredit, Totalkredit.' },
  { value: 'banklan', label: 'Banklån', desc: 'Billån, studielån, andet privat lån.' },
  { value: 'kreditkort', label: 'Kreditkort', desc: 'MasterCard, Visa, Coop MasterCard.' },
  { value: 'kassekredit', label: 'Kassekredit', desc: 'Trækningsret på lønkontoen.' },
  { value: 'andet', label: 'Andet', desc: 'Andet kreditprodukt.' },
];

const PAYMENT_INTERVAL_LABELS: { value: RecurrenceFreq; label: string }[] = [
  { value: 'monthly', label: 'Månedligt' },
  { value: 'quarterly', label: 'Kvartalvis' },
  { value: 'semiannual', label: 'Halvårligt' },
  { value: 'yearly', label: 'Årligt' },
];

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    name?: string;
    owner_name?: string | null;
    loan_type?: LoanType | null;
    lender?: string | null;
    opening_balance?: number;
    original_principal?: number | null;
    payment_amount?: number | null;
    payment_interval?: RecurrenceFreq;
    payment_start_date?: string | null;
    payment_rente?: number | null;
    payment_afdrag?: number | null;
    payment_bidrag?: number | null;
    payment_rabat?: number | null;
    term_months?: number | null;
    interest_rate?: number | null;
    apr?: number | null;
  };
  submitLabel: string;
  cancelHref: string;
  error?: string;
};

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

// "1 234.56" / "1.234,56" / "" → øre or null. Mirrors parseAmountToOere
// but accepts the negative case for rabat.
function parseLooseAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  return parseAmountToOere(t);
}

export function LoanForm({
  action,
  defaultValues = {},
  submitLabel,
  cancelHref,
  error,
}: Props) {
  const dv = defaultValues;
  const isShared = dv.owner_name === 'Fælles';

  // Live-computed sum of the breakdown so the user can verify their input
  // matches the calculated ydelse. Mirror the Insert: rente + afdrag + bidrag
  // + rabat (rabat is signed; user types it as positive but writes minus).
  const [rente, setRente] = useState(
    dv.payment_rente != null ? formatOereForInput(dv.payment_rente) : ''
  );
  const [afdrag, setAfdrag] = useState(
    dv.payment_afdrag != null ? formatOereForInput(dv.payment_afdrag) : ''
  );
  const [bidrag, setBidrag] = useState(
    dv.payment_bidrag != null ? formatOereForInput(dv.payment_bidrag) : ''
  );
  const [rabat, setRabat] = useState(
    dv.payment_rabat != null ? formatOereForInput(dv.payment_rabat) : ''
  );

  // Løbetid-felt har to inputs der altid synkroniseres: År (UI-helper, posts
  // ikke) og Måneder (name="term_months", er dem databasen ser). Brugeren
  // kan skrive i hvad end der falder dem mest naturligt.
  const initialMonths = dv.term_months ?? null;
  const [yearsStr, setYearsStr] = useState(
    initialMonths != null
      ? Number.isInteger(initialMonths / 12)
        ? String(initialMonths / 12)
        : (initialMonths / 12).toFixed(2)
      : ''
  );
  const [monthsStr, setMonthsStr] = useState(
    initialMonths != null ? String(initialMonths) : ''
  );

  function handleYearsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setYearsStr(v);
    if (v.trim() === '') {
      setMonthsStr('');
      return;
    }
    // Accept comma as decimal — Danish keyboards default to it.
    const n = Number(v.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) {
      setMonthsStr(String(Math.round(n * 12)));
    }
  }

  function handleMonthsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setMonthsStr(v);
    if (v.trim() === '') {
      setYearsStr('');
      return;
    }
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) {
      const y = n / 12;
      setYearsStr(Number.isInteger(y) ? String(y) : y.toFixed(2));
    }
  }

  const breakdownSum =
    (parseLooseAmount(rente) ?? 0) +
    (parseLooseAmount(afdrag) ?? 0) +
    (parseLooseAmount(bidrag) ?? 0) +
    (parseLooseAmount(rabat) ?? 0);
  const anyBreakdown = [rente, afdrag, bidrag, rabat].some((v) => v.trim().length > 0);

  function handleInput(e: React.FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLInputElement;
    if (t.name === 'payment_rente') setRente(t.value);
    else if (t.name === 'payment_afdrag') setAfdrag(t.value);
    else if (t.name === 'payment_bidrag') setBidrag(t.value);
    else if (t.name === 'payment_rabat') setRabat(t.value);
  }

  return (
    <form action={action} onInput={handleInput} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>Navn</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={dv.name ?? ''}
            placeholder="F.eks. Realkredit Danmark"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="loan_type" className={labelClass}>Type</label>
          <select
            id="loan_type"
            name="loan_type"
            defaultValue={dv.loan_type ?? ''}
            className={fieldClass}
          >
            <option value="">Vælg type</option>
            {LOAN_TYPE_LABELS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lender" className={labelClass}>
            Långiver <span className="text-neutral-400">(valgfrit)</span>
          </label>
          <input
            id="lender"
            name="lender"
            type="text"
            defaultValue={dv.lender ?? ''}
            placeholder="F.eks. Nordea, Realkredit Danmark"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="ownership" className={labelClass}>Ejer</label>
          <select
            id="ownership"
            name="ownership"
            defaultValue={isShared ? 'shared' : 'personal'}
            className={fieldClass}
          >
            <option value="personal">Personlig</option>
            <option value="shared">Fælles</option>
          </select>
        </div>
      </div>

      <fieldset className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
        <legend className="px-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Beløb
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="original_principal" className={labelClass}>
              Hovedstol <span className="text-neutral-400">(kr. — valgfrit)</span>
            </label>
            <AmountInput
              id="original_principal"
              name="original_principal"
              defaultValue={dv.original_principal != null ? formatOereForInput(dv.original_principal) : ''}
              placeholder="2 455 000.00"
            />
            <p className="mt-1 text-xs text-neutral-500">Oprindeligt lånebeløb</p>
          </div>
          <div>
            <label htmlFor="opening_balance" className={labelClass}>
              Gæld <span className="text-neutral-400">(kr.)</span>
            </label>
            <AmountInput
              id="opening_balance"
              name="opening_balance"
              defaultValue={
                dv.opening_balance != null
                  ? formatOereForInput(Math.abs(dv.opening_balance))
                  : ''
              }
              placeholder="2 381 448.85"
            />
            <p className="mt-1 text-xs text-neutral-500">Aktuelt skyldigt beløb</p>
          </div>
        </div>
        <div className="mt-4">
          <div className={labelClass}>Løbetid <span className="text-neutral-400">(valgfrit)</span></div>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            <div>
              <input
                id="term_years"
                type="text"
                inputMode="decimal"
                value={yearsStr}
                onChange={handleYearsChange}
                placeholder="30"
                className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <label htmlFor="term_years" className="mt-1 block text-xs text-neutral-500">
                År
              </label>
            </div>
            <div>
              <input
                id="term_months"
                name="term_months"
                type="number"
                min="1"
                value={monthsStr}
                onChange={handleMonthsChange}
                placeholder="360"
                className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <label htmlFor="term_months" className="mt-1 block text-xs text-neutral-500">
                Måneder
              </label>
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Skriv i den enhed du har for hånden — det andet felt opdaterer sig automatisk.
          </p>
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
        <legend className="px-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Betalingsinterval og ydelse
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="payment_interval" className={labelClass}>
              Betalingsinterval
            </label>
            <select
              id="payment_interval"
              name="payment_interval"
              defaultValue={dv.payment_interval ?? 'monthly'}
              className={fieldClass}
            >
              {PAYMENT_INTERVAL_LABELS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Realkredit er typisk kvartalvis · banklån typisk månedligt
            </p>
          </div>
          <div>
            <label htmlFor="payment_start_date" className={labelClass}>
              Seneste eller første betalingsdato <span className="text-neutral-400">(valgfrit)</span>
            </label>
            <input
              id="payment_start_date"
              name="payment_start_date"
              type="date"
              defaultValue={dv.payment_start_date ?? ''}
              className={fieldClass}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Den seneste ydelsesdato du kender — eller første hvis lånet er
              nyt. Næste betalingsdato beregnes ud fra intervallet.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="payment_amount" className={labelClass}>
            Samlet ydelse <span className="text-neutral-400">(kr. pr. interval — valgfrit)</span>
          </label>
          <AmountInput
            id="payment_amount"
            name="payment_amount"
            defaultValue={dv.payment_amount != null ? formatOereForInput(dv.payment_amount) : ''}
            placeholder="38 141.09"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Brug for banklån / kreditkort. For realkredit udfyld nedbrydningen
            nedenfor — ydelsen beregnes så automatisk.
          </p>
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
        <legend className="px-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Detaljeret nedbrydning <span className="lowercase text-neutral-400">(typisk realkredit)</span>
        </legend>
        <p className="mb-4 text-xs text-neutral-500">
          Bryd ydelsen op i sine bestanddele. Når lånet pushes til budgettet
          bliver hver del en underpost på den tilknyttede transaktion.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="payment_rente" className={labelClass}>
              Rente <span className="text-neutral-400">(kr.)</span>
            </label>
            <AmountInput
              id="payment_rente"
              name="payment_rente"
              defaultValue={rente}
              placeholder="23 927.46"
            />
          </div>
          <div>
            <label htmlFor="payment_afdrag" className={labelClass}>
              Afdrag <span className="text-neutral-400">(kr.)</span>
            </label>
            <AmountInput
              id="payment_afdrag"
              name="payment_afdrag"
              defaultValue={afdrag}
              placeholder="11 296.88"
            />
          </div>
          <div>
            <label htmlFor="payment_bidrag" className={labelClass}>
              Bidrag <span className="text-neutral-400">(kr.)</span>
            </label>
            <AmountInput
              id="payment_bidrag"
              name="payment_bidrag"
              defaultValue={bidrag}
              placeholder="4 412.22"
            />
          </div>
          <div>
            <label htmlFor="payment_rabat" className={labelClass}>
              Rabat <span className="text-neutral-400">(kr. — minus for KundeKroner)</span>
            </label>
            <AmountInput
              id="payment_rabat"
              name="payment_rabat"
              defaultValue={rabat}
              placeholder="-1 495.47"
            />
          </div>
        </div>

        {/* Capture live-controlled values via hidden mirrors so the form still
            posts whatever's in the visible AmountInputs. AmountInput is
            uncontrolled, so we drive it via separate state + sync via
            hidden inputs. Actually AmountInput emits via its own name —
            no mirror needed. We just use the state for the live-sum below. */}

        {anyBreakdown && (
          <div className="mt-4 rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-neutral-600">Beregnet ydelse efter rabat:</span>
              <span className="font-mono tabnum text-base font-semibold text-neutral-900">
                {formatAmount(breakdownSum)} kr
              </span>
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-md border border-neutral-200 bg-neutral-50 p-4">
        <legend className="px-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Rente
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="interest_rate" className={labelClass}>
              Rente <span className="text-neutral-400">(% — valgfrit)</span>
            </label>
            <input
              id="interest_rate"
              name="interest_rate"
              type="text"
              inputMode="decimal"
              defaultValue={dv.interest_rate ?? ''}
              placeholder="4.00"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="apr" className={labelClass}>
              ÅOP <span className="text-neutral-400">(% — valgfrit)</span>
            </label>
            <input
              id="apr"
              name="apr"
              type="text"
              inputMode="decimal"
              defaultValue={dv.apr ?? ''}
              placeholder="4.20"
              className={fieldClass}
            />
          </div>
        </div>
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
