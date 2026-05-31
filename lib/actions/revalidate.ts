// Centraliseret revalidation-helper for actions der ændrer cashflow-data.
//
// HVORFOR: hver gang vi har tilføjet en ny side der afleder data fra
// transfers/income/expenses (rådgiver, opsparinger, advisor osv) har vi
// måttet sweepe gennem ALLE actions og tilføje revalidatePath manuelt.
// Vi misser nogen, brugeren ser stale data, vi laver hotfix. Centralt
// sted = ny side tilføjes ÉT sted og fanger alle relevante mutations.
//
// REGEL: kald revalidateCashflowPaths() i alle 'use server'-actions der
// muterer transfers, transactions (income/expense), eller transfers' linked
// life_events. Semgrep-reglen `fambud-action-must-revalidate-cashflow`
// flagger 'use server'-filer der bruger supabase.from('transactions') eller
// 'transfers' med insert/update/delete uden også at importere helperen.

import { revalidatePath } from 'next/cache';

// Pages der afleder data fra cashflow (transfers + transactions). Hver
// gang en ny side tilføjes der viser aggregeret økonomi, tilføj den her.
const CASHFLOW_PATHS = [
  '/dashboard',
  '/raadgiver',
  '/overforsler',
  '/poster',
  '/konti',
  '/budget',
  '/indkomst',
  '/faste-udgifter',
  '/husholdning',
  '/opsparinger',
  '/rapport',
  '/begivenheder',
] as const;

// Invalidér alle cashflow-relaterede sider. Tager ingen argumenter -
// kald som første handling efter en succesfuld DB-mutation.
export function revalidateCashflowPaths(): void {
  for (const p of CASHFLOW_PATHS) {
    revalidatePath(p);
  }
}

// Specialiseret helper til actions der KUN påvirker et enkelt domæne.
// Inkluderer altid /dashboard og /raadgiver fordi de aggregerer alt.
export function revalidateDashboardAndRaadgiver(extraPaths: readonly string[] = []): void {
  revalidatePath('/dashboard');
  revalidatePath('/raadgiver');
  for (const p of extraPaths) revalidatePath(p);
}
