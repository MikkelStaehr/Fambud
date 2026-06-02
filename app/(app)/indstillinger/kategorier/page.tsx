// /indstillinger/kategorier - liste over alle kategorier med tilføj/
// arkivér/gendan + link til edit. Vis-arkiverede toggles via ?archivedCategories=1.

import Link from 'next/link';
import { Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { getCategories } from '@/lib/dal';
import { createCategory, archiveCategory, restoreCategory } from '../actions';

const CATEGORY_KIND_LABEL_DA: Record<string, string> = {
  income: 'Indtægt',
  expense: 'Udgift',
};

export default async function KategorierPage({
  searchParams,
}: {
  searchParams: Promise<{ archivedCategories?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const showArchivedCategories = sp.archivedCategories === '1';
  const categories = await getCategories({
    includeArchived: showArchivedCategories,
  });

  return (
    <div>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Kategorier
          </h2>
          <Link
            href={
              showArchivedCategories
                ? '/indstillinger/kategorier'
                : '/indstillinger/kategorier?archivedCategories=1'
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
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
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
                : 'Ingen aktive kategorier - tilføj én ovenfor.'}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className={`flex items-start justify-between gap-3 px-4 py-3 ${c.archived ? 'opacity-60' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
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
                  </div>
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
