// Månedlig oversigts-email: per-person beregning af "hvad sker der
// på dine konti hver måned" + HTML/text-template + sender.
//
// Konto-perspektiv-model: emailen viser brugerens egne konti (dem hvor
// accounts.owner_name matcher family_members.name). For hver:
//   Indtægt   = recurring income-transactions
//             + gennemsnit af sidste 3 primary-paychecks (recurrence='once'
//               income_role='primary') per konto - samme forecast-mønster
//               som getCashflowGraph bruger
//             + transfers IND fra konti der IKKE er personens egne
//   Udgift    = recurring expense-transactions
//             + transfers UD til konti der IKKE er personens egne
//   Overskud  = indtægt - udgift
//
// Transfers mellem personens egne konti (fx lønkonto → opsparing der
// begge er Mikkels) tæller IKKE - de er interne flytninger, ikke reelt
// indtægt eller udgift.
//
// Vi kører fra cron-context (service-role) så vi har INGEN getHouseholdContext-
// adgang. Beregningen er bevidst minimal og duplikerer noget af cashflow.ts's
// logik, men holder helt isoleret fra det auth-aware lag.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { formatAmount, monthlyEquivalent } from '@/lib/format';
import { sendEmail } from './resend';

export type MonthlySummary = {
  income: number; // øre, monthly-equivalent
  expense: number;
  net: number;
};

// Beregner personens månedlige konto-flow: hvad ind, hvad ud, hvad
// tilbage. Tager admin-klient så cron-route'n kan kalde uden
// auth-context, men kan også bruges fra auth-context (RLS dækker også).
export async function getMonthlySummaryForMember(
  adminClient: SupabaseClient<Database>,
  householdId: string,
  memberName: string
): Promise<MonthlySummary> {
  // Find personens egne ikke-arkiverede konti via owner_name-match.
  const { data: accounts, error: accountsErr } = await adminClient
    .from('accounts')
    .select('id')
    .eq('household_id', householdId)
    .eq('owner_name', memberName)
    .eq('archived', false);
  if (accountsErr) throw accountsErr;
  if (!accounts || accounts.length === 0) {
    return { income: 0, expense: 0, net: 0 };
  }

  const myAccountIds = accounts.map((a) => a.id);
  const myAccountSet = new Set(myAccountIds);

  // Tre datakilder parallelt:
  //   1. Recurring transactions på mine konti (income/expense via category)
  //   2. Primary-once paychecks - gennemsnit af de seneste 3 per konto
  //   3. Recurring transfers der rør mine konti (ind eller ud)
  type RecurringTxn = {
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
  type Paycheck = {
    account_id: string;
    amount: number;
    occurs_on: string;
  };
  type TransferRow = {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    recurrence:
      | 'once'
      | 'weekly'
      | 'monthly'
      | 'quarterly'
      | 'semiannual'
      | 'yearly';
  };

  const [txnsRes, paychecksRes, transfersRes] = await Promise.all([
    adminClient
      .from('transactions')
      .select('account_id, amount, recurrence, category:categories(kind)')
      .in('account_id', myAccountIds)
      .neq('recurrence', 'once')
      .returns<RecurringTxn[]>(),
    adminClient
      .from('transactions')
      .select('account_id, amount, occurs_on')
      .in('account_id', myAccountIds)
      .eq('recurrence', 'once')
      .eq('income_role', 'primary')
      .order('occurs_on', { ascending: false })
      .returns<Paycheck[]>(),
    // Transfers hvor MINDST én af endpoints er mine. Vi filtrerer i
    // memory (Supabase JS-clienten har ikke en let .or().in()-syntaks
    // med to lister), så vi henter alle husstandens recurring transfers
    // og filtrerer. Normalt få rækker.
    adminClient
      .from('transfers')
      .select('from_account_id, to_account_id, amount, recurrence')
      .eq('household_id', householdId)
      .neq('recurrence', 'once')
      .returns<TransferRow[]>(),
  ]);

  if (txnsRes.error) throw txnsRes.error;
  if (paychecksRes.error) throw paychecksRes.error;
  if (transfersRes.error) throw transfersRes.error;

  let income = 0;
  let expense = 0;

  // 1. Recurring transactions
  for (const txn of txnsRes.data ?? []) {
    const monthly = monthlyEquivalent(txn.amount, txn.recurrence);
    if (monthly === 0) continue;
    const kind = txn.category?.kind;
    if (kind === 'income') income += monthly;
    else if (kind === 'expense') expense += monthly;
  }

  // 2. Paychecks: gennemsnit af de seneste 3 per konto. Matcher
  //    cashflow.ts's forecast-mønster - lønudbetalinger gemmes som
  //    once-transactions med income_role='primary', og vi bruger
  //    rullende gennemsnit som månedligt income-tal.
  const paychecksByAccount = new Map<string, number[]>();
  for (const p of paychecksRes.data ?? []) {
    const arr = paychecksByAccount.get(p.account_id) ?? [];
    if (arr.length < 3) {
      arr.push(p.amount);
      paychecksByAccount.set(p.account_id, arr);
    }
  }
  for (const amounts of paychecksByAccount.values()) {
    if (amounts.length === 0) continue;
    const avg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
    income += Math.round(avg);
  }

  // 3. Transfers ind/ud af mine konti.
  //    Intern flytning (begge endpoints mine) tæller IKKE - det er bare
  //    omplacering af samme penge.
  for (const tr of transfersRes.data ?? []) {
    const fromMine = myAccountSet.has(tr.from_account_id);
    const toMine = myAccountSet.has(tr.to_account_id);
    if (fromMine && toMine) continue; // intern omplacering
    const monthly = monthlyEquivalent(tr.amount, tr.recurrence);
    if (monthly === 0) continue;
    if (fromMine) expense += monthly;
    if (toMine) income += monthly;
  }

  return { income, expense, net: income - expense };
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

  Ind på dine konti:    ${formatAmount(summary.income)} kr
  Ud fra dine konti:    ${formatAmount(summary.expense)} kr
  Tilbage hver måned:   ${formatAmount(summary.net)} kr

Tallene viser hvad der løber ind og ud af dine egne konti hver måned:
løn, recurring indtægter, overførsler til fælles/opsparing, og faste
udgifter på dine private konti.

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
                    <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;">Ind på dine konti</div>
                    <div style="margin-top:4px;font-size:24px;font-weight:600;color:#171717;font-variant-numeric:tabular-nums;">${formatAmount(summary.income)} kr</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;">
                    <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;">Ud fra dine konti</div>
                    <div style="margin-top:4px;font-size:24px;font-weight:600;color:#171717;font-variant-numeric:tabular-nums;">${formatAmount(summary.expense)} kr</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0 12px;">
                    <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;">Tilbage hver måned</div>
                    <div style="margin-top:4px;font-size:32px;font-weight:700;color:${netColor};font-variant-numeric:tabular-nums;">${formatAmount(summary.net)} kr</div>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#525252;">
                Tallene viser hvad der løber ind og ud af dine egne konti hver måned: løn, recurring indtægter, overførsler til fælles eller opsparing, og faste udgifter på dine private konti.
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
//
// isTest: når true, præfikses subject med "[TEST]" så modtageren tydeligt
// kan skelne manuelle testkald fra den planlagte månedlige send.
export async function sendMonthlySummaryEmail(input: {
  to: string;
  firstName: string;
  monthIndex0: number; // 0 = januar
  summary: MonthlySummary;
  appUrl: string;
  settingsUrl: string;
  isTest?: boolean;
}): Promise<void> {
  const baseSubject = buildSubject(input.firstName, input.monthIndex0);
  const subject = input.isTest ? `[TEST] ${baseSubject}` : baseSubject;
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
