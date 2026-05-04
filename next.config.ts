import type { NextConfig } from 'next';

// Sikkerhedshovedlinjer der sættes på alle responses. Vercel sætter
// allerede HSTS automatisk, så det er ikke i listen her.
//
// CSP er bevidst restriktiv:
// - script-src 'self' 'unsafe-inline' fordi Next.js inliner små
//   inline-scripts til hydration. Vi kan stramme til 'self' + nonce
//   senere hvis vi sætter en nonce-strategi op
// - connect-src tillader Supabase + DAWA (autocomplete) - alle
//   eksterne API'er vi kalder fra klienten
// - frame-ancestors 'none' = clickjacking-beskyttelse (matchende
//   X-Frame-Options: DENY for ældre browsere)
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
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
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
