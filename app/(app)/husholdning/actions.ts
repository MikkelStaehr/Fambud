'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext, getActionPerspective } from '@/lib/dal';
import { parseOptionalAmount, parseRequiredAmount, capLength, TEXT_LIMITS } from '@/lib/format';
import { assertAccountKind, HOUSEHOLD_PURCHASE_KINDS } from '@/lib/actions/account-validation';
import {
  HOUSEHOLD_SUBCATEGORIES,
  HOUSEHOLD_SUBCATEGORY_NAMES,
} from '@/lib/categories';

// /husholdning er et forbrugsspor pr. husholdningskonto. Hvert "køb" er en
// almindelig transaction med recurrence='once' på den valgte dato. Vi
// kategoriserer dem under én af HOUSEHOLD_SUBCATEGORIES (Dagligvarer,
// Restaurant, Takeaway, Pleje, Husholdning) så fordelings-grafen kan vise
// hvor pengene faktisk går hen. 'Husholdning' er catch-all/default.
//
// Kategorierne auto-oprettes ved første brug, samme mønster som 'Lån' for
// loans og 'Løn' for indkomst - ingen migration nødvendig.

async function getOrCreateHouseholdSubcategoryId(
  supabase: Awaited<ReturnType<typeof getHouseholdContext>>['supabase'],
  householdId: string,
  name: string,
  color: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('name', name)
    .eq('kind', 'expense')
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('categories')
    .insert({
      household_id: householdId,
      name,
      kind: 'expense',
      color,
    })
    .select('id')
    .single();
  if (error) { console.error('Action error:', error.message); throw new Error('Internal error'); }
  return created.id;
}

export async function addHouseholdPurchase(
  accountId: string,
  formData: FormData
) {
  if (!accountId) redirect('/husholdning');

  const description = capLength(String(formData.get('description') ?? '').trim(), TEXT_LIMITS.description);
  if (!description) {
    redirect(
      '/husholdning?error=' + encodeURIComponent('Indtast en beskrivelse')
    );
  }

  const amountRes = parseRequiredAmount(
    String(formData.get('amount') ?? ''),
    'Beløb'
  );
  if (!amountRes.ok) {
    redirect(
      '/husholdning?error=' + encodeURIComponent(amountRes.error)
    );
  }
  const amount = amountRes.value;

  const occurs_on = String(formData.get('occurs_on') ?? '').trim();
  if (!occurs_on || !/^\d{4}-\d{2}-\d{2}$/.test(occurs_on)) {
    redirect('/husholdning?error=' + encodeURIComponent('Ugyldig dato'));
  }

  const pRes = await getActionPerspective(accountId);
  if (!pRes.ok) redirect('/husholdning?error=' + encodeURIComponent(pRes.error));
  const { supabase, householdId } = pRes.perspective;

  // SECURITY: husholdning er KUN for kind='household' - en angriber må
  // ikke kunne pege accountId på et lån eller en checking-konto og
  // forfalske debt-down-payments eller checking-balance.
  const accCheck = await assertAccountKind(
    supabase, householdId, accountId, HOUSEHOLD_PURCHASE_KINDS
  );
  if (!accCheck.ok) {
    redirect('/husholdning?error=' + encodeURIComponent(accCheck.error));
  }

  // SECURITY: subcategory skal være ÉN af de kendte navne. Whitelist-tjek
  // sikrer at en angriber ikke kan POSTe arbitrary kategori-navne og spamme
  // categories-tabellen med opfindelser. Falder tilbage til 'Husholdning'
  // (catch-all) hvis feltet er tomt eller ukendt - bevarer bagudkompatibilitet
  // med tidligere formularer der ikke sendte feltet.
  const rawSub = String(formData.get('subcategory') ?? '').trim();
  const subName = HOUSEHOLD_SUBCATEGORY_NAMES.has(rawSub) ? rawSub : 'Husholdning';
  const subMeta = HOUSEHOLD_SUBCATEGORIES.find((s) => s.name === subName)!;
  const categoryId = await getOrCreateHouseholdSubcategoryId(
    supabase,
    householdId,
    subMeta.name,
    subMeta.color
  );

  const { error } = await supabase.from('transactions').insert({
    household_id: householdId,
    account_id: accountId,
    category_id: categoryId,
    amount,
    description,
    occurs_on,
    recurrence: 'once',
  });
  if (error) {
    console.error('addHouseholdPurchase failed:', error.message);
    redirect('/husholdning?error=' + encodeURIComponent('Købet kunne ikke gemmes'));
  }

  revalidatePath('/husholdning');
  revalidatePath('/dashboard');
  revalidatePath('/poster');
}

// Manuelt månedligt rådighedsbeløb. Gemmes på accounts.monthly_budget
// (migration 0024). Beløbet er intent-baseret - det skal ikke nødvendigvis
// matche de faktiske recurring transfers ind på kontoen.
export async function setMonthlyBudget(
  accountId: string,
  formData: FormData
) {
  if (!accountId) redirect('/husholdning');

  // Tomt felt = brugeren vil fjerne budgettet (null). Det betyder bare
  // "intet budget sat" - siden falder tilbage til kun at vise spend.
  const amountRes = parseOptionalAmount(
    String(formData.get('amount') ?? ''),
    'Beløb'
  );
  if (!amountRes.ok) {
    redirect('/husholdning?error=' + encodeURIComponent(amountRes.error));
  }
  const amount = amountRes.value;

  const pRes = await getActionPerspective(accountId);
  if (!pRes.ok) redirect('/husholdning?error=' + encodeURIComponent(pRes.error));
  const { supabase, householdId } = pRes.perspective;

  // monthly_budget giver kun mening på husholdningskonti - ellers er
  // det støj der kan forvirre forecast-logik.
  const accCheck = await assertAccountKind(
    supabase, householdId, accountId, HOUSEHOLD_PURCHASE_KINDS
  );
  if (!accCheck.ok) {
    redirect('/husholdning?error=' + encodeURIComponent(accCheck.error));
  }

  const { error } = await supabase
    .from('accounts')
    .update({ monthly_budget: amount })
    .eq('id', accountId)
    .eq('household_id', householdId);
  if (error) {
    console.error('setMonthlyBudget failed:', error.message);
    redirect('/husholdning?error=' + encodeURIComponent('Budgettet kunne ikke gemmes'));
  }

  revalidatePath('/husholdning');
  revalidatePath('/konti');
}

export async function deleteHouseholdPurchase(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const pRes = await getActionPerspective();
  if (!pRes.ok) return;
  const { supabase, householdId } = pRes.perspective;
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) { console.error('Action error:', error.message); throw new Error('Internal error'); }

  revalidatePath('/husholdning');
  revalidatePath('/dashboard');
  revalidatePath('/poster');
}
