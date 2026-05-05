// Service-role Supabase-klient til server-side admin-operationer hvor
// almindelig RLS ikke rækker - fx at slette en auth.users-række.
//
// VIGTIGT: Denne klient omgår RLS og må ALDRIG eksponeres til klienten
// eller bruges med data der kommer direkte fra brugeren uden validering.
// Brug kun fra 'use server'-actions efter du har verificeret authn'ed
// brugerens identitet med createClient (almindelig anon-klient).
//
// Krav: SUPABASE_SERVICE_ROLE_KEY skal være sat i miljøet (Vercel/local).
// Kasterne hvis nøglen mangler så vi ikke fejler stille i produktion.

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  if (!serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY not set - admin operations unavailable'
    );
  }
  return createClient<Database>(url, serviceKey, {
    auth: {
      // Service-role-klienten har ingen session - vi må ikke persistere
      // eller auto-refreshe noget.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
