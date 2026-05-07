'use server';

// Server Actions for /begivenheder.
//
// Pattern matcher /laan/actions.ts: privilegerede felter (household_id) hentes
// fra getHouseholdContext server-side, aldrig fra formData. Brugerinput læses
// eksplicit per felt - ingen mass-assignment (CLAUDE.md regel #2).

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import {
  capLength,
  parseOptionalAmount,
  parseRequiredAmount,
  TEXT_LIMITS,
  isValidOccursOn,
} from '@/lib/format';
import { setFlashCookie } from '@/lib/flash';
import { mapDbError } from '@/lib/actions/error-map';
import type {
  LifeEventItemStatus,
  LifeEventStatus,
  LifeEventTimeframe,
  LifeEventType,
} from '@/lib/database.types';

const VALID_TYPES: readonly LifeEventType[] = [
  'konfirmation',
  'bryllup',
  'foedselsdag',
  'rejse',
  'bolig',
  'studie',
  'andet',
];

const VALID_TIMEFRAMES: readonly LifeEventTimeframe[] = [
  'within_1y',
  'within_2y',
  'within_5y',
  'within_10y',
];

const VALID_ITEM_STATUSES: readonly LifeEventItemStatus[] = [
  'planlagt',
  'booket',
  'betalt',
];

type ParsedEvent = {
  name: string;
  type: LifeEventType;
  total_budget: number | null;
  use_items_for_budget: boolean;
  target_date: string | null;
  timeframe: LifeEventTimeframe | null;
  linked_account_id: string | null;
  notes: string | null;
};

// Status auto-derive: planning hvis ingen konto, ellers active.
// Kaldes både ved create og update. Terminale states (completed/cancelled)
// sættes via setLifeEventStatus og må ikke nulstilles til planning/active
// blot fordi linked_account ændres - det håndteres i updateLifeEvent.
function deriveStatusFromAccount(
  linked_account_id: string | null
): LifeEventStatus {
  return linked_account_id ? 'active' : 'planning';
}

function readEventForm(
  formData: FormData
): { error: string } | { data: ParsedEvent } {
  const name = capLength(
    String(formData.get('name') ?? '').trim(),
    TEXT_LIMITS.shortName
  );
  if (!name) return { error: 'Navn er påkrævet' };

  const typeRaw = String(formData.get('type') ?? '').trim();
  const type =
    VALID_TYPES.includes(typeRaw as LifeEventType)
      ? (typeRaw as LifeEventType)
      : 'andet';

  // Budget-mode: 'total' (skriv et frit tal) eller 'items' (sum af poster
  // bruges som total). Hvis 'items' er valgt men der ikke er items endnu,
  // gemmer vi total_budget=null og bruger items-summen senere.
  const budgetMode = String(formData.get('budget_mode') ?? 'total');
  const use_items_for_budget = budgetMode === 'items';
  let total_budget: number | null = null;
  if (!use_items_for_budget) {
    const totalRaw = String(formData.get('total_budget') ?? '');
    const parsed = parseOptionalAmount(totalRaw, 'Total budget');
    if (!parsed.ok) return { error: parsed.error };
    total_budget = parsed.value;
  }

  // Date-mode: 'date' (konkret dato) eller 'timeframe' (bucket). Begge
  // tvinger en deadline. DB-constraint life_events_must_have_deadline
  // (migration 0058) afviser hvis ingen er sat.
  const dateMode = String(formData.get('date_mode') ?? 'date');
  let target_date: string | null = null;
  let timeframe: LifeEventTimeframe | null = null;

  if (dateMode === 'date') {
    const raw = String(formData.get('target_date') ?? '').trim();
    if (!raw) return { error: 'Dato er påkrævet' };
    if (!isValidOccursOn(raw)) {
      return { error: 'Ugyldig dato' };
    }
    target_date = raw;
  } else if (dateMode === 'timeframe') {
    const raw = String(formData.get('timeframe') ?? '').trim();
    if (!VALID_TIMEFRAMES.includes(raw as LifeEventTimeframe)) {
      return { error: 'Vælg en tidsramme' };
    }
    timeframe = raw as LifeEventTimeframe;
  } else {
    return { error: 'Vælg dato eller tidsramme' };
  }

  // linked_account_id: tom string = ingen tilknyttet konto. UID-format
  // valideres ikke explicit her - DB's FK constraint fanger ugyldige IDs.
  const linkedRaw = String(formData.get('linked_account_id') ?? '').trim();
  const linked_account_id = linkedRaw || null;

  const notesRaw = capLength(
    String(formData.get('notes') ?? '').trim(),
    TEXT_LIMITS.description
  );
  const notes = notesRaw || null;

  return {
    data: {
      name,
      type,
      total_budget,
      use_items_for_budget,
      target_date,
      timeframe,
      linked_account_id,
      notes,
    },
  };
}

export async function createLifeEvent(formData: FormData) {
  const parsed = readEventForm(formData);
  if ('error' in parsed) {
    redirect(
      '/begivenheder/ny?error=' + encodeURIComponent(parsed.error)
    );
  }

  const { supabase, householdId } = await getHouseholdContext();

  // Hvis linked_account_id er sat, verificér at kontoen tilhører dette
  // household og er en gyldig type. RLS dækker også, men eksplicit tjek
  // giver en klar fejlbesked frem for en obskur DB-constraint-fejl.
  if (parsed.data.linked_account_id) {
    const { data: account } = await supabase
      .from('accounts')
      .select('id, kind')
      .eq('id', parsed.data.linked_account_id)
      .eq('household_id', householdId)
      .maybeSingle();
    if (!account) {
      redirect(
        '/begivenheder/ny?error=' +
          encodeURIComponent('Den valgte konto findes ikke')
      );
    }
  }

  const { data, error } = await supabase
    .from('life_events')
    .insert({
      household_id: householdId,
      name: parsed.data.name,
      type: parsed.data.type,
      total_budget: parsed.data.total_budget,
      use_items_for_budget: parsed.data.use_items_for_budget,
      target_date: parsed.data.target_date,
      timeframe: parsed.data.timeframe,
      linked_account_id: parsed.data.linked_account_id,
      status: deriveStatusFromAccount(parsed.data.linked_account_id),
      notes: parsed.data.notes,
    })
    .select('id')
    .single();
  if (error) {
    console.error('createLifeEvent failed:', error.message);
    redirect(
      '/begivenheder/ny?error=' +
        encodeURIComponent(mapDbError(error, 'Kunne ikke oprette begivenheden'))
    );
  }

  revalidatePath('/begivenheder');
  await setFlashCookie(`${parsed.data.name} oprettet`);
  redirect(`/begivenheder/${encodeURIComponent(data.id)}`);
}

export async function updateLifeEvent(id: string, formData: FormData) {
  const parsed = readEventForm(formData);
  if ('error' in parsed) {
    redirect(
      `/begivenheder/${encodeURIComponent(id)}?error=` +
        encodeURIComponent(parsed.error)
    );
  }

  const { supabase, householdId } = await getHouseholdContext();

  if (parsed.data.linked_account_id) {
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', parsed.data.linked_account_id)
      .eq('household_id', householdId)
      .maybeSingle();
    if (!account) {
      redirect(
        `/begivenheder/${encodeURIComponent(id)}?error=` +
          encodeURIComponent('Den valgte konto findes ikke')
      );
    }
  }

  // Status auto-derive: hvis nuværende status er terminal (completed/
  // cancelled), bevarer vi den. Ellers udleder vi fra linked_account.
  const { data: current } = await supabase
    .from('life_events')
    .select('status')
    .eq('id', id)
    .eq('household_id', householdId)
    .maybeSingle();
  const isTerminal =
    current?.status === 'completed' || current?.status === 'cancelled';
  const nextStatus: LifeEventStatus = isTerminal
    ? current!.status
    : deriveStatusFromAccount(parsed.data.linked_account_id);

  const { error } = await supabase
    .from('life_events')
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      total_budget: parsed.data.total_budget,
      use_items_for_budget: parsed.data.use_items_for_budget,
      target_date: parsed.data.target_date,
      timeframe: parsed.data.timeframe,
      linked_account_id: parsed.data.linked_account_id,
      status: nextStatus,
      notes: parsed.data.notes,
    })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    console.error('updateLifeEvent failed:', error.message);
    redirect(
      `/begivenheder/${encodeURIComponent(id)}?error=` +
        encodeURIComponent(mapDbError(error, 'Kunne ikke gemme begivenheden'))
    );
  }

  revalidatePath('/begivenheder');
  revalidatePath(`/begivenheder/${id}`);
  await setFlashCookie(`${parsed.data.name} gemt`);
  redirect(`/begivenheder/${encodeURIComponent(id)}`);
}

export async function deleteLifeEvent(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('life_events')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    console.error('deleteLifeEvent failed:', error.message);
    throw new Error('Internal error');
  }
  revalidatePath('/begivenheder');
  await setFlashCookie('Begivenhed slettet');
  redirect('/begivenheder');
}

// "Markér som gennemført" / "Aflys" - terminal status-skift fra
// detalje-siden. Vi tillader kun de to terminale targets her. Tilbage
// til planning/active sker via reopenLifeEvent som auto-deriverer fra
// linked_account_id (matcher den almindelige status-logik).
const TERMINAL_STATUSES: readonly LifeEventStatus[] = [
  'completed',
  'cancelled',
];

export async function setLifeEventStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const target = String(formData.get('status') ?? '');
  if (!id) return;
  if (!TERMINAL_STATUSES.includes(target as LifeEventStatus)) {
    return;
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('life_events')
    .update({ status: target as LifeEventStatus })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    console.error('setLifeEventStatus failed:', error.message);
    throw new Error('Internal error');
  }
  revalidatePath('/begivenheder');
  revalidatePath(`/begivenheder/${id}`);
  await setFlashCookie('Status opdateret');
  redirect(`/begivenheder/${encodeURIComponent(id)}`);
}

// Genåbn fra completed/cancelled. Auto-deriverer ny status fra
// linked_account_id (samme logik som createLifeEvent + updateLifeEvent).
export async function reopenLifeEvent(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { data: current } = await supabase
    .from('life_events')
    .select('linked_account_id, status')
    .eq('id', id)
    .eq('household_id', householdId)
    .maybeSingle();
  if (!current) return;
  // No-op hvis allerede ikke-terminal - ingen grund til at skrive en
  // identisk række.
  if (current.status !== 'completed' && current.status !== 'cancelled') {
    redirect(`/begivenheder/${encodeURIComponent(id)}`);
  }

  const next = deriveStatusFromAccount(current.linked_account_id);
  const { error } = await supabase
    .from('life_events')
    .update({ status: next })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    console.error('reopenLifeEvent failed:', error.message);
    throw new Error('Internal error');
  }
  revalidatePath('/begivenheder');
  revalidatePath(`/begivenheder/${id}`);
  await setFlashCookie('Begivenhed genåbnet');
  redirect(`/begivenheder/${encodeURIComponent(id)}`);
}

// ----------------------------------------------------------------
// Items (linje-poster på en begivenhed)
// ----------------------------------------------------------------

export async function addLifeEventItem(eventId: string, formData: FormData) {
  const title = capLength(
    String(formData.get('title') ?? '').trim(),
    TEXT_LIMITS.shortName
  );
  if (!title) {
    redirect(
      `/begivenheder/${encodeURIComponent(eventId)}?error=` +
        encodeURIComponent('Titel er påkrævet')
    );
  }

  const amountRaw = String(formData.get('amount') ?? '');
  // Items kan være 0 (fx en post hvor prisen ikke er kendt endnu).
  const amount = parseRequiredAmount(amountRaw, 'Beløb', { allowZero: true });
  if (!amount.ok) {
    redirect(
      `/begivenheder/${encodeURIComponent(eventId)}?error=` +
        encodeURIComponent(amount.error)
    );
  }

  const statusRaw = String(formData.get('status') ?? 'planlagt').trim();
  const status = VALID_ITEM_STATUSES.includes(statusRaw as LifeEventItemStatus)
    ? (statusRaw as LifeEventItemStatus)
    : 'planlagt';

  const { supabase, householdId } = await getHouseholdContext();

  // Verificér at event'en tilhører dette household før insert.
  const { data: event } = await supabase
    .from('life_events')
    .select('id')
    .eq('id', eventId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (!event) {
    throw new Error('Internal error');
  }

  // Find næste sort_order så nye items lægges nederst.
  const { data: lastItem } = await supabase
    .from('life_event_items')
    .select('sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = lastItem ? lastItem.sort_order + 1 : 0;

  const { error } = await supabase.from('life_event_items').insert({
    event_id: eventId,
    household_id: householdId,
    title,
    amount: amount.value,
    status,
    sort_order: nextSort,
  });
  if (error) {
    console.error('addLifeEventItem failed:', error.message);
    redirect(
      `/begivenheder/${encodeURIComponent(eventId)}?error=` +
        encodeURIComponent(mapDbError(error, 'Kunne ikke tilføje posten'))
    );
  }

  revalidatePath(`/begivenheder/${eventId}`);
  redirect(`/begivenheder/${encodeURIComponent(eventId)}`);
}

export async function updateLifeEventItem(formData: FormData) {
  const itemId = String(formData.get('_item_id') ?? '');
  const eventId = String(formData.get('event_id') ?? '');
  if (!itemId || !eventId) return;

  const title = capLength(
    String(formData.get('title') ?? '').trim(),
    TEXT_LIMITS.shortName
  );
  if (!title) {
    redirect(
      `/begivenheder/${encodeURIComponent(eventId)}?error=` +
        encodeURIComponent('Titel er påkrævet')
    );
  }

  const amount = parseRequiredAmount(
    String(formData.get('amount') ?? ''),
    'Beløb',
    { allowZero: true }
  );
  if (!amount.ok) {
    redirect(
      `/begivenheder/${encodeURIComponent(eventId)}?error=` +
        encodeURIComponent(amount.error)
    );
  }

  const statusRaw = String(formData.get('status') ?? 'planlagt').trim();
  const status = VALID_ITEM_STATUSES.includes(statusRaw as LifeEventItemStatus)
    ? (statusRaw as LifeEventItemStatus)
    : 'planlagt';

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('life_event_items')
    .update({ title, amount: amount.value, status })
    .eq('id', itemId)
    .eq('household_id', householdId);
  if (error) {
    console.error('updateLifeEventItem failed:', error.message);
    redirect(
      `/begivenheder/${encodeURIComponent(eventId)}?error=` +
        encodeURIComponent(mapDbError(error, 'Kunne ikke gemme posten'))
    );
  }

  revalidatePath(`/begivenheder/${eventId}`);
  redirect(`/begivenheder/${encodeURIComponent(eventId)}`);
}

export async function deleteLifeEventItem(formData: FormData) {
  const itemId = String(formData.get('id') ?? '');
  const eventId = String(formData.get('event_id') ?? '');
  if (!itemId || !eventId) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('life_event_items')
    .delete()
    .eq('id', itemId)
    .eq('household_id', householdId);
  if (error) {
    console.error('deleteLifeEventItem failed:', error.message);
    throw new Error('Internal error');
  }

  revalidatePath(`/begivenheder/${eventId}`);
  redirect(`/begivenheder/${encodeURIComponent(eventId)}`);
}
