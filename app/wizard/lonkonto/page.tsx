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

import { redirect } from 'next/navigation';
import { Check, HandCoins, Shield, Users, Wallet } from 'lucide-react';
import {
  getHouseholdContext,
  getHouseholdEconomyType,
  getMyMembership,
} from '@/lib/dal';
import { LonkontoIncomeForm } from './_components/LonkontoIncomeForm';
import { PartnerSharedIncomeForm } from './_components/PartnerSharedIncomeForm';
import {
  createPersonalAccountWithIncome,
  registerSharedIncome,
} from './actions';

export default async function WizardLonkontoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';

  // Guard mod duplikater: hvis brugeren ALLEREDE har oprettet en checking-
  // konto (typisk fordi setup_completed_at blev nulstillet og de gennemfører
  // wizarden igen) skal de IKKE kunne oprette endnu en lønkonto. Send dem
  // til næste rolle-specifikke trin i stedet. /wizard/page.tsx har samme
  // logik, men vi gentager den her så direkte URL-adgang er sikker.
  const { supabase, user } = await getHouseholdContext();

  // Fællesøkonomi-detektion: hvis husstanden er sat til 'shared', så er
  // den fælles lønkonto allerede oprettet af ejer. Partner skal IKKE
  // oprette endnu en — de skal kun registrere deres indkomst på den.
  const economyType = await getHouseholdEconomyType();
  const isPartnerInSharedMode = !isOwner && economyType === 'shared';

  // Guard: hvis brugeren allerede har gjort sin del af trin 1, skip videre.
  //   - Owner: har de oprettet en checking-konto?
  //   - Partner særskilt: har de oprettet egen checking-konto?
  //   - Partner shared: har de allerede registreret månedlig indkomst
  //     tagged med deres family_member_id?
  if (isPartnerInSharedMode) {
    const { data: myFm } = await supabase
      .from('family_members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (myFm) {
      const { count: ownIncome } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('family_member_id', myFm.id)
        .eq('income_role', 'primary')
        .eq('recurrence', 'monthly');
      if ((ownIncome ?? 0) > 0) {
        redirect('/wizard/oversigt');
      }
    }
  } else {
    const { count: ownChecking } = await supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .eq('kind', 'checking')
      .eq('archived', false);
    if ((ownChecking ?? 0) > 0) {
      redirect(isOwner ? '/wizard/faelleskonti' : '/wizard/oversigt');
    }
  }
  // Owner: 7 trin (lonkonto, faelleskonti, familie, opsparing, investering,
  // ejere, done). Partner: 4 trin (lonkonto, oversigt, opsparing, done).
  const totalSteps = isOwner ? 7 : 4;

  // Find den fælles lønkonto til partneren i shared-mode (bruges af
  // PartnerSharedIncomeForm til at vise hvilken konto deres løn lander
  // på).
  let sharedLonkonto: { id: string; name: string } | null = null;
  if (isPartnerInSharedMode) {
    const { supabase: sb, householdId } = await getHouseholdContext();
    const { data } = await sb
      .from('accounts')
      .select('id, name')
      .eq('household_id', householdId)
      .eq('kind', 'checking')
      .eq('owner_name', 'Fælles')
      .eq('archived', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) sharedLonkonto = data;
  }

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
        {isPartnerInSharedMode ? 'Din månedsløn' : 'Din lønkonto og indkomst'}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {isPartnerInSharedMode
          ? 'I jeres husstand pooles indkomsten — din løn lander på den fælles lønkonto. Vi skal bare bruge dit beløb til at beregne det samlede billede.'
          : 'Opret den konto hvor du modtager løn, og fortæl os hvor meget der kommer ind hver måned.'}
      </p>

      <div className="mt-6">
        {isPartnerInSharedMode && sharedLonkonto ? (
          <>
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <HandCoins className="h-3.5 w-3.5" />
              <span>
                Din løn lander på{' '}
                <span className="font-medium">{sharedLonkonto.name}</span>
              </span>
            </div>
            <PartnerSharedIncomeForm
              action={registerSharedIncome}
              error={error}
            />
          </>
        ) : (
          <LonkontoIncomeForm
            action={createPersonalAccountWithIncome}
            isOwner={isOwner}
            error={error}
          />
        )}
      </div>

      <details className="mt-4 rounded-md border border-neutral-200 bg-neutral-50/50 p-3 text-xs text-neutral-600">
        <summary className="cursor-pointer font-medium text-neutral-700">
          Hvorfor 3 lønudbetalinger?
        </summary>
        <p className="mt-2">
          Næsten ingen lønudbetalinger er præcis ens — overtid, sygedage,
          ferietillæg, bonus og pension-justeringer giver små udsving fra
          måned til måned. Vi tager gennemsnittet af de seneste 3 udbetalinger
          som forecast for resten af året, så HeroStatus, cashflow-grafen og
          rådighedsbeløb regner ud fra hvad du faktisk får — ikke en idealiseret
          basislønsedlen.
        </p>
        <p className="mt-2">
          Ét tal nu er nok til at komme i gang — du registrerer de 2 manglende
          udbetalinger på{' '}
          <span className="text-neutral-700">/indkomst</span> når du får dem
          (Duplikér-knappen sparer dig for at indtaste alle felter forfra).
        </p>
      </details>
    </div>
  );
}
