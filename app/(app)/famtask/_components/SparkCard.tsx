'use client';

// Én spark i indbakken med tjeklisten fra migration 0073: formål, beløb og
// måned, ansvarlig, og at alle med login har sagt ja.
//
// - Rediger: inline-form til alle felter. Ændringer nulstiller jeres ja
//   (updateSpark), så et ja altid gælder sparken som den ser ud.
// - Sig ja: optimistisk, så tjeklisten reagerer med det samme.
// - Gør til projekt: slået fra indtil tjeklisten er opfyldt. promoteSpark
//   tjekker igen på serveren.
// - Skridt (0074): i indbakken vises antal og sum med et link til sparkens
//   egen side, hvor skridtene redigeres. Prissatte skridt opfylder "Beløb".

import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { ArrowRight, Circle, CircleCheck, Pencil, ThumbsUp, Trash2 } from 'lucide-react';
import type { PlanSpark } from '@/lib/database.types';
import { formatAmount, formatOereForInput } from '@/lib/format';
import {
  formatCreatedDA,
  formatMonthShortDA,
  monthInputValue,
  sparkChecklist,
  type FamtaskMember,
  type SparkChecklistKey,
} from '@/lib/famtask';
import { AmountInput } from '../../_components/AmountInput';
import { SubmitButton } from '../../_components/SubmitButton';
import { deleteSpark, promoteSpark, setSparkApproval, updateSpark } from '../actions';
import {
  amountFieldClass,
  fieldClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './styles';

type Props = {
  spark: PlanSpark & { approvedUserIds: string[]; stepAmounts: (number | null)[] };
  members: FamtaskMember[];
  currentUserId: string;
  // true i indbakken: titel og skridt-linje linker til sparkens side
  linkToSpark?: boolean;
};

export function SparkCard({ spark, members, currentUserId, linkToSpark = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [, startApproval] = useTransition();
  const [approvedUserIds, setOptimisticApproval] = useOptimistic<string[], boolean>(
    spark.approvedUserIds,
    (current, approve) =>
      approve
        ? [...current.filter((id) => id !== currentUserId), currentUserId]
        : current.filter((id) => id !== currentUserId)
  );

  const checklist = sparkChecklist(spark, members, approvedUserIds, spark.stepAmounts);
  const sparkHref = `/famtask/sparks/${spark.id}`;
  const stepCount = spark.stepAmounts.length;
  const iApproved = approvedUserIds.includes(currentUserId);
  const owner = members.find((m) => m.id === spark.owner_member_id);
  const approvers = members.filter((m) => m.user_id != null);

  function toggleApproval() {
    setError(null);
    const approve = !iApproved;
    const fd = new FormData();
    fd.set('spark_id', spark.id);
    fd.set('approve', approve ? '1' : '0');
    startApproval(async () => {
      setOptimisticApproval(approve);
      const res = await setSparkApproval(fd);
      if (!res.ok) setError(res.error);
    });
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('spark_id', spark.id);
    startSave(async () => {
      const res = await updateSpark(fd);
      if (res.ok) setEditing(false);
      else setError(res.error);
    });
  }

  // Detaljen ved hvert punkt: hvad der er udfyldt, eller hvem der mangler.
  function detail(key: SparkChecklistKey, done: boolean): string | null {
    if (key === 'amount_month' && done) {
      const month = formatMonthShortDA(spark.target_month as string);
      return checklist.stepsTotal != null
        ? `${formatAmount(checklist.stepsTotal)} kr fra skridt, ${month}`
        : `${formatAmount(spark.estimated_amount as number)} kr, ${month}`;
    }
    if (key === 'owner' && owner) return owner.name;
    if (key === 'approvals') {
      if (approvers.length === 0) return 'Ingen i husstanden har login';
      return done
        ? approvers.map((m) => m.name).join(' og ')
        : `Mangler: ${checklist.missingApprovers.join(' og ')}`;
    }
    return null;
  }

  const errorBox = error && (
    <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {error}
    </p>
  );

  if (editing) {
    return (
      <li className="px-4 py-4">
        <form onSubmit={handleSave} className="max-w-2xl space-y-4">
          <div>
            <label htmlFor={`spark-title-${spark.id}`} className={labelClass}>
              Titel
            </label>
            <input
              id={`spark-title-${spark.id}`}
              name="title"
              type="text"
              required
              maxLength={200}
              defaultValue={spark.title}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor={`spark-note-${spark.id}`} className={labelClass}>
              Formål
            </label>
            <textarea
              id={`spark-note-${spark.id}`}
              name="note"
              rows={3}
              maxLength={1000}
              defaultValue={spark.note ?? ''}
              placeholder="Hvorfor vil vi det her?"
              className={fieldClass}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`spark-amount-${spark.id}`} className={labelClass}>
                Beløb, groft (kr)
                {stepCount > 0 && <span className="font-normal text-neutral-400"> (skridtene tæller)</span>}
              </label>
              <AmountInput
                id={`spark-amount-${spark.id}`}
                name="estimated_amount"
                defaultValue={
                  spark.estimated_amount != null ? formatOereForInput(spark.estimated_amount) : ''
                }
                className={amountFieldClass}
              />
            </div>
            <div>
              <label htmlFor={`spark-month-${spark.id}`} className={labelClass}>
                Måned
              </label>
              <input
                id={`spark-month-${spark.id}`}
                name="target_month"
                type="month"
                defaultValue={monthInputValue(spark.target_month)}
                placeholder="ÅÅÅÅ-MM"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor={`spark-owner-${spark.id}`} className={labelClass}>
                Ansvarlig
              </label>
              <select
                id={`spark-owner-${spark.id}`}
                name="owner_member_id"
                defaultValue={spark.owner_member_id ?? ''}
                className={fieldClass}
              >
                <option value="">Vælg</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {approvedUserIds.length > 0 && (
            <p className="text-xs text-neutral-500">
              Gemmer du ændringer, skal alle sige ja igen.
            </p>
          )}
          {errorBox}
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
      </li>
    );
  }

  return (
    <li className="px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium text-neutral-900">
            {linkToSpark ? (
              <Link href={sparkHref} className="hover:underline">
                {spark.title}
              </Link>
            ) : (
              spark.title
            )}
          </p>
          {spark.note && (
            <p className="mt-0.5 whitespace-pre-line break-words text-sm text-neutral-600">
              {spark.note}
            </p>
          )}
          <p className="mt-0.5 text-xs text-neutral-400">{formatCreatedDA(spark.created_at)}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <Pencil className="h-3 w-3" />
          Rediger
        </button>
      </div>

      <ul aria-label="Tjekliste" className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {checklist.items.map((item) => {
          const Icon = item.done ? CircleCheck : Circle;
          const text = detail(item.key, item.done);
          return (
            <li key={item.key} className="flex items-start gap-2 text-sm">
              <Icon
                aria-hidden
                className={`mt-0.5 h-4 w-4 shrink-0 ${item.done ? 'text-emerald-700' : 'text-neutral-300'}`}
              />
              <span className="min-w-0">
                <span className={item.done ? 'text-neutral-900' : 'text-neutral-500'}>
                  {item.label}
                </span>
                <span className="sr-only">{item.done ? ' (opfyldt)' : ' (mangler)'}</span>
                {text && (
                  <span className="block break-words text-xs text-neutral-500">{text}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      {linkToSpark && (
        <Link
          href={sparkHref}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900"
        >
          {stepCount > 0
            ? `${stepCount} skridt${checklist.stepsTotal != null ? `, ${formatAmount(checklist.stepsTotal)} kr` : ''}`
            : 'Bryd ned i skridt'}
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}

      {errorBox}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleApproval}
          aria-pressed={iApproved}
          className={
            iApproved
              ? 'inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100'
              : 'inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100'
          }
        >
          <ThumbsUp className="h-4 w-4" />
          {iApproved ? 'Du har sagt ja' : 'Sig ja'}
        </button>
        <form action={promoteSpark}>
          <input type="hidden" name="id" value={spark.id} />
          <SubmitButton pendingLabel="Opretter…" disabled={!checklist.ready}>
            Gør til projekt
          </SubmitButton>
        </form>
        <form
          action={deleteSpark}
          className="ml-auto"
          onSubmit={(e) => {
            if (
              stepCount > 0 &&
              !window.confirm(`Slet sparken og dens ${stepCount} skridt? Det kan ikke fortrydes.`)
            ) {
              e.preventDefault();
            }
          }}
        >
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
  );
}
