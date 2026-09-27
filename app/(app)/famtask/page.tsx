// /famtask - oversigt over husstandens projekter.
//
// Aktive projekter vises som kort med sum af skridt (plan.project_budget)
// og antal færdige skridt. Idéer og projekter på pause vises kompakt
// nedenunder, så et projekt der lige er lavet ud fra en spark (status
// 'ide') ikke forsvinder. Færdige ligger bag en fold-ud.

import Link from 'next/link';
import { getFamtaskProjects, type FamtaskProjectSummary } from '@/lib/dal';
import { formatAmount } from '@/lib/format';
import { formatMonthShortDA } from '@/lib/famtask';
import { EmptyState } from '../_components/EmptyState';

function progressLabel(p: FamtaskProjectSummary): string {
  if (p.stepCount === 0) return 'Ingen skridt endnu';
  return `${p.doneCount} af ${p.stepCount} skridt færdige`;
}

function ActiveProjectCard({ project: p }: { project: FamtaskProjectSummary }) {
  const pct = p.stepCount > 0 ? Math.round((p.doneCount / p.stepCount) * 100) : 0;
  return (
    <Link
      href={`/famtask/${p.id}`}
      className="block rounded-md border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:bg-stone-50"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-words text-sm font-semibold text-neutral-900">
          {p.title}
        </span>
        {p.totalAmount > 0 && (
          <span className="shrink-0 font-mono tabnum text-sm text-neutral-900">
            {formatAmount(p.totalAmount)} kr
          </span>
        )}
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={progressLabel(p)}
      >
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-neutral-500">
        <span>{progressLabel(p)}</span>
        {p.target_month && (
          <span className="first-letter:uppercase">Mål: {formatMonthShortDA(p.target_month)}</span>
        )}
      </div>
    </Link>
  );
}

function ProjectRow({ project: p }: { project: FamtaskProjectSummary }) {
  return (
    <li>
      <Link
        href={`/famtask/${p.id}`}
        className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition hover:bg-stone-50"
      >
        <span className="min-w-0 break-words text-neutral-900">{p.title}</span>
        <span className="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
          {p.stepCount > 0 && (
            <span>
              {p.doneCount}/{p.stepCount}
            </span>
          )}
          {p.totalAmount > 0 && (
            <span className="font-mono tabnum">{formatAmount(p.totalAmount)} kr</span>
          )}
        </span>
      </Link>
    </li>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
      {children}
    </h2>
  );
}

function CompactList({ projects }: { projects: FamtaskProjectSummary[] }) {
  return (
    <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 bg-white">
      {projects.map((p) => (
        <ProjectRow key={p.id} project={p} />
      ))}
    </ul>
  );
}

export default async function FamtaskPage() {
  const projects = await getFamtaskProjects();

  if (projects.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState message="Ingen projekter endnu. Fang et ønske som spark, og gør det til et projekt, når I vil i gang." />
      </div>
    );
  }

  const active = projects.filter((p) => p.status === 'aktiv');
  const ideas = projects.filter((p) => p.status === 'ide');
  const paused = projects.filter((p) => p.status === 'pause');
  const done = projects.filter((p) => p.status === 'faerdig');
  const activeTotal = active.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <>
      <section className="mt-6">
        <SectionHeading>Aktive</SectionHeading>
        {active.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Ingen aktive projekter. Sæt et projekt til Aktiv, når I går i gang.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-neutral-500">
              {active.length} {active.length === 1 ? 'projekt' : 'projekter'}
              {activeTotal > 0 && (
                <>
                  {' · '}
                  <span className="font-mono tabnum">{formatAmount(activeTotal)} kr</span> planlagt
                </>
              )}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {active.map((p) => (
                <ActiveProjectCard key={p.id} project={p} />
              ))}
            </div>
          </>
        )}
      </section>

      {ideas.length > 0 && (
        <section className="mt-8">
          <SectionHeading>Idéer</SectionHeading>
          <CompactList projects={ideas} />
        </section>
      )}

      {paused.length > 0 && (
        <section className="mt-8">
          <SectionHeading>På pause</SectionHeading>
          <CompactList projects={paused} />
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-8">
          <details>
            <summary className="mb-3 cursor-pointer text-xs font-medium uppercase tracking-wider text-neutral-500">
              Færdige ({done.length})
            </summary>
            <CompactList projects={done} />
          </details>
        </section>
      )}
    </>
  );
}
