// Email-template og -sender til setup proxy-anmodninger.
// Når Mikkel anmoder om at hjælpe Louise modtager Louise denne mail.

import { sendEmail } from '@/lib/email/resend';

type ProxyRequestParams = {
  toEmail: string;
  toName: string | null;        // Louises navn (kan være null)
  fromName: string;             // Mikkels navn
  householdName: string;        // Husstandens navn
  acceptUrl: string;            // Fuld URL til /accept-proxy/[token]
  expiresAt: Date;              // Hvornår selve grant'en udløber
};

export async function sendProxyRequestEmail(params: ProxyRequestParams): Promise<void> {
  const { toEmail, toName, fromName, householdName, acceptUrl, expiresAt } = params;

  const expiryFormatted = expiresAt.toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'long',
  });

  const greeting = toName ? `Hej ${escapeHtml(toName)}` : 'Hej';
  const fromNameSafe = escapeHtml(fromName);
  const householdNameSafe = escapeHtml(householdName);
  const acceptUrlSafe = escapeHtml(acceptUrl);

  await sendEmail({
    to: toEmail,
    subject: `${fromName} vil hjælpe dig med at opsætte din Fambud`,
    html: `
<!DOCTYPE html>
<html lang="da">
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#171717;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:40px 32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:24px;font-weight:600;letter-spacing:-0.02em;color:#171717;">Fambud</p>
                <p style="margin:0 0 24px;font-size:14px;color:#737373;">Familiens fælles økonomi</p>

                <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#171717;">${greeting},</h1>

                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#404040;">
                  <strong>${fromNameSafe}</strong> har spurgt om lov til at hjælpe dig med at sætte din økonomi op i ${householdNameSafe} på Fambud.
                </p>

                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#404040;">
                  Hvis du siger ja, kan ${fromNameSafe} <strong>se og redigere</strong> din økonomi på dine vegne:
                </p>

                <ul style="margin:0 0 20px 20px;padding:0;font-size:14px;line-height:1.7;color:#404040;">
                  <li>Se dine konti, transaktioner, lønudbetalinger og opsparingsmål</li>
                  <li>Tilføje nye konti, lønudbetalinger og faste udgifter</li>
                  <li>Oprette og redigere overførsler mellem dine konti</li>
                  <li>Opdatere dine økonomiplaner og opsparingsmål</li>
                </ul>

                <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#525252;background:#fef3c7;border-left:3px solid #d97706;padding:12px 16px;border-radius:4px;">
                  <strong>Vigtigt:</strong> ${fromNameSafe} f&aring;r samme adgang til din &oslash;konomi som dig selv s&aring;l&aelig;nge adgangen er aktiv. Hver handling logges med hvem der har gjort hvad. Adgangen udl&oslash;ber automatisk den ${expiryFormatted}, og du kan til enhver tid tr&aelig;kke den tilbage i Indstillinger.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="background:#065f46;border-radius:6px;">
                      <a href="${acceptUrlSafe}"
                         style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
                        Se og bekræft anmodningen
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 8px;font-size:13px;color:#737373;">
                  Virker knappen ikke? Kopier dette link til din browser:
                </p>
                <p style="margin:0 0 24px;font-size:12px;color:#525252;word-break:break-all;">
                  <a href="${acceptUrlSafe}" style="color:#065f46;">${acceptUrlSafe}</a>
                </p>

                <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;">

                <p style="margin:0;font-size:12px;line-height:1.5;color:#a3a3a3;">
                  Har du ikke kendskab til Fambud eller stoler du ikke på denne anmodning? Så ignorér mailen. ${fromNameSafe} får ikke besked om at du har set den, og der sker ikke noget.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `,
    text: [
      `${greeting},`,
      ``,
      `${fromName} har spurgt om lov til at hjælpe dig med at sætte din økonomi op i ${householdName} på Fambud.`,
      ``,
      `Hvis du siger ja, kan ${fromName} SE OG REDIGERE din økonomi på dine vegne:`,
      `- Se dine konti, transaktioner, lønudbetalinger og opsparingsmål`,
      `- Tilføje nye konti, lønudbetalinger og faste udgifter`,
      `- Oprette og redigere overførsler mellem dine konti`,
      `- Opdatere dine økonomiplaner og opsparingsmål`,
      ``,
      `Vigtigt: ${fromName} får samme adgang til din økonomi som dig selv sålænge adgangen er aktiv. Hver handling logges med hvem der har gjort hvad. Adgangen udløber automatisk den ${expiryFormatted}, og du kan til enhver tid trække den tilbage i Indstillinger.`,
      ``,
      `Se og bekræft anmodningen her:`,
      acceptUrl,
      ``,
      `Har du ikke kendskab til Fambud eller stoler du ikke på denne anmodning? Så ignorér mailen.`,
    ].join('\n'),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
