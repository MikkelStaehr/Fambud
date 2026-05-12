// Lønsedler (payslips): privatøkonomi-data tied til ÉN family_member.
//
// Privatøkonomi-konventionen håndhæves i UI-laget: kun den indloggede
// brugers eget family_member kan se sine egne lønsedler. RLS-policy'en
// tillader teknisk hele husstanden at læse hinandens (matcher accounts/
// transfers), men vi filtrerer eksplicit på family_member.user_id =
// auth.user.id i DAL'en så fejlagtig fetch ikke afsløre partnerens
// data.

import type {
  Payslip,
  PayslipLine,
  PayslipLineCategory,
} from '@/lib/database.types';
import { getHouseholdContext } from './auth';

export type PayslipWithLines = Payslip & {
  lines: PayslipLine[];
};

// Map fra raw_label (lowercase, trimmed) til den hyppigste category brugeren
// har givet det label tidligere. Driver "auto-foreslå kategori"-feature
// i lønseddel-form'en. Bygges fra hele husstandens historiske linjer -
// hvis Anna har kategoriseret "Holddrift-tillæg" som tillaeg, foreslår
// vi det samme for Mikkel når han skriver det.
export type PayslipLabelMap = Record<string, PayslipLineCategory>;

// Det family_member der hører til den indloggede bruger. Filtrerer
// senere queries så vi ikke ved et uheld henter partnerens lønsedler.
async function getCurrentFamilyMemberId(): Promise<string | null> {
  const { supabase, user } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('family_members')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// Alle lønsedler for den indloggede bruger, nyeste først, med items.
export async function getMyPayslips(): Promise<PayslipWithLines[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const memberId = await getCurrentFamilyMemberId();
  if (!memberId) return [];

  const { data: payslips, error: payslipsErr } = await supabase
    .from('payslips')
    .select('*')
    .eq('household_id', householdId)
    .eq('family_member_id', memberId)
    .order('period_start', { ascending: false });
  if (payslipsErr) throw payslipsErr;
  if (!payslips || payslips.length === 0) return [];

  const payslipIds = payslips.map((p) => p.id);
  const { data: lines, error: linesErr } = await supabase
    .from('payslip_lines')
    .select('*')
    .in('payslip_id', payslipIds)
    .order('sort_order', { ascending: true });
  if (linesErr) throw linesErr;

  const linesByPayslip = new Map<string, PayslipLine[]>();
  for (const line of lines ?? []) {
    const arr = linesByPayslip.get(line.payslip_id) ?? [];
    arr.push(line);
    linesByPayslip.set(line.payslip_id, arr);
  }

  return payslips.map((p) => ({
    ...p,
    lines: linesByPayslip.get(p.id) ?? [],
  }));
}

// Én lønseddel med items. Verificerer at den hører til den indloggede
// brugers family_member (ikke partnerens).
export async function getPayslipById(id: string): Promise<PayslipWithLines> {
  const { supabase, householdId } = await getHouseholdContext();
  const memberId = await getCurrentFamilyMemberId();
  if (!memberId) {
    throw new Error('No family member for current user');
  }

  const { data: payslip, error: payslipErr } = await supabase
    .from('payslips')
    .select('*')
    .eq('id', id)
    .eq('household_id', householdId)
    .eq('family_member_id', memberId)
    .single();
  if (payslipErr) throw payslipErr;

  const { data: lines, error: linesErr } = await supabase
    .from('payslip_lines')
    .select('*')
    .eq('payslip_id', id)
    .order('sort_order', { ascending: true });
  if (linesErr) throw linesErr;

  return { ...payslip, lines: lines ?? [] };
}

// Klassifikations-taxonomi bygget fra historiske linjer. Bruges af
// PayslipLinesEditor til at foreslå kategori når brugeren skriver et
// label form'en kender fra før.
//
// Vi bygger fra HELE husstandens linjer (ikke kun current user's),
// fordi to partnere ofte har samme arbejdsgivere eller samme typer
// af linjer (fx "Akasse 423 kr" vil have samme kategori uanset
// hvem af dem der får lønsedlen). Det fremskynder onboarding for
// partner #2.
//
// Most-recent classification vinder hvis samme label har fået flere
// kategorier - så bruger der ændrer mening, får deres seneste valg
// genbrugt.
export async function getPayslipLabelMap(): Promise<PayslipLabelMap> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('payslip_lines')
    .select('raw_label, category, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const map: PayslipLabelMap = {};
  for (const row of data ?? []) {
    const key = row.raw_label.trim().toLowerCase();
    if (!key) continue;
    // First-seen wins because vi sorterer nyeste først - så de første
    // entries vi behandler er de nyeste klassifikationer.
    if (!(key in map)) {
      map[key] = row.category;
    }
  }
  return map;
}

// Tjekker om der allerede findes en lønseddel der overlapper med en
// given periode for den indloggede bruger. Bruges af form'en til at
// vise en blød advarsel ("du har allerede en lønseddel for marts -
// vil du oprette en til?"). Returnerer ID'et på det overlappende
// payslip eller null.
export async function findOverlappingPayslip(
  periodStart: string,
  periodEnd: string,
  excludeId?: string
): Promise<string | null> {
  const { supabase, householdId } = await getHouseholdContext();
  const memberId = await getCurrentFamilyMemberId();
  if (!memberId) return null;

  let query = supabase
    .from('payslips')
    .select('id')
    .eq('household_id', householdId)
    .eq('family_member_id', memberId)
    // Overlap: A.start <= B.end AND A.end >= B.start
    .lte('period_start', periodEnd)
    .gte('period_end', periodStart);
  if (excludeId) {
    query = query.neq('id', excludeId);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
