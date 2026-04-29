'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarClock, Wand2 } from 'lucide-react';
import { AmountInput } from '../../_components/AmountInput';
import { RecurrenceField } from '../../_components/RecurrenceField';
import {
  INVESTMENT_TYPE_ANNUAL_CAP_KR,
  INVESTMENT_TYPE_LABEL_DA,
  formatAmount,
  formatOereForInput,
  formatShortDateDA,
} from '@/lib/format';
import { nextLastBankingDay, toISODate } from '@/lib/banking-days';
import type { Account, RecurrenceFreq } from '@/lib/database.types';

// Form'et skal kunne læse kind + investment_type på destinations-kontoen for
// at kunne foreslå "del årligt loft på 12"-knappen. Vi udvider derfor det
// account-shape vi accepterer fra Pick<id|name|archived> til at inkludere
// dem også. Begge kalde-sites har allerede full Account fra getAccounts().
type FormAccount = Pick<
  Account,
  'id' | 'name' | 'archived' | 'kind' | 'investment_type'
>;

type Props = {
  action: (formData: FormData) => Promise<void>;
  accounts: FormAccount[];
  defaultValues?: {
    from_account_id?: string;
    to_account_id?: string;
    amount?: number;
    description?: string | null;
    occurs_on?: string;
    recurrence?: RecurrenceFreq;
    recurrence_until?: string | null;
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

export function TransferForm({
  action,
  accounts,
  defaultValues = {},
  submitLabel,
  cancelHref,
  error,
}: Props) {
  const dv = defaultValues;
  // Same approach as TransactionForm — keep an archived account in the dropdown
  // when it's already the row's selected value, so editing doesn't lose it.
  const visibleAccounts = (selectedId?: string) =>
    accounts.filter((a) => !a.archived || a.id === selectedId);

  // Date er controlled så "Sidste bankdag"-knappen kan udfylde feltet.
  // Reglen: sidste hverdag i måneden (ingen helligdage modelleret) — samme
  // definition overalt i appen, importeret fra banking-days.ts.
  const [occursOn, setOccursOn] = useState(dv.occurs_on ?? todayISO());

  function fillLastBankingDay() {
    setOccursOn(toISODate(nextLastBankingDay(new Date())));
  }

  // Til-konto er controlled så vi kan reagere på valget og foreslå et
  // "fyld årligt loft / 12"-shortcut når kontoen er en aldersopsparing
  // eller børneopsparing. AmountInput er uncontrolled, så vi bruger key-
  // remount-tricket til at programmatisk opdatere dens defaultValue.
  const [toAccountId, setToAccountId] = useState(dv.to_account_id ?? '');
  const [amountSeed, setAmountSeed] = useState(
    dv.amount != null ? formatOereForInput(dv.amount) : ''
  );
  const [amountKey, setAmountKey] = useState(0);

  const selectedTo = accounts.find((a) => a.id === toAccountId);
  const annualCapKr =
    selectedTo?.investment_type
      ? INVESTMENT_TYPE_ANNUAL_CAP_KR[selectedTo.investment_type]
      : undefined;
  // Hele kroner pr. måned — vi runder ned så vi aldrig foreslår over loftet
  // (ved 9.900 kr/år giver det 825 kr/md som er præcis 9.900 totalt). For
  // 6.000 kr/år bliver det 500 kr/md, også eksakt.
  const monthlyCapOere =
    annualCapKr != null ? Math.floor((annualCapKr * 100) / 12) : null;

  function fillAnnualCap() {
    if (monthlyCapOere == null) return;
    setAmountSeed(formatOereForInput(monthlyCapOere));
    setAmountKey((k) => k + 1);
  }

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="from_account_id" className={labelClass}>Fra konto</label>
          <select
            id="from_account_id"
            name="from_account_id"
            required
            defaultValue={dv.from_account_id ?? ''}
            className={fieldClass}
          >
            <option value="" disabled>Vælg konto</option>
            {visibleAccounts(dv.from_account_id).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? ' (arkiveret)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="to_account_id" className={labelClass}>Til konto</label>
          <select
            id="to_account_id"
            name="to_account_id"
            required
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            className={fieldClass}
          >
            <option value="" disabled>Vælg konto</option>
            {visibleAccounts(toAccountId).map((a) => (
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
            Beløb <span className="text-neutral-400">(kr.)</span>
          </label>
          <AmountInput
            key={amountKey}
            id="amount"
            name="amount"
            required
            defaultValue={amountSeed}
          />
          {monthlyCapOere != null && annualCapKr != null && selectedTo?.investment_type && (
            <button
              type="button"
              onClick={fillAnnualCap}
              className="mt-1 inline-flex items-center gap-1 text-xs text-emerald-700 transition hover:text-emerald-900"
            >
              <Wand2 className="h-3 w-3" />
              Brug årligt loft for{' '}
              {INVESTMENT_TYPE_LABEL_DA[selectedTo.investment_type]}
              <span className="text-emerald-600">
                ({formatAmount(monthlyCapOere)} kr/md ={' '}
                {annualCapKr.toLocaleString('da-DK')} kr/år)
              </span>
            </button>
          )}
        </div>
        <div>
          <label htmlFor="occurs_on" className={labelClass}>Dato</label>
          <input
            id="occurs_on"
            name="occurs_on"
            type="date"
            required
            value={occursOn}
            onChange={(e) => setOccursOn(e.target.value)}
            className={fieldClass}
          />
          <button
            type="button"
            onClick={fillLastBankingDay}
            className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-500 transition hover:text-neutral-900"
          >
            <CalendarClock className="h-3 w-3" />
            Sidste bankdag i måneden
            <span className="text-neutral-400">
              ({formatShortDateDA(toISODate(nextLastBankingDay(new Date())))})
            </span>
          </button>
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
          placeholder="F.eks. Buffer-flytning"
          className={fieldClass}
        />
      </div>

      <RecurrenceField
        defaultRecurrence={dv.recurrence ?? 'once'}
        defaultUntil={dv.recurrence_until}
      />

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
