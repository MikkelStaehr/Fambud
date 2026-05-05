// Sentry init for browser-runtime. Next.js 16+ loader denne fil før
// React-rendering (analog til instrumentation.ts på server-siden).
//
// VIGTIG: NEXT_PUBLIC_SENTRY_DSN skal være sat (samme værdi som
// SENTRY_DSN på server-siden). Uden den NEXT_PUBLIC-prefikset bliver
// DSN ikke inlinet i klient-bundle og fejl-capture virker ikke
// browser-side.
//
// PII-redaction enforced via scrubPII - se lib/sentry-scrub.ts.
import * as Sentry from '@sentry/nextjs';
import { scrubErrorEvent, scrubTransactionEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Ingen auto-PII. Sentry's BrowserClient samler ellers IP-adresse og
  // user.email hvis Sentry.setUser() er kaldt med disse felter.
  sendDefaultPii: false,

  // Performance-tracing samples. Lav rate i prod, kan løftes ved behov.
  tracesSampleRate: 0.1,

  // Session Replay er deaktiveret - det optager DOM-mutationer og kan
  // lække PII hvis brugeren har følsomme felter åbne. Aktivér kun med
  // strict masking config og separat audit.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  beforeSend: scrubErrorEvent,
  beforeSendTransaction: scrubTransactionEvent,

  debug: false,
});

// Eksporteret for Next.js 16+ router-instrumentation. Captures
// route-transitions som spans i performance-tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
