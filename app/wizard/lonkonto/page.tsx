// Trin 1 i wizarden — kombinerer lønkonto-oprettelse og første lønudbetaling
// fordi de hører naturligt sammen. Uden et lønbeløb har resten af appen
// intet at vise (cashflow, forecast, dashboardet osv.), så vi gør begge
// ting i samme transaktion frem for to skærme i træk hvor anden trin
// føles som et "ekstra"-step.
//
// For partneren udvider vi velkomst-panelet med en sammenfatning af
// hvad ejeren har sat op (fælleskonti, buffer, familie). Det sætter
// kontekst på 5 sekunder — partneren ved straks de joiner en eksisterende
// husstand, ikke starter fra nul.

import { Check, Shield, Users, Wallet } from 'lucide-react';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import { LonkontoIncomeForm } from './_components/LonkontoIncomeForm';
import { createPersonalAccountWithIncome } from './actions';

export default async function WizardLonkontoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';
  // Owner: 7 trin (lonkonto, faelleskonti, familie, opsparing, investering,
  // ejere, done). Partner: 4 trin (lonkonto, oversigt, opsparing, done).
  const totalSteps = isOwner ? 7 : 4;

  // For partner: hent et hurtigt sammendrag af husstanden så velkomst-
  // panelet kan vise hvad ejeren allerede har sat op.
  let summary: {
    sharedAccounts: number;
    hasBuffer: boolean;
    familyMembers: number;
    ownerName: string | null;
  } | null = null;
  if (!isOwner) {
    const { supabase, householdId } = await getHouseholdContext();
    const [accountsRes, familyRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, owner_name, savings_purposes')
        .eq('household_id', householdId)
        .eq('archived', false),
      supabase
        .from('family_members')
        .select('id, name, role')
        .eq('household_id', householdId),
    ]);
    const accounts = accountsRes.data ?? [];
    const family = familyRes.data ?? [];
    const ownerRow = family.find((m) => m.role === 'owner');
    summary = {
      sharedAccounts: accounts.filter((a) => a.owner_name === 'Fælles').length,
      hasBuffer: accounts.some((a) =>
        a.savings_purposes?.includes('buffer')
      ),
      familyMembers: family.length,
      ownerName: ownerRow?.name ?? null,
    };
  }

  return (
    <div>
      {/* Velkomst-intro som sektion (ikke separat skærm) — sætter mental
          model uden at koste en klik. Kort og handlingsorienteret. */}
      {isOwner ? (
        <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50/60 p-4">
          <h2 className="text-sm font-semibold text-emerald-900">
            Velkommen til Fambud
          </h2>
          <p className="mt-1 text-xs text-emerald-900/80">
            Vi guider dig igennem opsætningen af jeres familiebudget. Det
            tager 5–10 minutter — vi springer udgifter, lån og overførsler
            over og tager dem efter wizarden i stedet.
          </p>
        </div>
      ) : (
        summary && (
          <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50/60 p-4">
            <h2 className="text-sm font-semibold text-emerald-900">
              Velkommen til husstanden
            </h2>
            <p className="mt-1 text-xs text-emerald-900/80">
              {summary.ownerName
                ? `${summary.ownerName} har allerede sat husstanden op:`
                : 'Husstanden er allerede sat op af din partner:'}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-emerald-900/90">
              {summary.sharedAccounts > 0 && (
                <li className="flex items-start gap-1.5">
                  <Wallet className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    {summary.sharedAccounts}{' '}
                    {summary.sharedAccounts === 1 ? 'fælleskonto' : 'fælleskonti'}
                  </span>
                </li>
              )}
              {summary.hasBuffer && (
                <li className="flex items-start gap-1.5">
                  <Shield className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>Bufferkonto sat op</span>
                </li>
              )}
              {summary.familyMembers > 1 && (
                <li className="flex items-start gap-1.5">
                  <Users className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    {summary.familyMembers} familiemedlemmer registreret
                  </span>
                </li>
              )}
              {summary.sharedAccounts === 0 &&
                !summary.hasBuffer &&
                summary.familyMembers <= 1 && (
                  <li className="flex items-start gap-1.5 text-emerald-900/70">
                    <Check className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>Husstanden er klar — du er det første medlem.</span>
                  </li>
                )}
            </ul>
            <p className="mt-2 text-xs text-emerald-900/80">
              Vi mangler bare din side: lønkonto, indkomst og eventuelle
              private opsparinger.
            </p>
          </div>
        )
      )}

      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 1 af {totalSteps}
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Din lønkonto og indkomst
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Opret den konto hvor du modtager løn, og fortæl os hvor meget der
        kommer ind hver måned.
      </p>

      <div className="mt-6">
        <LonkontoIncomeForm
          action={createPersonalAccountWithIncome}
          isOwner={isOwner}
          error={error}
        />
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Du kan registrere flere konkrete lønudbetalinger på{' '}
        <span className="text-neutral-700">/indkomst</span> efter wizarden —
        med 3 udbetalinger laver vi et nøjagtigt forecast af din månedsløn.
      </p>
    </div>
  );
}
