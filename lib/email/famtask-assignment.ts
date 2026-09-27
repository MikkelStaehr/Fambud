// Mail til den nye ansvarlige for en spark eller et projekt i Famtask
// (migration 0075). Sendes fra updateSpark/updateProject, når nogen sætter
// eller skifter "Ansvarlig". Samme opbygning som payment-reminder.ts:
// tekst- og HTML-version, og alt brugerindhold escapes.
//
// buildFamtaskAssignmentEmail er ren (ingen I/O), så den kan unit-testes.

import { monthInputValue } from '@/lib/famtask';
import { formatAmount, formatMonthYearDA } from '@/lib/format';
import { sendEmail } from './resend';

export type FamtaskAssignmentEmail = {
  // Modtagerens fornavn
  firstName: string;
  // Fornavn på den der gjorde modtageren ansvarlig
  assignerName: string;
  kind: 'spark' | 'project';
  title: string;
  purpose: string | null;
  amount: number | null; // øre
  month: string | null; // 'YYYY-MM-01'
  // Direkte link til sparken eller projektet
  url: string;
  settingsUrl: string;
};

const KIND_LABEL = { spark: 'sparken', project: 'projektet' } as const;

function details(e: FamtaskAssignmentEmail): [label: string, value: string][] {
  const rows: [string, string][] = [];
  if (e.purpose) rows.push(['Formål', e.purpose]);
  if (e.amount != null) rows.push(['Beløb', `${formatAmount(e.amount)} kr`]);
  if (e.month) rows.push(['Måned', formatMonthYearDA(monthInputValue(e.month))]);
  return rows;
}

function buildTextBody(e: FamtaskAssignmentEmail): string {
  const kind = KIND_LABEL[e.kind];
  const rows = details(e)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
  return `Hej ${e.firstName},

${e.assignerName} har gjort dig ansvarlig for ${kind} "${e.title}" i Famtask.
${rows ? `\n${rows}\n` : ''}
Åbn ${kind}: ${e.url}

---
Du modtager denne mail fordi du er blevet ansvarlig for noget i Famtask.
Slå dem fra her: ${e.settingsUrl}
`;
}

function buildHtmlBody(e: FamtaskAssignmentEmail): string {
  const kind = KIND_LABEL[e.kind];
  const rows = details(e)
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 12px 8px 0;border-bottom:1px solid #f0efe9;color:#737373;font-size:13px;vertical-align:top;white-space:nowrap;">${label}</td>
          <td style="padding:8px 0;border-bottom:1px solid #f0efe9;color:#171717;font-size:14px;">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
        </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="da">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Du er ansvarlig</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:24px;">
      <p style="margin:0 0 4px;font-size:15px;">Hej ${escapeHtml(e.firstName)},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#525252;">
        ${escapeHtml(e.assignerName)} har gjort dig ansvarlig for ${kind}
        <strong style="color:#171717;">${escapeHtml(e.title)}</strong> i Famtask.
      </p>
      ${rows ? `<table style="width:100%;border-collapse:collapse;">${rows}\n      </table>` : ''}
      <a href="${escapeHtml(e.url)}" style="display:inline-block;margin-top:18px;background:#4B4D39;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:8px;font-size:14px;font-weight:500;">Åbn ${kind}</a>
    </div>
    <p style="margin:14px 0 0;text-align:center;font-size:11px;color:#a3a3a3;">
      Du modtager denne mail fordi du er blevet ansvarlig for noget i Famtask.
      <a href="${escapeHtml(e.settingsUrl)}" style="color:#737373;">Slå dem fra</a>.
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

export function buildFamtaskAssignmentEmail(e: FamtaskAssignmentEmail): {
  subject: string;
  text: string;
  html: string;
} {
  return {
    subject: `${e.assignerName} har gjort dig ansvarlig for ${e.title}`,
    text: buildTextBody(e),
    html: buildHtmlBody(e),
  };
}

export async function sendFamtaskAssignmentEmail(
  to: string,
  e: FamtaskAssignmentEmail
): Promise<void> {
  await sendEmail({ to, ...buildFamtaskAssignmentEmail(e) });
}
