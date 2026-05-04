import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_ONLY_COOKIE,
  stripPersistenceIfSessionOnly,
} from '@/lib/supabase/session-flag';

// Next.js 16 renamed middleware.ts → proxy.ts. Same lifecycle: this runs on
// every matched request, refreshes the Supabase session cookie, and gates
// access to authenticated routes.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const sessionOnly = request.cookies.get(SESSION_ONLY_COOKIE)?.value === '1';

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          const adjusted = stripPersistenceIfSessionOnly(cookiesToSet, sessionOnly);
          adjusted.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          adjusted.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // Auth-sider redirecter loggede brugere videre til /dashboard - de
  // har ingen grund til at se login/signup/glemt-kodeord når de
  // allerede er på.
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/glemt-kodeord';
  // Root '/' er nu landing page - offentlig. Selve page-komponenten
  // bouncer loggede brugere videre til /dashboard, så vi behøver ikke
  // gate'e den her.
  // /nyt-kodeord og /auth/callback er bevidst hverken auth- eller
  // protected: recovery-flowet skal kunne lande dér med en frisk
  // session uden bounce.
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/konti') ||
    pathname.startsWith('/poster') ||
    pathname.startsWith('/overforsler') ||
    pathname.startsWith('/indstillinger') ||
    pathname.startsWith('/wizard');

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
