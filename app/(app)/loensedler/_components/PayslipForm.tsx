'use client';

// Form til oprettelse + redigering af en lønseddel.
//
// Struktur: metadata-felter (periode, udbetalingsdato, arbejdsgiver),
// PayslipLinesEditor (dynamiske linjer med fortegns-normalisering),
// saldo-felter (ferie, overarbejde, afspadsering), noter, submit.
//
// Alle saldoer er optional - mange lønsedler viser ikke felter for fx
// afspadsering, og benefits-modtagere har slet ikke ferie-konceptet.

import Link from 'next/link';
import { SubmitButton } from '../../_components/SubmitButton';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import { formatPayslipBalance } from '@/lib/format';
import type { PayslipLineCategory } from '@/lib/database.types';
import { PayslipLinesEditor, STANDARD_STARTER_LINES } from './PayslipLinesEditor';

type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    period_start?: string;
    period_end?: string;
    pay_date?: string | null;
    employer?: string | null;
    feriesaldo_remaining?: number | null;
    overarbejde_remaining?: number | null;
    afspadsering_remaining?: number | null;
    notes?: string | null;
    lines?: {
      raw_label: string;
      amount: number;
      category: PayslipLineCategory;
    }[];
  };
  labelMap: Record<string, PayslipLineCategory>;
  submitLabel: string;
  cancelHref: string;
  error?: string;
};

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

// Default-periode: indeværende kalender-måned. Format YYYY-MM-DD.
function currentMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function currentMonthEnd(): string {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

function formatBalanceForInput(
  hundredths: number | null | undefined
): string {
  if (hundredths == null) return '';
  const value = hundredths / 100;
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1).replace('.', ',');
}

export function PayslipForm({
  action,
  defaultValues = {},
  labelMap,
  submitLabel,
  cancelHref,
  error,
}: Props) {
  const dv = defaultValues;
  const initialLines = dv.lines && dv.lines.length > 0
    ? dv.lines
    : STANDARD_STARTER_LINES;

  return (
    <form action={action} className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Periode + udbetalingsdato + arbejdsgiver */}
      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-medium text-neutral-600">
          Periode og arbejdsgiver
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="period_start" className={labelClass}>
              <span className="inline-flex items-center gap-1">
                Periode-start
                <InfoTooltip>
                  Den første dag lønsedlen dækker - typisk den 1. i måneden.
                </InfoTooltip>
              </span>
            </label>
            <input
              id="period_start"
              name="period_start"
              type="date"
              required
              defaultValue={dv.period_start ?? currentMonthStart()}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="period_end" className={labelClass}>
              <span className="inline-flex items-center gap-1">
                Periode-slut
                <InfoTooltip>
                  Den sidste dag lønsedlen dækker - typisk sidste dag i
                  måneden.
                </InfoTooltip>
              </span>
            </label>
            <input
              id="period_end"
              name="period_end"
              type="date"
              required
              defaultValue={dv.period_end ?? currentMonthEnd()}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pay_date" className={labelClass}>
              Udbetalingsdato <span className="text-neutral-400">(valgfri)</span>
            </label>
            <input
              id="pay_date"
              name="pay_date"
              type="date"
              defaultValue={dv.pay_date ?? ''}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="employer" className={labelClass}>
              Arbejdsgiver <span className="text-neutral-400">(valgfri)</span>
            </label>
            <input
              id="employer"
              name="employer"
              type="text"
              defaultValue={dv.employer ?? ''}
              placeholder="Acme A/S"
              className={fieldClass}
              maxLength={100}
            />
          </div>
        </div>
      </fieldset>

      {/* Linjer */}
      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-medium text-neutral-600">
          Linjer på lønsedlen
        </legend>
        <p className="mb-3 text-xs text-neutral-500">
          Indtast hver post fra lønsedlen som en linje: bruttoløn, tillæg,
          AM-bidrag, A-skat, pension osv. Brug kategorierne så vi over tid
          kan forstå din lønseddel og spotte afvigelser.
        </p>
        <PayslipLinesEditor
          initialLines={initialLines}
          labelMap={labelMap}
        />
      </fieldset>

      {/* Saldoer */}
      <fieldset className="rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-xs font-medium text-neutral-600">
          Saldoer på lønsedlen
          <span className="ml-1 text-[11px] font-normal text-neutral-400">
            (valgfri, men det vi bedst kan hjælpe med over tid)
          </span>
        </legend>
        <p className="mb-3 text-xs text-neutral-500">
          Hvis din lønseddel viser saldoer for ferie, overarbejde eller
          afspadsering, så skriv dem her. Det er de tal vi tracker fra måned
          til måned så du kan se din udvikling.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="feriesaldo_remaining" className={labelClass}>
              <span className="inline-flex items-center gap-1">
                Feriedage tilbage
                <InfoTooltip>
                  Resterende feriedage. Skrives som tal med komma fx 18,5.
                  Det tal er typisk svært at holde styr på i hovedet - vi
                  tracker det for dig over tid.
                </InfoTooltip>
              </span>
            </label>
            <input
              id="feriesaldo_remaining"
              name="feriesaldo_remaining"
              type="text"
              inputMode="decimal"
              defaultValue={formatBalanceForInput(dv.feriesaldo_remaining)}
              placeholder="fx 18,5"
              className={fieldClass}
              maxLength={10}
            />
            {dv.feriesaldo_remaining != null && (
              <p className="mt-1 text-[11px] text-neutral-500">
                Sidst registreret: {formatPayslipBalance(dv.feriesaldo_remaining, 'dage')}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="overarbejde_remaining" className={labelClass}>
              <span className="inline-flex items-center gap-1">
                Overarbejde timer
                <InfoTooltip>
                  Antal opsparede overarbejdstimer (ikke afspadseret/udbetalt
                  endnu).
                </InfoTooltip>
              </span>
            </label>
            <input
              id="overarbejde_remaining"
              name="overarbejde_remaining"
              type="text"
              inputMode="decimal"
              defaultValue={formatBalanceForInput(dv.overarbejde_remaining)}
              placeholder="fx 12,5"
              className={fieldClass}
              maxLength={10}
            />
          </div>
          <div>
            <label htmlFor="afspadsering_remaining" className={labelClass}>
              <span className="inline-flex items-center gap-1">
                Afspadsering timer
                <InfoTooltip>
                  Flex- eller afspadseringssaldo - timer du kan tage fri
                  for senere.
                </InfoTooltip>
              </span>
            </label>
            <input
              id="afspadsering_remaining"
              name="afspadsering_remaining"
              type="text"
              inputMode="decimal"
              defaultValue={formatBalanceForInput(dv.afspadsering_remaining)}
              placeholder="fx 4,0"
              className={fieldClass}
              maxLength={10}
            />
          </div>
        </div>
      </fieldset>

      {/* Noter */}
      <div>
        <label htmlFor="notes" className={labelClass}>
          Noter <span className="text-neutral-400">(valgfri)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={dv.notes ?? ''}
          maxLength={1000}
          placeholder="Eventuelle bemærkninger om denne lønseddel …"
          className={fieldClass}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-200 pt-4">
        <Link
          href={cancelHref}
          className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        >
          Annuller
        </Link>
        <SubmitButton pendingLabel="Gemmer…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
