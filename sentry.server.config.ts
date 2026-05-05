// Sentry init for Node.js runtime (Server Actions, Route Handlers, RSC).
// Importeret fra instrumentation.ts når NEXT_RUNTIME === 'nodejs'.
//
// PII-redaction sker i scrubPII (lib/sentry-scrub.ts) - se den for detaljer.
// sendDefaultPii: false er eksplicit sat så Sentry ikke auto-collecter
// IP-adresser, headers eller request-body fra default-integrations.
import * as Sentry from '@sentry/nextjs';
import { scrubErrorEvent, scrubTransactionEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Ingen auto-PII. Vi tilføjer eksplicit user.id i Server Actions hvis
  // relevant, men aldrig email/IP/headers.
  sendDefaultPii: false,

  // Performance-tracing samples - lav rate fordi det er noisy. Errors
  // capture'es alligevel uafhængigt af denne sample-rate.
  tracesSampleRate: 0.1,

  // PII-redaction enforced på alle events der forlader appen.
  beforeSend: scrubErrorEvent,
  beforeSendTransaction: scrubTransactionEvent,

  // Slå Sentry's egen konsol-spam fra i prod. Build-output er allerede
  // via withSentryConfig(silent: !CI).
  debug: false,
});
