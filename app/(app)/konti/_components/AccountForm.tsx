import Link from 'next/link';
import { AmountInput } from '../../_components/AmountInput';
import { formatOereForInput } from '@/lib/format';
import type { AccountKind } from '@/lib/database.types';

const KIND_OPTIONS: { value: AccountKind; label: string }[] = [
  { value: 'checking', label: 'Lønkonto' },
  { value: 'budget', label: 'Budgetkonto' },
  { value: 'household', label: 'Husholdningskonto' },
  { value: 'savings', label: 'Opsparing' },
  { value: 'credit', label: 'Kredit' },
  { value: 'cash', label: 'Kontanter' },
  { value: 'other', label: 'Anden' },
];

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    name?: string;
    owner_name?: string | null;
    kind?: AccountKind;
    opening_balance?: number;
    goal_amount?: number | null;
    goal_date?: string | null;
    goal_label?: string | null;
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="kind" className={labelClass}>Type</label>
          <select id="kind" name="kind" defaultValue={dv.kind ?? 'checking'} className={fieldClass}>
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
            placeholder="Mikkel / Fælles"
            className={fieldClass}
          />
        </div>
      </div>

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

      <fieldset className="rounded-md border border-neutral-200 bg-neutral-50/50 p-4">
        <legend className="px-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Mål <span className="ml-1 normal-case font-normal text-neutral-400">(valgfrit)</span>
        </legend>

        <div className="space-y-4">
          <div>
            <label htmlFor="goal_label" className={labelClass}>Beskrivelse</label>
            <input
              id="goal_label"
              name="goal_label"
              type="text"
              defaultValue={dv.goal_label ?? ''}
              placeholder="Sommerferie 2027 / Buffer"
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="goal_amount" className={labelClass}>
                Målbeløb <span className="text-neutral-400">(kr.)</span>
              </label>
              <AmountInput
                id="goal_amount"
                name="goal_amount"
                defaultValue={dv.goal_amount != null ? formatOereForInput(dv.goal_amount) : ''}
                placeholder=""
              />
            </div>
            <div>
              <label htmlFor="goal_date" className={labelClass}>Måldato</label>
              <input
                id="goal_date"
                name="goal_date"
                type="date"
                defaultValue={dv.goal_date ?? ''}
                className={fieldClass}
              />
            </div>
          </div>
        </div>
      </fieldset>

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
