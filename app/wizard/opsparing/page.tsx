// /wizard/opsparing - Trin 4 i ejer-flowet (trin 2 i partner-flowet).
// Fundamentet (buffer) + private opsparinger + børneforbrugskonti pr.
// barn der allerede er oprettet i familie-trinet.
//
// Børneforbrugskonti modelleres som kind=savings med owner_name=barnets
// navn - så /opsparinger viser dem ved siden af de øvrige opsparinger
// med en tydelig ejer-tag, og cashflow-tjekket fanger underskud pr. barn
// hvis brugeren glemmer den månedlige overførsel.

import Link from 'next/link';
import { Baby, Plus, Shield, X } from 'lucide-react';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import {
  createBufferSavings,
  createChildSpendingAccount,
  createPrivateSavings,
  removePrivateSavings,
} from './actions';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

export default async function WizardOpsparingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';
  const totalSteps = isOwner ? 7 : 4;
  // Owner: trin 4 af 7. Partner: trin 3 af 4 (efter oversigt-trinet).
  const stepNumber = isOwner ? 4 : 3;
  // Owner: næste trin er investering. Partner: går direkte til done
  // (de skipper investerings-trinet og ejere-trinet helt).
  const nextHref = isOwner ? '/wizard/investering' : '/wizard/done';

  const { supabase, user, householdId } = await getHouseholdContext();

  // Brugerens egne savings-konti oprettet i denne wizard-session.
  // Filtreret på created_by + kind så kun denne brugers ses.
  const { data: existing } = await supabase
    .from('accounts')
    .select('id, name, owner_name, savings_purposes')
    .eq('created_by', user.id)
    .eq('kind', 'savings')
    .order('created_at', { ascending: true });

  const hasAny = (existing?.length ?? 0) > 0;
  const hasOwnBuffer = (existing ?? []).some((a) =>
    a.savings_purposes?.includes('buffer')
  );

  // For partner: tjek om husstanden ALLEREDE har en buffer (oprettet af
  // ejeren). Hvis ja, skjuler vi anbefalings-kortet - partneren behøver
  // ikke en privat buffer hvis husstanden har én. Vi viser i stedet en
  // notis om at den eksisterende buffer dækker hele familien.
  let householdHasBuffer = hasOwnBuffer;
  if (!isOwner && !hasOwnBuffer) {
    const { data: householdBuffer } = await supabase
      .from('accounts')
      .select('id')
      .eq('household_id', householdId)
      .eq('archived', false)
      .contains('savings_purposes', ['buffer'])
      .limit(1);
    householdHasBuffer = (householdBuffer?.length ?? 0) > 0;
  }
  // hasBuffer-variablen styrer om vi skjuler anbefalings-kortet - det
  // skal ske både hvis brugeren selv har en buffer og hvis husstanden har
  // en (kun relevant for partner).
  const hasBuffer = householdHasBuffer;

  // Børn i husstanden: family_member-rækker med ingen email og ingen
  // user_id. Bruges til "Tilføj børneforbrugskonto"-knapper. Kun relevant
  // for ejer (partner skal ikke gen-oprette børnekonti).
  const { data: allFamilyMembers } = isOwner
    ? await supabase
        .from('family_members')
        .select('id, name, email, user_id')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true })
    : { data: null };
  const children = (allFamilyMembers ?? []).filter(
    (m) => m.email == null && m.user_id == null
  );
  // En forbrugskonto til et barn detekteres via owner_name match. Det
  // forhindrer at samme barn får oprettet to konti hvis brugeren går
  // tilbage og frem.
  const childAccountByOwner = new Map<string, { id: string; name: string }>();
  for (const a of existing ?? []) {
    if (a.owner_name) {
      childAccountByOwner.set(a.owner_name, { id: a.id, name: a.name });
    }
  }

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin {stepNumber} af {totalSteps}
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Opsparinger
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Buffer (fundamentet), private opsparinger og forbrugskonti pr. barn -
        alt der lægges til side hver måned.
      </p>

      {/* For partner: hvis husstanden ALLEREDE har en buffer (oprettet af
          ejeren), viser vi en lille notis i stedet for anbefalings-kortet.
          Partneren behøver ikke en privat buffer - den fælles dækker hele
          familien. */}
      {!isOwner && !hasOwnBuffer && householdHasBuffer && (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <span className="font-medium">Husstanden har allerede en buffer</span>{' '}
          - den dækker hele familien. Du behøver ikke oprette en privat
          buffer, men kan gøre det hvis du vil holde noget for dig selv.
        </div>
      )}

      {/* Buffer-anbefaling - den ENE opsparing vi aktivt foreslår. Skjules
          når der allerede er en konto med 'buffer'-tag (egen eller
          husstandens). */}
      {!hasBuffer && (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
              <Shield className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-emerald-900">
                Vi anbefaler at I starter med en buffer
              </h2>
              <p className="mt-1 text-xs text-emerald-900/80">
                Bufferen er nødfond til jobtab, sygdom og akut reparation -
                det er fundamentet i jeres økonomi. Tommelfingerregel: kunne
                dække 3 mdr af jeres faste udgifter som minimum.
              </p>
              <form action={createBufferSavings} className="mt-3">
                <button
                  type="submit"
                  className="rounded-md bg-emerald-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-800"
                >
                  Opret bufferkonto
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Liste over alle savings oprettet af brugeren - buffer, private,
          børneforbrug. owner_name-taggen viser hvem kontoen tilhører. */}
      {hasAny && (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          {existing!.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 text-sm last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-900">{a.name}</span>
                {a.savings_purposes?.includes('buffer') ? (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                    Buffer
                  </span>
                ) : a.owner_name ? (
                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                    {a.owner_name}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-500">Opsparing</span>
                )}
              </div>
              <form action={removePrivateSavings}>
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

      {/* Add private savings form. Form-key resetter inputs efter hver
          submit så uncontrolled tekst ikke bliver hængende. */}
      <form
        key={existing?.length ?? 0}
        action={createPrivateSavings}
        className="mt-4 space-y-4 rounded-md border border-neutral-200 bg-white p-4"
      >
        <div>
          <label htmlFor="savings_name" className={labelClass}>
            Navn på privat opsparing
          </label>
          <input
            id="savings_name"
            name="name"
            type="text"
            required
            placeholder="F.eks. Aldersopsparing eller Ferie"
            className={fieldClass}
          />
        </div>

        <label className="flex items-start gap-3 text-sm text-neutral-700 select-none">
          <input
            type="checkbox"
            name="editable_by_all"
            defaultChecked
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
          />
          <span>
            <span className="font-medium text-neutral-900">
              Alle i husstanden kan redigere
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              Slå fra for konti du vil holde private.
            </span>
          </span>
        </label>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-md border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
        >
          Tilføj opsparing
        </button>
      </form>

      {/* Børneforbrugskonti - én ét-kliks knap pr. barn. Vises kun hvis
          ejer har børn registreret i familie-trinet. Hvis kontoen
          allerede findes (matchet på owner_name), vises status i stedet
          for en knap. */}
      {isOwner && children.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
            <Baby className="h-3 w-3" />
            Forbrugskonti til børn
          </h2>
          <p className="mb-3 text-xs text-neutral-500">
            Lommepenge, fritidsaktiviteter, mindre indkøb - én konto pr.
            barn så I kan planlægge månedlige overførsler.
          </p>
          <div className="space-y-2">
            {children.map((c) => {
              const existing = childAccountByOwner.get(c.name);
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
                    {existing && (
                      <span className="text-xs text-emerald-700">
                        ✓ {existing.name}
                      </span>
                    )}
                  </div>
                  {existing ? (
                    <span className="text-xs text-neutral-400">
                      Konto oprettet
                    </span>
                  ) : (
                    <form action={createChildSpendingAccount}>
                      <input type="hidden" name="child_id" value={c.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                      >
                        <Plus className="h-3 w-3" />
                        Opret forbrugskonto
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
          href={nextHref}
          className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Næste
        </Link>
        {!hasAny && (
          <Link
            href={nextHref}
            className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Hop over
          </Link>
        )}
      </div>
    </div>
  );
}
