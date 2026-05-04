'use client';

import { useState } from 'react';
import {
  Wallet,
  ShoppingCart,
  PiggyBank,
  Circle,
  type LucideIcon,
} from 'lucide-react';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

// Shared-account types in the order most users will pick. No checking (lønkonto
// er personlig), no cash (sjældent en delt "konto"), no credit (eget trin).
type SharedKind = 'budget' | 'household' | 'savings' | 'other';

const TYPES: { value: SharedKind; label: string; desc: string; Icon: LucideIcon }[] = [
  { value: 'budget',    label: 'Budgetkonto',       desc: 'Faste regninger - husleje, el, forsikringer.', Icon: Wallet },
  { value: 'household', label: 'Husholdningskonto', desc: 'Den I bruger til daglige indkøb.',               Icon: ShoppingCart },
  { value: 'savings',   label: 'Opsparing',         desc: 'Fælles opsparing til ferie, bil, kommende køb.',  Icon: PiggyBank },
  { value: 'other',     label: 'Anden',             desc: 'Hvad der ellers er fælles.',                       Icon: Circle },
];

type Props = {
  action: (formData: FormData) => Promise<void>;
  resetKey: number; // incremented after each successful add to remount the form
  error?: string;
};

export function SharedAccountForm({ action, resetKey, error }: Props) {
  const [kind, setKind] = useState<SharedKind>('budget');

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
            <KindCard
              key={t.value}
              value={t.value}
              label={t.label}
              desc={t.desc}
              icon={<t.Icon className="h-4 w-4" />}
              checked={kind === t.value}
              onSelect={() => setKind(t.value)}
            />
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="shared_name" className={labelClass}>Navn</label>
        <input
          id="shared_name"
          name="name"
          type="text"
          required
          placeholder={defaultName(kind)}
          className={fieldClass}
        />
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
        Tilføj konto
      </button>
    </form>
  );
}

function defaultName(kind: SharedKind): string {
  switch (kind) {
    case 'budget':    return 'Budgetkonto';
    case 'household': return 'Husholdningskonto';
    case 'savings':   return 'Fælles opsparing';
    case 'other':     return '';
  }
}

function KindCard({
  value,
  label,
  desc,
  icon,
  checked,
  onSelect,
}: {
  value: SharedKind;
  label: string;
  desc: string;
  icon: React.ReactNode;
  checked: boolean;
  onSelect: () => void;
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
        name="kind"
        value={value}
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
