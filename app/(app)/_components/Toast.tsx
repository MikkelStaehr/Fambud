// Lille toast-mekanisme der hænger på URL'ens search-params. Server-actions
// redirecter med ?notice=Gemt&kind=success efter en succesful create/update;
// denne komponent læser dem, viser toasten i 3s, og rydder så URL'en igen
// så toasten ikke vender tilbage hvis brugeren refresher.
//
// Vi har bevidst valgt search-param frem for cookie-flash:
//   - Server components kan ikke nemt slette cookies efter læsning
//     (kan kun læse i RSC, kan kun mutere i actions/middleware)
//   - URL-tilstand er debug-bar og forudsigelig
//   - router.replace med scroll: false giver ren cleanup uden at skubbe
//     en ny history-entry
//
// Toasten er placed i <AppLayout> så den vises på enhver (app)-side uden
// at hver page selv skal mounte den.

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

export function Toast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const notice = params.get('notice');
  const kindParam = params.get('kind');
  const kind: ToastKind =
    kindParam === 'error' || kindParam === 'info' ? kindParam : 'success';

  useEffect(() => {
    if (!notice) return;

    const timer = setTimeout(() => {
      // Ryd notice + kind fra URL'en uden at skubbe history. Andre query-
      // params (fx /poster?month=2026-04) bevares.
      const next = new URLSearchParams(params.toString());
      next.delete('notice');
      next.delete('kind');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, TOAST_DURATION_MS);

    return () => clearTimeout(timer);
  }, [notice, params, pathname, router]);

  if (!notice) return null;

  const { wrapper, icon: Icon } = KIND_STYLES[kind];
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
        <span>{notice}</span>
      </div>
    </div>
  );
}
