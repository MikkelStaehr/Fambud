'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarClock, Wand2 } from 'lucide-react';
import { AmountInput } from '../../_components/AmountInput';
import { RecurrenceField } from '../../_components/RecurrenceField';
import { SubmitButton } from '../../_components/SubmitButton';
import { AccountSelectGrouped } from '../../_components/AccountSelectGrouped';
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
  'id' | 'name' | 'archived' | 'kind' | 'investment_type' | 'owner_name' | 'created_by' | 'editable_by_all'
>;

type Props = {
  action: (formData: FormData) => Promise<void>;
  accounts: FormAccount[];
  // Identitets-kontekst til dropdown-gruppering. currentUserId er den
  // perspective-bruger der "ejer" valg-flowet (Mikkel normalt; Louise
  // under proxy). partner sætter "Mikkel"-gruppen op når Mikkel hjælper.
  currentUserId?: string;
  currentLabel?: string;
  partnerUserId?: string;
  partnerLabel?: string;
  // Map fra to_account_id → aktive begivenheder der allerede har transfers
  // til den konto. Bruges til at AUTO-FORESLÅ at en ny overførsel knyttes
  // til en begivenhed: "Ferie-konto er destination for Sommerferie 2026 -
  // skal denne overførsel også tælle med?". Frictionless flow når man laver
  // overførsel #2 til samme event-konto (fx Louises bidrag efter Mikkels).
  eventsByToAccount?: Record<string, { id: string; name: string }[]>;
  defaultValues?: {
    from_account_id?: string;
    to_account_id?: string;
    amount?: number;
    description?: string | null;
    occurs_on?: string;
    recurrence?: RecurrenceFreq;
    recurrence_until?: string | null;
    // Optional binding til en begivenhed. Når sat, gemmer createTransfer/
    // updateTransfer tokenen i transfers.life_event_id og redirector
    // tilbage til begivenhedens detalje-side.
    life_event_id?: string | null;
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
  currentUserId,
  currentLabel,
  partnerUserId,
  partnerLabel,
  eventsByToAccount = {},
  defaultValues = {},
  submitLabel,
  cancelHref,
  error,
}: Props) {
  const dv = defaultValues;
  // Same approach as TransactionForm - keep an archived account in the dropdown
  // when it's already the row's selected value, so editing doesn't lose it.
  const visibleAccounts = (selectedId?: string) =>
    accounts.filter((a) => !a.archived || a.id === selectedId);

  // Date er controlled så "Sidste bankdag"-knappen kan udfylde feltet.
  // Reglen: sidste hverdag i måneden (ingen helligdage modelleret) - samme
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

  // Event-link state: hvis to-kontoen matcher en aktiv begivenheds andre
  // transfers, foreslår vi at knytte til den. Init fra prefill (URL-param);
  // hvis ikke prefilled men der findes præcis ÉT match, auto-vælg det.
  const candidateEvents = toAccountId ? eventsByToAccount[toAccountId] ?? [] : [];
  const [linkedEventId, setLinkedEventId] = useState<string>(() => {
    if (dv.life_event_id) return dv.life_event_id;
    return '';
  });
  // Re-evaluér auto-suggestion når to-kontoen ændres. Sker kun hvis brugeren
  // ikke allerede har valgt noget eksplicit (linkedEventId === '').
  const autoSuggestId =
    candidateEvents.length === 1 && !dv.life_event_id ? candidateEvents[0].id : null;

  const selectedTo = accounts.find((a) => a.id === toAccountId);
  const annualCapKr =
    selectedTo?.investment_type
      ? INVESTMENT_TYPE_ANNUAL_CAP_KR[selectedTo.investment_type]
      : undefined;
  // Hele kroner pr. måned - vi runder ned så vi aldrig foreslår over loftet
  // (ved 9.900 kr/år giver det 825 kr/md som er præcis 9.900 totalt). For
  // 6.000 kr/år bliver det 500 kr/md, også eksakt.
  const monthlyCapOere =
    annualCapKr != null ? Math.floor((annualCapKr * 100) / 12) : null;

  function fillAnnualCap() {
    if (monthlyCapOere == null) return;
    setAmountSeed(formatOereForInput(monthlyCapOere));
    setAmountKey((k) => k + 1);
  }

  // Det effektive event-link der submittes: linkedEventId vinder hvis sat
  // (kan være __none__ hvis brugeren aktivt opt'er ud); ellers auto-suggest.
  // Tom streng = ingen link til server.
  const effectiveLifeEventId =
    linkedEventId === '__none__'
      ? ''
      : linkedEventId || autoSuggestId || '';

  return (
    <form action={action} className="space-y-5">
      {/* Skjult input bærer det faktiske life_event_id til server-actionen.
          Server-actionen verificerer ejerskab via household-tjek. */}
      {effectiveLifeEventId && (
        <input
          type="hidden"
          name="life_event_id"
          value={effectiveLifeEventId}
        />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="from_account_id" className={labelClass}>Fra konto</label>
          <AccountSelectGrouped
            id="from_account_id"
            name="from_account_id"
            required
            className={fieldClass}
            accounts={visibleAccounts(dv.from_account_id)}
            defaultValue={dv.from_account_id ?? ''}
            currentUserId={currentUserId}
            currentLabel={currentLabel}
            partnerUserId={partnerUserId}
            partnerLabel={partnerLabel}
          />
        </div>

        <div>
          <label htmlFor="to_account_id" className={labelClass}>Til konto</label>
          <AccountSelectGrouped
            id="to_account_id"
            name="to_account_id"
            required
            className={fieldClass}
            accounts={visibleAccounts(toAccountId)}
            value={toAccountId}
            onChange={(v) => {
              setToAccountId(v);
              // Reset event-link når brugeren skifter til-konto - hvis den
              // nye konto har andre matching events skal vi auto-foreslå dem,
              // ikke beholde det gamle event som måske ikke længere matcher.
              if (!dv.life_event_id) setLinkedEventId('');
            }}
            currentUserId={currentUserId}
            currentLabel={currentLabel}
            partnerUserId={partnerUserId}
            partnerLabel={partnerLabel}
          />
        </div>
      </div>

      {/* Begivenheds-link: vises kun når der findes aktive begivenheder
          der peger på den valgte til-konto. Et match = auto-suggested
          checkbox; flere = dropdown. Brugeren kan altid opt-out via
          "Ingen begivenhed". */}
      {candidateEvents.length > 0 && !dv.life_event_id && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-3">
          <div className="text-xs font-medium text-emerald-900">
            Knyt til begivenhed?
          </div>
          {candidateEvents.length === 1 ? (
            <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                checked={effectiveLifeEventId === candidateEvents[0].id}
                onChange={(e) =>
                  setLinkedEventId(e.target.checked ? candidateEvents[0].id : '__none__')
                }
                className="h-4 w-4 rounded border-neutral-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>
                Knyt til <strong>{candidateEvents[0].name}</strong> (andre
                overførsler peger allerede dertil)
              </span>
            </label>
          ) : (
            <select
              value={effectiveLifeEventId}
              onChange={(e) => setLinkedEventId(e.target.value || '__none__')}
              className="mt-1.5 block w-full rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            >
              <option value="">Ingen begivenhed</option>
              {candidateEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {dv.life_event_id && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-2 text-xs text-emerald-900">
          Knyttes til begivenhed (sat via link fra begivenheds-siden).
        </div>
      )}

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
