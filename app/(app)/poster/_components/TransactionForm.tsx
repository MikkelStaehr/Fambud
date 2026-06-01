'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { AmountInput } from '../../_components/AmountInput';
import { RecurrenceField } from '../../_components/RecurrenceField';
import { SubmitButton } from '../../_components/SubmitButton';
import { AccountSelectGrouped } from '../../_components/AccountSelectGrouped';
import { formatOereForInput } from '@/lib/format';
import type { Account, Category, RecurrenceFreq } from '@/lib/database.types';
import type { DescriptionSuggestion } from '@/lib/dal';

type Props = {
  action: (formData: FormData) => Promise<void>;
  accounts: Pick<Account, 'id' | 'name' | 'archived' | 'owner_name' | 'created_by' | 'editable_by_all'>[];
  currentUserId?: string;
  currentLabel?: string;
  partnerUserId?: string;
  partnerLabel?: string;
  categories: Pick<Category, 'id' | 'name' | 'kind' | 'archived'>[];
  // Beskrivelse → mest-brugte-kategori-historik. Bruges til auto-forslag
  // når brugeren skriver i beskrivelses-feltet. Tom array slår funktionen
  // fra (fx på en helt frisk konto med ingen tidligere poster).
  descriptionSuggestions?: DescriptionSuggestion[];
  defaultValues?: {
    account_id?: string;
    category_id?: string | null;
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

export function TransactionForm({
  action,
  accounts,
  categories,
  descriptionSuggestions = [],
  currentUserId,
  currentLabel,
  partnerUserId,
  partnerLabel,
  defaultValues = {},
  submitLabel,
  cancelHref,
  error,
}: Props) {
  const dv = defaultValues;
  const incomeCats = categories.filter((c) => c.kind === 'income' && !c.archived);
  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.archived);

  // If the row's current account/category is archived we still need to keep
  // them in the dropdown when editing, otherwise the value vanishes silently.
  const visibleAccounts = accounts.filter(
    (a) => !a.archived || a.id === dv.account_id
  );

  // Controlled state for auto-suggest: når beskrivelsen ændres, slår vi op
  // i descriptionSuggestions efter en match og opdaterer kategori-feltet
  // automatisk - MEN kun hvis brugeren ikke selv har valgt en kategori
  // manuelt endnu. Det bevarer manuel override som "vinder".
  const [description, setDescription] = useState(dv.description ?? '');
  const [categoryId, setCategoryId] = useState(dv.category_id ?? '');
  // Pre-eksisterende kategori (på edit-flow) tæller som manuelt valg, så
  // auto-forslag ikke overskriver brugerens eksisterende valg.
  const [userPickedCategory, setUserPickedCategory] = useState(
    dv.category_id != null && dv.category_id !== ''
  );

  // Find bedste match for den nuværende beskrivelse. Eksakt-match først,
  // ellers prefix-match (oftest brugte først). Returnerer null hvis
  // beskrivelsen er tom eller ikke matcher noget.
  const suggestion = useMemo(() => {
    const desc = description.trim().toLowerCase();
    if (!desc) return null;
    const exact = descriptionSuggestions.find((s) => s.description === desc);
    if (exact) return exact;
    // Prefix-match: brugeren har skrevet "Net" og vi har "netto" i historikken
    // - eller omvendt, brugeren skriver længere variant og vi har kortere.
    const prefixMatches = descriptionSuggestions
      .filter(
        (s) => s.description.startsWith(desc) || desc.startsWith(s.description)
      )
      .sort((a, b) => b.count - a.count);
    return prefixMatches[0] ?? null;
  }, [description, descriptionSuggestions]);

  const suggestedCategory = suggestion
    ? categories.find((c) => c.id === suggestion.categoryId) ?? null
    : null;

  // Auto-apply forslag når brugeren IKKE selv har valgt en kategori. Bruges
  // som derived state: hvis forslaget ændrer sig pga. ny beskrivelse, hopper
  // dropdownen med - så længe brugeren ikke har overskrevet manuelt.
  const effectiveCategoryId =
    !userPickedCategory && suggestion ? suggestion.categoryId : categoryId;

  // Vis et lille "forslag aktiveret"-banner når auto-forslaget styrer
  // dropdownen. Brugeren kan vælge en anden kategori manuelt for at låse op.
  const showSuggestionBanner =
    suggestedCategory != null &&
    !userPickedCategory &&
    effectiveCategoryId === suggestion?.categoryId;

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="account_id" className={labelClass}>Konto</label>
          <AccountSelectGrouped
            id="account_id"
            name="account_id"
            required
            className={fieldClass}
            accounts={visibleAccounts}
            defaultValue={dv.account_id ?? ''}
            currentUserId={currentUserId}
            currentLabel={currentLabel}
            partnerUserId={partnerUserId}
            partnerLabel={partnerLabel}
          />
        </div>

        <div>
          <label htmlFor="category_id" className={labelClass}>Kategori</label>
          <select
            id="category_id"
            name="category_id"
            required
            value={effectiveCategoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setUserPickedCategory(true);
            }}
            className={fieldClass}
          >
            <option value="" disabled>Vælg kategori</option>
            {expenseCats.length > 0 && (
              <optgroup label="Udgift">
                {expenseCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )}
            {incomeCats.length > 0 && (
              <optgroup label="Indtægt">
                {incomeCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          {showSuggestionBanner && suggestedCategory && suggestion && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <Sparkles className="h-3 w-3" />
              <span>
                Automatisk valgt{' '}
                <span className="font-medium">{suggestedCategory.name}</span>{' '}
                baseret på {suggestion.count}{' '}
                tidligere &ldquo;{suggestion.description}&rdquo;-
                {suggestion.count === 1 ? 'post' : 'poster'} - du kan ændre
                den hvis du vil.
              </span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="F.eks. Netto"
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
