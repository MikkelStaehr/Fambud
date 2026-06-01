// Transfers - penge-overførsler mellem to konti i samme husstand. To FK'er
// peger til `accounts` (from + to), så queries skal disambiguere via
// kolonnenavn fremfor constraint-navn (mere robust mod auto-genererede
// Postgres-navne).

import type {
  Account,
  AccountKind,
  RecurrenceFreq,
  Transfer,
} from '@/lib/database.types';
import { monthBounds, monthlyEquivalent } from '@/lib/format';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getPerspective,
  privateAccountFilter,
  getVisibleAccountIds,
} from './auth';

type TransferWithRelations = Transfer & {
  from_account: Pick<Account, 'id' | 'name'> | null;
  to_account: Pick<Account, 'id' | 'name'> | null;
};

export async function getTransfersForMonth(
  yearMonth: string
): Promise<TransferWithRelations[]> {
  const p = await getPerspective();
  const { start, end } = monthBounds(yearMonth);
  const visibleAccountIds = await getVisibleAccountIds();
  if (visibleAccountIds && visibleAccountIds.length === 0) return [];

  let q = p.supabase
    .from('transfers')
    .select(
      '*, from_account:accounts!from_account_id(id, name), to_account:accounts!to_account_id(id, name)'
    )
    .eq('household_id', p.householdId)
    .gte('occurs_on', start)
    .lte('occurs_on', end);
  // RLS for transfers: visible hvis MINDST én side er læsbar (mig.0030)
  if (visibleAccountIds) {
    q = q.or(
      `from_account_id.in.(${visibleAccountIds.join(',')}),to_account_id.in.(${visibleAccountIds.join(',')})`
    );
  }

  const { data, error } = await q
    .order('occurs_on', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<TransferWithRelations[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getTransferById(id: string): Promise<Transfer> {
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();
  let q = p.supabase
    .from('transfers')
    .select('*')
    .eq('id', id)
    .eq('household_id', p.householdId);
  if (visibleAccountIds) {
    q = q.or(
      `from_account_id.in.(${visibleAccountIds.join(',')}),to_account_id.in.(${visibleAccountIds.join(',')})`
    );
  }
  const { data, error } = await q.single();
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Transfer graph - datamodel for /overforsler graf-visning
// ----------------------------------------------------------------------------
// Hvor cashflow-grafen på dashboard viser HELE flowet (income → konti →
// expense), er denne fokuseret KUN på de kant-til-kant overførsler mellem
// konti. Til /overforsler hvor brugeren skal kunne trække fra konto til
// konto for at oprette en ny overførsel, og klikke på en eksisterende kant
// for at redigere den.
//
// Vi inkluderer engangs-overførsler ('once') i modsætning til dashboard-
// grafen - på /overforsler er hver enkelt overførsel relevant, også
// engangs-poster.
type TransferEdge = {
  from: string;            // from_account_id
  to: string;              // to_account_id
  totalMonthly: number;    // sum af monthlyEquivalent over alle overførsler i parret
  transfers: {
    id: string;
    amount: number;        // pr. forekomst (øre)
    recurrence: RecurrenceFreq;
    description: string | null;
    occurs_on: string;
  }[];
};

// Minimal ejer-metadata for ALLE husstandens konti (incl. dem der er
// RLS-skjult fra perspectiv'et). Bruges af /overforsler til at vise
// "Fra Louise" på partnerens private lønkonto i stedet for "Fra Ukendt".
// Kun metadata - ingen balance eller transaktioner.
export type TransferAccountOwner = {
  id: string;
  name: string;
  kind: AccountKind;
  owner_name: string | null;
  created_by: string | null;
  editable_by_all: boolean;
};

type TransferGraphData = {
  accounts: Account[];
  edges: TransferEdge[];
  // Hus-bredt ejer-lookup. Brug accountOwners.get(id) som fallback når
  // accounts-listen mangler en konto (typisk partnerens private lønkonto).
  accountOwners: Map<string, TransferAccountOwner>;
};

export async function getTransferGraph(): Promise<TransferGraphData> {
  const p = await getPerspective();
  const visibleAccountIds = await getVisibleAccountIds();
  if (visibleAccountIds && visibleAccountIds.length === 0) {
    return { accounts: [], edges: [], accountOwners: new Map() };
  }

  let accountsQ = p.supabase
    .from('accounts')
    .select('*')
    .eq('household_id', p.householdId)
    .eq('archived', false);
  accountsQ = accountsQ.or(privateAccountFilter(p));

  let transfersQ = p.supabase
    .from('transfers')
    .select('id, from_account_id, to_account_id, amount, recurrence, description, occurs_on')
    .eq('household_id', p.householdId);
  if (visibleAccountIds) {
    transfersQ = transfersQ.or(
      `from_account_id.in.(${visibleAccountIds.join(',')}),to_account_id.in.(${visibleAccountIds.join(',')})`
    );
  }

  // Hus-bred ejer-metadata via admin-client: vi har brug for at klassificere
  // from-konti der er RLS-skjult fra perspectiv'et (typisk partnerens private
  // lønkonto). Privacy-safe: kun id/name/kind + owner-felter - ingen balance
  // eller transaktioner. Samme mønster som getEconomyPlanData bruger til
  // memberLonkonto-lookup.
  const adminClient = createAdminClient();
  const [accountsRes, transfersRes, allAccountsRes, familyMembersRes] =
    await Promise.all([
      accountsQ.order('created_at', { ascending: true }),
      transfersQ.order('occurs_on', { ascending: false }),
      adminClient
        .from('accounts')
        .select('id, name, kind, owner_name, created_by, editable_by_all')
        .eq('household_id', p.householdId)
        .eq('archived', false),
      adminClient
        .from('family_members')
        .select('user_id, name')
        .eq('household_id', p.householdId)
        .not('user_id', 'is', null),
    ]);

  if (accountsRes.error) throw accountsRes.error;
  if (transfersRes.error) throw transfersRes.error;
  if (allAccountsRes.error) throw allAccountsRes.error;
  if (familyMembersRes.error) throw familyMembersRes.error;

  // Map user_id → family member-navn så vi kan resolve owner_name=null
  // til partnerens navn (fx Louises lønkonto har owner_name=null, men
  // created_by peger på Louises auth-user, og vi vil vise "Louise" som ejer).
  const memberNameByUserId = new Map<string, string>();
  for (const fm of familyMembersRes.data ?? []) {
    if (fm.user_id) memberNameByUserId.set(fm.user_id, fm.name);
  }

  const accountOwners = new Map<string, TransferAccountOwner>();
  for (const a of allAccountsRes.data ?? []) {
    const memberName = a.created_by
      ? memberNameByUserId.get(a.created_by) ?? null
      : null;
    accountOwners.set(a.id, {
      id: a.id,
      name: a.name,
      kind: a.kind,
      owner_name: a.owner_name ?? memberName,
      created_by: a.created_by,
      editable_by_all: a.editable_by_all ?? false,
    });
  }

  // Samle alle transfers under deres (from, to)-par. monthlyEquivalent giver
  // 0 for 'once', så engangs-overførsler bidrager ikke til kant-tykkelsen
  // men er stadig listet under transfers[].
  const byPair = new Map<string, TransferEdge>();
  for (const tr of transfersRes.data ?? []) {
    const key = `${tr.from_account_id}→${tr.to_account_id}`;
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    let edge = byPair.get(key);
    if (!edge) {
      edge = {
        from: tr.from_account_id,
        to: tr.to_account_id,
        totalMonthly: 0,
        transfers: [],
      };
      byPair.set(key, edge);
    }
    edge.totalMonthly += monthly;
    edge.transfers.push({
      id: tr.id,
      amount: tr.amount,
      recurrence: tr.recurrence,
      description: tr.description,
      occurs_on: tr.occurs_on,
    });
  }

  return {
    accounts: accountsRes.data ?? [],
    edges: Array.from(byPair.values()),
    accountOwners,
  };
}

// Aktive tilbagevendende overførsler i samme retning - bruges af
// /overforsler/ny til at advare brugeren før den opretter en duplikat
// (typisk når Rådgiverens "Opsæt overførsel" linkes ind, men der
// allerede er en månedlig overførsel fra samme lønkonto til samme
// budget/husholdnings/buffer-konto).
//
// "Aktiv" = recurrence != 'once' AND (recurrence_until null OR i fremtiden).
// Engangs-overførsler er ikke duplikat-kandidater - de er per definition
// historik der ikke gentages.
export type MatchingActiveTransfer = {
  id: string;
  amount: number;
  recurrence: RecurrenceFreq;
  recurrence_until: string | null;
  description: string | null;
  occurs_on: string;
  monthlyEquivalent: number;
};

export async function getMatchingActiveTransfers(
  fromAccountId: string,
  toAccountId: string
): Promise<MatchingActiveTransfer[]> {
  if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
    return [];
  }
  const p = await getPerspective();
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data, error } = await p.supabase
    .from('transfers')
    .select(
      'id, amount, recurrence, recurrence_until, description, occurs_on'
    )
    .eq('household_id', p.householdId)
    .eq('from_account_id', fromAccountId)
    .eq('to_account_id', toAccountId)
    .neq('recurrence', 'once')
    .or(`recurrence_until.is.null,recurrence_until.gte.${todayIso}`)
    .order('occurs_on', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    amount: t.amount,
    recurrence: t.recurrence,
    recurrence_until: t.recurrence_until,
    description: t.description,
    occurs_on: t.occurs_on,
    monthlyEquivalent: monthlyEquivalent(t.amount, t.recurrence),
  }));
}
