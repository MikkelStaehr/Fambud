// Sentry init for Edge runtime (proxy.ts, edge route handlers).
// Importeret fra instrumentation.ts når NEXT_RUNTIME === 'edge'.
//
// Edge runtime er mere begrænset end Node — vi konfigurerer ens som
// server-side, men nogle Sentry-integrations no-op'er automatisk her.
import * as Sentry from '@sentry/nextjs';
import { scrubErrorEvent, scrubTransactionEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  sendDefaultPii: false,

  tracesSampleRate: 0.1,

  beforeSend: scrubErrorEvent,
  beforeSendTransaction: scrubTransactionEvent,

  debug: false,
});
