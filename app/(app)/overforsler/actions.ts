'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseRequiredAmount, capLength, TEXT_LIMITS } from '@/lib/format';
import { setFlashCookie } from '@/lib/flash';
import { mapDbError } from '@/lib/actions/error-map';
import type { RecurrenceFreq } from '@/lib/database.types';

const VALID_FREQS: readonly RecurrenceFreq[] = [
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
];

// UUID-mønster brugt til at validere life_event_id. Vi accepterer kun
// gyldige UUIDv4-strenge så et ondsindet input ikke ender i query'en.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readTransferForm(formData: FormData):
  | { error: string }
  | {
      data: {
        from_account_id: string;
        to_account_id: string;
        amount: number;
        description: string | null;
        occurs_on: string;
        recurrence: RecurrenceFreq;
        recurrence_until: string | null;
        life_event_id: string | null;
      };
    } {
  const from_account_id = String(formData.get('from_account_id') ?? '').trim();
  const to_account_id = String(formData.get('to_account_id') ?? '').trim();
  if (!from_account_id || !to_account_id) return { error: 'Vælg begge konti' };
  // Mirrors the DB-level CHECK; we duplicate it here for a friendlier message.
  if (from_account_id === to_account_id) {
    return { error: 'Fra-konto og til-konto skal være forskellige' };
  }

  const amountRes = parseRequiredAmount(
    String(formData.get('amount') ?? ''),
    'Beløb'
  );
  if (!amountRes.ok) return { error: amountRes.error };
  const amount = amountRes.value;

  const occurs_on = String(formData.get('occurs_on') ?? '').trim();
  if (!occurs_on) return { error: 'Dato er påkrævet' };

  const recurrenceRaw = String(formData.get('recurrence') ?? 'once');
  if (!VALID_FREQS.includes(recurrenceRaw as RecurrenceFreq)) {
    return { error: 'Ugyldig gentagelse' };
  }
  const recurrence = recurrenceRaw as RecurrenceFreq;

  const untilRaw = String(formData.get('recurrence_until') ?? '').trim();
  const recurrence_until = recurrence === 'once' ? null : untilRaw || null;

  const descRaw = capLength(String(formData.get('description') ?? '').trim(), TEXT_LIMITS.description);
  const description = descRaw || null;

  // life_event_id kommer som hidden input når brugeren startede flow'et
  // fra en begivenheds "Opsæt overførsel"-CTA. Format-tjek her; ejerskab
  // verificeres serverside i createTransfer/updateTransfer (RLS dækker
  // også, men eksplicit tjek giver en pænere fejlbesked).
  const lifeEventRaw = String(formData.get('life_event_id') ?? '').trim();
  const life_event_id = UUID_PATTERN.test(lifeEventRaw) ? lifeEventRaw : null;

  return {
    data: {
      from_account_id,
      to_account_id,
      amount,
      description,
      occurs_on,
      recurrence,
      recurrence_until,
      life_event_id,
    },
  };
}

export async function createTransfer(formData: FormData) {
  const parsed = readTransferForm(formData);
  if ('error' in parsed) {
    redirect('/overforsler/ny?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();

  // Hvis link til en begivenhed er angivet, verificér at event'en
  // tilhører dette household før insert. RLS ville også afvise via
  // FK-trigger, men eksplicit tjek giver en pænere fejlbesked.
  if (parsed.data.life_event_id) {
    const { data: event } = await supabase
      .from('life_events')
      .select('id')
      .eq('id', parsed.data.life_event_id)
      .eq('household_id', householdId)
      .maybeSingle();
    if (!event) {
      redirect(
        '/overforsler/ny?error=' +
          encodeURIComponent('Den valgte begivenhed findes ikke')
      );
    }
  }

  const { error } = await supabase.from('transfers').insert({
    household_id: householdId,
    ...parsed.data,
  });
  if (error) {
    redirect('/overforsler/ny?error=' + encodeURIComponent('Operationen fejlede - prøv igen'));
  }

  revalidatePath('/overforsler');
  revalidatePath('/dashboard');
  // Hvis transferen blev linket til en begivenhed, invalider også den
  // begivenheds detalje- og listesider så live status (planning →
  // active) opdateres straks.
  if (parsed.data.life_event_id) {
    revalidatePath('/begivenheder');
    revalidatePath(`/begivenheder/${parsed.data.life_event_id}`);
    await setFlashCookie('Overførsel oprettet og koblet til begivenhed');
    redirect(
      `/begivenheder/${encodeURIComponent(parsed.data.life_event_id)}`
    );
  }
  await setFlashCookie('Overførsel oprettet');
  redirect('/overforsler');
}

export async function updateTransfer(id: string, formData: FormData) {
  const parsed = readTransferForm(formData);
  if ('error' in parsed) {
    redirect(
      `/overforsler/${encodeURIComponent(id)}?error=` + encodeURIComponent(parsed.error)
    );
  }

  const { supabase, householdId } = await getHouseholdContext();

  if (parsed.data.life_event_id) {
    const { data: event } = await supabase
      .from('life_events')
      .select('id')
      .eq('id', parsed.data.life_event_id)
      .eq('household_id', householdId)
      .maybeSingle();
    if (!event) {
      redirect(
        `/overforsler/${encodeURIComponent(id)}?error=` +
          encodeURIComponent('Den valgte begivenhed findes ikke')
      );
    }
  }

  const { error } = await supabase
    .from('transfers')
    .update(parsed.data)
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect(
      `/overforsler/${encodeURIComponent(id)}?error=` + encodeURIComponent(mapDbError(error, 'Kunne ikke gemme overførslen'))
    );
  }

  revalidatePath('/overforsler');
  revalidatePath('/dashboard');
  if (parsed.data.life_event_id) {
    revalidatePath('/begivenheder');
    revalidatePath(`/begivenheder/${parsed.data.life_event_id}`);
  }
  await setFlashCookie('Overførsel gemt');
  redirect('/overforsler');
}

export async function deleteTransfer(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transfers')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) { console.error('Action error:', error.message); throw new Error('Internal error'); }
  revalidatePath('/overforsler');
  revalidatePath('/dashboard');
  await setFlashCookie('Overførsel slettet');
  redirect('/overforsler');
}
