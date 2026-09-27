'use client';

// Projekt-header: titel, status (skifter med det samme), formål, målmåned,
// groft beløb og ansvarlig (de tre sidste arves fra sparken, migration
// 0072). "Rediger" åbner en inline-form til alle felter undtagen status.

import { useOptimistic, useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import type { PlanProject, PlanProjectStatus } from '@/lib/database.types';
import { formatAmount, formatMonthYearDA, formatOereForInput } from '@/lib/format';
import {
  isProjectStatus,
  monthInputValue,
  PROJECT_STATUS_LABEL_DA,
  PROJECT_STATUSES,
  type FamtaskMember,
} from '@/lib/famtask';
import { AmountInput } from '../../_components/AmountInput';
import { setProjectStatus, updateProject } from '../actions';
import {
  amountFieldClass,
  fieldClass,
  labelClass,
  primaryButtonClass,
  PROJECT_STATUS_CLASS,
  secondaryButtonClass,
} from './styles';

export function ProjectDetails({
  project,
  members,
}: {
  project: PlanProject;
  members: FamtaskMember[];
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [, startStatus] = useTransition();
  const [status, setOptimisticStatus] = useOptimistic<PlanProjectStatus, PlanProjectStatus>(
    project.status,
    (_current, next) => next
  );

  function changeStatus(next: string) {
    if (!isProjectStatus(next)) return;
    setError(null);
    const fd = new FormData();
    fd.set('project_id', project.id);
    fd.set('status', next);
    startStatus(async () => {
      setOptimisticStatus(next);
      const res = await setProjectStatus(fd);
      if (!res.ok) setError(res.error);
    });
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('project_id', project.id);
    startSave(async () => {
      const res = await updateProject(fd);
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  const owner = members.find((m) => m.id === project.owner_member_id);

  if (editing) {
    return (
      <form onSubmit={handleSave} className="max-w-2xl space-y-4">
        <div>
          <label htmlFor="project-title" className={labelClass}>
            Titel
          </label>
          <input
            id="project-title"
            name="title"
            type="text"
            required
            maxLength={200}
            defaultValue={project.title}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="project-purpose" className={labelClass}>
            Formål
          </label>
          <textarea
            id="project-purpose"
            name="purpose"
            rows={3}
            maxLength={1000}
            defaultValue={project.purpose ?? ''}
            placeholder="Hvorfor vil vi det her?"
            className={fieldClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="project-target-month" className={labelClass}>
              Målmåned
            </label>
            <input
              id="project-target-month"
              name="target_month"
              type="month"
              defaultValue={monthInputValue(project.target_month)}
              placeholder="ÅÅÅÅ-MM"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="project-estimated-amount" className={labelClass}>
              Beløb, groft (kr)
            </label>
            <AmountInput
              id="project-estimated-amount"
              name="estimated_amount"
              defaultValue={
                project.estimated_amount != null ? formatOereForInput(project.estimated_amount) : ''
              }
              className={amountFieldClass}
            />
          </div>
          <div>
            <label htmlFor="project-owner" className={labelClass}>
              Ansvarlig
            </label>
            <select
              id="project-owner"
              name="owner_member_id"
              defaultValue={project.owner_member_id ?? ''}
              className={fieldClass}
            >
              <option value="">Ingen</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? 'Gemmer…' : 'Gem'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setError(null);
            }}
            className={secondaryButtonClass}
          >
            Annullér
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <h2 className="break-words text-xl font-semibold tracking-tight text-neutral-900">
        {project.title}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label htmlFor="project-status" className="sr-only">
          Status
        </label>
        <select
          id="project-status"
          value={status}
          onChange={(e) => changeStatus(e.target.value)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-neutral-900 ${PROJECT_STATUS_CLASS[status]}`}
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABEL_DA[s]}
            </option>
          ))}
        </select>
        {project.target_month && (
          <span className="text-xs text-neutral-500 first-letter:uppercase">
            Mål: {formatMonthYearDA(monthInputValue(project.target_month))}
          </span>
        )}
        {project.estimated_amount != null && (
          <span className="text-xs text-neutral-500">
            Groft: <span className="font-mono tabnum">{formatAmount(project.estimated_amount)} kr</span>
          </span>
        )}
        {owner && <span className="text-xs text-neutral-500">Ansvarlig: {owner.name}</span>}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Pencil className="h-3 w-3" />
          Rediger
        </button>
      </div>
      {project.purpose && (
        <p className="mt-3 max-w-2xl whitespace-pre-line break-words text-sm text-neutral-600">
          {project.purpose}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
