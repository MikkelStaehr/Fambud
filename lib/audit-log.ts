// Audit-log-helper. Skriver til audit_log-tabellen via service-role-klient
// så authenticated brugere ikke kan manipulere deres egen log.
//
// Brug fra Server Actions (login, password-reset, invite-redemption etc.):
//
//   import { logAuditEvent } from '@/lib/audit-log';
//   await logAuditEvent({
//     action: 'login.failure',
//     result: 'failure',
//     metadata: { email_hash: hashEmail(email) },
//   });
//
// Bemærk: ip + user_agent læses automatisk fra request-headers hvis de
// ikke passes ind. user_id/household_id må passes eksplicit hvis kendt.
//
// PII-redaction: metadata strippes for kendte PII-nøgler (email, password,
// token osv.) før insert. Brug `hashEmail()` hvis du har behov for at
// korrelere events fra samme email uden at gemme rå email-adresse.

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export type AuditAction =
  // Authentication
  | 'login.success'
  | 'login.failure'
  | 'logout'
  | 'signup.success'
  | 'signup.failure'
  | 'password.reset_requested'
  | 'password.reset_completed'
  // Invites + membership
  | 'invite.created'
  | 'invite.redeemed'
  | 'invite.redemption_failed'
  | 'member.added'
  | 'member.removed'
  | 'member.role_changed'
  // Account lifecycle
  | 'account.deleted';

export type AuditResult = 'success' | 'failure' | 'denied';

export type AuditMetadata = Record<string, unknown>;

// Forventet shape af audit_log-tabellen. Matcher migration 0055.
// Erstattes af auto-genereret type fra database.types.ts efter
// 'npm run db:types' er kørt mod prod-DB.
type AuditLogRow = {
  action: AuditAction;
  result: AuditResult;
  user_id: string | null;
  household_id: string | null;
  resource: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: AuditMetadata;
};

type LogParams = {
  action: AuditAction;
  result: AuditResult;
  user_id?: string | null;
  household_id?: string | null;
  resource?: string | null;
  ip?: string | null;
  user_agent?: string | null;
  metadata?: AuditMetadata;
};

// Best-effort logger. Audit-log-fejl må ALDRIG break user-flow - vi logger
// til console (Sentry fanger det) og fortsætter. En manglende audit-event
// er bedre end en bruger der ikke kan logge ind.
export async function logAuditEvent(params: LogParams): Promise<void> {
  try {
    const requestContext = await readRequestContext();
    const safeMetadata = redactPII(params.metadata ?? {});

    const admin = createAdminClient();
    // audit_log er ikke i auto-genererede database.types.ts endnu
    // (migration 0055 skal køres + 'npm run db:types' køres manuelt for
    // at regenerere). Cast via unknown indtil regenerering.
    const insertPayload: AuditLogRow = {
      action: params.action,
      result: params.result,
      user_id: params.user_id ?? null,
      household_id: params.household_id ?? null,
      resource: params.resource ?? null,
      ip: params.ip ?? requestContext.ip,
      user_agent: params.user_agent ?? requestContext.userAgent,
      metadata: safeMetadata,
    };
    type AuditTableLike = {
      insert: (row: AuditLogRow) => Promise<{ error: { message: string } | null }>;
    };
    const auditTable = admin.from('audit_log' as never) as unknown as AuditTableLike;
    const { error } = await auditTable.insert(insertPayload);

    if (error) {
      console.error(
        `audit-log insert failed for ${params.action}:`,
        error.message
      );
    }
  } catch (e) {
    console.error(`audit-log helper failed for ${params.action}:`, e);
  }
}

// SHA-256 hash af email til korrelation uden PII-eksponering. Brug ved
// failed-login-tracking hvor vi vil se "samme email forsøgt flere
// gange" uden at gemme rå email i log.
//
// Bemærk: ikke salted - to forskellige FamBud-instanser ville få samme
// hash for samme email. Det er bevidst: vi har én instans, og hash-
// kolisionen er ikke en angrebsvektor (man kan stadig ikke reverse
// hash til email uden at have email i forvejen).
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 16);
}

// PII-redaction - samme princip som lib/sentry-scrub.ts men for plain
// objects. Strippede nøgler:
// - Direkte: email, password, token, secret, key, cpr, phone, tlf,
//   adgangskode, kodeord
// - Email-pattern i værdier (catches misnamed fields)
//
// Recursive på nested objekter. Arrays: hver element gennemgås.
const PII_KEY_PATTERN = /^(email|password|token|secret|key|cpr|phone|tlf|adgangskode|kodeord|api_key|jwt|bearer)$/i;
const EMAIL_VALUE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redactPII(obj: AuditMetadata): AuditMetadata {
  const result: AuditMetadata = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_KEY_PATTERN.test(key)) {
      result[key] = '[redacted]';
    } else if (typeof value === 'string' && EMAIL_VALUE_PATTERN.test(value)) {
      // Email-shape i værdi (selvom feltet ikke hedder email) → redact.
      // Catches misnamed fields som 'username' der indeholder email.
      result[key] = '[redacted-email]';
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? redactPII(item as AuditMetadata)
          : typeof item === 'string' && EMAIL_VALUE_PATTERN.test(item)
            ? '[redacted-email]'
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactPII(value as AuditMetadata);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function readRequestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    // x-forwarded-for kan være liste af proxies; tag højremost (Vercel
    // appender klient-IP). Samme pattern som lib/rate-limit.ts:getClientIp.
    const xff = h.get('x-forwarded-for');
    const ip = xff ? xff.split(',').pop()?.trim() ?? null : null;
    const userAgent = h.get('user-agent')?.slice(0, 500) ?? null;
    return { ip, userAgent };
  } catch {
    // Ikke i request-context (fx ved background-job). Returnér null.
    return { ip: null, userAgent: null };
  }
}
