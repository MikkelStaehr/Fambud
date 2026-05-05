// Cookie-baseret state-bærer til auth-flow-trin (signup check-email, password-
// reset check-email, etc.) Tidligere brugte vi URL-params som
// '/signup?step=check-email&email=anders@...' - emailen endte i browser-
// historik, Vercel access-logs og referrer-headers. Cookie-tilgangen lukker
// den lille PII-leak og gør at refresh på siden bevarer state-screenen.
//
// Cookien er HttpOnly + 10 min maxAge. Hvis brugeren forlader siden og
// kommer tilbage senere viser vi formen igen (cookien er udløbet) - bedre
// end at vise stale state.

import { cookies } from 'next/headers';

const COOKIE_NAME = '_fambud_auth_step';
const MAX_AGE_SECONDS = 600; // 10 min

export type AuthStepState = {
  step: 'check-email';
  email: string;
};

export async function setAuthStepCookie(state: AuthStepState): Promise<void> {
  const cookieStore = await cookies();
  // Cap email-længde defensivt - emails er typisk under 100 tegn,
  // men vi vil ikke have at en stor cookie ender i et redirect-response.
  const safeEmail = state.email.slice(0, 200);
  cookieStore.set(
    COOKIE_NAME,
    JSON.stringify({ step: state.step, email: safeEmail }),
    {
      path: '/',
      maxAge: MAX_AGE_SECONDS,
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    }
  );
}

export async function readAuthStepCookie(): Promise<AuthStepState | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.step !== 'check-email' || typeof parsed?.email !== 'string') {
      return null;
    }
    return { step: 'check-email', email: parsed.email };
  } catch {
    return null;
  }
}
