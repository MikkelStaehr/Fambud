// Activity-feed til husstanden: udlæsning af audit_log scoped til den
// aktuelle husstand, filtreret til de event-typer der giver mening for
// slutbrugere (transaktioner, konti, lån, proxy, familie-medlemskab).
//
// Login/password/signup-events ligger UDENFOR scope - de er pre-husstand
// (failed logins har ofte null user_id) og hører hjemme i operator-
// dashboardet, ikke i app'en.
//
// Læser via admin-client fordi audit_log har RLS DENY ALL (kun
// service-role kan læse). Re-imposér household-grænsen manuelt - samme
// mønster som getTransferGraph + economy-plan bruger til hus-bred lookup.

import { createAdminClient } from '@/lib/supabase/admin';
import { getHouseholdContext } from './auth';
import type { AuditAction, AuditResult, AuditMetadata } from '@/lib/audit-log';

// audit_log er endnu ikke i auto-genererede database.types.ts.
// Vi definerer shape lokalt og caster admin-client-queryen.
export type ActivityRow = {
  id: number;
  occurred_at: string;
  action: AuditAction;
  result: AuditResult;
  resource: string | null;
  user_id: string | null;
  acting_user_id: string | null;
  household_id: string | null;
  metadata: AuditMetadata;
  // Resolved navne (fra family_members-lookup). Null hvis user_id ikke
  // matcher et family member (kan ske ved historiske rækker fra brugere
  // der senere er fjernet fra husstanden).
  user_name: string | null;
  acting_user_name: string | null;
};

// Hvilke action-typer der vises på husstands-aktivitets-siden. Holder
// listen eksplicit så vi ikke ved et uheld eksponerer nye event-typer
// (fx login.failure) når de tilføjes til AuditAction.
const HOUSEHOLD_VISIBLE_ACTIONS: readonly AuditAction[] = [
  // Finansielle UPDATE/DELETE (migration 0071, P16)
  'transaction.updated',
  'transaction.deleted',
  'account.updated',
  'account.deleted',
  'loan.updated',
  'loan.deleted',
  // Membership-ændringer (interessante for konflikt-evidens)
  'member.added',
  'member.removed',
  'member.role_changed',
  'invite.created',
  'invite.redeemed',
  // Proxy-flow (Mikkel hjalp Louise)
  'proxy.requested',
  'proxy.accepted',
  'proxy.rejected',
  'proxy.revoked',
  'proxy.activated',
  'proxy.resource_created',
];

type GetActivityOpts = {
  limit?: number;
  // Filter til specifik action-type. Null = alle visible-actions.
  actionFilter?: AuditAction | null;
};

export async function getHouseholdActivity(
  opts: GetActivityOpts = {}
): Promise<ActivityRow[]> {
  const { limit = 100, actionFilter = null } = opts;
  const { householdId } = await getHouseholdContext();

  const admin = createAdminClient();

  // Audit-log query. Vi caster via unknown fordi audit_log mangler i
  // database.types.ts (samme grund som lib/audit-log.ts caster sin insert).
  type AuditLogQuery = {
    from: (table: 'audit_log') => {
      select: (cols: string) => {
        eq: (col: string, val: string) => unknown;
      };
    };
  };
  const adminAsAudit = admin as unknown as AuditLogQuery;

  // Build query: scope til husstand + action-whitelist.
  type AuditRow = Omit<ActivityRow, 'user_name' | 'acting_user_name'>;
  type QueryBuilder = {
    in: (col: string, vals: readonly string[]) => QueryBuilder;
    eq: (col: string, val: string) => QueryBuilder;
    order: (col: string, opts: { ascending: boolean }) => QueryBuilder;
    limit: (n: number) => Promise<{ data: AuditRow[] | null; error: { message: string } | null }>;
  };
  let q = adminAsAudit
    .from('audit_log')
    .select(
      'id, occurred_at, action, result, resource, user_id, acting_user_id, household_id, metadata'
    )
    .eq('household_id', householdId) as unknown as QueryBuilder;

  if (actionFilter && HOUSEHOLD_VISIBLE_ACTIONS.includes(actionFilter)) {
    q = q.eq('action', actionFilter);
  } else {
    q = q.in('action', HOUSEHOLD_VISIBLE_ACTIONS);
  }

  const { data: rows, error } = await q
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [];

  // Resolv user_id + acting_user_id til navne via family_members.
  // Engang lookup pr. query - vi forventer maks ~5-10 unikke user_ids
  // selv ved 100 rækker, og samme bruger gentager sig på tværs af events.
  const userIds = new Set<string>();
  for (const r of rows) {
    if (r.user_id) userIds.add(r.user_id);
    if (r.acting_user_id) userIds.add(r.acting_user_id);
  }
  const nameByUserId = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: members } = await admin
      .from('family_members')
      .select('user_id, name')
      .eq('household_id', householdId)
      .in('user_id', Array.from(userIds));
    for (const m of members ?? []) {
      if (m.user_id) nameByUserId.set(m.user_id, m.name);
    }
  }

  return rows.map((r) => ({
    ...r,
    user_name: r.user_id ? nameByUserId.get(r.user_id) ?? null : null,
    acting_user_name: r.acting_user_id
      ? nameByUserId.get(r.acting_user_id) ?? null
      : null,
  }));
}
