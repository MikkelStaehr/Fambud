'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseAmountToOere } from '@/lib/format';

// Hjælper: find eller opret 'Løn'-kategori for husstanden. Den deles
// mellem alle indkomst-transaktioner uanset om vi er i særskilt- eller
// fælles-økonomi-mode.
async function ensureLonCategory(
  supabase: Awaited<ReturnType<typeof getHouseholdContext>>['supabase'],
  householdId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('name', 'Løn')
    .eq('kind', 'income')
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase
    .from('categories')
    .insert({
      household_id: householdId,
      name: 'Løn',
      kind: 'income',
      color: '#22c55e',
    })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? 'Kunne ikke oprette Løn-kategori');
  }
  return created.id;
}

// Læs 1-3 paycheck-rows fra formdata. Row 0 er krævet (mindst én indkomst
// for at appen har noget at vise). Row 1 og 2 er valgfri — kun rækker hvor
// både dato og beløb er udfyldt tæller. Returnerer et array af parsede
// pairs eller error-string.
type PaycheckSample = { date: string; amount: number };

function readPaychecks(
  formData: FormData
): { error: string } | { paychecks: PaycheckSample[] } {
  const out: PaycheckSample[] = [];
  for (let i = 0; i < 3; i++) {
    const dateRaw = String(formData.get(`paycheck_${i}_date`) ?? '').trim();
    const amountRaw = String(formData.get(`paycheck_${i}_amount`) ?? '').trim();
    if (!dateRaw && !amountRaw) {
      // Helt tom row — spring over (gælder kun row 1 og 2)
      if (i === 0) return { error: 'Mindst én lønudbetaling er krævet' };
      continue;
    }
    if (!dateRaw) return { error: `Lønudbetaling ${i + 1}: dato mangler` };
    if (!amountRaw)
      return { error: `Lønudbetaling ${i + 1}: beløb mangler` };
    const amount = parseAmountToOere(amountRaw);
    if (amount === null || amount <= 0) {
      return { error: `Lønudbetaling ${i + 1}: ugyldigt beløb` };
    }
    out.push({ date: dateRaw, amount });
  }
  if (out.length === 0) {
    return { error: 'Mindst én lønudbetaling er krævet' };
  }
  return { paychecks: out };
}

// Trin 1 for ejer + partner i særskilt-mode. Opretter både lønkontoen og
// 1-3 paycheck-samples (recurrence='once', income_role='primary') i samme
// transaction. Cashflow + forecast læser samples direkte — ingen recurring
// monthly behøves.
export async function createPersonalAccountWithIncome(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent('Kontonavn er påkrævet'));
  }

  const parsed = readPaychecks(formData);
  if ('error' in parsed) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent(parsed.error));
  }

  const editable_by_all = formData.get('editable_by_all') === 'on';

  const { supabase, householdId, user } = await getHouseholdContext();

  // Idempotens: hvis brugeren allerede har en checking-konto, send dem
  // videre i stedet for at oprette en duplikat (skete tidligere ved
  // dobbelt-submit eller browser back/refresh).
  const { count: existingChecking } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id)
    .eq('kind', 'checking')
    .eq('archived', false);
  if ((existingChecking ?? 0) > 0) {
    const { data: m } = await supabase
      .from('family_members')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    redirect(
      m?.role === 'owner' ? '/wizard/faelleskonti' : '/wizard/oversigt'
    );
  }

  const { data: fm } = await supabase
    .from('family_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!fm) {
    redirect(
      '/wizard/lonkonto?error=' +
        encodeURIComponent('Kunne ikke finde din profil — log ud og log ind igen')
    );
  }

  // 1) Opret lønkontoen
  const { data: account, error: accErr } = await supabase
    .from('accounts')
    .insert({
      household_id: householdId,
      name,
      owner_name: null,
      kind: 'checking',
      editable_by_all,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (accErr || !account) {
    redirect(
      '/wizard/lonkonto?error=' +
        encodeURIComponent(accErr?.message ?? 'Kunne ikke oprette lønkontoen')
    );
  }

  const categoryId = await ensureLonCategory(supabase, householdId);

  // 2) Opret 1-3 paycheck-samples som 'once'-transaktioner
  const rows = parsed.paychecks.map((p) => ({
    household_id: householdId,
    account_id: account.id,
    category_id: categoryId,
    family_member_id: fm.id,
    amount: p.amount,
    description: 'Lønudbetaling',
    occurs_on: p.date,
    recurrence: 'once' as const,
    income_role: 'primary' as const,
  }));
  const { error: txErr } = await supabase.from('transactions').insert(rows);
  if (txErr) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent(txErr.message));
  }

  // 3) Routing afhænger af rolle
  const { data: membership } = await supabase
    .from('family_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const isOwner = membership?.role === 'owner';

  revalidatePath('/wizard');
  redirect(isOwner ? '/wizard/faelleskonti' : '/wizard/oversigt');
}

// Partner i fællesøkonomi-mode registrerer 1-3 paycheck-samples på den
// eksisterende fælles lønkonto. Ingen ny konto oprettes.
export async function registerSharedIncome(formData: FormData) {
  const parsed = readPaychecks(formData);
  if ('error' in parsed) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId, user } = await getHouseholdContext();

  // Find den fælles lønkonto. Hvis den mangler, er der noget i opsætningen
  // der er gået galt — vi sender brugeren tilbage med en klar fejl.
  const { data: shared } = await supabase
    .from('accounts')
    .select('id')
    .eq('household_id', householdId)
    .eq('kind', 'checking')
    .eq('owner_name', 'Fælles')
    .eq('archived', false)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!shared) {
    redirect(
      '/wizard/lonkonto?error=' +
        encodeURIComponent(
          'Kunne ikke finde fælles lønkonto — bed ejeren tjekke opsætningen'
        )
    );
  }

  const { data: fm } = await supabase
    .from('family_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!fm) {
    redirect(
      '/wizard/lonkonto?error=' +
        encodeURIComponent('Kunne ikke finde din profil — log ud og log ind igen')
    );
  }

  const categoryId = await ensureLonCategory(supabase, householdId);

  const rows = parsed.paychecks.map((p) => ({
    household_id: householdId,
    account_id: shared.id,
    category_id: categoryId,
    family_member_id: fm.id,
    amount: p.amount,
    description: 'Lønudbetaling',
    occurs_on: p.date,
    recurrence: 'once' as const,
    income_role: 'primary' as const,
  }));
  const { error: txErr } = await supabase.from('transactions').insert(rows);
  if (txErr) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent(txErr.message));
  }

  revalidatePath('/wizard');
  redirect('/wizard/oversigt');
}
