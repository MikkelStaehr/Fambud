import Link from 'next/link';
import { Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import { getSettingsData, getCategories } from '@/lib/dal';
import { formatShortDateDA } from '@/lib/format';
import {
  createInvite,
  deleteInvite,
  createCategory,
  archiveCategory,
  restoreCategory,
  createFamilyMember,
  deleteFamilyMember,
} from './actions';
import { CopyInviteButton } from './_components/CopyInviteButton';

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

const CATEGORY_KIND_LABEL_DA: Record<string, string> = {
  income: 'Indtægt',
  expense: 'Udgift',
};

export default async function IndstillingerPage({
  searchParams,
}: {
  searchParams: Promise<{ archivedCategories?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const showArchivedCategories = sp.archivedCategories === '1';

  const [{ household, invites, familyMembers, currentUserId }, categories] = await Promise.all([
    getSettingsData(),
    getCategories({ includeArchived: showArchivedCategories }),
  ]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Indstillinger
        </h1>
      </header>

      {/* Husstand */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Husstand
        </h2>
        <div className="rounded-md border border-neutral-200 bg-white px-4 py-3">
          <div className="text-sm font-medium text-neutral-900">{household.name}</div>
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
          Alle i familien — voksne med login og børn uden. Tilføj en email på
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
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Tilføj
          </button>
        </form>

        <div className="mt-4 overflow-hidden rounded-md border border-neutral-200 bg-white">
          {familyMembers.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              Ingen familiemedlemmer endnu — tilføj dig selv og resten af familien ovenfor.
            </div>
          ) : (
            <table className="w-full">
              <tbody>
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
                    <tr
                      key={fm.id}
                      className="border-b border-neutral-100 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
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
                        <div className="mt-0.5 text-xs text-neutral-500">
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
                      </td>
                      <td className="w-px whitespace-nowrap px-4 py-3 text-right">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Inviter en person */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Inviter en person
        </h2>

        <form
          action={createInvite}
          className="flex items-end gap-3 rounded-md border border-neutral-200 bg-white p-4"
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
              placeholder="7 — tom for aldrig"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">
              0 eller tom = aldrig udløber
            </p>
          </div>

          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
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
            <table className="w-full">
              <tbody>
                {invites.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-neutral-100 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm font-semibold tracking-wider text-neutral-900">
                        {inv.code}
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-500">
                        Udløber: {expiresLabel(inv.expires_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Kategorier */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Kategorier
          </h2>
          <Link
            href={
              showArchivedCategories ? '/indstillinger' : '/indstillinger?archivedCategories=1'
            }
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            {showArchivedCategories ? 'Skjul arkiverede' : 'Vis arkiverede'}
          </Link>
        </div>

        {sp.error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {sp.error}
          </div>
        )}

        {/* Tilføj kategori */}
        <form
          action={createCategory}
          className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 bg-white p-4"
        >
          <div className="flex-1 min-w-40">
            <label htmlFor="cat_name" className="block text-xs font-medium text-neutral-600">
              Navn
            </label>
            <input
              id="cat_name"
              name="name"
              type="text"
              required
              placeholder="F.eks. Bolig"
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label htmlFor="cat_kind" className="block text-xs font-medium text-neutral-600">
              Type
            </label>
            <select
              id="cat_kind"
              name="kind"
              defaultValue="expense"
              className="mt-1.5 block rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            >
              <option value="expense">Udgift</option>
              <option value="income">Indtægt</option>
            </select>
          </div>
          <div>
            <label htmlFor="cat_color" className="block text-xs font-medium text-neutral-600">
              Farve
            </label>
            <input
              id="cat_color"
              name="color"
              type="color"
              defaultValue="#94a3b8"
              className="mt-1.5 block h-9 w-14 cursor-pointer rounded-md border border-neutral-300 bg-white p-1"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Tilføj
          </button>
        </form>

        {/* Liste */}
        <div className="mt-4 overflow-hidden rounded-md border border-neutral-200 bg-white">
          {categories.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-500">
              {showArchivedCategories
                ? 'Ingen kategorier'
                : 'Ingen aktive kategorier — tilføj én ovenfor.'}
            </div>
          ) : (
            <table className="w-full">
              <tbody>
                {categories.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-neutral-100 last:border-b-0 ${c.archived ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                          aria-hidden
                        />
                        <span className="text-sm text-neutral-900">{c.name}</span>
                        {c.archived && (
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500">
                            Arkiveret
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 ml-5 text-xs text-neutral-500">
                        {CATEGORY_KIND_LABEL_DA[c.kind] ?? c.kind}
                      </div>
                    </td>
                    <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/indstillinger/kategorier/${c.id}`}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                        >
                          <Pencil className="h-3 w-3" />
                          Rediger
                        </Link>
                        {c.archived ? (
                          <form action={restoreCategory}>
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                            >
                              <ArchiveRestore className="h-3 w-3" />
                              Gendan
                            </button>
                          </form>
                        ) : (
                          <form action={archiveCategory}>
                            <input type="hidden" name="id" value={c.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                            >
                              <Archive className="h-3 w-3" />
                              Arkivér
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
