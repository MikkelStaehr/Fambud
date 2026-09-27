// Famtask: husstandens planlægning (plan-schemaet, migration 0070).
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
    // Kun status pr. skridt - antal færdige tælles i koden. En husstand
    // har få nok skridt til at det er billigere end et ekstra view.
    plan
      .from('steps')
      .select('project_id, status')
      .eq('household_id', householdId),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (budgetRes.error) throw budgetRes.error;
  if (stepsRes.error) throw stepsRes.error;

  const totalByProject = new Map(
    (budgetRes.data ?? []).map((b) => [b.project_id, b.total_amount])
  );
  const counts = new Map<string, { steps: number; done: number }>();
  for (const s of stepsRes.data ?? []) {
    const c = counts.get(s.project_id) ?? { steps: 0, done: 0 };
    c.steps += 1;
    if (s.status === 'faerdig') c.done += 1;
    counts.set(s.project_id, c);
  }

  return (projectsRes.data ?? []).map((p) => ({
    ...p,
    totalAmount: totalByProject.get(p.id) ?? 0,
    stepCount: counts.get(p.id)?.steps ?? 0,
    doneCount: counts.get(p.id)?.done ?? 0,
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
  // user_id på dem der har sagt ja (migration 0072)
  approvedUserIds: string[];
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

  const [sparksRes, approvalsRes, members] = await Promise.all([
    plan
      .from('sparks')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false }),
    plan
      .from('spark_approvals')
      .select('spark_id, user_id')
      .eq('household_id', householdId),
    getFamtaskMembers(),
  ]);
  if (sparksRes.error) throw sparksRes.error;
  if (approvalsRes.error) throw approvalsRes.error;

  const approvedBySpark = new Map<string, string[]>();
  for (const a of approvalsRes.data ?? []) {
    approvedBySpark.set(a.spark_id, [...(approvedBySpark.get(a.spark_id) ?? []), a.user_id]);
  }

  const open: FamtaskOpenSpark[] = [];
  const promotedRaw: PlanSpark[] = [];
  for (const s of sparksRes.data ?? []) {
    if (s.promoted_project_id) promotedRaw.push(s);
    else open.push({ ...s, approvedUserIds: approvedBySpark.get(s.id) ?? [] });
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
