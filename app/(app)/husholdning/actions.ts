'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseAmountToOere } from '@/lib/format';

// /husholdning er et forbrugsspor pr. husholdningskonto. Hvert "køb" er en
// almindelig transaction med recurrence='once' på den valgte dato. Vi
// kategoriserer dem under 'Husholdning' (auto-oprettet på første brug,
// samme pattern som 'Lån' for loans og 'Løn' for indkomst) — så filtrering
// "vis mig al mad-spend" er let senere.

async function getOrCreateHouseholdCategoryId(
  supabase: Awaited<ReturnType<typeof getHouseholdContext>>['supabase'],
  householdId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('name', 'Husholdning')
    .eq('kind', 'expense')
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('categories')
    .insert({
      household_id: householdId,
      name: 'Husholdning',
      kind: 'expense',
      // Samme grøn-tone som 'Mad' — visuelt aligneret men distinkt fra de
      // restaurant-spend brugeren måske kategoriserer som 'Mad' separat.
      color: '#16a34a',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

export async function addHouseholdPurchase(
  accountId: string,
  formData: FormData
) {
  if (!accountId) redirect('/husholdning');

  const description = String(formData.get('description') ?? '').trim();
  if (!description) {
    redirect(
      '/husholdning?error=' + encodeURIComponent('Indtast en beskrivelse')
    );
  }

  const amount = parseAmountToOere(String(formData.get('amount') ?? ''));
  if (amount === null || amount <= 0) {
    redirect(
      '/husholdning?error=' + encodeURIComponent('Indtast et beløb større end 0')
    );
  }

  const occurs_on = String(formData.get('occurs_on') ?? '').trim();
  if (!occurs_on || !/^\d{4}-\d{2}-\d{2}$/.test(occurs_on)) {
    redirect('/husholdning?error=' + encodeURIComponent('Ugyldig dato'));
  }

  const { supabase, householdId } = await getHouseholdContext();
  const categoryId = await getOrCreateHouseholdCategoryId(supabase, householdId);

  const { error } = await supabase.from('transactions').insert({
    household_id: householdId,
    account_id: accountId,
    category_id: categoryId,
    amount: amount as number,
    description,
    occurs_on,
    recurrence: 'once',
  });
  if (error) {
    redirect('/husholdning?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/husholdning');
  revalidatePath('/dashboard');
  revalidatePath('/poster');
}

// Manuelt månedligt rådighedsbeløb. Gemmes på accounts.monthly_budget
// (migration 0024). Beløbet er intent-baseret — det skal ikke nødvendigvis
// matche de faktiske recurring transfers ind på kontoen.
export async function setMonthlyBudget(
  accountId: string,
  formData: FormData
) {
  if (!accountId) redirect('/husholdning');

  const raw = String(formData.get('amount') ?? '').trim();
  // Tomt felt = brugeren vil fjerne budgettet (sætter til null). Det betyder
  // bare "intet budget sat" — siden falder så tilbage til kun at vise spend.
  let amount: number | null;
  if (!raw) {
    amount = null;
  } else {
    const parsed = parseAmountToOere(raw);
    if (parsed === null || parsed < 0) {
      redirect(
        '/husholdning?error=' + encodeURIComponent('Ugyldigt beløb')
      );
    }
    amount = parsed as number;
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .update({ monthly_budget: amount })
    .eq('id', accountId)
    .eq('household_id', householdId);
  if (error) {
    redirect('/husholdning?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/husholdning');
  revalidatePath('/konti');
}

export async function deleteHouseholdPurchase(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);

  revalidatePath('/husholdning');
  revalidatePath('/dashboard');
  revalidatePath('/poster');
}
