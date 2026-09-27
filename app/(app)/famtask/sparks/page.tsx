// /famtask/sparks - indbakken. Sparks fanges med Cmd/Ctrl+K eller "Ny
// spark" og ryddes enten ved at blive til et projekt eller ved at slettes.
// En spark bliver først til et projekt når tjeklisten er opfyldt (SparkCard).

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getFamtaskSparks } from '@/lib/dal';
import { EmptyState } from '../../_components/EmptyState';
import { SparkCard } from '../_components/SparkCard';

export default async function FamtaskSparksPage() {
  const { open, promoted, members, currentUserId } = await getFamtaskSparks();

  return (
    <>
      <section className="mt-6">
        {open.length === 0 ? (
          <EmptyState message="Ingen sparks i indbakken. Fang et ønske eller en idé med Ny spark, eller Cmd/Ctrl+K på computeren." />
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
            {open.map((spark) => (
              <SparkCard
                key={spark.id}
                spark={spark}
                members={members}
                currentUserId={currentUserId}
                linkToSpark
              />
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
