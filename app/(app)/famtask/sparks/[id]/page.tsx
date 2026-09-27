// /famtask/sparks/[id] - én spark med tjekliste og skridt (migration 0074).
//
// Her brydes sparken ned i skridt med beløb og måned, så husstanden siger
// ja til et gennemregnet budget. Skridtene følger med over, når sparken
// bliver til et projekt. Er den allerede blevet det, sendes man dertil.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getFamtaskSpark } from '@/lib/dal';
import { SparkCard } from '../../_components/SparkCard';
import { StepList } from '../../_components/StepList';

export default async function FamtaskSparkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getFamtaskSpark(id);
  if (!data) notFound();
  const { spark, steps, members, currentUserId } = data;
  if (spark.promoted_project_id) redirect(`/famtask/${spark.promoted_project_id}`);

  return (
    <>
      <Link
        href="/famtask/sparks"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Alle sparks
      </Link>

      <ul className="mt-3 max-w-3xl rounded-md border border-neutral-200 bg-white">
        <SparkCard spark={spark} members={members} currentUserId={currentUserId} />
      </ul>

      <section className="mt-6 max-w-3xl">
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Skridt
        </h3>
        <p className="mb-3 text-sm text-neutral-600">
          Bryd sparken ned i skridt med beløb, så I siger ja til et gennemregnet
          budget. Skridtene følger med, når sparken bliver til et projekt.
        </p>
        <StepList parent={{ kind: 'spark', id: spark.id }} steps={steps} />
      </section>
    </>
  );
}
