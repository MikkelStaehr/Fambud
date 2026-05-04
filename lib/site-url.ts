// Resolverer den kanoniske origin (https://fambud.dk) til brug i
// auth-mails og redirect-URL'er. Læser SITE_URL env-var som primær
// kilde - faldback til VERCEL_URL (fra preview-deploys) og endelig
// til request-Host som sidste udvej.
//
// Vi undgår bevidst Host-headeren som primær kilde fordi den kan
// spoofes via reverse-proxy-misconfiguration. Når SITE_URL er sat
// (via Vercel env vars) bruges en hardcoded værdi der ikke kan
// manipuleres af klienten.

import { headers } from 'next/headers';

export async function resolveSiteOrigin(): Promise<string> {
  // 1. Foretrukket: hardcoded i env (sat på Vercel som SITE_URL)
  const envSiteUrl = process.env.SITE_URL;
  if (envSiteUrl) {
    return envSiteUrl.replace(/\/$/, '');
  }

  // 2. Vercel preview-deploys får automatisk VERCEL_URL (uden protokol)
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }

  // 3. Sidste udvej: request-headers. Bruges kun til lokal dev.
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}
