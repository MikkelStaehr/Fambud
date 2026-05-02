'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseAmountToOere } from '@/lib/format';
import {
  nextFixedDayOccurrence,
  nextLastBankingDay,
  toISODate,
} from '@/lib/banking-days';

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

// Trin 1 i den nye wizard kombinerer to ting der hører sammen — uden løn
// er kontoen tom og resten af appen har intet at vise. Vi opretter:
//
//   1. Brugerens lønkonto (kind=checking, ejet af dem)
//   2. En recurring månedslønstransaktion på den konto, knyttet til
//      brugerens family_member som primary indkomst
//
// Begge i samme server action så vi enten lykkes helt eller fejler tydeligt
// og brugeren kan rette én ting og prøve igen. Vi lader DB'en være sandhed
// — hvis income-insert fejler efter konto-insert, lader vi kontoen stå
// (brugeren kan altid sætte indkomst op senere).
export async function createPersonalAccountWithIncome(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent('Kontonavn er påkrævet'));
  }

  const amount = parseAmountToOere(String(formData.get('amount') ?? ''));
  if (amount === null || amount <= 0) {
    redirect(
      '/wizard/lonkonto?error=' +
        encodeURIComponent('Indtast et lønbeløb større end 0')
    );
  }

  const dayRule = String(formData.get('day_rule') ?? 'fixed');
  const today = new Date();
  let occurs_on: string;
  if (dayRule === 'last-banking-day') {
    occurs_on = toISODate(nextLastBankingDay(today));
  } else {
    const dayOfMonth = Number(formData.get('day_of_month') ?? '1');
    if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      redirect(
        '/wizard/lonkonto?error=' + encodeURIComponent('Ugyldig dag i måneden')
      );
    }
    occurs_on = toISODate(nextFixedDayOccurrence(today, dayOfMonth));
  }

  const description =
    String(formData.get('description') ?? '').trim() || 'Månedsløn';

  // Owner ser ikke editable_by_all-checkboxet (deres lønkonto er pr. default
  // lukket). Partner ser den tændt — de fleste ønsker at deres modkonto
  // kan rette mindre fejl. Hidden field på owner sikrer stabil form-shape.
  const editable_by_all = formData.get('editable_by_all') === 'on';

  const { supabase, householdId, user } = await getHouseholdContext();

  // Idempotens-guard: hvis brugeren allerede har en aktiv checking-konto,
  // afvis duplikat-oprettelse og send dem videre. Page'n har samme guard
  // men vi dobbeltsikrer her i tilfælde af direkte form-submission.
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

  // Hent brugerens family_member.id så income kan tagges med income_role
  // 'primary' og family_member_id. Det er kritisk for forecast-motoren der
  // grupperer paychecks pr. medlem.
  const { data: fm } = await supabase
    .from('family_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!fm) {
    redirect(
      '/wizard/lonkonto?error=' +
        encodeURIComponent(
          'Kunne ikke finde din profil — log ud og log ind igen'
        )
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

  // 2) Find/opret 'Løn'-kategori. Tiny race-vindue hvis to medlemmer kører
  //    wizarden samtidig — worst case to 'Løn'-rækker, harmless at rydde op.
  const { data: existingCat } = await supabase
    .from('categories')
    .select('id')
    .eq('household_id', householdId)
    .eq('name', 'Løn')
    .eq('kind', 'income')
    .maybeSingle();
  let categoryId = existingCat?.id;
  if (!categoryId) {
    const { data: newCat, error: catErr } = await supabase
      .from('categories')
      .insert({
        household_id: householdId,
        name: 'Løn',
        kind: 'income',
        color: '#22c55e',
      })
      .select('id')
      .single();
    if (catErr) {
      redirect('/wizard/lonkonto?error=' + encodeURIComponent(catErr.message));
    }
    categoryId = newCat!.id;
  }

  // 3) Opret månedsløns-transaktionen. recurrence='monthly' så cashflow-
  //    grafen får noget at vise dag-1. Forecast-motoren kræver derudover
  //    konkrete paycheck-samples (recurrence='once', income_role='primary'),
  //    som brugeren registrerer post-wizard via dashboardets onboarding-
  //    checkliste + Duplikér-funktionen.
  const { error: txErr } = await supabase.from('transactions').insert({
    household_id: householdId,
    account_id: account.id,
    category_id: categoryId,
    family_member_id: fm.id,
    amount,
    description,
    occurs_on,
    recurrence: 'monthly',
    income_role: 'primary',
  });
  if (txErr) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent(txErr.message));
  }

  // 4) Routing afhænger af rolle. Owner skal sætte fælleskonti op først,
  //    derefter familie. Partner skipper begge dele og går direkte til
  //    private opsparinger.
  const { data: membership } = await supabase
    .from('family_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const isOwner = membership?.role === 'owner';

  revalidatePath('/wizard');
  // Partner skipper faelleskonti og familie (begge er ejer-only) og går
  // til oversigt-trinet hvor de ser hvad ejeren har sat op.
  redirect(isOwner ? '/wizard/faelleskonti' : '/wizard/oversigt');
}

// Partner i fællesøkonomi-mode registrerer KUN indkomst — den fælles
// lønkonto eksisterer allerede fra ejer's wizard. Vi finder den, opretter
// månedlig recurring income tagged med partnerens family_member_id, og
// fortsætter til /wizard/oversigt.
export async function registerSharedIncome(formData: FormData) {
  const amount = parseAmountToOere(String(formData.get('amount') ?? ''));
  if (amount === null || amount <= 0) {
    redirect(
      '/wizard/lonkonto?error=' +
        encodeURIComponent('Indtast et lønbeløb større end 0')
    );
  }

  const dayRule = String(formData.get('day_rule') ?? 'fixed');
  const today = new Date();
  let occurs_on: string;
  if (dayRule === 'last-banking-day') {
    occurs_on = toISODate(nextLastBankingDay(today));
  } else {
    const dayOfMonth = Number(formData.get('day_of_month') ?? '1');
    if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      redirect(
        '/wizard/lonkonto?error=' + encodeURIComponent('Ugyldig dag i måneden')
      );
    }
    occurs_on = toISODate(nextFixedDayOccurrence(today, dayOfMonth));
  }

  const description =
    String(formData.get('description') ?? '').trim() || 'Månedsløn';

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

  const { error: txErr } = await supabase.from('transactions').insert({
    household_id: householdId,
    account_id: shared.id,
    category_id: categoryId,
    family_member_id: fm.id,
    amount,
    description,
    occurs_on,
    recurrence: 'monthly',
    income_role: 'primary',
  });
  if (txErr) {
    redirect('/wizard/lonkonto?error=' + encodeURIComponent(txErr.message));
  }

  revalidatePath('/wizard');
  redirect('/wizard/oversigt');
}
