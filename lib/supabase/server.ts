import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SESSION_ONLY_COOKIE, stripPersistenceIfSessionOnly } from './session-flag';
import type { Database } from '@/lib/database.types';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Inside Server Components Next forbids cookie writes. We swallow
          // the error - the proxy refreshes session cookies on every request,
          // so missed writes here are recovered on the next round-trip.
          try {
            const sessionOnly = cookieStore.get(SESSION_ONLY_COOKIE)?.value === '1';
            const adjusted = stripPersistenceIfSessionOnly(cookiesToSet, sessionOnly);
            adjusted.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
