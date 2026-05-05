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

  // SECURITY: Strip CRLF fra alle felter der kunne misbruges til
  // header-injection. JSON-API'et beskytter normalt mod det, men hvis
  // env-vars er forkert sat eller fremtidige callers passer rå
  // brugerinput, er det defense-in-depth.
  const stripCRLF = (s: string) => s.replace(/[\r\n]/g, '');
  const safeFrom = stripCRLF(from ?? defaultFrom!);
  const safeSubject = stripCRLF(subject);
  const safeReplyTo = replyTo ? stripCRLF(replyTo) : undefined;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: safeFrom,
      to: Array.isArray(to) ? to : [to],
      subject: safeSubject,
      html,
      text,
      reply_to: safeReplyTo,
    }),
  });

  if (!res.ok) {
    // Body kan indeholde Resend's interne debug-data (request-id, og
    // hvis fremtidige caller har sendt user-input som mistakenly leaked).
    // Vi logger body til server-side logs men kaster en simpel besked
    // til caller, så fejlen ikke utilsigtet propagerer ind i en URL
    // eller UI-toast.
    const body = await res.text().catch(() => '');
    console.error(`Resend API error: status=${res.status} body=${body}`);
    throw new Error(`Resend ${res.status}`);
  }
}
