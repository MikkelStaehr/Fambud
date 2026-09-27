// Famtask: husstandens planlægning (plan-schemaet, migration 0072).
//
// Data er husstands-niveau uden private rækker, så vi bruger
// getHouseholdContext() (user-client + RLS) og ikke getPerspective().
// Proxy-mode ændrer intet her: begge partnere ser de samme projekter.
// Alle queries filtrerer alligevel eksplicit på household_id, som resten
// af DAL'en.

import type { PlanProject, PlanSpark, PlanStep } from '@/lib/database.types';
import { isUuid, type FamtaskMember } from '@/lib/famtask';
import { getHouseholdContext } from './auth';

// Husstandens medlemmer i samme rækkefølge som /husholdning. Bruges til
// "Ansvarlig" og til at vide hvem der skal godkende en spark (også af
// promoteSpark, så tjeklisten tjekkes mod de samme data som siden viser).
export async function getFamtaskMembers(): Promise<FamtaskMember[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .from('family_members')
    .select('id, name, user_id')
    .eq('household_id', householdId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type FamtaskProjectSummary = PlanProject & {
  // Sum af steps.amount i øre (fra plan.project_budget)
  totalAmount: number;
  stepCount: number;
  doneCount: number;
  // Skridt uden beløb: totalAmount er ikke hele budgettet, så længe > 0
  unpricedCount: number;
};

// Alle projekter i husstanden med budget-sum og fremdrift. Nyeste først;
// siden grupperer selv efter status.
export async function getFamtaskProjects(): Promise<FamtaskProjectSummary[]> {
  const { supabase, householdId } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const [projectsRes, budgetRes, stepsRes] = await Promise.all([
    plan
      .from('projects')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }),
    plan
      .from('project_budget')
      .select('project_id, total_amount')
      .eq('household_id', householdId),
    // Kun status og beløb pr. skridt - antal færdige og uden beløb tælles i
    // koden. En husstand har få nok skridt til at det er billigere end et
    // ekstra view.
    plan
      .from('steps')
      .select('project_id, status, amount')
      .eq('household_id', householdId)
      .not('project_id', 'is', null),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (budgetRes.error) throw budgetRes.error;
  if (stepsRes.error) throw stepsRes.error;

  const totalByProject = new Map(
    (budgetRes.data ?? []).map((b) => [b.project_id, b.total_amount])
  );
  const counts = new Map<string, { steps: number; done: number; unpriced: number }>();
  for (const s of stepsRes.data ?? []) {
    if (!s.project_id) continue;
    const c = counts.get(s.project_id) ?? { steps: 0, done: 0, unpriced: 0 };
    c.steps += 1;
    if (s.status === 'faerdig') c.done += 1;
    if (s.amount == null) c.unpriced += 1;
    counts.set(s.project_id, c);
  }

  return (projectsRes.data ?? []).map((p) => ({
    ...p,
    totalAmount: totalByProject.get(p.id) ?? 0,
    stepCount: counts.get(p.id)?.steps ?? 0,
    doneCount: counts.get(p.id)?.done ?? 0,
    unpricedCount: counts.get(p.id)?.unpriced ?? 0,
  }));
}

// Ét projekt med skridt i rækkefølge. null = findes ikke (eller tilhører
// en anden husstand) - siden viser 404.
export async function getFamtaskProject(
  id: string
): Promise<{ project: PlanProject; steps: PlanStep[]; members: FamtaskMember[] } | null> {
  if (!isUuid(id)) return null;
  const { supabase, householdId } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const [projectRes, stepsRes, members] = await Promise.all([
    plan
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('household_id', householdId)
      .maybeSingle(),
    plan
      .from('steps')
      .select('*')
      .eq('project_id', id)
      .eq('household_id', householdId)
      .order('position', { ascending: true }),
    getFamtaskMembers(),
  ]);
  if (projectRes.error) throw projectRes.error;
  if (stepsRes.error) throw stepsRes.error;
  if (!projectRes.data) return null;

  return { project: projectRes.data, steps: stepsRes.data ?? [], members };
}

export type FamtaskOpenSpark = PlanSpark & {
  // user_id på dem der har sagt ja (migration 0073)
  approvedUserIds: string[];
  // Beløb pr. skridt på sparken, null for skridt uden beløb (migration 0074)
  stepAmounts: (number | null)[];
};

export type FamtaskSparks = {
  // Indbakken: sparks der endnu ikke er blevet til et projekt
  open: FamtaskOpenSpark[];
  // Sparks der er gjort til projekt, med projektets titel til linket
  promoted: (PlanSpark & { projectTitle: string })[];
  members: FamtaskMember[];
  currentUserId: string;
};

export async function getFamtaskSparks(): Promise<FamtaskSparks> {
  const { supabase, householdId, user } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const [sparksRes, approvalsRes, stepsRes, members] = await Promise.all([
    plan
      .from('sparks')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }),
    plan
      .from('spark_approvals')
      .select('spark_id, user_id')
      .eq('household_id', householdId),
    plan
      .from('steps')
      .select('spark_id, amount')
      .eq('household_id', householdId)
      .not('spark_id', 'is', null),
    getFamtaskMembers(),
  ]);
  if (sparksRes.error) throw sparksRes.error;
  if (approvalsRes.error) throw approvalsRes.error;
  if (stepsRes.error) throw stepsRes.error;

  const approvedBySpark = groupBySpark(approvalsRes.data ?? [], (a) => a.user_id);
  const amountsBySpark = groupBySpark(stepsRes.data ?? [], (s) => s.amount);

  const open: FamtaskOpenSpark[] = [];
  const promotedRaw: PlanSpark[] = [];
  for (const s of sparksRes.data ?? []) {
    if (s.promoted_project_id) promotedRaw.push(s);
    else {
      open.push({
        ...s,
        approvedUserIds: approvedBySpark.get(s.id) ?? [],
        stepAmounts: amountsBySpark.get(s.id) ?? [],
      });
    }
  }

  const projectIds = Array.from(
    new Set(promotedRaw.map((s) => s.promoted_project_id as string))
  );
  const titleById = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects, error: projErr } = await plan
      .from('projects')
      .select('id, title')
      .eq('household_id', householdId)
      .in('id', projectIds);
    if (projErr) throw projErr;
    for (const p of projects ?? []) titleById.set(p.id, p.title);
  }

  return {
    open,
    promoted: promotedRaw.map((s) => ({
      ...s,
      projectTitle: titleById.get(s.promoted_project_id as string) ?? 'Projekt',
    })),
    members,
    currentUserId: user.id,
  };
}

// Én spark med skridt (/famtask/sparks/[id]). Er sparken allerede blevet
// til et projekt, sender siden videre dertil via spark.promoted_project_id.
// null = findes ikke (eller tilhører en anden husstand) - siden viser 404.
export async function getFamtaskSpark(id: string): Promise<{
  spark: FamtaskOpenSpark;
  steps: PlanStep[];
  members: FamtaskMember[];
  currentUserId: string;
} | null> {
  if (!isUuid(id)) return null;
  const { supabase, householdId, user } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const [sparkRes, approvalsRes, stepsRes, members] = await Promise.all([
    plan
      .from('sparks')
      .select('*')
      .eq('id', id)
      .eq('household_id', householdId)
      .maybeSingle(),
    plan
      .from('spark_approvals')
      .select('user_id')
      .eq('spark_id', id)
      .eq('household_id', householdId),
    plan
      .from('steps')
      .select('*')
      .eq('spark_id', id)
      .eq('household_id', householdId)
      .order('position', { ascending: true }),
    getFamtaskMembers(),
  ]);
  if (sparkRes.error) throw sparkRes.error;
  if (approvalsRes.error) throw approvalsRes.error;
  if (stepsRes.error) throw stepsRes.error;
  if (!sparkRes.data) return null;

  const steps = stepsRes.data ?? [];
  return {
    spark: {
      ...sparkRes.data,
      approvedUserIds: (approvalsRes.data ?? []).map((a) => a.user_id),
      stepAmounts: steps.map((s) => s.amount),
    },
    steps,
    members,
    currentUserId: user.id,
  };
}

function groupBySpark<T extends { spark_id: string | null }, V>(
  rows: T[],
  pick: (row: T) => V
): Map<string, V[]> {
  const bySpark = new Map<string, V[]>();
  for (const row of rows) {
    if (!row.spark_id) continue;
    bySpark.set(row.spark_id, [...(bySpark.get(row.spark_id) ?? []), pick(row)]);
  }
  return bySpark;
}
