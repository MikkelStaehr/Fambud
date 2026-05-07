import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

// Sikkerhedshovedlinjer der sættes på alle responses.
//
// HSTS: Vercel sætter selv max-age=63072000 som default, men vi overrider
// her for at tilføje includeSubDomains. 'preload' er bevidst IKKE med
// endnu - det kræver eksplicit submission til hstspreload.org og er
// nær-irreversibelt. Først efter en uges varmeperiode med
// includeSubDomains uden subdomæne-issues bør 'preload' tilføjes og
// submitted manuelt.
//
// CSP er bevidst restriktiv:
// - script-src 'self' 'unsafe-inline' fordi Next.js inliner små
//   inline-scripts til hydration. Accepteret risiko (se SECURITY_AUDITS.md);
//   kan strammes til nonce-baseret CSP senere
// - connect-src tillader Supabase + DAWA (autocomplete) + Resend - alle
//   eksterne API'er vi kalder fra klienten
// - frame-ancestors 'none' = clickjacking-beskyttelse (matchende
//   X-Frame-Options: DENY for ældre browsere)
// - object-src 'none' blokerer Flash/legacy-plugin-embeds (XSS-vektor)
// - upgrade-insecure-requests forcerer HTTPS på alle subresources
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // Vi tillader kun billeder fra self + data: + Supabase Storage.
      // 'https:' var for bredt - en eventuel XSS kunne exfiltrere data
      // via new Image().src med en attacker-host.
      "img-src 'self' data: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.dataforsyningen.dk https://api.resend.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Skjul X-Powered-By: Next.js header. Lille info-disclosure der ikke
  // hjælper legitime brugere - kun angribere der scanner for stack-
  // specifikke CVEs.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

// Wrap med Sentry's build-tid plugin. Uploader source maps til
// Sentry når SENTRY_AUTH_TOKEN er sat (kun i Vercel build), så stack
// traces er læselige uden at maps skal hostes offentligt.
//
// sourcemaps.deleteSourcemapsAfterUpload: true holder maps væk fra
// produktions-bundle - Sentry bruger dem stadig server-side til mapping
// efter upload, men de serves ikke til browseren.
//
// silent: !CI = stille i lokal dev, fuld logging i CI-build.
//
// Bemærk: disableLogger er fravalgt - den er deprecated i v10 og
// ikke understøttet under Turbopack (Next.js 16's default-bundler).
// Sentry's egen runtime-logger er allerede tavs i prod via debug:false
// i hver runtime-config.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  // Tunnel Sentry-events gennem en intern route så ad-blockers og
  // strict CSP-policies ikke blokerer events. Default-CSP'en i denne
  // fil tillader ikke connect-src til Sentry-domæner direkte; tunnel
  // gør det unødvendigt.
  tunnelRoute: '/monitoring',
});
