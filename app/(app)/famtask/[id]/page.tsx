// /famtask/[id] - ét projekt med skridt som flad liste.
//
// Layout:
//   - Tilbage-link
//   - ProjectDetails: titel, status, formål, målmåned (+ rediger)
//   - StepList: tilføj, omdøb, flyt, status, beløb, måned
//   - Slet projekt (bag en fold-ud, så det ikke trykkes ved et uheld)

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { getFamtaskProject } from '@/lib/dal';
import { SubmitButton } from '../../_components/SubmitButton';
import { ProjectDetails } from '../_components/ProjectDetails';
import { StepList } from '../_components/StepList';
import { deleteProject } from '../actions';

export default async function FamtaskProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getFamtaskProject(id);
  if (!data) notFound();
  const { project, steps } = data;

  return (
    <>
      <Link
        href="/famtask"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Alle projekter
      </Link>

      <section className="mt-3">
        <ProjectDetails project={project} />
      </section>

      <section className="mt-6 max-w-3xl">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Skridt
        </h3>
        <StepList projectId={project.id} steps={steps} />
      </section>

      <section className="mt-10 max-w-3xl border-t border-neutral-200 pt-6">
        <details>
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-red-700">
            <Trash2 className="h-3.5 w-3.5" />
            Slet projekt
          </summary>
          <p className="mt-2 text-sm text-neutral-600">
            Sletter projektet og alle dets skridt. En spark der blev til
            projektet, kommer tilbage i indbakken. Kan ikke fortrydes.
          </p>
          <form action={deleteProject} className="mt-3">
            <input type="hidden" name="project_id" value={project.id} />
            <SubmitButton variant="danger" pendingLabel="Sletter…">
              Slet projektet
            </SubmitButton>
          </form>
        </details>
      </section>
    </>
  );
}
