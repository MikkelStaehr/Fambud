// Vercel Cron: ugentlig betalings-påmindelse til family_members der har slået
// den til. Konfig i vercel.json kalder denne route hver mandag kl. 07:00.
//
// Mønster spejler /api/cron/monthly-summary: Bearer-token-auth via CRON_SECRET,
// admin-klient, per-medlem-send med individuel fejlhåndtering, audit-log.
//
// Idempotency: last_payment_reminder_sent_at. Vi springer over hvis der er
// sendt inden for de sidste 6 dage, så et retry eller dobbelt-trigger samme
// uge ikke giver dobbelt-mail.
//
// Vi sender KUN hvis der faktisk er kommende betalinger - ingen "intet
// forfalder"-mail (det ville bare være støj).

import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveSiteOrigin } from '@/lib/site-url';
import {
  getUpcomingPaymentsForMember,
  sendPaymentReminderEmail,
} from '@/lib/email/payment-reminder';
import { logAuditEvent } from '@/lib/audit-log';

export const maxDuration = 300;

const HORIZON_DAYS = 7;
const MIN_DAYS_BETWEEN = 6;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET mangler i environment');
    return false;
  }
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

function sentWithinDays(lastSentAt: string | null, now: Date, days: number): boolean {
  if (!lastSentAt) return false;
  const diffMs = now.getTime() - new Date(lastSentAt).getTime();
  return diffMs < days * 24 * 60 * 60 * 1000;
}

function firstNameOf(fullName: string | null): string {
  if (!fullName) return 'der';
  return fullName.trim().split(/\s+/)[0] ?? 'der';
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const supabase = createAdminClient();

  const { data: members, error: membersErr } = await supabase
    .from('family_members')
    .select(
      'id, household_id, name, email, user_id, payment_reminder_email_enabled, last_payment_reminder_sent_at'
    )
    .eq('payment_reminder_email_enabled', true)
    .not('email', 'is', null)
    .not('user_id', 'is', null);

  if (membersErr) {
    console.error('payment-reminders: failed to list members', membersErr);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }

  const eligible = members ?? [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const origin = await resolveSiteOrigin();
  const appUrl = `${origin}/dashboard`;
  const settingsUrl = `${origin}/indstillinger`;

  for (const member of eligible) {
    if (sentWithinDays(member.last_payment_reminder_sent_at, now, MIN_DAYS_BETWEEN)) {
      skipped++;
      continue;
    }
    if (!member.email || !member.name || !member.user_id) {
      skipped++;
      continue;
    }

    try {
      const payments = await getUpcomingPaymentsForMember(
        supabase,
        member.household_id,
        member.user_id,
        HORIZON_DAYS
      );

      // Ingen kommende betalinger → ingen mail (men opdater IKKE timestamp,
      // så de får mailen næste uge hvis der så er noget).
      if (payments.length === 0) {
        skipped++;
        continue;
      }

      await sendPaymentReminderEmail({
        to: member.email,
        firstName: firstNameOf(member.name),
        payments,
        periodDays: HORIZON_DAYS,
        appUrl,
        settingsUrl,
      });

      const { error: updateErr } = await supabase
        .from('family_members')
        .update({ last_payment_reminder_sent_at: now.toISOString() })
        .eq('id', member.id);
      if (updateErr) {
        console.error(
          `payment-reminders: failed to update last_sent for ${member.id}`,
          updateErr
        );
      }

      await logAuditEvent({
        action: 'payment_reminder.sent',
        result: 'success',
        user_id: null,
        household_id: member.household_id,
        metadata: { member_id: member.id, count: payments.length },
      });

      sent++;
    } catch (err) {
      failed++;
      console.error(`payment-reminders: failed for member ${member.id}`, err);
      await logAuditEvent({
        action: 'payment_reminder.failed',
        result: 'failure',
        user_id: null,
        household_id: member.household_id,
        metadata: {
          member_id: member.id,
          reason: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
        },
      }).catch((logErr) => {
        console.error('payment-reminders: audit log failed', logErr);
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
