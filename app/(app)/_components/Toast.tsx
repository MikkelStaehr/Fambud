// Cookie-baseret flash-toast. Server-actions sætter '_fambud_flash'-cookien
// via setFlashCookie() før redirect; vi læser cookien her, viser toasten
// i 3s og rydder så cookien.
//
// Tidligere læste vi notice/kind fra URL-params, men det gav en
// phishing-vektor (angriber kunne crafte URL der viste falske beskeder).
// Cookies kan kun sættes af samme origin, så de er trusted.
//
// Toasten er placed i <AppLayout> så den vises på enhver (app)-side uden
// at hver page selv skal mounte den.

'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

const KIND_STYLES: Record<ToastKind, { wrapper: string; icon: typeof CheckCircle2 }> = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: CheckCircle2,
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-900',
    icon: AlertCircle,
  },
  info: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: Info,
  },
};

const TOAST_DURATION_MS = 3000;
const COOKIE_NAME = '_fambud_flash';

type FlashContent = { kind: ToastKind; message: string };

function readAndClearFlashCookie(): FlashContent | null {
  if (typeof document === 'undefined') return null;
  const all = document.cookie.split('; ');
  const raw = all.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;

  // Ryd cookien straks. Selv hvis parsing fejler under skal vi ikke
  // vise samme stale toast på næste navigation.
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;

  const value = raw.substring(COOKIE_NAME.length + 1);
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (typeof parsed?.m !== 'string') return null;
    const kind: ToastKind =
      parsed.k === 'error' || parsed.k === 'info' ? parsed.k : 'success';
    return { kind, message: parsed.m };
  } catch {
    return null;
  }
}

export function Toast() {
  const [flash, setFlash] = useState<FlashContent | null>(null);

  // Læs cookie ved mount. Server actions kan have sat den lige før
  // redirect; vi konsumerer den hér og rydder URL-state ikke længere
  // er nødvendigt.
  useEffect(() => {
    const found = readAndClearFlashCookie();
    if (found) setFlash(found);
  }, []);

  // Auto-skjul efter TOAST_DURATION_MS.
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  if (!flash) return null;

  const { wrapper, icon: Icon } = KIND_STYLES[flash.kind];
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4"
    >
      <div
        className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-md border px-4 py-2.5 text-sm shadow-lg ${wrapper}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{flash.message}</span>
      </div>
    </div>
  );
}
