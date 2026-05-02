'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AmountInput } from '../../_components/AmountInput';
import { SubmitButton } from '../../_components/SubmitButton';
import {
  formatOereForInput,
  INVESTMENT_TYPE_LABEL_DA,
  INVESTMENT_TYPE_CAP_DA,
  SAVINGS_PURPOSE_DESC_DA,
  SAVINGS_PURPOSE_LABEL_DA,
} from '@/lib/format';
import type {
  AccountKind,
  InvestmentType,
  SavingsPurpose,
} from '@/lib/database.types';

const KIND_OPTIONS: { value: AccountKind; label: string }[] = [
  { value: 'checking', label: 'Lønkonto' },
  { value: 'budget', label: 'Budgetkonto' },
  { value: 'household', label: 'Husholdningskonto' },
  { value: 'savings', label: 'Opsparing' },
  { value: 'investment', label: 'Investering' },
  { value: 'credit', label: 'Kredit' },
  { value: 'cash', label: 'Kontanter' },
  { value: 'other', label: 'Anden' },
];

const INVESTMENT_TYPE_ORDER: InvestmentType[] = [
  'aktiedepot',
  'aktiesparekonto',
  'aldersopsparing',
  'pension',
  'boerneopsparing',
];

const SAVINGS_PURPOSE_ORDER: SavingsPurpose[] = [
  'buffer',
  'predictable_unexpected',
];

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    name?: string;
    owner_name?: string | null;
    kind?: AccountKind;
    investment_type?: InvestmentType | null;
    savings_purposes?: SavingsPurpose[] | null;
    opening_balance?: number;
    editable_by_all?: boolean;
  };
  submitLabel: string;
  cancelHref: string;
  error?: string;
};

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

export function AccountForm({ action, defaultValues = {}, submitLabel, cancelHref, error }: Props) {
  const dv = defaultValues;
  // Track kind locally so investment_type-feltet kan vises/skjules dynamisk.
  const [kind, setKind] = useState<AccountKind>(dv.kind ?? 'checking');
  const [investmentType, setInvestmentType] = useState<InvestmentType | ''>(
    dv.investment_type ?? ''
  );
  // Multi-select: én konto kan dække begge formål samtidig (typisk for
  // familier der har én "Bufferkonto" til både nødfond og forudsigelige
  // uforudsete).
  const [savingsPurposes, setSavingsPurposes] = useState<SavingsPurpose[]>(
    dv.savings_purposes ?? []
  );
  const showInvestmentType = kind === 'investment';
  const showSavingsPurpose = kind === 'savings';
  const cap = investmentType ? INVESTMENT_TYPE_CAP_DA[investmentType] : null;

  function togglePurpose(p: SavingsPurpose) {
    setSavingsPurposes((curr) =>
      curr.includes(p) ? curr.filter((x) => x !== p) : [...curr, p]
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="name" className={labelClass}>Navn</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={dv.name ?? ''}
          placeholder="Lønkonto"
          className={fieldClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="kind" className={labelClass}>Type</label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as AccountKind)}
            className={fieldClass}
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="owner_name" className={labelClass}>
            Ejer <span className="text-neutral-400">(valgfrit)</span>
          </label>
          <input
            id="owner_name"
            name="owner_name"
            type="text"
            defaultValue={dv.owner_name ?? ''}
            placeholder="Mikkel / Fælles / barnets navn"
            className={fieldClass}
          />
        </div>
      </div>

      {showInvestmentType && (
        <div>
          <label htmlFor="investment_type" className={labelClass}>
            Investeringstype <span className="text-neutral-400">(valgfrit)</span>
          </label>
          <select
            id="investment_type"
            name="investment_type"
            value={investmentType}
            onChange={(e) => setInvestmentType(e.target.value as InvestmentType | '')}
            className={fieldClass}
          >
            <option value="">— Vælg type —</option>
            {INVESTMENT_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {INVESTMENT_TYPE_LABEL_DA[t]}
              </option>
            ))}
          </select>
          {cap && (
            <p className="mt-1.5 text-xs text-neutral-500">{cap}</p>
          )}
        </div>
      )}

      {showSavingsPurpose && (
        <div>
          <span className={labelClass}>
            Specialfunktion <span className="text-neutral-400">(valgfrit — vælg én eller begge)</span>
          </span>
          <div className="mt-2 space-y-2">
            {SAVINGS_PURPOSE_ORDER.map((p) => {
              const checked = savingsPurposes.includes(p);
              return (
                <label
                  key={p}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md border border-neutral-200 bg-white p-3 text-sm transition hover:border-neutral-300"
                >
                  <input
                    type="checkbox"
                    name="savings_purposes"
                    value={p}
                    checked={checked}
                    onChange={() => togglePurpose(p)}
                    className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-neutral-900">
                      {SAVINGS_PURPOSE_LABEL_DA[p]}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {SAVINGS_PURPOSE_DESC_DA[p]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {savingsPurposes.length === 2 && (
            <p className="mt-2 text-xs text-emerald-700">
              Begge formål dækkes af denne konto.
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="opening_balance" className={labelClass}>
          Startsaldo <span className="text-neutral-400">(kr.)</span>
        </label>
        <AmountInput
          id="opening_balance"
          name="opening_balance"
          defaultValue={dv.opening_balance != null ? formatOereForInput(dv.opening_balance) : '0.00'}
        />
      </div>

      <div className="rounded-md border border-neutral-200 bg-white p-4">
        <label className="flex items-start gap-3 text-sm text-neutral-700 select-none">
          <input
            type="checkbox"
            name="editable_by_all"
            defaultChecked={dv.editable_by_all ?? true}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
          />
          <span>
            <span className="font-medium text-neutral-900">
              Alle i husstanden kan redigere
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              Også oprette og slette poster på denne konto. Slå fra for at låse
              kontoen til kun dig.
            </span>
          </span>
        </label>
      </div>

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
