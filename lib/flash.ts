// Cookie-baseret flash-toast. Server-actions sætter en kort-levende cookie
// før redirect; <Toast /> i layoutet læser den, viser toasten og rydder
// cookien igen.
//
// Tidligere brugte vi URL-params (?notice=...), men det åbnede en lille
// phishing-vektor: en angriber kunne sende et offer en crafted URL som
// fx /dashboard?notice=Din+konto+er+suspenderet&kind=error og vise en
// falsk besked. URL'er er kontrollérbare af alle, cookies er ikke.
//
// Cookien er bevidst NOT HttpOnly så client-component'en (Toast) kan
// læse og rydde den. Trusselsmodel-mæssigt er det ok: vi har CSP der
// blokerer XSS, og en angriber kan ikke sætte cookies på vores domæne
// uden enten XSS eller subdomain-kontrol (begge dele har vi ikke).
//
// Brug:
//   await setFlashCookie('Konto gemt');
//   redirect('/konti');

import { cookies } from 'next/headers';

const COOKIE_NAME = '_fambud_flash';
const MAX_AGE_SECONDS = 60;

type Kind = 'success' | 'error' | 'info';

export async function setFlashCookie(
  message: string,
  kind: Kind = 'success'
): Promise<void> {
  const cookieStore = await cookies();
  // Cap message-længden for at undgå at en angiver-template-injection
  // (hvis der nogensinde sker en) kan poison'e cookien med kæmpe payload.
  const safeMessage = message.slice(0, 200);
  const value = JSON.stringify({ k: kind, m: safeMessage });
  cookieStore.set(COOKIE_NAME, value, {
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: false,
  });
}

// Backward-compat shim. Tidligere callere brugte:
//   redirect(noticeUrl('/konti', 'Konto gemt'));
// Den nye pattern er:
//   await setFlashCookie('Konto gemt');
//   redirect('/konti');
// Indtil alle callere er migreret accepterer vi stadig noticeUrl-form'en.
// @deprecated brug setFlashCookie + plain redirect i stedet.
export function noticeUrl(path: string, _message: string, _kind?: Kind): string {
  // Returnerer bare path uden notice-params. Caller skal selv have kaldt
  // setFlashCookie først.
  return path;
}
