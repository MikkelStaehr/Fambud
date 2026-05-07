// Begivenheder (life_events): planlagte større opsparingsmål.
//
// Hver begivenhed har optional linje-poster (life_event_items) der summer
// til total-budget når use_items_for_budget=true, og optional link til en
// savings/investment-konto. UI'et beregner fremdrift via konto-saldo +
// budget-helpers i lib/format.ts (lifeEventTotalBudget,
// lifeEventMonthsRemaining).

import type { Account, LifeEvent, LifeEventItem } from '@/lib/database.types';
import { getHouseholdContext } from './auth';

export type LifeEventLinkedAccount = Pick<
  Account,
  'id' | 'name' | 'opening_balance' | 'kind'
>;

export type LifeEventWithItems = LifeEvent & {
  items: LifeEventItem[];
  linked_account: LifeEventLinkedAccount | null;
};

// Lister begivenheder for det aktuelle household. Aflyste filtreres væk
// med mindre includeCancelled=true (admin-view kunne vise dem; default
// bruger-view skjuler dem). Sortering: target_date stigende, nulls sidst,
// så "nærmeste deadline først" er det naturlige resultat.
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

  // Items joint-fetch: én query for alle events. items_by_event-mappet
  // bygges client-side så vi undgår N+1.
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

  // Linked accounts joint-fetch: kun de IDs der reelt er sat.
  const linkedIds = events
    .map((e) => e.linked_account_id)
    .filter((id): id is string => !!id);
  const accountById = new Map<string, LifeEventLinkedAccount>();
  if (linkedIds.length > 0) {
    const { data: accounts, error: accErr } = await supabase
      .from('accounts')
      .select('id, name, opening_balance, kind')
      .in('id', linkedIds);
    if (accErr) throw accErr;
    for (const account of accounts ?? []) {
      accountById.set(account.id, account);
    }
  }

  return events.map((event) => ({
    ...event,
    items: itemsByEvent.get(event.id) ?? [],
    linked_account: event.linked_account_id
      ? (accountById.get(event.linked_account_id) ?? null)
      : null,
  }));
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

  const { data: items, error: itemsErr } = await supabase
    .from('life_event_items')
    .select('*')
    .eq('event_id', id)
    .order('sort_order', { ascending: true });
  if (itemsErr) throw itemsErr;

  let linked_account: LifeEventLinkedAccount | null = null;
  if (event.linked_account_id) {
    const { data: account } = await supabase
      .from('accounts')
      .select('id, name, opening_balance, kind')
      .eq('id', event.linked_account_id)
      .eq('household_id', householdId)
      .maybeSingle();
    linked_account = account ?? null;
  }

  return { ...event, items: items ?? [], linked_account };
}

// Konti til linked_account-dropdown'en på begivenhed-formen. Kun savings
// og investment giver mening (det er der opsparings-saldoer ligger), og
// kun ikke-arkiverede.
export async function getLifeEventEligibleAccounts(): Promise<
  Pick<Account, 'id' | 'name' | 'kind'>[]
> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, kind')
    .eq('household_id', householdId)
    .in('kind', ['savings', 'investment'])
    .eq('archived', false)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Antal aktive (ikke-aflyste, ikke-gennemførte) begivenheder. Bruges af
// dashboard og evt. badges i sidebaren senere.
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
