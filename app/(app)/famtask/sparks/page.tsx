// /famtask/sparks - indbakken. Sparks fanges med Cmd/Ctrl+K eller "Ny
// spark" og ryddes enten ved at blive til et projekt eller ved at slettes.

import Link from 'next/link';
import { ArrowRight, Trash2 } from 'lucide-react';
import { getFamtaskSparks } from '@/lib/dal';
import { formatCreatedDA } from '@/lib/famtask';
import { EmptyState } from '../../_components/EmptyState';
import { SubmitButton } from '../../_components/SubmitButton';
import { deleteSpark, promoteSpark } from '../actions';

export default async function FamtaskSparksPage() {
  const { open, promoted } = await getFamtaskSparks();

  return (
    <>
      <section className="mt-6">
        {open.length === 0 ? (
          <EmptyState message="Ingen sparks i indbakken. Fang et ønske eller en idé med Ny spark, eller Cmd/Ctrl+K på computeren." />
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
            {open.map((spark) => (
              <li
                key={spark.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-neutral-900">
                    {spark.title}
                  </p>
                  {spark.note && (
                    <p className="mt-0.5 break-words text-sm text-neutral-600">{spark.note}</p>
                  )}
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {formatCreatedDA(spark.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={promoteSpark}>
                    <input type="hidden" name="id" value={spark.id} />
                    <SubmitButton pendingLabel="Opretter…">Gør til projekt</SubmitButton>
                  </form>
                  <form action={deleteSpark}>
                    <input type="hidden" name="id" value={spark.id} />
                    <button
                      type="submit"
                      aria-label={`Slet spark: ${spark.title}`}
                      className="rounded-md p-2.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {promoted.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Blev til projekter
          </h2>
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
            {promoted.map((spark) => (
              <li key={spark.id}>
                <Link
                  href={`/famtask/${spark.promoted_project_id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-stone-50"
                >
                  <span className="min-w-0 break-words text-neutral-600">{spark.title}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-neutral-500">
                    Åbn projekt
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
