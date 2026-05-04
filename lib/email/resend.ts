// Tynd wrapper rundt om Resend's REST API. Vi bruger fetch frem for
// at installere `resend`-SDK'en så vi sparer en dep + bundle-size,
// og fordi vi kun har behov for at sende mail (ingen webhook-parsing,
// ingen audience-management).
//
// Brug:
//   await sendEmail({
//     to: 'someone@example.com',
//     subject: '...',
//     html: '...',
//   });
//
// Konfiguration via env:
//   RESEND_API_KEY              - API-nøgle fra resend.com
//   RESEND_FROM_EMAIL           - afsender, fx 'Fambud <hej@fambud.dk>'.
//                                 Skal være på et domæne du har verificeret hos Resend.

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  /** Tekst-version til klients der ikke renderer HTML. Anbefalet for deliverability. */
  text?: string;
  /** Override af default RESEND_FROM_EMAIL. Sjældent nødvendigt. */
  from?: string;
  /** Reply-To header - praktisk for feedback-mails så man kan svare direkte. */
  replyTo?: string;
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
}: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const defaultFrom = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY mangler i environment');
  }
  if (!from && !defaultFrom) {
    throw new Error('RESEND_FROM_EMAIL mangler i environment, og from-felt ikke angivet');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from ?? defaultFrom,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      reply_to: replyTo,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}
