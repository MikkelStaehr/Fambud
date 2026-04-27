import Link from 'next/link';
import { Plus, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { getAccounts } from '@/lib/dal';
import {
  ACCOUNT_KIND_LABEL_DA,
  formatAmount,
  formatShortDateDA,
} from '@/lib/format';
import { archiveAccount, restoreAccount } from './actions';

export default async function KontiPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const sp = await searchParams;
  const showArchived = sp.archived === '1';
  const accounts = await getAccounts({ includeArchived: showArchived });

  return (
    <div className="px-8 py-6">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">Konti</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {accounts.length} {accounts.length === 1 ? 'konto' : 'konti'}
            {showArchived ? ' (inkl. arkiverede)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={showArchived ? '/konti' : '/konti?archived=1'}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            {showArchived ? 'Skjul arkiverede' : 'Vis arkiverede'}
          </Link>
          <Link
            href="/konti/ny"
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            Ny konto
          </Link>
        </div>
      </header>

      <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
        {accounts.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-neutral-500">
            Ingen konti endnu — opret den første.
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className={`border-b border-neutral-100 last:border-b-0 ${a.archived ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-neutral-900">
                      {a.name}
                      {a.archived && (
                        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-normal text-neutral-500">
                          Arkiveret
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-500">
                      <span>{ACCOUNT_KIND_LABEL_DA[a.kind] ?? a.kind}</span>
                      {a.owner_name && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span>{a.owner_name}</span>
                        </>
                      )}
                      {a.goal_amount && (
                        <>
                          <span className="text-neutral-300">·</span>
                          <span>
                            Mål: {formatAmount(a.goal_amount)} kr.
                            {a.goal_date && ` til ${formatShortDateDA(a.goal_date)}`}
                            {a.goal_label && ` — ${a.goal_label}`}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabnum font-mono text-sm text-neutral-900">
                      {formatAmount(a.opening_balance)}
                    </span>
                    <span className="ml-1 text-xs text-neutral-400">{a.currency}</span>
                  </td>
                  <td className="w-px whitespace-nowrap px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/konti/${a.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                        title="Rediger"
                      >
                        <Pencil className="h-3 w-3" />
                        Rediger
                      </Link>
                      {a.archived ? (
                        <form action={restoreAccount}>
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                          >
                            <ArchiveRestore className="h-3 w-3" />
                            Gendan
                          </button>
                        </form>
                      ) : (
                        <form action={archiveAccount}>
                          <input type="hidden" name="id" value={a.id} />
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
    </div>
  );
}
