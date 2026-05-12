// Månedlig oversigts-email: per-person beregning af indtægt/udgift/
// overskud + HTML/text-template + sender.
//
// Vi kører fra cron-context (service-role) så vi har INGEN getHouseholdContext-
// adgang. Beregningen er bevidst minimal og duplikerer en lille smule af
// cashflow.ts's logik, men holder helt isoleret fra det auth-aware lag.
//
// Per-person attribution-model:
//   1. Konti hvor accounts.owner_name = personens navn → "private"
//   2. Konti hvor accounts.owner_name = 'Fælles' → fælles, deles på
//      antal bidragsydere (familiemembers med user_id eller email)
//   3. Andre persons private konti ignoreres
//
// Beløb er monthly-equivalent (ikke historiske actuals). Det matcher
// dashboard-modellen og gør at tallet er meningsfuldt uanset hvornår i
// måneden emailen sendes.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { formatAmount, monthlyEquivalent } from '@/lib/format';
import { sendEmail } from './resend';

export type MonthlySummary = {
  income: number; // øre, monthly-equivalent
  expense: number;
  net: number;
};

// Computes en persons månedlige run-rate baseret på household-data.
// Tager admin-klient så cron-route'n kan kalde uden auth-context.
export async function getMonthlySummaryForMember(
  adminClient: SupabaseClient<Database>,
  householdId: string,
  memberName: string,
  numContributors: number
): Promise<MonthlySummary> {
  // Hent alle ikke-arkiverede konti og partition dem efter ejer.
  const { data: accounts, error: accountsErr } = await adminClient
    .from('accounts')
    .select('id, owner_name')
    .eq('household_id', householdId)
    .eq('archived', false);
  if (accountsErr) throw accountsErr;
  if (!accounts || accounts.length === 0) {
    return { income: 0, expense: 0, net: 0 };
  }

  const personalIds = new Set<string>();
  const sharedIds = new Set<string>();
  for (const acc of accounts) {
    if (acc.owner_name === memberName) {
      personalIds.add(acc.id);
    } else if (acc.owner_name === 'Fælles') {
      sharedIds.add(acc.id);
    }
  }

  const relevantIds = [...personalIds, ...sharedIds];
  if (relevantIds.length === 0) {
    return { income: 0, expense: 0, net: 0 };
  }

  // Recurring transaktioner: brug monthlyEquivalent. Vi inkluderer alle
  // recurrences (også 'once') men for 'once' bidrager monthlyEquivalent
  // = 0, så de tæller ikke - acceptable simplificering for V1.
  //
  // .returns<>() overskriver Supabase's auto-inferens af join-typen
  // (der i hand-written database.types.ts ikke har en relation declared
  // mellem transactions og categories). Samme mønster som cashflow.ts.
  type TxnRow = {
    account_id: string;
    amount: number;
    recurrence:
      | 'once'
      | 'weekly'
      | 'monthly'
      | 'quarterly'
      | 'semiannual'
      | 'yearly';
    category: { kind: 'income' | 'expense' } | null;
  };

  const { data: txns, error: txnsErr } = await adminClient
    .from('transactions')
    .select('account_id, amount, recurrence, category:categories(kind)')
    .in('account_id', relevantIds)
    .returns<TxnRow[]>();
  if (txnsErr) throw txnsErr;

  let personalIncome = 0;
  let personalExpense = 0;
  let sharedIncome = 0;
  let sharedExpense = 0;

  for (const txn of txns ?? []) {
    const monthly = monthlyEquivalent(txn.amount, txn.recurrence);
    if (monthly === 0) continue;
    const kind = txn.category?.kind;
    if (!kind) continue;
    const isPersonal = personalIds.has(txn.account_id);
    if (kind === 'income') {
      if (isPersonal) personalIncome += monthly;
      else sharedIncome += monthly;
    } else {
      if (isPersonal) personalExpense += monthly;
      else sharedExpense += monthly;
    }
  }

  const safeContributors = Math.max(1, numContributors);
  const income =
    personalIncome + Math.round(sharedIncome / safeContributors);
  const expense =
    personalExpense + Math.round(sharedExpense / safeContributors);

  return { income, expense, net: income - expense };
}

// Antal bidragsydere i husstanden - matcher CashflowAdvisor's logik
// fra getAdvisorContext: tæller members med user_id eller email.
// Børn (begge null) tæller ikke. Min 1.
export async function getNumContributors(
  adminClient: SupabaseClient<Database>,
  householdId: string
): Promise<number> {
  const { data: members, error } = await adminClient
    .from('family_members')
    .select('user_id, email')
    .eq('household_id', householdId);
  if (error) throw error;
  const contributors = (members ?? []).filter(
    (m) => m.user_id !== null || m.email !== null
  );
  return Math.max(1, contributors.length);
}

// ----------------------------------------------------------------------------
// Email template
// ----------------------------------------------------------------------------

const MONTHS_DA = [
  'januar',
  'februar',
  'marts',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'december',
];

function monthNameDA(monthIndex0: number): string {
  return MONTHS_DA[monthIndex0] ?? '';
}

function buildSubject(firstName: string, monthIndex0: number): string {
  const month = monthNameDA(monthIndex0);
  return `Din ${month}-oversigt, ${firstName}`;
}

function buildTextBody(
  firstName: string,
  monthIndex0: number,
  summary: MonthlySummary,
  appUrl: string,
  settingsUrl: string
): string {
  const month = monthNameDA(monthIndex0);
  return `Hej ${firstName},

Her er din kortfattede oversigt for ${month}:

  Indtægt:   ${formatAmount(summary.income)} kr
  Udgift:    ${formatAmount(summary.expense)} kr
  Overskud:  ${formatAmount(summary.net)} kr

Tallene er din egen månedlige run-rate (private konti + din andel af fælles).

Åbn FamBud for det fulde overblik: ${appUrl}

---
Du modtager denne mail fordi du har slået månedlige oversigter til.
Slå dem fra her: ${settingsUrl}
`;
}

function buildHtmlBody(
  firstName: string,
  monthIndex0: number,
  summary: MonthlySummary,
  appUrl: string,
  settingsUrl: string
): string {
  const month = monthNameDA(monthIndex0);
  const netColor = summary.net >= 0 ? '#047857' : '#b91c1c'; // emerald-700 / red-700
  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${month}-oversigt</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f5f5f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#ffffff;border:1px solid #e7e5e4;border-radius:8px;overflow:hidden;">

          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #e7e5e4;background-color:#fafaf9;">
              <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#737373;">FamBud</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2;color:#171717;">Hej ${escapeHtml(firstName)}, her er din ${escapeHtml(month)}-oversigt</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;">
                    <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;">Indtægt</div>
                    <div style="margin-top:4px;font-size:24px;font-weight:600;color:#171717;font-variant-numeric:tabular-nums;">${formatAmount(summary.income)} kr</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;">
                    <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;">Udgift</div>
                    <div style="margin-top:4px;font-size:24px;font-weight:600;color:#171717;font-variant-numeric:tabular-nums;">${formatAmount(summary.expense)} kr</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0 12px;">
                    <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;">Overskud</div>
                    <div style="margin-top:4px;font-size:32px;font-weight:700;color:${netColor};font-variant-numeric:tabular-nums;">${formatAmount(summary.net)} kr</div>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#525252;">
                Tallene er din egen månedlige run-rate, beregnet ud fra dine private konti og din andel af jeres fælles økonomi.
              </p>

              <div style="margin-top:28px;text-align:center;">
                <a href="${escapeAttr(appUrl)}" style="display:inline-block;background-color:#065f46;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:6px;">Åbn FamBud</a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px 24px;background-color:#fafaf9;border-top:1px solid #e7e5e4;">
              <p style="margin:0;font-size:11px;line-height:1.5;color:#737373;">
                Du modtager denne mail fordi du har slået månedlige oversigter til.
                <a href="${escapeAttr(settingsUrl)}" style="color:#525252;text-decoration:underline;">Slå dem fra her</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// Send-funktion. Kaster hvis Resend fejler - cron-routen logger og
// fortsætter med næste bruger.
export async function sendMonthlySummaryEmail(input: {
  to: string;
  firstName: string;
  monthIndex0: number; // 0 = januar
  summary: MonthlySummary;
  appUrl: string;
  settingsUrl: string;
}): Promise<void> {
  const subject = buildSubject(input.firstName, input.monthIndex0);
  const html = buildHtmlBody(
    input.firstName,
    input.monthIndex0,
    input.summary,
    input.appUrl,
    input.settingsUrl
  );
  const text = buildTextBody(
    input.firstName,
    input.monthIndex0,
    input.summary,
    input.appUrl,
    input.settingsUrl
  );

  await sendEmail({
    to: input.to,
    subject,
    html,
    text,
  });
}
