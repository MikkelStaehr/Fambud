// Next.js instrumentation hook - kaldes én gang ved server-startup.
// Vi bruger den til at initialisere Sentry på server- og edge-runtime.
// Klient-side init sker i instrumentation-client.ts.
//
// Re-eksport af onRequestError er Sentry's anbefalede måde at fange
// fejl i Server Components, Route Handlers og Server Actions hvor
// Next.js kalder hooket.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export { captureRequestError as onRequestError } from '@sentry/nextjs';
