import Link from 'next/link';
import { AmountInput } from '../../_components/AmountInput';
import { RecurrenceField } from '../../_components/RecurrenceField';
import { formatOereForInput } from '@/lib/format';
import type { Account, RecurrenceFreq } from '@/lib/database.types';

type Props = {
  action: (formData: FormData) => Promise<void>;
  accounts: Pick<Account, 'id' | 'name' | 'archived'>[];
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

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
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
            defaultValue={dv.to_account_id ?? ''}
            className={fieldClass}
          >
            <option value="" disabled>Vælg konto</option>
            {visibleAccounts(dv.to_account_id).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? ' (arkiveret)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="amount" className={labelClass}>
            Beløb <span className="text-neutral-400">(kr.)</span>
          </label>
          <AmountInput
            id="amount"
            name="amount"
            required
            defaultValue={dv.amount != null ? formatOereForInput(dv.amount) : ''}
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
