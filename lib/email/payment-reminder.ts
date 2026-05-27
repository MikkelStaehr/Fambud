// Ugentlig betalings-påmindelse: de faste udgifter + overførsler der
// forfalder i den kommende uge, samlet i én mail. Kører fra cron-context
// (service-role) så vi har ingen getHouseholdContext - beregningen tager
// admin-klient + eksplicit household/bruger, og dublerer bevidst lidt af
// upcoming-events.ts's forlæns-rul-logik for at holde sig isoleret fra det
// auth-aware lag.
//
// Scope pr. medlem: betalinger på medlemmets EGNE konti (created_by =
// brugeren) + husstandens FÆLLES konti (owner_name='Fælles'). En partners
// private regninger er ikke med - de er privacy-beskyttede.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, RecurrenceFreq } from '@/lib/database.types';
import {
  formatAmount,
  formatShortDateDA,
  nextOccurrenceAfter,
} from '@/lib/format';
import { sendEmail } from './resend';

export type UpcomingPayment = {
  date: string; // ISO YYYY-MM-DD
  description: string;
  amount: number; // øre
  kind: 'expense' | 'transfer';
};

export async function getUpcomingPaymentsForMember(
  adminClient: SupabaseClient<Database>,
  householdId: string,
  userId: string,
  days: number
): Promise<UpcomingPayment[]> {
  // Relevante konti: brugerens egne (created_by) + fælles. Ikke lån (kind
  // 'credit' - de håndteres på /laan og er ikke modelleret som forfaldne
  // transaktioner her) og ikke arkiverede.
  const { data: accounts, error: accErr } = await adminClient
    .from('accounts')
    .select('id, owner_name, created_by, kind, archived')
    .eq('household_id', householdId);
  if (accErr) throw accErr;

  const relevantIds = (accounts ?? [])
    .filter(
      (a) =>
        !a.archived &&
        a.kind !== 'credit' &&
        (a.created_by === userId || a.owner_name === 'Fælles')
    )
    .map((a) => a.id);
  if (relevantIds.length === 0) return [];

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const horizon = new Date(todayDateOnly);
  horizon.setDate(horizon.getDate() + days);
  const todayISO = todayDateOnly.toISOString().slice(0, 10);
  const horizonISO = horizon.toISOString().slice(0, 10);

  const [txnsRes, transfersRes] = await Promise.all([
    adminClient
      .from('transactions')
      .select(
        'id, amount, description, occurs_on, recurrence, category:categories!inner(name, kind)'
      )
      .eq('household_id', householdId)
      .eq('category.kind', 'expense')
      .in('account_id', relevantIds)
      .returns<
        {
          id: string;
          amount: number;
          description: string | null;
          occurs_on: string;
          recurrence: RecurrenceFreq;
          category: { name: string; kind: 'expense' } | null;
        }[]
      >(),
    adminClient
      .from('transfers')
      .select(
        'id, amount, description, occurs_on, recurrence, to_account:accounts!to_account_id(name)'
      )
      .eq('household_id', householdId)
      .in('from_account_id', relevantIds)
      .returns<
        {
          id: string;
          amount: number;
          description: string | null;
          occurs_on: string;
          recurrence: RecurrenceFreq;
          to_account: { name: string } | null;
        }[]
      >(),
  ]);
  if (txnsRes.error) throw txnsRes.error;
  if (transfersRes.error) throw transfersRes.error;

  const payments: UpcomingPayment[] = [];

  for (const t of txnsRes.data ?? []) {
    const nextDate =
      t.recurrence === 'once'
        ? t.occurs_on
        : nextOccurrenceAfter(t.occurs_on, t.recurrence, today);
    if (nextDate < todayISO || nextDate > horizonISO) continue;
    payments.push({
      date: nextDate,
      description: t.description ?? t.category?.name ?? 'Regning',
      amount: t.amount,
      kind: 'expense',
    });
  }

  for (const tr of transfersRes.data ?? []) {
    const nextDate =
      tr.recurrence === 'once'
        ? tr.occurs_on
        : nextOccurrenceAfter(tr.occurs_on, tr.recurrence, today);
    if (nextDate < todayISO || nextDate > horizonISO) continue;
    payments.push({
      date: nextDate,
      description: tr.description ?? `Overførsel til ${tr.to_account?.name ?? '?'}`,
      amount: tr.amount,
      kind: 'transfer',
    });
  }

  payments.sort((a, b) => a.date.localeCompare(b.date));
  return payments;
}

// ----------------------------------------------------------------------------
// Email template
// ----------------------------------------------------------------------------

function buildSubject(payments: UpcomingPayment[], days: number): string {
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const count = payments.length;
  return `${count} ${count === 1 ? 'betaling' : 'betalinger'} de næste ${days} dage (${formatAmount(total)} kr)`;
}

function buildTextBody(
  firstName: string,
  payments: UpcomingPayment[],
  days: number,
  appUrl: string,
  settingsUrl: string
): string {
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const lines = payments
    .map(
      (p) =>
        `  ${formatShortDateDA(p.date)}  ${p.description}  -  ${formatAmount(p.amount)} kr`
    )
    .join('\n');
  return `Hej ${firstName},

Her er de betalinger der forfalder de næste ${days} dage:

${lines}

  I alt:  ${formatAmount(total)} kr

Det dækker faste udgifter og overførsler på dine egne konti samt
husstandens fælleskonti.

Åbn FamBud: ${appUrl}

---
Du modtager denne mail fordi du har slået betalings-påmindelser til.
Slå dem fra her: ${settingsUrl}
`;
}

function buildHtmlBody(
  firstName: string,
  payments: UpcomingPayment[],
  days: number,
  appUrl: string,
  settingsUrl: string
): string {
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const rows = payments
    .map(
      (p) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0efe9;color:#737373;font-size:13px;white-space:nowrap;">${formatShortDateDA(p.date)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0efe9;color:#171717;font-size:14px;">${escapeHtml(p.description)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0efe9;color:#171717;font-size:14px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatAmount(p.amount)} kr</td>
        </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kommende betalinger</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:15px;">Hej ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#525252;">
        Her er de betalinger der forfalder de næste ${days} dage.
      </p>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
        <tr>
          <td style="padding:12px 0 0;font-size:13px;font-weight:600;color:#171717;">I alt</td>
          <td></td>
          <td style="padding:12px 0 0;font-size:14px;font-weight:600;text-align:right;color:#171717;font-variant-numeric:tabular-nums;">${formatAmount(total)} kr</td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:#737373;">
        Dækker faste udgifter og overførsler på dine egne konti samt
        husstandens fælleskonti.
      </p>
      <a href="${appUrl}" style="display:inline-block;margin-top:18px;background:#4B4D39;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:14px;font-weight:500;">Åbn FamBud</a>
    </div>
    <p style="margin:14px 0 0;text-align:center;font-size:11px;color:#a3a3a3;">
      Du modtager denne mail fordi du har slået betalings-påmindelser til.
      <a href="${settingsUrl}" style="color:#737373;">Slå dem fra</a>.
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendPaymentReminderEmail(opts: {
  to: string;
  firstName: string;
  payments: UpcomingPayment[];
  periodDays: number;
  appUrl: string;
  settingsUrl: string;
}): Promise<void> {
  const { to, firstName, payments, periodDays, appUrl, settingsUrl } = opts;
  await sendEmail({
    to,
    subject: buildSubject(payments, periodDays),
    text: buildTextBody(firstName, payments, periodDays, appUrl, settingsUrl),
    html: buildHtmlBody(firstName, payments, periodDays, appUrl, settingsUrl),
  });
}
