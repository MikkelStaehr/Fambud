'use server';

// Server Actions for /loensedler.
//
// Pattern matcher /begivenheder/actions.ts: privilegerede felter
// (household_id, family_member_id) hentes server-side fra
// getHouseholdContext, aldrig fra formData.
//
// Linjer på lønsedlen kommer som parallelle formData-arrays:
//   line_label[]      raw_label
//   line_amount[]     positivt tal (vi normaliserer fortegn ud fra
//                     category før insert)
//   line_category[]   PayslipLineCategory
// .getAll() returnerer arrayet i form-rækkefølge så vi kan zippe dem
// til structured records. Rækker med tom label springes over.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import {
  capLength,
  isValidOccursOn,
  parsePayslipBalance,
  parseRequiredAmount,
  payslipNormalizedAmount,
  TEXT_LIMITS,
} from '@/lib/format';
import { setFlashCookie } from '@/lib/flash';
import { mapDbError } from '@/lib/actions/error-map';
import type { PayslipLineCategory } from '@/lib/database.types';

const VALID_CATEGORIES: readonly PayslipLineCategory[] = [
  'grundlon',
  'tillaeg',
  'feriepenge_optjent',
  'pension_arbejdsgiver',
  'pension_egen',
  'atp',
  'am_bidrag',
  'a_skat',
  'akasse',
  'fagforening',
  'fradrag_andet',
  'andet',
];

type ParsedLine = {
  raw_label: string;
  amount: number; // signed øre
  category: PayslipLineCategory;
};

type ParsedPayslip = {
  period_start: string;
  period_end: string;
  pay_date: string | null;
  employer: string | null;
  feriesaldo_remaining: number | null;
  overarbejde_remaining: number | null;
  afspadsering_remaining: number | null;
  notes: string | null;
  lines: ParsedLine[];
};

function readPayslipForm(
  formData: FormData
): { error: string } | { data: ParsedPayslip } {
  const period_start = String(formData.get('period_start') ?? '').trim();
  const period_end = String(formData.get('period_end') ?? '').trim();
  if (!isValidOccursOn(period_start)) {
    return { error: 'Periode-start er påkrævet og skal være en gyldig dato' };
  }
  if (!isValidOccursOn(period_end)) {
    return { error: 'Periode-slut er påkrævet og skal være en gyldig dato' };
  }
  if (period_end < period_start) {
    return { error: 'Periode-slut skal være efter periode-start' };
  }

  const payDateRaw = String(formData.get('pay_date') ?? '').trim();
  let pay_date: string | null = null;
  if (payDateRaw) {
    if (!isValidOccursOn(payDateRaw)) {
      return { error: 'Udbetalingsdato er ikke gyldig' };
    }
    pay_date = payDateRaw;
  }

  const employerRaw = capLength(
    String(formData.get('employer') ?? '').trim(),
    TEXT_LIMITS.shortName
  );
  const employer = employerRaw || null;

  // Saldoer er optional - blank = null. parsePayslipBalance accepterer
  // "18,5" / "18.5" og returnerer hundrededele.
  const feriesaldoRaw = String(formData.get('feriesaldo_remaining') ?? '').trim();
  const feriesaldo_remaining = feriesaldoRaw
    ? parsePayslipBalance(feriesaldoRaw)
    : null;
  if (feriesaldoRaw && feriesaldo_remaining === null) {
    return { error: 'Ugyldig feriesaldo (brug fx 18,5)' };
  }

  const overarbejdeRaw = String(formData.get('overarbejde_remaining') ?? '').trim();
  const overarbejde_remaining = overarbejdeRaw
    ? parsePayslipBalance(overarbejdeRaw)
    : null;
  if (overarbejdeRaw && overarbejde_remaining === null) {
    return { error: 'Ugyldig overarbejde-saldo' };
  }

  const afspadseringRaw = String(formData.get('afspadsering_remaining') ?? '').trim();
  const afspadsering_remaining = afspadseringRaw
    ? parsePayslipBalance(afspadseringRaw)
    : null;
  if (afspadseringRaw && afspadsering_remaining === null) {
    return { error: 'Ugyldig afspadserings-saldo' };
  }

  const notesRaw = capLength(
    String(formData.get('notes') ?? '').trim(),
    TEXT_LIMITS.description
  );
  const notes = notesRaw || null;

  // Linjer kommer som parallelle arrays. Hver tripel (label, amount,
  // category) skal være sat hvis label er udfyldt; tomme rækker
  // springes over.
  const labels = formData.getAll('line_label').map(String);
  const amounts = formData.getAll('line_amount').map(String);
  const categories = formData.getAll('line_category').map(String);

  const lines: ParsedLine[] = [];
  for (let i = 0; i < labels.length; i++) {
    const rawLabel = capLength(
      (labels[i] ?? '').trim(),
      TEXT_LIMITS.shortName
    );
    if (!rawLabel) continue; // skip empty rows

    const rawAmount = (amounts[i] ?? '').trim();
    // Tom row med kun label - vis fejl frem for stille at skippe.
    if (!rawAmount) {
      return { error: `Linje "${rawLabel}" mangler et beløb` };
    }
    const amountRes = parseRequiredAmount(rawAmount, `Linje "${rawLabel}"`, {
      allowNegative: true, // 'andet' kan være negativ
    });
    if (!amountRes.ok) return { error: amountRes.error };

    const rawCategory = (categories[i] ?? 'andet').trim();
    const category = VALID_CATEGORIES.includes(rawCategory as PayslipLineCategory)
      ? (rawCategory as PayslipLineCategory)
      : 'andet';

    lines.push({
      raw_label: rawLabel,
      amount: payslipNormalizedAmount(amountRes.value, category),
      category,
    });
  }

  if (lines.length === 0) {
    return { error: 'Tilføj mindst én linje med beløb' };
  }

  return {
    data: {
      period_start,
      period_end,
      pay_date,
      employer,
      feriesaldo_remaining,
      overarbejde_remaining,
      afspadsering_remaining,
      notes,
      lines,
    },
  };
}

// Find den indloggede brugers family_member. Lønsedler hører til ÉN
// person, og DAL/UI viser kun current users egne.
async function requireCurrentFamilyMemberId(): Promise<{
  supabase: Awaited<ReturnType<typeof getHouseholdContext>>['supabase'];
  householdId: string;
  memberId: string;
}> {
  const ctx = await getHouseholdContext();
  const { data, error } = await ctx.supabase
    .from('family_members')
    .select('id')
    .eq('user_id', ctx.user.id)
    .maybeSingle();
  if (error || !data) {
    throw new Error('Internal error');
  }
  return { supabase: ctx.supabase, householdId: ctx.householdId, memberId: data.id };
}

export async function createPayslip(formData: FormData) {
  const parsed = readPayslipForm(formData);
  if ('error' in parsed) {
    redirect('/loensedler/ny?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId, memberId } = await requireCurrentFamilyMemberId();

  const { data: payslip, error: payslipErr } = await supabase
    .from('payslips')
    .insert({
      household_id: householdId,
      family_member_id: memberId,
      period_start: parsed.data.period_start,
      period_end: parsed.data.period_end,
      pay_date: parsed.data.pay_date,
      employer: parsed.data.employer,
      feriesaldo_remaining: parsed.data.feriesaldo_remaining,
      overarbejde_remaining: parsed.data.overarbejde_remaining,
      afspadsering_remaining: parsed.data.afspadsering_remaining,
      notes: parsed.data.notes,
    })
    .select('id')
    .single();
  if (payslipErr) {
    console.error('createPayslip failed:', payslipErr.message);
    redirect(
      '/loensedler/ny?error=' +
        encodeURIComponent(mapDbError(payslipErr, 'Kunne ikke gemme lønsedlen'))
    );
  }

  // Insert lines som batch. Hvis det fejler, kompenserende delete af
  // parent-payslip - så vi ikke efterlader en lønseddel uden linjer.
  const linesToInsert = parsed.data.lines.map((line, idx) => ({
    payslip_id: payslip.id,
    household_id: householdId,
    raw_label: line.raw_label,
    amount: line.amount,
    category: line.category,
    sort_order: idx,
  }));
  const { error: linesErr } = await supabase
    .from('payslip_lines')
    .insert(linesToInsert);
  if (linesErr) {
    console.error('createPayslip lines insert failed:', linesErr.message);
    await supabase.from('payslips').delete().eq('id', payslip.id);
    redirect(
      '/loensedler/ny?error=' +
        encodeURIComponent('Kunne ikke gemme linjerne - prøv igen')
    );
  }

  revalidatePath('/loensedler');
  await setFlashCookie('Lønseddel gemt');
  redirect(`/loensedler/${encodeURIComponent(payslip.id)}`);
}

export async function updatePayslip(id: string, formData: FormData) {
  const parsed = readPayslipForm(formData);
  if ('error' in parsed) {
    redirect(
      `/loensedler/${encodeURIComponent(id)}?error=` +
        encodeURIComponent(parsed.error)
    );
  }

  const { supabase, householdId, memberId } = await requireCurrentFamilyMemberId();

  // Verificér at lønsedlen tilhører den indloggede bruger før vi rør den.
  const { data: existing } = await supabase
    .from('payslips')
    .select('id')
    .eq('id', id)
    .eq('household_id', householdId)
    .eq('family_member_id', memberId)
    .maybeSingle();
  if (!existing) {
    throw new Error('Internal error');
  }

  const { error: updateErr } = await supabase
    .from('payslips')
    .update({
      period_start: parsed.data.period_start,
      period_end: parsed.data.period_end,
      pay_date: parsed.data.pay_date,
      employer: parsed.data.employer,
      feriesaldo_remaining: parsed.data.feriesaldo_remaining,
      overarbejde_remaining: parsed.data.overarbejde_remaining,
      afspadsering_remaining: parsed.data.afspadsering_remaining,
      notes: parsed.data.notes,
    })
    .eq('id', id)
    .eq('household_id', householdId);
  if (updateErr) {
    console.error('updatePayslip failed:', updateErr.message);
    redirect(
      `/loensedler/${encodeURIComponent(id)}?error=` +
        encodeURIComponent(mapDbError(updateErr, 'Kunne ikke gemme lønsedlen'))
    );
  }

  // Replace-all-lines: simpler end at diffe. Et tab i race-vinduet ville
  // efterlade lønsedlen tomt midlertidigt - acceptabelt for single-user
  // editing.
  const { error: deleteErr } = await supabase
    .from('payslip_lines')
    .delete()
    .eq('payslip_id', id);
  if (deleteErr) {
    console.error('updatePayslip delete-lines failed:', deleteErr.message);
    redirect(
      `/loensedler/${encodeURIComponent(id)}?error=` +
        encodeURIComponent('Kunne ikke opdatere linjer - prøv igen')
    );
  }

  const linesToInsert = parsed.data.lines.map((line, idx) => ({
    payslip_id: id,
    household_id: householdId,
    raw_label: line.raw_label,
    amount: line.amount,
    category: line.category,
    sort_order: idx,
  }));
  const { error: linesErr } = await supabase
    .from('payslip_lines')
    .insert(linesToInsert);
  if (linesErr) {
    console.error('updatePayslip insert-lines failed:', linesErr.message);
    redirect(
      `/loensedler/${encodeURIComponent(id)}?error=` +
        encodeURIComponent('Linjerne kunne ikke gemmes - prøv igen')
    );
  }

  revalidatePath('/loensedler');
  revalidatePath(`/loensedler/${id}`);
  await setFlashCookie('Lønseddel gemt');
  redirect(`/loensedler/${encodeURIComponent(id)}`);
}

export async function deletePayslip(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId, memberId } = await requireCurrentFamilyMemberId();

  const { error } = await supabase
    .from('payslips')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)
    .eq('family_member_id', memberId);
  if (error) {
    console.error('deletePayslip failed:', error.message);
    throw new Error('Internal error');
  }
  revalidatePath('/loensedler');
  await setFlashCookie('Lønseddel slettet');
  redirect('/loensedler');
}
