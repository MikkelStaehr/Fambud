import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Auth callback for Supabase PKCE-flow. Brugeren lander her fra emails
// (recovery, magic link, signup confirmation) med en `code`-query-param.
// Vi bytter koden til en session og redirecter til `next` (default
// /dashboard). Bruges pt. kun af "glemt kodeord"-flowet, der peger på
// /auth/callback?next=/nyt-kodeord.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Hvis koden mangler eller er udløbet sender vi brugeren tilbage til
  // login med en venlig fejl - bedre end en hvid skærm.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Bekræftelseslinket er udløbet eller ugyldigt')}`
  );
}
