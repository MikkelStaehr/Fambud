'use client';

// Flad liste af skridt på et projekt eller en spark (migration 0074).
//
// - Status: ét tryk på ikonet (todo → i gang → færdig → todo)
// - Rækkefølge: op/ned-knapper (træk-og-slip er upålideligt på mobil)
// - Rediger: titel, beløb (kr i UI, øre i DB), måned og status inline
// - Tilføj: kun titel, så man hurtigt kan skrive en liste
//
// Status, flyt og slet er optimistiske (useOptimistic), så listen reagerer
// med det samme; server-data overtager når revalidate er færdig. Actions
// returnerer {ok, error} og redirecter ikke, så siden ikke hopper til
// toppen efter hvert tryk.

import { useOptimistic, useRef, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Circle, CircleCheck, CircleDot, Pencil } from 'lucide-react';
import type { PlanStep, PlanStepStatus } from '@/lib/database.types';
import { formatAmount, formatOereForInput } from '@/lib/format';
import {
  formatMonthShortDA,
  monthInputValue,
  moveInOrder,
  nextStepStatus,
  STEP_STATUS_LABEL_DA,
  STEP_STATUSES,
  type StepParent,
} from '@/lib/famtask';
import { AmountInput } from '../../_components/AmountInput';
import {
  addStep,
  deleteStep,
  moveStep,
  setStepStatus,
  updateStep,
  type FamtaskActionResult,
} from '../actions';
import {
  amountFieldClass,
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './styles';

type OptimisticAction =
  | { type: 'status'; id: string; status: PlanStepStatus }
  | { type: 'move'; id: string; direction: 'up' | 'down' }
  | { type: 'delete'; id: string };

function applyOptimistic(steps: PlanStep[], action: OptimisticAction): PlanStep[] {
  switch (action.type) {
    case 'status':
      return steps.map((s) => (s.id === action.id ? { ...s, status: action.status } : s));
    case 'delete':
      return steps.filter((s) => s.id !== action.id);
    case 'move': {
      const order = moveInOrder(steps.map((s) => s.id), action.id, action.direction);
      if (!order) return steps;
      const byId = new Map(steps.map((s) => [s.id, s]));
      return order.map((id) => byId.get(id) as PlanStep);
    }
  }
}

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const STATUS_ICON: Record<PlanStepStatus, { icon: typeof Circle; className: string }> = {
  todo: { icon: Circle, className: 'text-neutral-300' },
  i_gang: { icon: CircleDot, className: 'text-amber-600' },
  faerdig: { icon: CircleCheck, className: 'text-emerald-700' },
};

const iconButtonClass =
  'rounded-md p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-30';

type Props = {
  parent: StepParent;
  steps: PlanStep[];
};

export function StepList({ parent, steps }: Props) {
  const [optimisticSteps, applyAction] = useOptimistic(steps, applyOptimistic);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [adding, startAdd] = useTransition();
  const [saving, startSave] = useTransition();
  const addFormRef = useRef<HTMLFormElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  function run(
    action: (fd: FormData) => Promise<FamtaskActionResult>,
    fd: FormData,
    optimistic?: OptimisticAction
  ) {
    setError(null);
    startTransition(async () => {
      if (optimistic) applyAction(optimistic);
      const res = await action(fd);
      if (!res.ok) setError(res.error);
    });
  }

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set(parent.kind === 'project' ? 'project_id' : 'spark_id', parent.id);
    startAdd(async () => {
      const res = await addStep(fd);
      if (res.ok) {
        addFormRef.current?.reset();
        addInputRef.current?.focus();
      } else {
        setError(res.error);
      }
    });
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>, stepId: string) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('step_id', stepId);
    startSave(async () => {
      const res = await updateStep(fd);
      if (res.ok) setEditingId(null);
      else setError(res.error);
    });
  }

  const total = optimisticSteps.reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const hasAmounts = optimisticSteps.some((s) => s.amount != null);
  // Summen er kun hele budgettet, hvis alle skridt har et beløb
  const unpricedCount = optimisticSteps.filter((s) => s.amount == null).length;
  const doneCount = optimisticSteps.filter((s) => s.status === 'faerdig').length;

  return (
    <div className="rounded-md border border-neutral-200 bg-white">
      {error && (
        <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {optimisticSteps.length === 0 ? (
        <p className="px-4 py-4 text-sm text-neutral-500">
          Ingen skridt endnu. Skriv det første nedenfor, fx &quot;Indhent tilbud&quot;.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {optimisticSteps.map((step, index) => {
            if (editingId === step.id) {
              return (
                <li key={step.id} className="px-3 py-3 sm:px-4">
                  <form
                    onSubmit={(e) => handleSave(e, step.id)}
                    className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr] sm:items-end"
                  >
                    <div>
                      <label htmlFor={`step-title-${step.id}`} className={labelClass}>
                        Skridt
                      </label>
                      <input
                        id={`step-title-${step.id}`}
                        name="title"
                        type="text"
                        required
                        maxLength={200}
                        defaultValue={step.title}
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label htmlFor={`step-amount-${step.id}`} className={labelClass}>
                        Beløb (kr)
                      </label>
                      <AmountInput
                        id={`step-amount-${step.id}`}
                        name="amount"
                        defaultValue={step.amount != null ? formatOereForInput(step.amount) : ''}
                        className={amountFieldClass}
                      />
                    </div>
                    <div>
                      <label htmlFor={`step-month-${step.id}`} className={labelClass}>
                        Måned
                      </label>
                      <input
                        id={`step-month-${step.id}`}
                        name="month"
                        type="month"
                        defaultValue={monthInputValue(step.month)}
                        placeholder="ÅÅÅÅ-MM"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label htmlFor={`step-status-${step.id}`} className={labelClass}>
                        Status
                      </label>
                      <select
                        id={`step-status-${step.id}`}
                        name="status"
                        defaultValue={step.status}
                        className={fieldClass}
                      >
                        {STEP_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STEP_STATUS_LABEL_DA[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
                      <button type="submit" disabled={saving} className={primaryButtonClass}>
                        {saving ? 'Gemmer…' : 'Gem'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setError(null);
                        }}
                        className={secondaryButtonClass}
                      >
                        Annullér
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          run(deleteStep, formData({ step_id: step.id }), {
                            type: 'delete',
                            id: step.id,
                          });
                        }}
                        className="ml-auto rounded-md px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
                      >
                        Slet skridt
                      </button>
                    </div>
                  </form>
                </li>
              );
            }

            const { icon: StatusIcon, className: statusColor } = STATUS_ICON[step.status];
            const next = nextStepStatus(step.status);
            const done = step.status === 'faerdig';
            const hasMeta = step.status === 'i_gang' || step.amount != null || step.month != null;

            return (
              <li key={step.id} className="flex items-start gap-1 px-1 py-1.5 sm:px-2">
                <button
                  type="button"
                  onClick={() =>
                    run(setStepStatus, formData({ step_id: step.id, status: next }), {
                      type: 'status',
                      id: step.id,
                      status: next,
                    })
                  }
                  aria-label={`${STEP_STATUS_LABEL_DA[step.status]}. Skift til ${STEP_STATUS_LABEL_DA[next]}`}
                  className="rounded-md p-2 transition hover:bg-neutral-100"
                >
                  <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                </button>

                <div className="min-w-0 flex-1 py-2">
                  <p
                    className={`break-words text-sm ${
                      done ? 'text-neutral-400 line-through' : 'text-neutral-900'
                    }`}
                  >
                    {step.title}
                  </p>
                  {hasMeta && (
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                      {step.status === 'i_gang' && (
                        <span className="font-medium text-amber-700">I gang</span>
                      )}
                      {step.amount != null && (
                        <span className="font-mono tabnum">{formatAmount(step.amount)} kr</span>
                      )}
                      {step.month && (
                        <span className="first-letter:uppercase">{formatMonthShortDA(step.month)}</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() =>
                      run(moveStep, formData({ step_id: step.id, direction: 'up' }), {
                        type: 'move',
                        id: step.id,
                        direction: 'up',
                      })
                    }
                    aria-label={`Flyt op: ${step.title}`}
                    className={iconButtonClass}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === optimisticSteps.length - 1}
                    onClick={() =>
                      run(moveStep, formData({ step_id: step.id, direction: 'down' }), {
                        type: 'move',
                        id: step.id,
                        direction: 'down',
                      })
                    }
                    aria-label={`Flyt ned: ${step.title}`}
                    className={iconButtonClass}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditingId(step.id);
                    }}
                    aria-label={`Rediger: ${step.title}`}
                    className={iconButtonClass}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {optimisticSteps.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-stone-50 px-4 py-2.5 text-xs text-neutral-500">
          <span>
            {doneCount} af {optimisticSteps.length} færdige
          </span>
          {hasAmounts && (
            <span className="flex flex-wrap items-baseline justify-end gap-x-2">
              {unpricedCount > 0 && <span>{unpricedCount} skridt uden beløb</span>}
              <span className="font-mono tabnum text-sm font-semibold text-neutral-900">
                {formatAmount(total)} kr
              </span>
            </span>
          )}
        </div>
      )}

      <form
        ref={addFormRef}
        onSubmit={handleAdd}
        className="flex gap-2 border-t border-neutral-200 bg-stone-50 p-3"
      >
        <label htmlFor="new-step" className="sr-only">
          Nyt skridt
        </label>
        <input
          ref={addInputRef}
          id="new-step"
          name="title"
          type="text"
          required
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Nyt skridt…"
          className={`${fieldClass} flex-1`}
        />
        <button type="submit" disabled={adding} className={primaryButtonClass}>
          {adding ? 'Tilføjer…' : 'Tilføj'}
        </button>
      </form>
    </div>
  );
}
