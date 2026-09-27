'use server';

// Server Actions for /famtask (plan-schemaet, migration 0070).
//
// Samme mønster som /begivenheder: household_id kommer fra
// getHouseholdContext() server-side, og hvert felt læses eksplicit fra
// formData (CLAUDE.md §2). Hver query filtrerer desuden på household_id.
//
// Actions der kaldes fra klient-komponenter (quick-capture, skridt,
// projekt-detaljer) returnerer FamtaskActionResult og redirecter ikke: fejl
// vises inline, og siden hopper ikke til toppen efter hvert klik på mobil.
// revalidatePath opdaterer data på den aktuelle side.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseOptionalAmount, TEXT_LIMITS } from '@/lib/format';
import { readOptionalText, readText } from '@/lib/actions/safe-form';
import { mapDbError } from '@/lib/actions/error-map';
import { setFlashCookie } from '@/lib/flash';
import {
  isProjectStatus,
  isStepStatus,
  isUuid,
  moveInOrder,
  parseMonthInput,
} from '@/lib/famtask';

export type FamtaskActionResult = { ok: true } | { ok: false; error: string };

// 'layout' revaliderer /famtask og alt under (sparks, projekt-sider).
function revalidateFamtask() {
  revalidatePath('/famtask', 'layout');
}

function fail(scope: string, error: { message?: string }, fallback: string): FamtaskActionResult {
  console.error(`${scope} failed:`, error.message);
  return { ok: false, error: mapDbError(error, fallback) };
}

// ----------------------------------------------------------------------------
// Sparks
// ----------------------------------------------------------------------------

// Quick-capture (Ctrl/Cmd+K). created_by udfyldes af DB-default auth.uid().
export async function createSpark(formData: FormData): Promise<FamtaskActionResult> {
  const title = readText(formData, 'title', TEXT_LIMITS.mediumName);
  if (!title) return { ok: false, error: 'Skriv noget først' };

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .schema('plan')
    .from('sparks')
    .insert({ household_id: householdId, title });
  if (error) return fail('createSpark', error, 'Kunne ikke gemme sparken');

  revalidateFamtask();
  return { ok: true };
}

export async function deleteSpark(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .schema('plan')
    .from('sparks')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    console.error('deleteSpark failed:', error.message);
    throw new Error('Internal error');
  }
  revalidateFamtask();
}

// "Gør til projekt": opretter projektet, sætter promoted_project_id og
// åbner projektet. Titel og note følger med over.
export async function promoteSpark(formData: FormData) {
  const sparkId = String(formData.get('id') ?? '');
  if (!isUuid(sparkId)) return;

  const { supabase, householdId } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const { data: spark, error: sparkErr } = await plan
    .from('sparks')
    .select('id, title, note, promoted_project_id')
    .eq('id', sparkId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (sparkErr) {
    console.error('promoteSpark (read) failed:', sparkErr.message);
    throw new Error('Internal error');
  }
  if (!spark) redirect('/famtask/sparks');
  // Allerede gjort til projekt (dobbeltklik, eller partneren nåede det først)
  if (spark.promoted_project_id) redirect(`/famtask/${spark.promoted_project_id}`);

  const { data: project, error: projErr } = await plan
    .from('projects')
    .insert({ household_id: householdId, title: spark.title, purpose: spark.note })
    .select('id')
    .single();
  if (projErr) {
    console.error('promoteSpark (insert) failed:', projErr.message);
    await setFlashCookie('Kunne ikke oprette projektet', 'error');
    redirect('/famtask/sparks');
  }

  // Betinget link: kun hvis sparken stadig ikke er forfremmet. Taber vi et
  // race, sletter vi vores nye projekt igen og går til det der vandt.
  const { data: linked, error: linkErr } = await plan
    .from('sparks')
    .update({ promoted_project_id: project.id })
    .eq('id', sparkId)
    .eq('household_id', householdId)
    .is('promoted_project_id', null)
    .select('promoted_project_id');
  if (linkErr || !linked || linked.length === 0) {
    if (linkErr) console.error('promoteSpark (link) failed:', linkErr.message);
    await plan
      .from('projects')
      .delete()
      .eq('id', project.id)
      .eq('household_id', householdId);
    const { data: current } = await plan
      .from('sparks')
      .select('promoted_project_id')
      .eq('id', sparkId)
      .eq('household_id', householdId)
      .maybeSingle();
    if (current?.promoted_project_id) redirect(`/famtask/${current.promoted_project_id}`);
    await setFlashCookie('Kunne ikke gøre sparken til et projekt', 'error');
    redirect('/famtask/sparks');
  }

  revalidateFamtask();
  await setFlashCookie('Projekt oprettet');
  redirect(`/famtask/${project.id}`);
}

// ----------------------------------------------------------------------------
// Projekter
// ----------------------------------------------------------------------------

export async function updateProject(formData: FormData): Promise<FamtaskActionResult> {
  const projectId = String(formData.get('project_id') ?? '');
  if (!isUuid(projectId)) return { ok: false, error: 'Projektet findes ikke' };

  const title = readText(formData, 'title', TEXT_LIMITS.mediumName);
  if (!title) return { ok: false, error: 'Projektet skal have en titel' };
  const purpose = readOptionalText(formData, 'purpose', TEXT_LIMITS.description);
  const targetMonth = parseMonthInput(String(formData.get('target_month') ?? ''));
  if (!targetMonth.ok) return { ok: false, error: targetMonth.error };

  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .schema('plan')
    .from('projects')
    .update({ title, purpose, target_month: targetMonth.value })
    .eq('id', projectId)
    .eq('household_id', householdId)
    .select('id');
  if (error) return fail('updateProject', error, 'Kunne ikke gemme projektet');
  if (!data || data.length === 0) return { ok: false, error: 'Projektet findes ikke længere' };

  revalidateFamtask();
  return { ok: true };
}

export async function setProjectStatus(formData: FormData): Promise<FamtaskActionResult> {
  const projectId = String(formData.get('project_id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!isUuid(projectId) || !isProjectStatus(status)) {
    return { ok: false, error: 'Ugyldig status' };
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .schema('plan')
    .from('projects')
    .update({ status })
    .eq('id', projectId)
    .eq('household_id', householdId);
  if (error) return fail('setProjectStatus', error, 'Kunne ikke skifte status');

  revalidateFamtask();
  return { ok: true };
}

// Skridt slettes med (FK cascade). Sparks der pegede på projektet mister
// linket og dukker op i indbakken igen.
export async function deleteProject(formData: FormData) {
  const projectId = String(formData.get('project_id') ?? '');
  if (!isUuid(projectId)) return;

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .schema('plan')
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('household_id', householdId);
  if (error) {
    console.error('deleteProject failed:', error.message);
    throw new Error('Internal error');
  }
  revalidateFamtask();
  await setFlashCookie('Projekt slettet');
  redirect('/famtask');
}

// ----------------------------------------------------------------------------
// Skridt
// ----------------------------------------------------------------------------

// Tilføj er bevidst kun titel: hurtigt at skrive en liste. Beløb og måned
// sættes bagefter på det enkelte skridt.
export async function addStep(formData: FormData): Promise<FamtaskActionResult> {
  const projectId = String(formData.get('project_id') ?? '');
  if (!isUuid(projectId)) return { ok: false, error: 'Projektet findes ikke' };
  const title = readText(formData, 'title', TEXT_LIMITS.mediumName);
  if (!title) return { ok: false, error: 'Skriv hvad skridtet er' };

  const { supabase, householdId } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const { data: last, error: lastErr } = await plan
    .from('steps')
    .select('position')
    .eq('project_id', projectId)
    .eq('household_id', householdId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) return fail('addStep (position)', lastErr, 'Kunne ikke tilføje skridtet');

  // Sammensat FK (project_id, household_id) afviser et projekt fra en
  // anden husstand, så vi behøver ikke slå projektet op først.
  const { error } = await plan.from('steps').insert({
    project_id: projectId,
    household_id: householdId,
    title,
    position: last ? last.position + 1 : 0,
  });
  if (error) return fail('addStep', error, 'Kunne ikke tilføje skridtet');

  revalidateFamtask();
  return { ok: true };
}

// Omdøb, status, beløb (kr i UI, øre i DB) og måned i ét.
export async function updateStep(formData: FormData): Promise<FamtaskActionResult> {
  const stepId = String(formData.get('step_id') ?? '');
  if (!isUuid(stepId)) return { ok: false, error: 'Skridtet findes ikke' };

  const title = readText(formData, 'title', TEXT_LIMITS.mediumName);
  if (!title) return { ok: false, error: 'Skridtet skal have en titel' };
  const status = String(formData.get('status') ?? '');
  if (!isStepStatus(status)) return { ok: false, error: 'Ugyldig status' };
  const amount = parseOptionalAmount(String(formData.get('amount') ?? ''), 'Beløb');
  if (!amount.ok) return { ok: false, error: amount.error };
  const month = parseMonthInput(String(formData.get('month') ?? ''));
  if (!month.ok) return { ok: false, error: month.error };

  const { supabase, householdId } = await getHouseholdContext();
  const { data, error } = await supabase
    .schema('plan')
    .from('steps')
    .update({ title, status, amount: amount.value, month: month.value })
    .eq('id', stepId)
    .eq('household_id', householdId)
    .select('id');
  if (error) return fail('updateStep', error, 'Kunne ikke gemme skridtet');
  if (!data || data.length === 0) return { ok: false, error: 'Skridtet findes ikke længere' };

  revalidateFamtask();
  return { ok: true };
}

// Ét-tryks status-skift. Klienten sender den ønskede status (ikke "næste"),
// så et dobbelt-tryk ikke springer et trin over.
export async function setStepStatus(formData: FormData): Promise<FamtaskActionResult> {
  const stepId = String(formData.get('step_id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!isUuid(stepId) || !isStepStatus(status)) {
    return { ok: false, error: 'Ugyldig status' };
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .schema('plan')
    .from('steps')
    .update({ status })
    .eq('id', stepId)
    .eq('household_id', householdId);
  if (error) return fail('setStepStatus', error, 'Kunne ikke skifte status');

  revalidateFamtask();
  return { ok: true };
}

// Flyt et skridt én plads op/ned. Vi skriver position = index for de
// skridt hvis plads ændrer sig, så eventuelle dubletter i position også
// rettes. Typisk 2 updates.
export async function moveStep(formData: FormData): Promise<FamtaskActionResult> {
  const stepId = String(formData.get('step_id') ?? '');
  const direction = String(formData.get('direction') ?? '');
  if (!isUuid(stepId) || (direction !== 'up' && direction !== 'down')) {
    return { ok: false, error: 'Ugyldig flytning' };
  }

  const { supabase, householdId } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const { data: step, error: stepErr } = await plan
    .from('steps')
    .select('project_id')
    .eq('id', stepId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (stepErr) return fail('moveStep (read)', stepErr, 'Kunne ikke flytte skridtet');
  if (!step) return { ok: false, error: 'Skridtet findes ikke længere' };

  const { data: siblings, error: sibErr } = await plan
    .from('steps')
    .select('id, position')
    .eq('project_id', step.project_id)
    .eq('household_id', householdId)
    .order('position', { ascending: true });
  if (sibErr) return fail('moveStep (siblings)', sibErr, 'Kunne ikke flytte skridtet');

  const current = siblings ?? [];
  const order = moveInOrder(current.map((s) => s.id), stepId, direction);
  if (!order) return { ok: true };

  const positionById = new Map(current.map((s) => [s.id, s.position]));
  const updates = order
    .map((id, index) => ({ id, index }))
    .filter(({ id, index }) => positionById.get(id) !== index)
    .map(({ id, index }) =>
      plan
        .from('steps')
        .update({ position: index })
        .eq('id', id)
        .eq('household_id', householdId)
    );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail('moveStep', failed.error, 'Kunne ikke flytte skridtet');

  revalidateFamtask();
  return { ok: true };
}

export async function deleteStep(formData: FormData): Promise<FamtaskActionResult> {
  const stepId = String(formData.get('step_id') ?? '');
  if (!isUuid(stepId)) return { ok: false, error: 'Skridtet findes ikke' };

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .schema('plan')
    .from('steps')
    .delete()
    .eq('id', stepId)
    .eq('household_id', householdId);
  if (error) return fail('deleteStep', error, 'Kunne ikke slette skridtet');

  revalidateFamtask();
  return { ok: true };
}
