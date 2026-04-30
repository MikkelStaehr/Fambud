'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseRequiredAmount } from '@/lib/format';

// Default-kategorier der seedes ind i tabellen når brugeren trykker "Brug
// forslag"-knappen. Tallene er konservative midt-i-spectrum-estimater for
// en typisk dansk familie. Brugeren kan altid justere bagefter.
//
// Bil: 8.000 = midten af 6.000-10.000 for benzin/diesel. El er 2.000-6.000;
// brugeren kan sænke det selv hvis de har el-bil.
const DEFAULT_ESTIMATES_OERE: { label: string; yearly_amount: number }[] = [
  { label: 'Gaver', yearly_amount: 300_000 },        // 3.000 kr/år
  { label: 'Tandlæge', yearly_amount: 320_000 },     // 3.200 kr/år
  { label: 'Bil (vedligehold)', yearly_amount: 800_000 }, // 8.000 kr/år
  { label: 'Cykel', yearly_amount: 100_000 },        // 1.000 kr/år
];

export async function addPredictableEstimate(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) {
    redirect('/opsparinger?error=' + encodeURIComponent('Indtast en kategori'));
  }

  const amountRes = parseRequiredAmount(
    String(formData.get('yearly_amount') ?? ''),
    'Årligt beløb',
    { allowZero: true }
  );
  if (!amountRes.ok) {
    redirect('/opsparinger?error=' + encodeURIComponent(amountRes.error));
  }

  const { supabase, householdId } = await getHouseholdContext();

  // Append to end. Position-baseret ordering — samme pattern som
  // family_members og transaction_components.
  const { data: last } = await supabase
    .from('predictable_estimates')
    .select('position')
    .eq('household_id', householdId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (last?.position ?? -1) + 1;

  const { error } = await supabase.from('predictable_estimates').insert({
    household_id: householdId,
    label,
    yearly_amount: amountRes.value,
    position: nextPos,
  });
  if (error) {
    redirect('/opsparinger?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/opsparinger');
}

export async function updatePredictableEstimate(
  id: string,
  formData: FormData
) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) {
    redirect('/opsparinger?error=' + encodeURIComponent('Indtast en kategori'));
  }

  const amountRes = parseRequiredAmount(
    String(formData.get('yearly_amount') ?? ''),
    'Årligt beløb',
    { allowZero: true }
  );
  if (!amountRes.ok) {
    redirect('/opsparinger?error=' + encodeURIComponent(amountRes.error));
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('predictable_estimates')
    .update({ label, yearly_amount: amountRes.value })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect('/opsparinger?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/opsparinger');
}

export async function deletePredictableEstimate(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('predictable_estimates')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) throw new Error(error.message);

  revalidatePath('/opsparinger');
}

// Seed default-kategorier. Skal kun køre én gang — kaldes fra "Brug forslag"-
// knappen når listen er tom. Hvis brugeren har slettet alle og trykker igen,
// får de defaults tilbage (det er fint, det er bare hjælpe-rækker).
export async function seedDefaultEstimates() {
  const { supabase, householdId } = await getHouseholdContext();
  const rows = DEFAULT_ESTIMATES_OERE.map((e, i) => ({
    household_id: householdId,
    label: e.label,
    yearly_amount: e.yearly_amount,
    position: i,
  }));
  const { error } = await supabase.from('predictable_estimates').insert(rows);
  if (error) {
    redirect('/opsparinger?error=' + encodeURIComponent(error.message));
  }
  revalidatePath('/opsparinger');
}
