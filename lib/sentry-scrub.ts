// Centralised PII-scrubbing for Sentry events. Importeret af alle tre
// runtime-configs (sentry.server.config.ts, sentry.edge.config.ts,
// instrumentation-client.ts) så vi har én sandhed for hvad der må forlade
// FamBud's egen kode på vej til Sentry's servere.
//
// Vi er en finansiel app der håndterer husholdningsøkonomi. Sentry-events
// MÅ IKKE indeholde email, kodeord, cookies, query-params eller auth-tokens.
//
// Sammenhæng: Prompt 10 GDPR-audit (SECURITY_AUDITS.md). Ledger Art. 6(1)(f)
// (legitime interesser - drift og sikkerhed) for fejl-logs forudsætter at
// PII er strippet først.
import type { ErrorEvent, Event, EventHint } from '@sentry/nextjs';
// TransactionEvent re-eksporteres ikke fra @sentry/nextjs i v10, men er
// tilgængelig fra core-pakken (transitiv dependency via @sentry/nextjs).
import type { TransactionEvent } from '@sentry/core';

export function scrubPII<T extends Event>(event: T): T {
  if (event.request) {
    // Request body kan indeholde form-data fra signup (email, kodeord),
    // submission-felter, session-tokens. Strip altid.
    delete event.request.data;
    delete event.request.cookies;

    if (event.request.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['Authorization'];
      delete event.request.headers['Cookie'];
    }

    // Query-string kan indeholde email (fx ?error=Indtast%20email...) eller
    // andre URL-params med PII. Erstat wholesale - vi har sjældent brug for
    // den til debugging og kan altid gentænke valgt format senere.
    if (event.request.query_string) {
      event.request.query_string = '[redacted]';
    }
  }

  // User-objekt: behold kun opake user.id (UUID) til korrelation. Email,
  // brugernavn, IP er PII der ikke skal forlade os.
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }

  return event;
}

// Type-narrowed wrappers så Sentry-init kan bruge dem direkte uden cast.
// beforeSend modtager ErrorEvent; beforeSendTransaction modtager
// TransactionEvent. Begge går gennem samme scrubPII via generic.
export function scrubErrorEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  return scrubPII(event);
}

export function scrubTransactionEvent(event: TransactionEvent, _hint: EventHint): TransactionEvent | null {
  return scrubPII(event);
}
