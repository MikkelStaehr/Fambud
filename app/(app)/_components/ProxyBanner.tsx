// Top-banner der vises på alle (app)-sider når en proxy-session er
// aktiv. Markerer tydeligt at handlinger gemmes på en ANDEN brugers
// vegne, så Mikkel ikke ved et uheld opretter ting på Louises konto
// uden at vide det.

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
    <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-50 px-3 py-2 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 text-sm text-amber-900 sm:flex-row sm:items-center">
        <p>
          <strong>Hjælper-tilstand:</strong> du tilføjer data for{' '}
          <strong>{name}</strong>
          {daysLeft > 0 && (
            <span className="ml-1 text-xs text-amber-700">
              ({daysLeft} {daysLeft === 1 ? 'dag' : 'dage'} tilbage)
            </span>
          )}
        </p>
        <form action={deactivateProxySession}>
          <button
            type="submit"
            className="rounded-md border border-amber-400 bg-white px-3 py-1 text-xs font-medium text-amber-900 transition hover:border-amber-500 hover:bg-amber-100"
          >
            Skift tilbage til din egen profil
          </button>
        </form>
      </div>
    </div>
  );
}
