// Transfers - penge-overførsler mellem to konti i samme husstand. To FK'er
// peger til `accounts` (from + to), så queries skal disambiguere via
// kolonnenavn fremfor constraint-navn (mere robust mod auto-genererede
// Postgres-navne).

import type { Account, RecurrenceFreq, Transfer } from '@/lib/database.types';
import { monthBounds, monthlyEquivalent } from '@/lib/format';
import { getHouseholdContext } from './auth';

type TransferWithRelations = Transfer & {
  from_account: Pick<Account, 'id' | 'name'> | null;
  to_account: Pick<Account, 'id' | 'name'> | null;
};

export async function getTransfersForMonth(
  yearMonth: string
): Promise<TransferWithRelations[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { start, end } = monthBounds(yearMonth);

  // Two FKs from transfers→accounts, so we disambiguate by column name. This
  // is more robust than the constraint-name form because we don't depend on
  // Postgres's auto-generated constraint naming (transfers_from_account_id_fkey).
  const { data, error } = await supabase
    .from('transfers')
    .select(
      '*, from_account:accounts!from_account_id(id, name), to_account:accounts!to_account_id(id, name)'
    )
    .eq('household_id', householdId)
    .gte('occurs_on', start)
    .lte('occurs_on', end)
    .order('occurs_on', { ascending: false })
    .order('created_at', { ascending: false })
    .returns<TransferWithRelations[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getTransferById(id: string): Promise<Transfer> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('id', id)
    .eq('household_id', householdId)
    .single();
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

type TransferGraphData = {
  accounts: Account[];
  edges: TransferEdge[];
};

export async function getTransferGraph(): Promise<TransferGraphData> {
  const { supabase, householdId } = await getHouseholdContext();

  const [accountsRes, transfersRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('household_id', householdId)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
    supabase
      .from('transfers')
      .select('id, from_account_id, to_account_id, amount, recurrence, description, occurs_on')
      .eq('household_id', householdId)
      .order('occurs_on', { ascending: false }),
  ]);

  if (accountsRes.error) throw accountsRes.error;
  if (transfersRes.error) throw transfersRes.error;

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
  };
}
