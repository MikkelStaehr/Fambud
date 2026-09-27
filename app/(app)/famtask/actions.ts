'use server';

// Server Actions for /famtask (plan-schemaet, migration 0072).
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
import { getFamtaskMembers, getHouseholdContext } from '@/lib/dal';
import { parseOptionalAmount, TEXT_LIMITS } from '@/lib/format';
import { readOptionalText, readText } from '@/lib/actions/safe-form';
import { mapDbError } from '@/lib/actions/error-map';
import { setFlashCookie } from '@/lib/flash';
import { logAuditEvent } from '@/lib/audit-log';
import { sendFamtaskAssignmentEmail } from '@/lib/email/famtask-assignment';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveSiteOrigin } from '@/lib/site-url';
import {
  isProjectStatus,
  isStepStatus,
  isUuid,
  moveInOrder,
  parseMonthInput,
  sparkChecklist,
  type StepParent,
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

// "Ansvarlig"-feltet. Tom = ingen. Den sammensatte FK (0073) afviser et
// medlem fra en anden husstand, så medlemmet slås ikke op først.
function readOwnerMemberId(
  formData: FormData
): { ok: true; value: string | null } | { ok: false; error: string } {
  const raw = String(formData.get('owner_member_id') ?? '').trim();
  if (!raw) return { ok: true, value: null };
  if (!isUuid(raw)) return { ok: false, error: 'Ugyldigt medlem' };
  return { ok: true, value: raw };
}

// Et ja gælder sparken som den så ud, da man sagde ja. Ændres tjekliste-
// felterne (0073) eller sparkens skridt (0074), nulstilles alle godkendelser.
async function resetSparkApprovals(sparkId: string): Promise<{ message?: string } | null> {
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .schema('plan')
    .from('spark_approvals')
    .delete()
    .eq('spark_id', sparkId)
    .eq('household_id', householdId);
  return error;
}

// Hvem et nyt skridt hører til: præcis ét af project_id og spark_id (0074).
function readStepParent(formData: FormData): StepParent | null {
  const projectId = String(formData.get('project_id') ?? '');
  const sparkId = String(formData.get('spark_id') ?? '');
  if (isUuid(projectId) && !sparkId) return { kind: 'project', id: projectId };
  if (isUuid(sparkId) && !projectId) return { kind: 'spark', id: sparkId };
  return null;
}

const PARENT_COLUMN = { project: 'project_id', spark: 'spark_id' } as const;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

// Mail til den nye ansvarlige (migration 0075). Kaldes efter at ændringen
// er gemt, så en fejl her må aldrig give brugeren en fejl: alt fanges og
// logges i audit-loggen. Ingen mail til en selv, til medlemmer uden login
// eller email, eller hvis modtageren har slået det fra. Højst 20 i timen
// pr. afsender (rate_limit_routes), så man ikke kan spamme sin partner.
async function notifyNewOwner(n: {
  kind: 'spark' | 'project';
  id: string;
  title: string;
  purpose: string | null;
  amount: number | null;
  month: string | null;
  ownerMemberId: string;
}): Promise<void> {
  const { supabase, householdId, user } = await getHouseholdContext();
  const audit = {
    user_id: user.id,
    household_id: householdId,
    resource: `${n.kind}:${n.id}`,
  };
  try {
    const [ownerRes, meRes] = await Promise.all([
      supabase
        .from('family_members')
        .select('name, email, user_id, famtask_email_enabled')
        .eq('id', n.ownerMemberId)
        .eq('household_id', householdId)
        .maybeSingle(),
      supabase
        .from('family_members')
        .select('name')
        .eq('user_id', user.id)
        .eq('household_id', householdId)
        .maybeSingle(),
    ]);
    if (ownerRes.error) throw ownerRes.error;
    const owner = ownerRes.data;
    if (
      !owner?.email ||
      !owner.user_id ||
      owner.user_id === user.id ||
      !owner.famtask_email_enabled
    ) {
      return;
    }

    if (!(await checkRateLimit(user.id, 'famtask_assignment_email'))) {
      await logAuditEvent({
        ...audit,
        action: 'famtask_assignment.failed',
        result: 'denied',
        metadata: { member_id: n.ownerMemberId, reason: 'rate_limited' },
      });
      return;
    }

    const origin = await resolveSiteOrigin();
    const path = n.kind === 'spark' ? `/famtask/sparks/${n.id}` : `/famtask/${n.id}`;
    await sendFamtaskAssignmentEmail(owner.email, {
      firstName: firstName(owner.name),
      assignerName: firstName(meRes.data?.name ?? '') || 'Et familiemedlem',
      kind: n.kind,
      title: n.title,
      purpose: n.purpose,
      amount: n.amount,
      month: n.month,
      url: `${origin}${path}`,
      settingsUrl: `${origin}/indstillinger/profil`,
    });
    await logAuditEvent({
      ...audit,
      action: 'famtask_assignment.sent',
      result: 'success',
      metadata: { member_id: n.ownerMemberId },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('notifyNewOwner failed:', reason);
    await logAuditEvent({
      ...audit,
      action: 'famtask_assignment.failed',
      result: 'failure',
      metadata: { member_id: n.ownerMemberId, reason: reason.slice(0, 200) },
    });
  }
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

// Sletter også sparkens skridt (FK cascade, 0074).
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
  // Sparkens egen side findes ikke længere, så vi går altid til indbakken.
  await setFlashCookie('Spark slettet');
  redirect('/famtask/sparks');
}

// Tjekliste-felterne på en spark (migration 0073). Ændres noget, nulstilles
// alle godkendelser: et ja gælder sparken som den så ud, da man sagde ja.
// Gem uden ændringer rører ikke godkendelserne.
export async function updateSpark(formData: FormData): Promise<FamtaskActionResult> {
  const sparkId = String(formData.get('spark_id') ?? '');
  if (!isUuid(sparkId)) return { ok: false, error: 'Sparken findes ikke' };

  const title = readText(formData, 'title', TEXT_LIMITS.mediumName);
  if (!title) return { ok: false, error: 'Sparken skal have en titel' };
  const note = readOptionalText(formData, 'note', TEXT_LIMITS.description);
  const amount = parseOptionalAmount(String(formData.get('estimated_amount') ?? ''), 'Beløb');
  if (!amount.ok) return { ok: false, error: amount.error };
  const targetMonth = parseMonthInput(String(formData.get('target_month') ?? ''));
  if (!targetMonth.ok) return { ok: false, error: targetMonth.error };
  const owner = readOwnerMemberId(formData);
  if (!owner.ok) return owner;

  const { supabase, householdId } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const { data: current, error: readErr } = await plan
    .from('sparks')
    .select('title, note, estimated_amount, target_month, owner_member_id, promoted_project_id')
    .eq('id', sparkId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (readErr) return fail('updateSpark (read)', readErr, 'Kunne ikke gemme sparken');
  if (!current) return { ok: false, error: 'Sparken findes ikke længere' };
  if (current.promoted_project_id) {
    return { ok: false, error: 'Sparken er allerede blevet til et projekt' };
  }

  const next = {
    title,
    note,
    estimated_amount: amount.value,
    target_month: targetMonth.value,
    owner_member_id: owner.value,
  };
  const changed = (Object.keys(next) as (keyof typeof next)[]).some(
    (k) => next[k] !== current[k]
  );
  if (!changed) return { ok: true };

  const { error } = await plan
    .from('sparks')
    .update(next)
    .eq('id', sparkId)
    .eq('household_id', householdId);
  if (error) return fail('updateSpark', error, 'Kunne ikke gemme sparken');

  const resetErr = await resetSparkApprovals(sparkId);
  if (resetErr) {
    return fail('updateSpark (reset)', resetErr, 'Sparken er gemt, men godkendelserne blev ikke nulstillet');
  }

  if (next.owner_member_id && next.owner_member_id !== current.owner_member_id) {
    await notifyNewOwner({
      kind: 'spark',
      id: sparkId,
      title,
      purpose: note,
      amount: amount.value,
      month: targetMonth.value,
      ownerMemberId: next.owner_member_id,
    });
  }

  revalidateFamtask();
  return { ok: true };
}

// Sig ja til en spark, eller træk sit ja tilbage. Man godkender altid som
// sig selv: user_id udfyldes af DB-default auth.uid() ved insert og kommer
// fra sessionen ved delete, aldrig fra formData (CLAUDE.md §2).
export async function setSparkApproval(formData: FormData): Promise<FamtaskActionResult> {
  const sparkId = String(formData.get('spark_id') ?? '');
  if (!isUuid(sparkId)) return { ok: false, error: 'Sparken findes ikke' };
  const approve = formData.get('approve') === '1';

  const { supabase, householdId, user } = await getHouseholdContext();
  const approvals = supabase.schema('plan').from('spark_approvals');

  if (approve) {
    // Sammensat FK afviser en spark fra en anden husstand. 23505 betyder
    // at man allerede har sagt ja (dobbelttryk), og det er fint.
    const { error } = await approvals.insert({ spark_id: sparkId, household_id: householdId });
    if (error && error.code !== '23505') {
      return fail('setSparkApproval (insert)', error, 'Kunne ikke gemme dit ja');
    }
  } else {
    const { error } = await approvals
      .delete()
      .eq('spark_id', sparkId)
      .eq('household_id', householdId)
      .eq('user_id', user.id);
    if (error) return fail('setSparkApproval (delete)', error, 'Kunne ikke trække dit ja tilbage');
  }

  revalidateFamtask();
  return { ok: true };
}

// "Gør til projekt": tjekker tjeklisten og kalder plan.promote_spark, der i
// én transaktion opretter projektet, flytter sparkens skridt over og sætter
// promoted_project_id (0074). Titel, formål, beløb, måned og ansvarlig
// følger med over.
export async function promoteSpark(formData: FormData) {
  const sparkId = String(formData.get('id') ?? '');
  if (!isUuid(sparkId)) return;

  const { supabase, householdId } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const { data: spark, error: sparkErr } = await plan
    .from('sparks')
    .select('id, note, estimated_amount, target_month, owner_member_id, promoted_project_id')
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

  // Tjeklisten håndhæves her på serveren, ikke kun ved at knappen er
  // slået fra på siden.
  const [approvalsRes, stepsRes, members] = await Promise.all([
    plan
      .from('spark_approvals')
      .select('user_id')
      .eq('spark_id', sparkId)
      .eq('household_id', householdId),
    plan
      .from('steps')
      .select('amount')
      .eq('spark_id', sparkId)
      .eq('household_id', householdId),
    getFamtaskMembers(),
  ]);
  const readErr = approvalsRes.error ?? stepsRes.error;
  if (readErr) {
    console.error('promoteSpark (checklist) failed:', readErr.message);
    throw new Error('Internal error');
  }
  const checklist = sparkChecklist(
    spark,
    members,
    (approvalsRes.data ?? []).map((a) => a.user_id),
    (stepsRes.data ?? []).map((s) => s.amount)
  );
  if (!checklist.ready) {
    const missing = checklist.items
      .filter((i) => !i.done)
      .map((i) => i.label.toLowerCase())
      .join(', ');
    await setFlashCookie(`Sparken mangler: ${missing}`, 'error');
    redirect(`/famtask/sparks/${sparkId}`);
  }

  const { data: projectId, error: rpcErr } = await plan.rpc('promote_spark', {
    p_spark_id: sparkId,
  });
  if (rpcErr || !projectId) {
    if (rpcErr) console.error('promoteSpark (rpc) failed:', rpcErr.message);
    await setFlashCookie('Kunne ikke gøre sparken til et projekt', 'error');
    redirect(`/famtask/sparks/${sparkId}`);
  }

  // Tjeklisten er opfyldt, så beslutningen er taget: projektet starter som
  // Aktiv i stedet for DB-default Idé. Kun hvis det stadig er Idé, så et
  // projekt der allerede fandtes (dobbeltklik) ikke får sin status ændret.
  // Fejler det, er projektet stadig oprettet; status kan skiftes på siden.
  const { error: statusErr } = await plan
    .from('projects')
    .update({ status: 'aktiv' })
    .eq('id', projectId)
    .eq('household_id', householdId)
    .eq('status', 'ide');
  if (statusErr) console.error('promoteSpark (status) failed:', statusErr.message);

  revalidateFamtask();
  await setFlashCookie('Projekt oprettet');
  redirect(`/famtask/${projectId}`);
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
  const amount = parseOptionalAmount(String(formData.get('estimated_amount') ?? ''), 'Beløb');
  if (!amount.ok) return { ok: false, error: amount.error };
  const owner = readOwnerMemberId(formData);
  if (!owner.ok) return owner;

  const { supabase, householdId } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const { data: current, error: readErr } = await plan
    .from('projects')
    .select('owner_member_id')
    .eq('id', projectId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (readErr) return fail('updateProject (read)', readErr, 'Kunne ikke gemme projektet');
  if (!current) return { ok: false, error: 'Projektet findes ikke længere' };

  const { error } = await plan
    .from('projects')
    .update({
      title,
      purpose,
      target_month: targetMonth.value,
      estimated_amount: amount.value,
      owner_member_id: owner.value,
    })
    .eq('id', projectId)
    .eq('household_id', householdId);
  if (error) return fail('updateProject', error, 'Kunne ikke gemme projektet');

  if (owner.value && owner.value !== current.owner_member_id) {
    await notifyNewOwner({
      kind: 'project',
      id: projectId,
      title,
      purpose,
      amount: amount.value,
      month: targetMonth.value,
      ownerMemberId: owner.value,
    });
  }

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
// sættes bagefter på det enkelte skridt. Skridtet hører til et projekt
// eller en spark (0074).
export async function addStep(formData: FormData): Promise<FamtaskActionResult> {
  const parent = readStepParent(formData);
  if (!parent) return { ok: false, error: 'Skridtet mangler et projekt eller en spark' };
  const title = readText(formData, 'title', TEXT_LIMITS.mediumName);
  if (!title) return { ok: false, error: 'Skriv hvad skridtet er' };

  const { supabase, householdId } = await getHouseholdContext();
  const plan = supabase.schema('plan');

  const { data: last, error: lastErr } = await plan
    .from('steps')
    .select('position')
    .eq(PARENT_COLUMN[parent.kind], parent.id)
    .eq('household_id', householdId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastErr) return fail('addStep (position)', lastErr, 'Kunne ikke tilføje skridtet');

  // De sammensatte FK'er afviser et projekt eller en spark fra en anden
  // husstand, så vi behøver ikke slå forælderen op først.
  const { error } = await plan.from('steps').insert({
    project_id: parent.kind === 'project' ? parent.id : null,
    spark_id: parent.kind === 'spark' ? parent.id : null,
    household_id: householdId,
    title,
    position: last ? last.position + 1 : 0,
  });
  if (error) return fail('addStep', error, 'Kunne ikke tilføje skridtet');

  if (parent.kind === 'spark') {
    const resetErr = await resetSparkApprovals(parent.id);
    if (resetErr) return fail('addStep (reset)', resetErr, 'Skridtet er tilføjet, men godkendelserne blev ikke nulstillet');
  }

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
  const plan = supabase.schema('plan');

  const { data: current, error: readErr } = await plan
    .from('steps')
    .select('spark_id, title, amount, month')
    .eq('id', stepId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (readErr) return fail('updateStep (read)', readErr, 'Kunne ikke gemme skridtet');
  if (!current) return { ok: false, error: 'Skridtet findes ikke længere' };

  const { error } = await plan
    .from('steps')
    .update({ title, status, amount: amount.value, month: month.value })
    .eq('id', stepId)
    .eq('household_id', householdId);
  if (error) return fail('updateStep', error, 'Kunne ikke gemme skridtet');

  // Status alene ændrer ikke budgettet, så kun titel, beløb og måned
  // nulstiller godkendelserne på en spark.
  const budgetChanged =
    current.title !== title || current.amount !== amount.value || current.month !== month.value;
  if (current.spark_id && budgetChanged) {
    const resetErr = await resetSparkApprovals(current.spark_id);
    if (resetErr) return fail('updateStep (reset)', resetErr, 'Skridtet er gemt, men godkendelserne blev ikke nulstillet');
  }

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
    .select('project_id, spark_id')
    .eq('id', stepId)
    .eq('household_id', householdId)
    .maybeSingle();
  if (stepErr) return fail('moveStep (read)', stepErr, 'Kunne ikke flytte skridtet');
  if (!step) return { ok: false, error: 'Skridtet findes ikke længere' };

  // Søskende er skridtene med samme forælder (projekt eller spark, 0074).
  const [column, parentId] = step.project_id
    ? (['project_id', step.project_id] as const)
    : (['spark_id', step.spark_id as string] as const);
  const { data: siblings, error: sibErr } = await plan
    .from('steps')
    .select('id, position')
    .eq(column, parentId)
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
  const { data: deleted, error } = await supabase
    .schema('plan')
    .from('steps')
    .delete()
    .eq('id', stepId)
    .eq('household_id', householdId)
    .select('spark_id');
  if (error) return fail('deleteStep', error, 'Kunne ikke slette skridtet');

  const sparkId = deleted?.[0]?.spark_id;
  if (sparkId) {
    const resetErr = await resetSparkApprovals(sparkId);
    if (resetErr) return fail('deleteStep (reset)', resetErr, 'Skridtet er slettet, men godkendelserne blev ikke nulstillet');
  }

  revalidateFamtask();
  return { ok: true };
}
