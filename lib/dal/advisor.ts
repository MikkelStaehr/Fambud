// Advisor-context - udvider getCashflowGraph med data CashflowAdvisor skal
// bruge for at lave per-bruger-forslag på fælles-konti.
//
// Når en fælles-konto er underdækket, skal forslaget kun adressere DEN
// indloggede brugers manglende andel - ikke det fulde underskud. Det
// kræver at vi ved:
//   1. Hvem har bidraget til kontoen (transfers grupperet efter
//      from_account.created_by)
//   2. Hvor mange skal forventes at bidrage (logged-in + pre-godkendte
//      family_members)
//   3. Hvilke pre-godkendte er der så vi kan vise "Louise mangler signup"-
//      banneret
//
// Vi samler alt i én helper så CashflowAdvisor kun har én DAL-call.

import { monthlyEquivalent } from '@/lib/format';
import { getPerspective } from './auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCashflowGraph, type AccountCashflowDetail } from './cashflow';

export type PendingMember = { id: string; name: string; email: string };

export type AdvisorContext = {
  // Allerede i CashflowGraphData, gentaget her for et samlet svar.
  perAccount: Map<string, AccountCashflowDetail>;
  // Pr. (from_account, to_account) summen pr. bruger der har skabt
  // from_account. Bruges til at finde "hvor meget har Mikkel bidraget til
  // fælles-Budgetkontoen?" via accounts-creator-mapping.
  transfersByCreator: {
    fromAccountId: string;
    toAccountId: string;
    creatorUserId: string | null;
    monthly: number;
  }[];
  // Antal personer der forventes at bidrage til fælles-udgifter. Tæller
  // både logged-in (user_id != null) og pre-godkendte (email != null,
  // user_id == null) family_members. Min. 1.
  numContributors: number;
  pendingMembers: PendingMember[];
  currentUserId: string;
};

export async function getAdvisorContext(): Promise<AdvisorContext> {
  // HOUSEHOLD-WIDE for contribution tracking - rådgiveren skal vise alle
  // bidragsyderes overførsler, ikke kun perspektivets. Mikkel skal kunne
  // se Louises bidrag uden at toggle proxy.
  //
  // Sikkerhed:
  // - Transfers: RLS fra migration 0030 tillader allerede read når
  //   mindst én side er writable_to_me. Louises transfer FROM hendes
  //   private TIL Budget (shared) er synlig fordi to-siden er fælles.
  // - Accounts (id, created_by): minimal data-eksposition via admin-
  //   client. Vi har brug for at mappe transfer.from_account_id ->
  //   creator for at attribuere bidrag korrekt. Kun id + created_by -
  //   ikke balance, name, monthly_budget eller andre felter.
  const p = await getPerspective();
  const adminSupabase = createAdminClient();

  const [transfersRes, accountsRes, familyRes, graphData] = await Promise.all([
    p.supabase
      .from('transfers')
      .select('from_account_id, to_account_id, amount, recurrence')
      .eq('household_id', p.householdId)
      .neq('recurrence', 'once'),
    adminSupabase
      .from('accounts')
      .select('id, created_by')
      .eq('household_id', p.householdId),
    p.supabase
      .from('family_members')
      .select('id, name, email, user_id')
      .eq('household_id', p.householdId),
    getCashflowGraph(),
  ]);

  if (transfersRes.error) throw transfersRes.error;
  if (accountsRes.error) throw accountsRes.error;
  if (familyRes.error) throw familyRes.error;

  // Map account_id → created_by user id
  const creatorByAccount = new Map<string, string | null>();
  for (const a of accountsRes.data ?? []) {
    creatorByAccount.set(a.id, a.created_by);
  }

  // Aggregér transfers pr. (from, to, creator)-tripel så samme person der
  // har lavet flere transfers fra forskellige af deres konti tæller samlet.
  type Key = string;
  const aggregate = new Map<Key, AdvisorContext['transfersByCreator'][0]>();
  for (const tr of transfersRes.data ?? []) {
    const creator = creatorByAccount.get(tr.from_account_id) ?? null;
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    const key = `${tr.from_account_id}→${tr.to_account_id}@${creator ?? 'null'}`;
    const prev = aggregate.get(key);
    if (prev) prev.monthly += monthly;
    else aggregate.set(key, {
      fromAccountId: tr.from_account_id,
      toAccountId: tr.to_account_id,
      creatorUserId: creator,
      monthly,
    });
  }

  // Antal forventede bidragsydere: alle family_members der enten ER
  // logget-ind eller er pre-godkendt via email. Børn (begge null) tælles
  // ikke med - de bidrager ikke økonomisk.
  const contributors = (familyRes.data ?? []).filter(
    (fm) => fm.user_id != null || fm.email != null
  );
  const pendingMembers: PendingMember[] = (familyRes.data ?? [])
    .filter((fm) => fm.user_id == null && fm.email != null)
    .map((fm) => ({ id: fm.id, name: fm.name, email: fm.email as string }));

  return {
    perAccount: graphData.perAccount,
    transfersByCreator: Array.from(aggregate.values()),
    numContributors: Math.max(1, contributors.length),
    pendingMembers,
    currentUserId: p.authUserId,
  };
}
