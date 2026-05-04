// Næste 7 dages begivenheder - kommende regninger og overførsler.
//
// Dashboard-modulet "Næste begivenheder" viser hvad der sker økonomisk i den
// nære fremtid. Vi beregner det forlæns:
//   - For recurring transaktioner: rul deres anchor-dato frem til næste
//     forekomst efter today via nextOccurrenceAfter() - hvis dato er
//     inden for vinduet, inkluderes posten
//   - For 'once'-transaktioner: inkluderes hvis deres occurs_on er i
//     fremtiden inden for vinduet (fx en planlagt enkelt-betaling)
// Income-paychecks med income_role='primary' inkluderes ikke - de er
// historiske registreringer, ikke fremtidige forekomster (vi kender kun
// gennemsnit, ikke næste konkrete dato).
//
// Hver event-tagges med scope ('private' eller 'shared') afhængig af om
// kilde-kontoens owner_name === 'Fælles'. Det matcher den samme privat/fælles-
// opdeling som CategoryGroupChart bruger og lader UI'et toggle uden ekstra
// roundtrip.

import type { RecurrenceFreq } from '@/lib/database.types';
import { nextOccurrenceAfter } from '@/lib/format';
import { getHouseholdContext } from './auth';

export type EventScope = 'private' | 'shared';

export type UpcomingEvent = {
  id: string;
  kind: 'expense' | 'transfer';
  scope: EventScope;
  date: string;          // ISO YYYY-MM-DD - den fremtidige forekomst
  description: string;
  amount: number;        // positivt øre, fortegnet håndteres af kind
  account: { id: string; name: string } | null;
  destination: { id: string; name: string } | null; // kun for transfers
  category: { name: string; color: string } | null;  // kun for expenses
};

export async function getUpcomingEvents(days: number = 7): Promise<UpcomingEvent[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const horizon = new Date(todayDateOnly);
  horizon.setDate(horizon.getDate() + days);

  const [txnsRes, transfersRes] = await Promise.all([
    supabase
      .from('transactions')
      .select(
        'id, account_id, amount, description, occurs_on, recurrence, account:accounts(id, name, owner_name), category:categories!inner(name, color, kind)'
      )
      .eq('household_id', householdId)
      .eq('category.kind', 'expense')
      .returns<{
        id: string;
        account_id: string;
        amount: number;
        description: string | null;
        occurs_on: string;
        recurrence: RecurrenceFreq;
        account: { id: string; name: string; owner_name: string | null } | null;
        category: { name: string; color: string; kind: 'expense' } | null;
      }[]>(),
    supabase
      .from('transfers')
      .select(
        'id, amount, description, occurs_on, recurrence, from_account:accounts!from_account_id(id, name, owner_name), to_account:accounts!to_account_id(id, name)'
      )
      .eq('household_id', householdId)
      .returns<{
        id: string;
        amount: number;
        description: string | null;
        occurs_on: string;
        recurrence: RecurrenceFreq;
        from_account: { id: string; name: string; owner_name: string | null } | null;
        to_account: { id: string; name: string } | null;
      }[]>(),
  ]);

  if (txnsRes.error) throw txnsRes.error;
  if (transfersRes.error) throw transfersRes.error;

  const events: UpcomingEvent[] = [];
  const horizonISO = horizon.toISOString().slice(0, 10);
  const todayISO = todayDateOnly.toISOString().slice(0, 10);
  const scopeFor = (ownerName: string | null | undefined): EventScope =>
    ownerName === 'Fælles' ? 'shared' : 'private';

  for (const t of txnsRes.data ?? []) {
    const nextDate =
      t.recurrence === 'once' ? t.occurs_on : nextOccurrenceAfter(t.occurs_on, t.recurrence, today);
    if (nextDate < todayISO || nextDate > horizonISO) continue;
    events.push({
      id: t.id,
      kind: 'expense',
      scope: scopeFor(t.account?.owner_name),
      date: nextDate,
      description: t.description ?? t.category?.name ?? 'Regning',
      amount: t.amount,
      account: t.account ? { id: t.account.id, name: t.account.name } : null,
      destination: null,
      category: t.category ? { name: t.category.name, color: t.category.color } : null,
    });
  }

  for (const tr of transfersRes.data ?? []) {
    const nextDate =
      tr.recurrence === 'once' ? tr.occurs_on : nextOccurrenceAfter(tr.occurs_on, tr.recurrence, today);
    if (nextDate < todayISO || nextDate > horizonISO) continue;
    events.push({
      id: tr.id,
      kind: 'transfer',
      scope: scopeFor(tr.from_account?.owner_name),
      date: nextDate,
      description: tr.description ?? `Overførsel til ${tr.to_account?.name ?? '?'}`,
      amount: tr.amount,
      account: tr.from_account
        ? { id: tr.from_account.id, name: tr.from_account.name }
        : null,
      destination: tr.to_account,
      category: null,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));
  return events;
}
