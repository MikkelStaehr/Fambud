// Mini måned-mod-måned-trend for variabelt forbrug. Tager 6 datapunkter
// fra DAL'en og viser dem som små lodrette bjælker - aktuel måned
// fremhævet, med en kort sammenligning mod 3-måneders-gennemsnittet
// nedenunder. Spiir-style "udgiver du mere end normalt?"-blink.
//
// Kun once-poster med kategori=expense indgår (det er det BOGFØRTE
// forbrug pr. måned). Faste regninger er stabile og ville bare flade
// trenden ud - de er allerede dækket i /budget og rapporten.

import { formatAmount } from '@/lib/format';
import { InfoTooltip } from '@/app/_components/InfoTooltip';
import type { MonthlyExpenseTrendPoint } from '@/lib/dal';

type Props = {
  points: MonthlyExpenseTrendPoint[];
};

export function MonthlyTrendWidget({ points }: Props) {
  // Tomt-state: ingen poster i vinduet endnu. Vi viser en tør placeholder
  // frem for at skjule hele kortet - det er stadig informativt at vide
  // hvor trenden VIL dukke op når der er data.
  const hasData = points.some((p) => p.total > 0);
  const max = Math.max(...points.map((p) => p.total), 1);
  const current = points[points.length - 1]!;
  const past = points.slice(0, -1);
  const pastAvg =
    past.length > 0
      ? Math.round(past.reduce((s, p) => s + p.total, 0) / past.length)
      : 0;
  const diff = current.total - pastAvg;
  const diffPct =
    pastAvg > 0 ? Math.round((diff * 100) / pastAvg) : null;

  return (
    <section className="rounded-md border border-neutral-200 bg-white p-4 sm:p-5">
      <h2 className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Variabelt månedsforbrug
        <InfoTooltip>
          Summen af bogførte poster (once-transaktioner) pr. måned. Faste
          regninger udelades så du ser det der VARIERER fra måned til måned.
          Den nuværende måned akkumulerer stadig.
        </InfoTooltip>
      </h2>

      {hasData ? (
        <>
          {/* Bars-row: 6 lodrette bjælker med kort månedsnavn under. Højde
              proportional til max(total) så den højeste måned altid fylder
              fuld bar-højde. */}
          <div className="mt-3 flex h-20 items-end gap-1.5">
            {points.map((p, i) => {
              const isCurrent = i === points.length - 1;
              const pct = (p.total / max) * 100;
              return (
                <div key={p.yearMonth} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-16 w-full items-end">
                    <div
                      className={`w-full rounded-t ${
                        isCurrent
                          ? 'bg-emerald-700'
                          : 'bg-neutral-200'
                      }`}
                      style={{ height: `${Math.max(pct, 4)}%` }}
                      title={`${p.monthLabel}: ${formatAmount(p.total)} kr`}
                    />
                  </div>
                  <span
                    className={`text-[10px] ${
                      isCurrent ? 'font-medium text-neutral-900' : 'text-neutral-400'
                    }`}
                  >
                    {p.monthLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Sammenligning. Hvis intet historisk gennemsnit (alle past=0),
              viser vi blot den nuværende månedssum. */}
          <div className="mt-3 text-sm">
            <div className="tabnum font-mono font-semibold text-neutral-900">
              {formatAmount(current.total)} kr
              <span className="ml-1 text-xs font-normal text-neutral-500">
                denne måned
              </span>
            </div>
            {diffPct != null && (
              <div className="mt-0.5 text-xs">
                {diff > 0 ? (
                  <span className="text-amber-700">
                    +{diffPct}% vs. 3-måneders-gennemsnit ({formatAmount(pastAvg)} kr)
                  </span>
                ) : diff < 0 ? (
                  <span className="text-emerald-700">
                    {diffPct}% vs. 3-måneders-gennemsnit ({formatAmount(pastAvg)} kr)
                  </span>
                ) : (
                  <span className="text-neutral-500">
                    Samme som 3-måneders-gennemsnit
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">
          Ingen bogførte poster de seneste måneder endnu. Tilføj poster på{' '}
          <span className="text-neutral-700">/poster</span> så fylder trenden
          sig op.
        </p>
      )}
    </section>
  );
}
