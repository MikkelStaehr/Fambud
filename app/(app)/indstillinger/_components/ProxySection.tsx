// Server-rendered sektion til /indstillinger der viser proxy-grants (begge
// retninger) og giver Mikkel mulighed for at anmode om nye eller skifte til
// en aktiv proxy-session.

import { createClient } from '@/lib/supabase/server';
import { getActiveProxyContext } from '@/lib/proxy';
import {
  requestSetupProxy,
  activateProxySession,
  revokeSetupProxy,
} from '../proxy-actions';
import { SubmitButton } from '@/app/_components/SubmitButton';

type ProxyGrant = {
  id: string;
  grantor_user_id: string;
  grantee_user_id: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  grantorName?: string;
  granteeName?: string;
};

type FamilyMember = {
  id: string;
  name: string;
  email: string | null;
  user_id: string | null;
};

export async function ProxySection() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Hent alle aktive (ikke-udløbet, ikke-revoked) grants hvor caller er
  // enten grantor eller grantee. Plus pending requests caller har sendt.
  const { data: grantsRaw } = await supabase
    .from('setup_proxy_grants')
    .select('id, grantor_user_id, grantee_user_id, expires_at, accepted_at, revoked_at, created_at')
    .or(`grantor_user_id.eq.${user.id},grantee_user_id.eq.${user.id}`)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  const grants: ProxyGrant[] = (grantsRaw ?? []) as ProxyGrant[];

  // Hent navne på alle unikke users involveret
  const userIds = new Set<string>();
  for (const g of grants) {
    userIds.add(g.grantor_user_id);
    userIds.add(g.grantee_user_id);
  }
  if (userIds.size > 0) {
    const { data: members } = await supabase
      .from('family_members')
      .select('user_id, name')
      .in('user_id', Array.from(userIds));
    const nameByUserId = new Map<string, string>();
    for (const m of members ?? []) {
      if (m.user_id) nameByUserId.set(m.user_id, m.name);
    }
    for (const g of grants) {
      g.grantorName = nameByUserId.get(g.grantor_user_id);
      g.granteeName = nameByUserId.get(g.grantee_user_id);
    }
  }

  // Hent family members vi kan anmode om hjælp fra (har user_id + email,
  // ikke caller selv, ingen eksisterende grant)
  const { data: familyMembers } = await supabase
    .from('family_members')
    .select('id, name, email, user_id')
    .neq('user_id', user.id)
    .not('user_id', 'is', null)
    .not('email', 'is', null);

  const existingGrantsByGrantor = new Set(
    grants
      .filter((g) => g.grantee_user_id === user.id)
      .map((g) => g.grantor_user_id)
  );
  const requestableMembers: FamilyMember[] = ((familyMembers ?? []) as FamilyMember[]).filter(
    (m) => !existingGrantsByGrantor.has(m.user_id!)
  );

  const grantsToMe = grants.filter(
    (g) => g.grantee_user_id === user.id && g.accepted_at
  );
  const grantsFromMe = grants.filter(
    (g) => g.grantor_user_id === user.id && g.accepted_at
  );
  const pendingFromMe = grants.filter(
    (g) => g.grantee_user_id === user.id && !g.accepted_at
  );
  const pendingToMe = grants.filter(
    (g) => g.grantor_user_id === user.id && !g.accepted_at
  );

  const activeCtx = await getActiveProxyContext();

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Hjælp og delegation
      </h2>

      <p className="mb-3 text-xs text-neutral-500">
        Sætter du en andens økonomi op for dem? Anmod om &ldquo;hjælper-adgang&rdquo;, så
        de kan godkende via email. Du kan kun <strong>tilføje</strong> nye
        konti, indkomst og udgifter - ikke se eller redigere deres
        eksisterende data. Adgangen udløber automatisk efter 7 dage.
      </p>

      {/* Anmod om hjælper-adgang */}
      {requestableMembers.length > 0 ? (
        <form
          action={requestSetupProxy}
          className="rounded-md border border-neutral-200 bg-stone-50/50 p-4"
        >
          <label htmlFor="proxy-target" className="block text-xs font-medium text-neutral-600">
            Anmod om at hjælpe
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              id="proxy-target"
              name="family_member_id"
              required
              className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            >
              <option value="">- Vælg familiemedlem -</option>
              {requestableMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.email ? `(${m.email})` : ''}
                </option>
              ))}
            </select>
            <SubmitButton pendingText="Sender...">Send anmodning</SubmitButton>
          </div>
        </form>
      ) : (
        <div className="rounded-md border border-dashed border-neutral-200 bg-white px-4 py-3 text-xs text-neutral-500">
          Ingen familiemedlemmer at anmode om hjælp til. De skal have en aktiv
          konto + email registreret.
        </div>
      )}

      {/* Aktive grants TIL MIG (jeg er grantee) */}
      {grantsToMe.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Dine aktive hjælper-adgange
          </h3>
          <div className="space-y-2">
            {grantsToMe.map((g) => {
              const isCurrentlyActive = activeCtx?.grantId === g.id;
              return (
                <div
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3"
                >
                  <div className="text-sm text-emerald-900">
                    Du kan hjælpe <strong>{g.grantorName ?? 'ukendt'}</strong>{' '}
                    <span className="text-xs text-emerald-700">
                      (udløber {formatExpiry(g.expires_at)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrentlyActive ? (
                      <span className="rounded bg-emerald-200 px-2 py-1 text-xs font-medium text-emerald-900">
                        Aktiv lige nu
                      </span>
                    ) : (
                      <form action={activateProxySession}>
                        <input type="hidden" name="grant_id" value={g.id} />
                        <button
                          type="submit"
                          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-800"
                        >
                          Skift til perspektiv
                        </button>
                      </form>
                    )}
                    <form action={revokeSetupProxy}>
                      <input type="hidden" name="grant_id" value={g.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100"
                      >
                        Træk tilbage
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aktive grants FRA MIG (jeg er grantor - jeg har givet en anden adgang) */}
      {grantsFromMe.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Folk du har givet adgang
          </h3>
          <div className="space-y-2">
            {grantsFromMe.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-200 bg-white px-4 py-3"
              >
                <div className="text-sm text-neutral-700">
                  <strong>{g.granteeName ?? 'ukendt'}</strong> kan tilføje data for dig{' '}
                  <span className="text-xs text-neutral-500">
                    (udløber {formatExpiry(g.expires_at)})
                  </span>
                </div>
                <form action={revokeSetupProxy}>
                  <input type="hidden" name="grant_id" value={g.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Træk tilbage
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending requests SENDT af mig (jeg er grantee, venter på accept) */}
      {pendingFromMe.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Afventer svar
          </h3>
          <div className="space-y-2">
            {pendingFromMe.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3"
              >
                <div className="text-sm text-amber-900">
                  Anmodning sendt til <strong>{g.grantorName ?? 'ukendt'}</strong>
                  <span className="ml-2 text-xs text-amber-700">
                    (udløber {formatExpiry(g.expires_at)})
                  </span>
                </div>
                <form action={revokeSetupProxy}>
                  <input type="hidden" name="grant_id" value={g.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                  >
                    Annullér
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending requests TIL mig (jeg er grantor, en anden har anmodet) */}
      {pendingToMe.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Anmodninger til dig
          </h3>
          <p className="text-xs text-neutral-500">
            Du har {pendingToMe.length} ubesvaret anmodning(er). Tjek din indbakke
            for samtykke-link, eller bed afsenderen om at gen-sende.
          </p>
        </div>
      )}
    </section>
  );
}

function formatExpiry(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'udløber snart';
  if (days === 1) return 'om 1 dag';
  return `om ${days} dage`;
}
