'use client';

import { useState } from 'react';
import {
  CreditCard,
  Home,
  Landmark,
  Wallet,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { AmountInput } from '@/app/(app)/_components/AmountInput';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

type Ownership = 'personal' | 'shared';
// Visual flavour only — all four values are stored as kind='credit'. The
// distinction lives in the user's chosen name and is mostly here so people
// realise they CAN add their realkreditlån via this step.
type CreditType = 'kreditkort' | 'realkredit' | 'banklan' | 'kassekredit';

const TYPES: {
  value: CreditType;
  label: string;
  desc: string;
  Icon: LucideIcon;
  placeholder: string;
}[] = [
  {
    value: 'kreditkort',
    label: 'Kreditkort',
    desc: 'MasterCard, Visa, Coop MasterCard.',
    Icon: CreditCard,
    placeholder: 'F.eks. MasterCard',
  },
  {
    value: 'realkredit',
    label: 'Realkreditlån',
    desc: 'Boliglån via Realkredit Danmark, Nykredit, Totalkredit.',
    Icon: Home,
    placeholder: 'F.eks. Realkredit Danmark',
  },
  {
    value: 'banklan',
    label: 'Banklån',
    desc: 'Billån, studielån, andet privat lån.',
    Icon: Landmark,
    placeholder: 'F.eks. Billån',
  },
  {
    value: 'kassekredit',
    label: 'Kassekredit',
    desc: 'Trækningsret på din lønkonto.',
    Icon: Wallet,
    placeholder: 'F.eks. Kassekredit',
  },
];

type Props = {
  action: (formData: FormData) => Promise<void>;
  resetKey: number;
  error?: string;
};

export function CreditLoanForm({ action, resetKey, error }: Props) {
  const [creditType, setCreditType] = useState<CreditType>('kreditkort');
  const [ownership, setOwnership] = useState<Ownership>('personal');

  const placeholder = TYPES.find((t) => t.value === creditType)?.placeholder ?? '';

  return (
    <form
      key={resetKey}
      action={action}
      className="space-y-4 rounded-md border border-neutral-200 bg-white p-4"
    >
      <div>
        <div className={labelClass}>Type</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <Card
              key={t.value}
              checked={creditType === t.value}
              onSelect={() => setCreditType(t.value)}
              icon={<t.Icon className="h-4 w-4" />}
              label={t.label}
              desc={t.desc}
              radioName="credit_type"
              radioValue={t.value}
            />
          ))}
        </div>
      </div>

      <div>
        <div className={labelClass}>Hvem ejer kontoen?</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Card
            checked={ownership === 'personal'}
            onSelect={() => setOwnership('personal')}
            icon={<User className="h-4 w-4" />}
            label="Personlig"
            desc="Mit eget — kun mit ansvar."
            radioName="ownership"
            radioValue="personal"
          />
          <Card
            checked={ownership === 'shared'}
            onSelect={() => setOwnership('shared')}
            icon={<Users className="h-4 w-4" />}
            label="Fælles"
            desc="Vores fælles ansvar."
            radioName="ownership"
            radioValue="shared"
          />
        </div>
      </div>

      <div>
        <label htmlFor="kl_name" className={labelClass}>Navn</label>
        <input
          id="kl_name"
          name="name"
          type="text"
          required
          placeholder={placeholder}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="kl_balance" className={labelClass}>
          Saldo <span className="text-neutral-400">(kr. — minus for gæld)</span>
        </label>
        <AmountInput
          id="kl_balance"
          name="opening_balance"
          defaultValue=""
          placeholder="-150 000.00"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="kl_rente" className={labelClass}>
            Rente <span className="text-neutral-400">(% — valgfrit)</span>
          </label>
          <input
            id="kl_rente"
            name="interest_rate"
            type="text"
            inputMode="decimal"
            placeholder="3.50"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="kl_aop" className={labelClass}>
            ÅOP <span className="text-neutral-400">(% — valgfrit)</span>
          </label>
          <input
            id="kl_aop"
            name="apr"
            type="text"
            inputMode="decimal"
            placeholder="4.20"
            className={fieldClass}
          />
        </div>
      </div>

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
