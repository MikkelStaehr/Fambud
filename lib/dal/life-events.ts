// Begivenheder (life_events): planlagte større opsparingsmål.
//
// Modellen post-migration 0059: en begivenhed har INGEN direkte konto-FK.
// Tilknytningen sker via overførsler - hver transfer.life_event_id linker
// en konkret månedlig opsparing til en begivenhed. En event kan have N
// transfers (multi-contributor), eller 0 (planning-state).
//
// DAL'en henter events + items + transfers i én roundtrip pr. side. Live
// status og alerts beregnes i lib/format.ts på read.

import type {
  AccountKind,
  LifeEvent,
  LifeEventItem,
  RecurrenceFreq,
} from '@/lib/database.types';
import { monthlyEquivalent } from '@/lib/format';
import { getHouseholdContext } from './auth';

// Slim-summary af en transfer linket til et event. Vi henter kun de
// felter UI'et faktisk skal bruge (sammenligning af mål-konti,
// monthly-equivalent, navn på kontoen).
export type LifeEventTransferSummary = {
  id: string;
  to_account_id: string;
  to_account_name: string;
  to_account_kind: AccountKind;
  amount: number;
  recurrence: RecurrenceFreq;
  monthly: number; // monthlyEquivalent af amount + recurrence
};

export type LifeEventWithItems = LifeEvent & {
  items: LifeEventItem[];
  // Recurring (ikke-'once') transfers tied til dette event. Empty array
  // betyder planning - ingen aktiv opsparing endnu.
  transfers: LifeEventTransferSummary[];
  // Sum af transfers.monthly. Bruges af agentens underfunded-detektor
  // og som "Aktuel pr. måned"-stat i UI.
  monthlyTotal: number;
};

// Sortering: target_date stigende, nulls sidst (timeframe-buckets
// behandles som "udsat" i sammenligning).
export async function getLifeEvents(
  includeCancelled = false
): Promise<LifeEventWithItems[]> {
  const { supabase, householdId } = await getHouseholdContext();

  let eventsQuery = supabase
    .from('life_events')
    .select('*')
    .eq('household_id', householdId)
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (!includeCancelled) {
    eventsQuery = eventsQuery.neq('status', 'cancelled');
  }

  const { data: events, error: eventsErr } = await eventsQuery;
  if (eventsErr) throw eventsErr;
  if (!events || events.length === 0) return [];

  const eventIds = events.map((e) => e.id);

  // Items joint-fetch
  const { data: items, error: itemsErr } = await supabase
    .from('life_event_items')
    .select('*')
    .in('event_id', eventIds)
    .order('sort_order', { ascending: true });
  if (itemsErr) throw itemsErr;

  const itemsByEvent = new Map<string, LifeEventItem[]>();
  for (const item of items ?? []) {
    const arr = itemsByEvent.get(item.event_id) ?? [];
    arr.push(item);
    itemsByEvent.set(item.event_id, arr);
  }

  // Transfers joint-fetch: alle recurring transfers tied til disse
  // events. 'once'-transfers ekskluderes - de er engangsindbetalinger,
  // ikke månedlig opsparing, og skal ikke flippe status til active.
  const { data: transfers, error: transfersErr } = await supabase
    .from('transfers')
    .select('id, life_event_id, to_account_id, amount, recurrence')
    .in('life_event_id', eventIds)
    .neq('recurrence', 'once');
  if (transfersErr) throw transfersErr;

  // Berig transfers med kontonavne. Ét select pr. unique account_id.
  const accountIds = Array.from(
    new Set((transfers ?? []).map((t) => t.to_account_id))
  );
  const accountMap = new Map<
    string,
    { name: string; kind: AccountKind }
  >();
  if (accountIds.length > 0) {
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('id, name, kind')
      .in('id', accountIds);
    if (accErr) throw accErr;
    for (const acc of accounts ?? []) {
      accountMap.set(acc.id, { name: acc.name, kind: acc.kind });
    }
  }

  const transfersByEvent = new Map<string, LifeEventTransferSummary[]>();
  for (const tr of transfers ?? []) {
    if (!tr.life_event_id) continue;
    const account = accountMap.get(tr.to_account_id);
    const summary: LifeEventTransferSummary = {
      id: tr.id,
      to_account_id: tr.to_account_id,
      to_account_name: account?.name ?? 'Ukendt konto',
      to_account_kind: account?.kind ?? 'other',
      amount: tr.amount,
      recurrence: tr.recurrence,
      monthly: monthlyEquivalent(tr.amount, tr.recurrence),
    };
    const arr = transfersByEvent.get(tr.life_event_id) ?? [];
    arr.push(summary);
    transfersByEvent.set(tr.life_event_id, arr);
  }

  return events.map((event) => {
    const eventTransfers = transfersByEvent.get(event.id) ?? [];
    const monthlyTotal = eventTransfers.reduce(
      (sum, t) => sum + t.monthly,
      0
    );
    return {
      ...event,
      items: itemsByEvent.get(event.id) ?? [],
      transfers: eventTransfers,
      monthlyTotal,
    };
  });
}

export async function getLifeEventById(id: string): Promise<LifeEventWithItems> {
  const { supabase, householdId } = await getHouseholdContext();

  const { data: event, error: eventErr } = await supabase
    .from('life_events')
    .select('*')
    .eq('id', id)
    .eq('household_id', householdId)
    .single();
  if (eventErr) throw eventErr;

  const [itemsRes, transfersRes] = await Promise.all([
    supabase
      .from('life_event_items')
      .select('*')
      .eq('event_id', id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('transfers')
      .select('id, to_account_id, amount, recurrence')
      .eq('life_event_id', id)
      .neq('recurrence', 'once'),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (transfersRes.error) throw transfersRes.error;

  const accountIds = Array.from(
    new Set((transfersRes.data ?? []).map((t) => t.to_account_id))
  );
  const accountMap = new Map<
    string,
    { name: string; kind: AccountKind }
  >();
  if (accountIds.length > 0) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, name, kind')
      .in('id', accountIds)
      .eq('household_id', householdId);
    for (const acc of accounts ?? []) {
      accountMap.set(acc.id, { name: acc.name, kind: acc.kind });
    }
  }

  const transfers: LifeEventTransferSummary[] = (transfersRes.data ?? []).map(
    (tr) => {
      const account = accountMap.get(tr.to_account_id);
      return {
        id: tr.id,
        to_account_id: tr.to_account_id,
        to_account_name: account?.name ?? 'Ukendt konto',
        to_account_kind: account?.kind ?? 'other',
        amount: tr.amount,
        recurrence: tr.recurrence,
        monthly: monthlyEquivalent(tr.amount, tr.recurrence),
      };
    }
  );
  const monthlyTotal = transfers.reduce((sum, t) => sum + t.monthly, 0);

  return {
    ...event,
    items: itemsRes.data ?? [],
    transfers,
    monthlyTotal,
  };
}

// Antal aktive (ikke-aflyste, ikke-gennemførte) begivenheder. Bruges
// af dashboard og evt. badges i sidebaren senere.
export async function getActiveLifeEventCount(): Promise<number> {
  const { supabase, householdId } = await getHouseholdContext();
  const { count, error } = await supabase
    .from('life_events')
    .select('*', { count: 'exact', head: true })
    .eq('household_id', householdId)
    .in('status', ['planning', 'active']);
  if (error) throw error;
  return count ?? 0;
}
