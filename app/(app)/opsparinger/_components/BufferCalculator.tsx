'use client';

// Buffer-kalkulator: bruger indtaster et månedligt indskud, vi viser hvor
// lang tid der går før bufferen kan dække 1, 3, 6 og 12 mdr af husstandens
// faste udgifter.
//
// Det modsatte spørgsmål af "hvor meget skal jeg sætte til side for at nå
// 3 mdr buffer på 12 mdr?" — i stedet starter brugeren fra hvad de
// realistisk kan afsætte og ser så timelinen for målene. Mere ærligt: ingen
// abstrakt "anbefalet"-tal der ikke matcher virkeligheden.
//
// Antagelse: starter ved 0 kr (vi har ikke saldo-data i appen, kun flow).
// Hvis brugeren allerede har sparet op, kan de selv mentalt fortolke
// tabellen som "fra mit nuværende niveau".

import { useState } from 'react';
import { formatAmount, formatOereForInput, parseAmountToOere } from '@/lib/format';
import { AmountInput } from '../../_components/AmountInput';

const MILESTONES: { months: number; label: string }[] = [
  { months: 1, label: '1 måned' },
  { months: 3, label: '3 måneder' },
  { months: 6, label: '6 måneder' },
  { months: 12, label: '12 måneder' },
];

type Props = {
  // Sum af recurring expense-transactions / md, fra getHouseholdFinancialSummary.
  monthlyFixedExpenses: number;
  // Kontoens nuværende månedlige indskud (recurring transfers ind),
  // bruges som default for inputtet så kalkulatoren straks viser noget
  // meningsfuldt for brugere der allerede har en buffer i gang.
  defaultMonthlyContribution: number;
};

export function BufferCalculator({
  monthlyFixedExpenses,
  defaultMonthlyContribution,
}: Props) {
  const [contributionStr, setContributionStr] = useState(
    defaultMonthlyContribution > 0
      ? formatOereForInput(defaultMonthlyContribution)
      : ''
  );

  const contribution = parseAmountToOere(contributionStr) ?? 0;

  // Beregn tid-til-mål for hver milestone. Hvis bidrag = 0 returnerer vi
  // null (vises som —). Hvis tiden er > 50 år (600 mdr) er det praktisk
  // talt aldrig — vis advarsel i stedet for et meningsløst tal.
  function monthsUntil(targetMonths: number): number | null {
    if (contribution <= 0) return null;
    const target = monthlyFixedExpenses * targetMonths;
    const months = Math.ceil(target / contribution);
    if (months > 600) return null;
    return months;
  }

  function formatDuration(months: number): string {
    if (months < 12) return `${months} mdr`;
    const years = Math.floor(months / 12);
    const remainder = months % 12;
    if (remainder === 0) return `${years} år`;
    return `${years} år, ${remainder} mdr`;
  }

  return (
    <div className="space-y-3 text-xs">
      <div
        onInput={(e) => {
          const t = e.target as HTMLInputElement;
          if (t.name === 'buffer-contribution') setContributionStr(t.value);
        }}
      >
        <label
          htmlFor="buffer-contribution"
          className="block text-[10px] font-medium uppercase tracking-wider text-neutral-500"
        >
          Hvad kan I lægge til side hver måned?
        </label>
        <div className="mt-1.5">
          <AmountInput
            id="buffer-contribution"
            name="buffer-contribution"
            defaultValue={contributionStr}
            placeholder="500.00"
          />
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          Indtast et realistisk månedligt beløb. Vi regner hvor lang tid der
          går før bufferen kan dække jeres faste udgifter.
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Dækning</th>
              <th className="px-3 py-1.5 text-right font-medium">Beløb</th>
              <th className="px-3 py-1.5 text-right font-medium">Tid til mål</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {MILESTONES.map((m) => {
              const target = monthlyFixedExpenses * m.months;
              const months = monthsUntil(m.months);
              return (
                <tr key={m.months}>
                  <td className="px-3 py-1.5 text-neutral-700">{m.label}</td>
                  <td className="px-3 py-1.5 text-right tabnum font-mono text-neutral-700">
                    {formatAmount(target)} kr
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabnum font-mono ${
                      months == null ? 'text-neutral-400' : 'text-neutral-900'
                    }`}
                  >
                    {months == null
                      ? contribution <= 0
                        ? '—'
                        : '> 50 år'
                      : formatDuration(months)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-neutral-500">
        Faste udgifter:{' '}
        <span className="tabnum font-mono">
          {formatAmount(monthlyFixedExpenses)}
        </span>{' '}
        kr/md. Beregningen antager I starter fra 0 — har I allerede en buffer,
        skal I trække den fra målbeløbet selv.
      </p>
    </div>
  );
}
