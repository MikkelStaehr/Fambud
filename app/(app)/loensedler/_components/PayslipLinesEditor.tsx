'use client';

// Dynamisk linje-editor: brugeren tilføjer/fjerner rækker for hver
// post på lønsedlen (grundløn, tillæg, AM-bidrag, A-skat, pension osv.).
//
// Klassifikations-læring: når en bruger skriver et label form'en har set
// før (fx "Holddrift-tillæg"), foreslår vi automatisk samme kategori som
// sidst. labelMap fodres fra DAL via getPayslipLabelMap. Brugeren kan
// frit overskrive forslaget.
//
// Form-submission: rækkerne sendes som parallelle arrays via inputs
// med samme name (line_label, line_amount, line_category). Server-
// action zipper dem via formData.getAll().

import { useState, useId } from 'react';
import { Plus, Trash2, Info } from 'lucide-react';
import { AmountInput } from '../../_components/AmountInput';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import {
  formatOereForInput,
  PAYSLIP_LINE_CATEGORY_LABEL_DA,
  PAYSLIP_LINE_CATEGORY_TOOLTIP_DA,
} from '@/lib/format';
import type { PayslipLineCategory } from '@/lib/database.types';

type LineRow = {
  // Stabilt UI-id (ikke gemt i DB). Bruges som React-key så remove
  // ikke flipper inputs rundt.
  uiKey: string;
  raw_label: string;
  // Brugeren skriver altid positive tal her (vist som-is i input).
  // Server normaliserer fortegn ud fra category før insert.
  amountInput: string;
  category: PayslipLineCategory;
};

type Props = {
  // Initial rækker (tom for nye, fyldt med eksisterende ved edit).
  initialLines?: {
    raw_label: string;
    amount: number; // signed øre
    category: PayslipLineCategory;
  }[];
  // Mapping fra raw_label.toLowerCase().trim() til kategori, baseret
  // på husstandens tidligere klassifikationer. Empty map for første
  // gangs-brugere.
  labelMap: Record<string, PayslipLineCategory>;
};

const CATEGORY_ORDER: PayslipLineCategory[] = [
  'grundlon',
  'tillaeg',
  'feriepenge_optjent',
  'pension_arbejdsgiver',
  'pension_egen',
  'atp',
  'am_bidrag',
  'a_skat',
  'akasse',
  'fagforening',
  'fradrag_andet',
  'andet',
];

const inputClass =
  'block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

function newRow(): LineRow {
  return {
    uiKey: crypto.randomUUID(),
    raw_label: '',
    amountInput: '',
    category: 'andet',
  };
}

function rowFromInitial(line: {
  raw_label: string;
  amount: number;
  category: PayslipLineCategory;
}): LineRow {
  return {
    uiKey: crypto.randomUUID(),
    raw_label: line.raw_label,
    // Input viser altid absolutbeløb - brugeren skrev oprindeligt
    // positivt og vi normaliserede fortegn på server.
    amountInput: formatOereForInput(Math.abs(line.amount)),
    category: line.category,
  };
}

export function PayslipLinesEditor({ initialLines, labelMap }: Props) {
  const reactId = useId();
  const [rows, setRows] = useState<LineRow[]>(() => {
    if (initialLines && initialLines.length > 0) {
      return initialLines.map(rowFromInitial);
    }
    // Start med 4 tomme rækker så brugeren ser at det er en flerlinje-form
    return [newRow(), newRow(), newRow(), newRow()];
  });

  function updateRow(uiKey: string, patch: Partial<LineRow>) {
    setRows((prev) =>
      prev.map((row) => (row.uiKey === uiKey ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(uiKey: string) {
    setRows((prev) => prev.filter((row) => row.uiKey !== uiKey));
  }

  // Når label loses focus og vi har en kendt klassifikation, foreslå
  // den til kategori. Vi overskriver KUN hvis kategori stadig er
  // default 'andet' - så vi ikke trampler brugerens eget valg.
  function handleLabelBlur(uiKey: string, value: string) {
    const key = value.trim().toLowerCase();
    if (!key) return;
    const suggested = labelMap[key];
    if (!suggested) return;
    setRows((prev) =>
      prev.map((row) => {
        if (row.uiKey !== uiKey) return row;
        if (row.category !== 'andet') return row;
        return { ...row, category: suggested };
      })
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div
          key={row.uiKey}
          className="grid gap-2 rounded-md border border-neutral-200 bg-stone-50 p-3 sm:grid-cols-[2fr_1fr_1.4fr_auto] sm:items-end"
        >
          <div>
            <label
              htmlFor={`${reactId}-label-${idx}`}
              className="block text-[11px] font-medium text-neutral-600"
            >
              Tekst på lønseddel
            </label>
            <input
              id={`${reactId}-label-${idx}`}
              type="text"
              name="line_label"
              value={row.raw_label}
              onChange={(e) =>
                updateRow(row.uiKey, { raw_label: e.target.value })
              }
              onBlur={(e) => handleLabelBlur(row.uiKey, e.target.value)}
              placeholder="Bruttoløn, A-skat, AM-bidrag …"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor={`${reactId}-amount-${idx}`}
              className="block text-[11px] font-medium text-neutral-600"
            >
              Beløb (kr)
            </label>
            <AmountInput
              id={`${reactId}-amount-${idx}`}
              name="line_amount"
              defaultValue={row.amountInput}
              placeholder="0.00"
              className="block w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-right font-mono tabnum text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label
              htmlFor={`${reactId}-cat-${idx}`}
              className="block text-[11px] font-medium text-neutral-600"
            >
              <span className="inline-flex items-center gap-1">
                Kategori
                <InfoTooltip>
                  {PAYSLIP_LINE_CATEGORY_TOOLTIP_DA[row.category]}
                </InfoTooltip>
              </span>
            </label>
            <select
              id={`${reactId}-cat-${idx}`}
              name="line_category"
              value={row.category}
              onChange={(e) =>
                updateRow(row.uiKey, {
                  category: e.target.value as PayslipLineCategory,
                })
              }
              className={inputClass}
            >
              {CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat}>
                  {PAYSLIP_LINE_CATEGORY_LABEL_DA[cat]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex sm:justify-end">
            <button
              type="button"
              onClick={() => removeRow(row.uiKey)}
              aria-label="Fjern række"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sm:hidden">Fjern række</span>
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-900 hover:bg-neutral-50"
      >
        <Plus className="h-4 w-4" />
        Tilføj linje
      </button>

      <p className="inline-flex items-start gap-1.5 text-[11px] text-neutral-500">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Skriv altid positive tal. Fradrag (AM-bidrag, A-skat osv.) gemmes
        automatisk som negative ud fra kategorien.
      </p>
    </div>
  );
}

// Genbruges af PayslipForm til at lave standard-rækker når brugeren
// opretter sin første lønseddel: grundløn, AM-bidrag, A-skat. Tre
// almindelige felter forudfyldt med tomme beløb, så onboarding-
// frictionen er minimal.
export const STANDARD_STARTER_LINES: {
  raw_label: string;
  amount: number;
  category: PayslipLineCategory;
}[] = [
  { raw_label: 'Bruttoløn', amount: 0, category: 'grundlon' },
  { raw_label: 'AM-bidrag', amount: 0, category: 'am_bidrag' },
  { raw_label: 'A-skat', amount: 0, category: 'a_skat' },
  { raw_label: 'ATP', amount: 0, category: 'atp' },
];
