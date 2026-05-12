// Vercel Cron: månedlig oversigts-email til alle aktive family_members.
//
// Konfig i vercel.json kalder denne route den 28. i hver måned kl. 06:00
// (slutningen af måneden, så tallene reflekterer hele perioden plus den
// månedlige run-rate). Vercel sender Authorization: Bearer ${CRON_SECRET}
// så vi kan verificere at det er Vercel der kalder og ikke en uautoriseret
// 3.-part.
//
// Idempotency: last_monthly_summary_sent_at gemmes på family_members.
// Hvis den allerede er sat for indeværende kalendermåned, springer vi
// brugeren over. Det betyder retries efter delvist fejlede runs ikke
// dobbelt-sender, og det betyder også at vi kan re-run'e cron'en manuelt
// hvis vi har behov.
//
// Failure-håndtering: hver bruger sendes individuelt. Fejler vi for ÉN,
// logger vi til Vercel-stdout og fortsætter med næste. Ingen retry-loop
// for V1 - en bruger der manglede én måned, har sandsynligvis ramt en
// transient fejl (Resend rate-limit, network) og får mailen næste måned.

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveSiteOrigin } from '@/lib/site-url';
import {
  getMonthlySummaryForMember,
  getNumContributors,
  sendMonthlySummaryEmail,
} from '@/lib/email/monthly-summary';
import { logAuditEvent } from '@/lib/audit-log';

// Vercel Cron har op til 60 sek på Hobby, 300 på Pro. Vi sætter
// max-tid ekspliciteret så den ikke afbrydes ved store husstands-
// antal. Increase når brugerbasen vokser.
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET mangler i environment');
    return false;
  }
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

// Returner true hvis lastSentAt ligger i samme kalendermåned som nu.
function alreadySentThisMonth(
  lastSentAt: string | null,
  now: Date
): boolean {
  if (!lastSentAt) return false;
  const last = new Date(lastSentAt);
  return (
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth()
  );
}

function firstNameOf(fullName: string | null): string {
  if (!fullName) return 'der';
  const trimmed = fullName.trim();
  return trimmed.split(/\s+/)[0] ?? 'der';
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const monthIndex0 = now.getUTCMonth();

  const supabase = createAdminClient();

  // Find alle eligible members: enabled + email + user_id, sorteret
  // efter household så vi kan caches numContributors per household.
  const { data: members, error: membersErr } = await supabase
    .from('family_members')
    .select('id, household_id, name, email, monthly_summary_email_enabled, last_monthly_summary_sent_at')
    .eq('monthly_summary_email_enabled', true)
    .not('email', 'is', null)
    .not('user_id', 'is', null)
    .order('household_id', { ascending: true });

  if (membersErr) {
    console.error('monthly-summary: failed to list members', membersErr);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  const eligible = members ?? [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // Cache numContributors per household så vi ikke kører N+1.
  const contributorsCache = new Map<string, number>();

  const origin = await resolveSiteOrigin();
  const appUrl = `${origin}/dashboard`;
  const settingsUrl = `${origin}/indstillinger`;

  for (const member of eligible) {
    // Idempotency-check
    if (alreadySentThisMonth(member.last_monthly_summary_sent_at, now)) {
      skipped++;
      continue;
    }
    if (!member.email || !member.name) {
      skipped++;
      continue;
    }

    try {
      let numContributors = contributorsCache.get(member.household_id);
      if (numContributors == null) {
        numContributors = await getNumContributors(supabase, member.household_id);
        contributorsCache.set(member.household_id, numContributors);
      }

      const summary = await getMonthlySummaryForMember(
        supabase,
        member.household_id,
        member.name,
        numContributors
      );

      await sendMonthlySummaryEmail({
        to: member.email,
        firstName: firstNameOf(member.name),
        monthIndex0,
        summary,
        appUrl,
        settingsUrl,
      });

      // Marker som sendt - vi opdaterer last_monthly_summary_sent_at
      // til now() så næste kørsel inden for samme måned skipper.
      const { error: updateErr } = await supabase
        .from('family_members')
        .update({ last_monthly_summary_sent_at: now.toISOString() })
        .eq('id', member.id);
      if (updateErr) {
        // Mail er sendt men vi kunne ikke registrere det - log og
        // fortsæt. Risiko: dobbelt-mail ved retry, men sjælden case.
        console.error(
          `monthly-summary: failed to update last_sent for ${member.id}`,
          updateErr
        );
      }

      await logAuditEvent({
        action: 'monthly_summary.sent',
        result: 'success',
        user_id: null,
        household_id: member.household_id,
        metadata: {
          member_id: member.id,
          month: monthIndex0,
        },
      });

      sent++;
    } catch (err) {
      failed++;
      console.error(
        `monthly-summary: failed for member ${member.id}`,
        err
      );
      await logAuditEvent({
        action: 'monthly_summary.failed',
        result: 'failure',
        user_id: null,
        household_id: member.household_id,
        metadata: {
          member_id: member.id,
          month: monthIndex0,
          reason: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
        },
      }).catch((logErr) => {
        console.error('monthly-summary: audit log failed', logErr);
      });
    }
  }

  return NextResponse.json({
    ok: true,
    eligible: eligible.length,
    sent,
    skipped,
    failed,
  });
}
