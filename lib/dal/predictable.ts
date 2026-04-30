// DAL for predictable_estimates — kategori-baseret budget for "forudsigelige
// uforudsete" udgifter. Bruges af /opsparinger PredictableCard til at lade
// brugeren tænke konkret igennem hvad puljen skal dække (gaver, tandlæge,
// bil, cykel, andet) og udregne et månedligt indskud baseret på det.

import { getHouseholdContext } from './auth';
import type { PredictableEstimate } from '@/lib/database.types';

export async function getPredictableEstimates(): Promise<PredictableEstimate[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('predictable_estimates')
    .select('*')
    .eq('household_id', householdId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Sum af alle årlige estimater. Sum / 12 = anbefalet månedligt indskud
// til "Forudsigelige uforudsete"-kontoen.
export function sumYearlyEstimates(
  estimates: Pick<PredictableEstimate, 'yearly_amount'>[]
): number {
  return estimates.reduce((sum, e) => sum + e.yearly_amount, 0);
}
