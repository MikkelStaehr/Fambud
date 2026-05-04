'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import type { InvestmentType } from '@/lib/database.types';

const VALID_TYPES: readonly InvestmentType[] = [
  'aldersopsparing',
  'aktiesparekonto',
  'aktiedepot',
  'pension',
  'boerneopsparing',
];

const DEFAULT_NAME: Record<InvestmentType, string> = {
  aldersopsparing: 'Aldersopsparing',
  aktiesparekonto: 'Aktiesparekonto',
  aktiedepot: 'Aktiedepot',
  pension: 'Pension',
  boerneopsparing: 'Børneopsparing',
};

// Generel investerings-konto. Brugeren vælger investment_type, og vi
// foreslår default-navn baseret på typen. owner_name efterlades null;
// den kan justeres i ejere-trinet bagefter.
export async function createInvestment(formData: FormData) {
  const typeRaw = String(formData.get('investment_type') ?? '').trim();
  if (!VALID_TYPES.includes(typeRaw as InvestmentType)) {
    redirect(
      '/wizard/investering?error=' + encodeURIComponent('Vælg en investeringstype')
    );
  }
  const investment_type = typeRaw as InvestmentType;

  const name =
    String(formData.get('name') ?? '').trim() || DEFAULT_NAME[investment_type];

  const { supabase, householdId, user } = await getHouseholdContext();
  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    name,
    owner_name: null,
    kind: 'investment',
    investment_type,
    editable_by_all: true,
    created_by: user.id,
  });
  if (error) {
    redirect('/wizard/investering?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/investering');
}

// Børneopsparing pr. barn - én ét-kliks knap pr. barn der opretter en
// investment-konto med owner_name=barnets navn og investment_type=
// 'boerneopsparing'. Det giver skattefordel-loftet (6.000/år/barn) en
// konkret konto som /konti og /opsparinger genkender.
export async function createChildSavings(formData: FormData) {
  const childId = String(formData.get('child_id') ?? '').trim();
  if (!childId) {
    redirect(
      '/wizard/investering?error=' + encodeURIComponent('Manglende barn-id')
    );
  }

  const { supabase, householdId, user } = await getHouseholdContext();
  const { data: child } = await supabase
    .from('family_members')
    .select('name, email, user_id')
    .eq('id', childId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (!child || child.email != null || child.user_id != null) {
    redirect(
      '/wizard/investering?error=' + encodeURIComponent('Ugyldigt barn')
    );
  }

  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    name: `Børneopsparing ${child.name}`,
    owner_name: child.name,
    kind: 'investment',
    investment_type: 'boerneopsparing',
    editable_by_all: true,
    created_by: user.id,
  });
  if (error) {
    redirect('/wizard/investering?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/investering');
}

export async function removeInvestment(formData: FormData) {
  const id = String(formData.get('id') ?? '').trim();
  if (!id) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    redirect('/wizard/investering?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/wizard/investering');
}
