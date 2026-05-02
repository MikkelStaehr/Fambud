// /wizard/investering — Trin 5 i ejer-flowet. Aldersopsparing,
// aktiesparekonto, aktiedepot og børneopsparing. Alle valgfri — bruger
// kan tilføje senere via /konti hvis de ikke kan huske detaljer på dem
// nu. Kreditkort/lån er fjernet fra wizarden helt; de håndteres via
// in-app onboarding når brugeren rent faktisk har tid og dokumenter.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Baby, Plus, TrendingUp, X } from 'lucide-react';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import { INVESTMENT_TYPE_LABEL_DA } from '@/lib/format';
import {
  createChildSavings,
  createInvestment,
  removeInvestment,
} from './actions';
import type { InvestmentType } from '@/lib/database.types';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

const TYPES_FOR_FORM: { value: InvestmentType; label: string; desc: string }[] = [
  {
    value: 'aldersopsparing',
    label: 'Aldersopsparing',
    desc: 'Lav skat ved udbetaling, max ca. 8.800 kr/år.',
  },
  {
    value: 'aktiesparekonto',
    label: 'Aktiesparekonto',
    desc: 'Lav løbende beskatning, max 135.900 kr indskud.',
  },
  {
    value: 'aktiedepot',
    label: 'Aktiedepot',
    desc: 'Frit aktie/fonds-depot uden skatteloft.',
  },
  {
    value: 'pension',
    label: 'Pension',
    desc: 'Arbejdsmarkedspension, ratepension, livrente.',
  },
];

export default async function WizardInvesteringPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Owner only — partner skipper investerings-trinet (de kan tilføje
  // egne investeringskonti post-wizard).
  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const sp = await searchParams;
  const error = sp.error;

  const { supabase, user, householdId } = await getHouseholdContext();
  const { data: existing } = await supabase
    .from('accounts')
    .select('id, name, owner_name, investment_type')
    .eq('created_by', user.id)
    .eq('kind', 'investment')
    .order('created_at', { ascending: true });

  // Børn (uden email/user_id) — bruges til "Tilføj børneopsparing"-knapper.
  const { data: allFamilyMembers } = await supabase
    .from('family_members')
    .select('id, name, email, user_id')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });
  const children = (allFamilyMembers ?? []).filter(
    (m) => m.email == null && m.user_id == null
  );
  // Eksisterende børneopsparinger pr. barn (matchet på owner_name +
  // investment_type) — så knappen skifter til "✓ oprettet" når den findes.
  const childSavingsByOwner = new Map<string, { id: string; name: string }>();
  for (const a of existing ?? []) {
    if (a.investment_type === 'boerneopsparing' && a.owner_name) {
      childSavingsByOwner.set(a.owner_name, { id: a.id, name: a.name });
    }
  }

  const count = existing?.length ?? 0;

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 5 af 7
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Investeringskonti
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Aldersopsparing, aktiesparekonto, aktiedepot og børneopsparing — alt
        valgfrit. Du kan altid tilføje flere senere.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Liste over allerede oprettede investeringskonti */}
      {count > 0 && (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          {existing!.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 text-sm last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-800">
                  <TrendingUp className="h-3.5 w-3.5" />
                </span>
                <span className="font-medium text-neutral-900">{a.name}</span>
                {a.investment_type && (
                  <span className="text-xs text-neutral-500">
                    {INVESTMENT_TYPE_LABEL_DA[a.investment_type]}
                  </span>
                )}
                {a.owner_name && (
                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    {a.owner_name}
                  </span>
                )}
              </div>
              <form action={removeInvestment}>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="rounded p-1 text-neutral-300 transition hover:bg-red-50 hover:text-red-700"
                  title="Fjern konto"
                  aria-label={`Fjern ${a.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Add-form — vælg type, derefter navn (default udfyldes baseret på
          type). Form-key resetter inputs efter hver submit. */}
      <form
        key={count}
        action={createInvestment}
        className="mt-4 space-y-4 rounded-md border border-neutral-200 bg-white p-4"
      >
        <div>
          <label htmlFor="investment_type" className={labelClass}>
            Type
          </label>
          <select
            id="investment_type"
            name="investment_type"
            required
            defaultValue=""
            className={fieldClass}
          >
            <option value="" disabled>
              Vælg investeringstype
            </option>
            {TYPES_FOR_FORM.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} — {t.desc}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="investment_name" className={labelClass}>
            Navn <span className="text-neutral-400">(valgfrit)</span>
          </label>
          <input
            id="investment_name"
            name="name"
            type="text"
            placeholder="Lad være tomt for at bruge typen som navn"
            className={fieldClass}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
        >
          Tilføj investeringskonto
        </button>
      </form>

      {/* Børneopsparing — én ét-kliks knap pr. barn der allerede er oprettet
          i familie-trinet. */}
      {children.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
            <Baby className="h-3 w-3" />
            Børneopsparing
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            Skattefordels-konto til opsparing pr. barn (max 6.000 kr/år/barn).
            Én konto pr. barn — vi opretter med ét klik.
          </p>
          <div className="space-y-2">
            {children.map((c) => {
              const existingChild = childSavingsByOwner.get(c.name);
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-800">
                      <Baby className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium text-neutral-900">
                      {c.name}
                    </span>
                    {existingChild && (
                      <span className="text-xs text-emerald-700">
                        ✓ {existingChild.name}
                      </span>
                    )}
                  </div>
                  {existingChild ? (
                    <span className="text-xs text-neutral-400">Konto oprettet</span>
                  ) : (
                    <form action={createChildSavings}>
                      <input type="hidden" name="child_id" value={c.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                      >
                        <Plus className="h-3 w-3" />
                        Opret børneopsparing
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        Du kan tilføje så mange du vil. Klik{' '}
        <span className="text-neutral-700">Næste</span> når du er færdig.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/wizard/ejere"
          className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Næste
        </Link>
        {count === 0 && (
          <Link
            href="/wizard/ejere"
            className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Hop over
          </Link>
        )}
      </div>
    </div>
  );
}
