import Link from 'next/link';
import { AmountInput } from '../../_components/AmountInput';
import { RecurrenceField } from '../../_components/RecurrenceField';
import { formatOereForInput } from '@/lib/format';
import type { Account, RecurrenceFreq } from '@/lib/database.types';
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

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="amount" className={labelClass}>
            Nettoløn <span className="text-neutral-400">(kr.)</span>
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
          Bruttoløn og pension <span className="lowercase text-neutral-400">(valgfrit)</span>
        </legend>
        <p className="mb-4 text-xs text-neutral-500">
          Udfyld bruttoløn og pensionsprocenter for at få et fuldt
          lønbillede — bruges til pensionstjek og rådgivning.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="gross_amount" className={labelClass}>
              Bruttoløn <span className="text-neutral-400">(kr.)</span>
            </label>
            <AmountInput
              id="gross_amount"
              name="gross_amount"
              defaultValue={dv.gross_amount != null ? formatOereForInput(dv.gross_amount) : ''}
            />
          </div>
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
              defaultValue={dv.pension_own_pct ?? ''}
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
              defaultValue={dv.pension_employer_pct ?? ''}
              placeholder="10"
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
