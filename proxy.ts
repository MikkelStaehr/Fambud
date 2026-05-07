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
  // Eksklusioner: statiske assets + offentlige well-known-filer der skal
  // serveres direkte uden proxy-logik. Tidligere fangede proxy'en
  // /robots.txt og redirectede til /login, så crawlers fik HTML i stedet
  // for tekst-direktiverne. /.well-known/ holdes også fri så vi senere
  // kan placere security.txt, change-password etc. der.
  //
  // /monitoring er Sentry's tunnel-route (sat i next.config.ts via
  // withSentryConfig.tunnelRoute). Browseren POST'er Sentry-events
  // dertil, og en Route Handler forwarder til sentry.io. Uden eksplicit
  // eksklusion ville proxy'en redirecte uautentificerede tunnel-requests
  // til /login, hvilket dropper alle client-side Sentry-events fra
  // udloggede brugere (inkl. landing-page, signup, glemt-kodeord -
  // præcis dér hvor vi mest gerne vil fange fejl).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|monitoring|\\.well-known).*)',
  ],
};
