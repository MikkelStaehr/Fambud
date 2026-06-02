// /indstillinger/husstand - alt der handler om husstanden og dens
// medlemmer: husstandsnavn, familieliste, hjælper-adgang (proxy) og
// invitationer.

import { Trash2 } from 'lucide-react';
import { getSettingsData } from '@/lib/dal';
import { formatShortDateDA } from '@/lib/format';
import {
  createInvite,
  deleteInvite,
  createFamilyMember,
  deleteFamilyMember,
} from '../actions';
import { CopyInviteButton } from '../_components/CopyInviteButton';
import { ProxySection } from '../_components/ProxySection';

const ROLE_LABEL_DA: Record<string, string> = {
  owner: 'Ejer',
  member: 'Medlem',
};

function memberStatus(fm: {
  user_id: string | null;
  email: string | null;
}): { label: string; tone: 'login' | 'pending' | 'none' } {
  if (fm.user_id) return { label: 'Kan logge ind', tone: 'login' };
  if (fm.email) return { label: 'Afventer signup', tone: 'pending' };
  return { label: 'Ingen login', tone: 'none' };
}

function expiresLabel(expires_at: string | null): string {
  if (!expires_at) return 'Aldrig';
  const ms = new Date(expires_at).getTime() - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days < 1) {
    const hours = Math.max(1, Math.ceil(ms / (60 * 60 * 1000)));
    return `Om ${hours} ${hours === 1 ? 'time' : 'timer'}`;
  }
  return `Om ${days} ${days === 1 ? 'dag' : 'dage'}`;
}

export default async function HusstandPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  const { household, invites, familyMembers, currentUserId } =
    await getSettingsData();

  return (
    <div>
      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {sp.notice && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {sp.notice}
        </div>
      )}

      {/* Husstand-navn + oprettelses-dato */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Husstand
        </h2>
        <div className="rounded-md border border-neutral-200 bg-white px-4 py-3">
          <div className="text-sm font-medium text-neutral-900">
            {household.name}
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            Oprettet {formatShortDateDA(household.created_at.slice(0, 10))}
          </div>
        </div>
      </section>

      {/* Familie */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Familie
        </h2>
        <p className="mb-3 text-xs text-neutral-500">
          Alle i familien - voksne med login og børn uden. Tilføj en email på
          en voksen for at pre-godkende dem: når de signer up med præcis den
          email, bliver de automatisk tilknyttet husstanden.
        </p>

        <form
          action={createFamilyMember}
          className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 bg-white p-4"
        >
          <div className="flex-1 min-w-40">
            <label htmlFor="fm_name" className="block text-xs font-medium text-neutral-600">
              Navn
            </label>
            <input
              id="fm_name"
              name="name"
              type="text"
              required
              placeholder="F.eks. Louise eller Theodor"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div className="flex-1 min-w-52">
            <label htmlFor="fm_email" className="block text-xs font-medium text-neutral-600">
              Email <span className="text-neutral-400">(voksne med login)</span>
            </label>
            <input
              id="fm_email"
              name="email"
              type="email"
              placeholder="louise@example.com"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label htmlFor="fm_birthdate" className="block text-xs font-medium text-neutral-600">
              Fødselsdato <span className="text-neutral-400">(valgfrit)</span>
            </label>
            <input
              id="fm_birthdate"
              name="birthdate"
              type="date"
              className="mt-1.5 block rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Tilføj
          </button>
        </form>

        <div className="mt-4 overflow-hidden rounded-md border border-neutral-200 bg-white">
          {familyMembers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              Ingen familiemedlemmer endnu - tilføj dig selv og resten af familien ovenfor.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {familyMembers.map((fm) => {
                const status = memberStatus(fm);
                const isSelf = fm.user_id === currentUserId;
                const toneClass =
                  status.tone === 'login'
                    ? 'bg-emerald-50 text-emerald-700'
                    : status.tone === 'pending'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-neutral-100 text-neutral-500';
                return (
                  <li key={fm.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-neutral-900">{fm.name}</span>
                        {isSelf && (
                          <span className="text-xs text-neutral-400">(dig)</span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${toneClass}`}
                        >
                          {status.label}
                        </span>
                        {fm.role && fm.user_id && (
                          <span className="text-xs text-neutral-500">
                            {ROLE_LABEL_DA[fm.role] ?? fm.role}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-neutral-500">
                        {fm.email && <span>{fm.email}</span>}
                        {fm.email && fm.birthdate && <span> · </span>}
                        {fm.birthdate && (
                          <span>Født {formatShortDateDA(fm.birthdate)}</span>
                        )}
                        {fm.joined_at && (
                          <span>
                            {(fm.email || fm.birthdate) && ' · '}
                            tilsluttet {formatShortDateDA(fm.joined_at.slice(0, 10))}
                          </span>
                        )}
                      </div>
                    </div>
                    {!isSelf && (
                      <form action={deleteFamilyMember}>
                        <input type="hidden" name="id" value={fm.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-700"
                          title="Fjern familiemedlem"
                        >
                          <Trash2 className="h-3 w-3" />
                          Fjern
                        </button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Hjælper-adgang (setup proxy) */}
      <ProxySection />

      {/* Inviter en person */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Inviter en person
        </h2>

        <form
          action={createInvite}
          className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 bg-white p-4"
        >
          <div className="flex-1 max-w-xs">
            <label
              htmlFor="expires_in_days"
              className="block text-xs font-medium text-neutral-600"
            >
              Udløber om (dage)
            </label>
            <input
              id="expires_in_days"
              name="expires_in_days"
              type="number"
              min={0}
              defaultValue={7}
              placeholder="7 - tom for aldrig"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">
              0 eller tom = aldrig udløber
            </p>
          </div>

          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Generér kode
          </button>
        </form>

        {/* Aktive invitationer */}
        <h3 className="mt-6 mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Aktive invitationer
        </h3>
        <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {invites.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              Ingen aktive invitationer
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold tracking-wider text-neutral-900">
                      {inv.code}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      Udløber: {expiresLabel(inv.expires_at)}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <CopyInviteButton value={inv.code} kind="code" />
                    <CopyInviteButton value={inv.code} kind="link" />
                    <form action={deleteInvite}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-neutral-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        title="Annullér invitation"
                      >
                        <Trash2 className="h-3 w-3" />
                        Annullér
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
