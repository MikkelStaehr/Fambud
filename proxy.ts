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

  // Public routes - alt andet kræver auth (deny-by-default).
  // Vi whitelister eksplicit i stedet for at blackliste, så fremtidige
  // routes (fx /laan, /indkomst, /opsparinger osv.) automatisk er
  // beskyttet. Tidligere version glemte at tilføje flere af de nye
  // (app)-routes til isProtected-listen, hvilket gav et defense-in-depth
  // hul: de var kun beskyttet af layout.tsx.
  const isLandingPage = pathname === '/';
  const isAuthPage =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/glemt-kodeord';
  const isPublic =
    isLandingPage ||
    isAuthPage ||
    pathname === '/nyt-kodeord' ||
    pathname === '/privatliv' ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/auth/');

  if (!user && !isPublic) {
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
