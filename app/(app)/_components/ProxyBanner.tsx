// Top-banner der vises på alle (app)-sider når en proxy-session er aktiv.
// I v1.5 er banneret kraftigere og siger eksplicit "ser og redigerer som
// [Name]" - tidligere "Hjælper-tilstand" undervurderede konsekvensen.
// Sammen med 4px orange venstrekant på app-shellen (layout.tsx) er det
// umuligt at glemme at man kigger som anden bruger.

import { Eye } from 'lucide-react';
import { deactivateProxySession } from '../indstillinger/proxy-actions';

type Props = {
  grantorName: string | null;
  expiresAt: string;
};

export function ProxyBanner({ grantorName, expiresAt }: Props) {
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const name = grantorName ?? 'et familiemedlem';

  return (
    <div className="sticky top-0 z-40 border-b-2 border-orange-500 bg-gradient-to-r from-orange-50 via-orange-100 to-orange-50 px-3 py-2.5 shadow-sm sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 text-sm text-orange-950 sm:flex-row sm:items-center">
        <p className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            <Eye className="h-3 w-3" />
            Ser som
          </span>
          <span>
            Du ser og redigerer som <strong>{name}</strong>. Handlinger gemmes p&aring; hendes konto.
            {daysLeft > 0 && (
              <span className="ml-1 text-xs text-orange-700">
                ({daysLeft} {daysLeft === 1 ? 'dag' : 'dage'} tilbage)
              </span>
            )}
          </span>
        </p>
        <form action={deactivateProxySession}>
          <button
            type="submit"
            className="rounded-md border border-orange-500 bg-white px-3 py-1 text-xs font-medium text-orange-900 transition hover:border-orange-600 hover:bg-orange-50"
          >
            Skift tilbage til din egen profil
          </button>
        </form>
      </div>
    </div>
  );
}
