import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const LANDING_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Auth callback for Supabase PKCE-flow. Brugeren lander her fra emails
// (recovery, magic link, signup confirmation) med en `code`-query-param.
// Vi bytter koden til en session og redirecter til `next` (default
// /dashboard). Bruges pt. kun af "glemt kodeord"-flowet, der peger på
// /auth/callback?next=/nyt-kodeord.
// Validér at `next` er en same-origin relativ path. Uden dette tjek kan
// en angriber sende `?next=//evil.com` eller `?next=@evil.com/login` -
// browseren parser `https://fambud.dk@evil.com/login` som host=evil.com
// og redirecter væk fra Fambud-domænet. Hvert recovery/confirm-link i
// vores mails ville så være phishbart.
function safeNextPath(raw: string | null): string {
  if (!raw) return '/dashboard';
  // Skal starte med præcis ét '/' (afviser '//x', '/\x' og '/@x' der i
  // praksis bliver til protocol-relative eller userinfo-tricks).
  if (
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.startsWith('/\\') ||
    raw.startsWith('/@')
  ) {
    return '/dashboard';
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Conversion-tracking: hvis brugeren havde en landing-flow-token
      // fra "Find ud af det selv"-flowet, blev den lagret i raw_user_
      // meta_data under signup. Læs den nu (auth.uid() er sat efter
      // exchange) og link den anonyme submission til denne bruger.
      // Fail-silent: linket er ikke blokerende.
      try {
        const { data: userData } = await supabase.auth.getUser();
        const token = userData?.user?.user_metadata?.landing_flow_token;
        if (typeof token === 'string' && LANDING_TOKEN_PATTERN.test(token)) {
          const { error: linkErr } = await supabase.rpc(
            'link_landing_submission',
            { p_token: token }
          );
          if (linkErr) {
            console.error('link_landing_submission failed:', linkErr.message);
          }
        }
      } catch (err) {
        console.error('landing-flow link unexpected error:', err);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Hvis koden mangler eller er udløbet sender vi brugeren tilbage til
  // login med en venlig fejl - bedre end en hvid skærm.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Bekræftelseslinket er udløbet eller ugyldigt')}`
  );
}
