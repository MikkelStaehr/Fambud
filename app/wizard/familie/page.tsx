// /wizard/familie — Trin 3 i ejer-flowet. Brugeren vælger mellem solo og
// familiebudget. Familie → opret partner (navn+email, pre-godkendt) og
// børn (kun navn, ingen login). Begge bliver til family_member-rækker
// som senere bruges som ejere på børneopsparing/børneforbrugskonti og
// til at vise "din andel" af fælles-konti i cashflow-tjekket.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Baby,
  Coins,
  HandCoins,
  Mail,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { getHouseholdContext, getHouseholdEconomyType, getMyMembership } from '@/lib/dal';
import {
  addChild,
  addPartner,
  removeFamilyMember,
  setEconomyType,
} from './actions';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

export default async function WizardFamiliePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; error?: string }>;
}) {
  // Owner only — partner skipper familie-trinet helt og går direkte fra
  // lonkonto til privat-opsparing.
  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const sp = await searchParams;
  const error = sp.error;

  const { supabase, householdId, user } = await getHouseholdContext();
  const { data: members } = await supabase
    .from('family_members')
    .select('id, name, email, user_id, role')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  // Ejeren er allerede registreret som family_member fra signup. Vi
  // adskiller dem fra resten så listen viser ejeren øverst som "dig".
  const owner = (members ?? []).find((m) => m.user_id === user.id);
  const dependents = (members ?? []).filter(
    (m) => m.user_id !== user.id
  );
  const hasDependents = dependents.length > 0;

  const economyType = await getHouseholdEconomyType();
  const isShared = economyType === 'shared';

  // Auto-detekter familie-mode hvis der allerede er pre-godkendte medlemmer,
  // eller hvis husstanden er sat til 'shared' (så har brugeren allerede valgt
  // familiemodel og skal kun udfylde resten).
  const view: 'choice' | 'solo' | 'family' = hasDependents || isShared
    ? 'family'
    : sp.type === 'solo'
      ? 'solo'
      : sp.type === 'family' || sp.type === 'shared'
        ? 'family'
        : 'choice';

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 3 af 7
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Familie eller solobudget?
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Skal Fambud holde styr på flere voksne og børn — eller er det kun dig?
        Du kan altid tilføje familie senere fra Indstillinger.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {view === 'choice' && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/wizard/familie?type=solo"
            className="group flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-4 transition hover:border-neutral-900 hover:bg-neutral-50"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-700 transition group-hover:bg-neutral-900 group-hover:text-white">
              <User className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold text-neutral-900">
              Solobudget
            </div>
            <p className="text-xs text-neutral-500">
              Det er kun mig — ingen partner eller børn at koordinere med.
            </p>
          </Link>

          <Link
            href="/wizard/familie?type=family"
            className="group flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-4 transition hover:border-neutral-900 hover:bg-neutral-50"
          >
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-700 transition group-hover:bg-neutral-900 group-hover:text-white">
              <Users className="h-5 w-5" />
            </div>
            <div className="text-sm font-semibold text-neutral-900">
              Familiebudget
            </div>
            <p className="text-xs text-neutral-500">
              Vi er flere — opret partner og børn så vi kan vise jeres
              fællesøkonomi.
            </p>
          </Link>
        </div>
      )}

      {view === 'solo' && (
        <div className="mt-6 space-y-4">
          <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
            Du er den eneste i husstanden. Vi springer partner- og børne-
            opsætningen over og fortsætter til opsparingerne.
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/wizard/opsparing"
              className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Næste
            </Link>
            <Link
              href="/wizard/familie"
              className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Tilbage
            </Link>
          </div>
        </div>
      )}

      {view === 'family' && (
        <div className="mt-6 space-y-6">
          {/* Økonomi-model: hver-for-sig vs pooled. Vises som to klikbare
              kort. Aktive valg (matcher households.economy_type) markeres
              med ring + farvet ikon. Skift mellem mode'er retager ejer's
              eksisterende lønkonto via setEconomyType-action. */}
          <section>
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Hvordan håndterer I økonomien?
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <form action={setEconomyType}>
                <input type="hidden" name="economy_type" value="separate" />
                <button
                  type="submit"
                  className={`group flex w-full flex-col gap-1.5 rounded-md border p-3 text-left transition ${
                    !isShared
                      ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div
                    className={`inline-flex h-7 w-7 items-center justify-center rounded ${
                      !isShared
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold text-neutral-900">
                    Særskilt økonomi
                  </div>
                  <p className="text-xs text-neutral-500">
                    Hver har sin egen lønkonto. I sender til Fælles for delte
                    udgifter — resten er privat.
                  </p>
                </button>
              </form>

              <form action={setEconomyType}>
                <input type="hidden" name="economy_type" value="shared" />
                <button
                  type="submit"
                  className={`group flex w-full flex-col gap-1.5 rounded-md border p-3 text-left transition ${
                    isShared
                      ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div
                    className={`inline-flex h-7 w-7 items-center justify-center rounded ${
                      isShared
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    <HandCoins className="h-4 w-4" />
                  </div>
                  <div className="text-sm font-semibold text-neutral-900">
                    Fællesøkonomi
                  </div>
                  <p className="text-xs text-neutral-500">
                    Begge lønninger lander på én Fælles Lønkonto. Overskuddet
                    deles eller fordeles som I selv vil.
                  </p>
                </button>
              </form>
            </div>
            {isShared && (
              <p className="mt-2 text-xs text-emerald-700">
                ✓ Jeres lønkonto fra trin 1 er nu Fælles Lønkonto. Begge
                lønninger lander her — partner registrerer bare sin
                indkomst når hun joiner.
              </p>
            )}
          </section>

          {/* Liste over eksisterende familiemedlemmer (inkl. ejeren). */}
          <section>
            <h2 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Familiemedlemmer
            </h2>
            <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
              {/* Ejeren først, kan ikke fjernes */}
              {owner && (
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                      <User className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-medium text-neutral-900">
                      {owner.name}
                    </span>
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-600">
                      Dig (ejer)
                    </span>
                  </div>
                </div>
              )}

              {/* Pre-godkendte partner + børn */}
              {dependents.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-sm last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                        m.email
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {m.email ? (
                        <Mail className="h-3.5 w-3.5" />
                      ) : (
                        <Baby className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="font-medium text-neutral-900">{m.name}</span>
                    {m.email ? (
                      <>
                        <span className="text-xs text-neutral-500">{m.email}</span>
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-800">
                          Partner
                        </span>
                      </>
                    ) : (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-700">
                        Barn
                      </span>
                    )}
                  </div>
                  <form action={removeFamilyMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <button
                      type="submit"
                      className="rounded p-1 text-neutral-300 transition hover:bg-red-50 hover:text-red-700"
                      title="Fjern"
                      aria-label={`Fjern ${m.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>

          {/* Tilføj partner */}
          <section>
            <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700">
              <UserPlus className="h-3.5 w-3.5" />
              Tilføj partner
            </h3>
            <p className="mb-2 text-xs text-neutral-500">
              Pre-godkend din partner med deres email — når de signer op,
              kobles de automatisk til husstanden.
            </p>
            <form
              key={`partner-${dependents.length}`}
              action={addPartner}
              className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label htmlFor="partner_name" className={labelClass}>
                  Navn
                </label>
                <input
                  id="partner_name"
                  name="name"
                  type="text"
                  required
                  placeholder="Louise"
                  className={fieldClass}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="partner_email" className={labelClass}>
                  Email
                </label>
                <input
                  id="partner_email"
                  name="email"
                  type="email"
                  required
                  placeholder="louise@..."
                  className={fieldClass}
                />
              </div>
              <button
                type="submit"
                className="self-start rounded-md border border-neutral-900 bg-white px-3 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 sm:self-end"
              >
                Tilføj
              </button>
            </form>
          </section>

          {/* Tilføj barn */}
          <section>
            <h3 className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700">
              <Baby className="h-3.5 w-3.5" />
              Tilføj barn
            </h3>
            <p className="mb-2 text-xs text-neutral-500">
              Børn har ikke deres egen login, men bliver til ejere på
              børneforbrugskonti og børneopsparing senere i wizarden.
            </p>
            <form
              key={`child-${dependents.length}`}
              action={addChild}
              className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label htmlFor="child_name" className={labelClass}>
                  Navn
                </label>
                <input
                  id="child_name"
                  name="name"
                  type="text"
                  required
                  placeholder="Emil"
                  className={fieldClass}
                />
              </div>
              <button
                type="submit"
                className="self-start rounded-md border border-neutral-900 bg-white px-3 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50 sm:self-end"
              >
                Tilføj
              </button>
            </form>
          </section>

          <div className="flex items-center gap-3 border-t border-neutral-200 pt-4">
            <Link
              href="/wizard/opsparing"
              className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              Næste
            </Link>
            <Link
              href="/wizard/familie"
              className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              Skift til solo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
