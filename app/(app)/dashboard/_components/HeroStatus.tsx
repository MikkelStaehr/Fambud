// Dashboardets hero-tile: "Er du på rette spor?" - det første brugeren ser
// efter velkomst-headeren. Svaret er nettoflow for indeværende måned med en
// kort interpretiv linje ("du har overskud", "udgifter overstiger indtægter")
// så folk uden saldo-baggrund også kan aflæse status med ét blik.
//
// Vi viser bevidst ikke noget "trygt at bruge"-tal - det ville kræve
// saldo-data vi ikke har. Hero'en er ren cashflow.

import { formatAmount } from '@/lib/format';
import { InfoTooltip } from '@/app/_components/InfoTooltip';

type Props = {
  income: number;
  expense: number;
  net: number;
  monthLabel: string;  // fx "April 2026" - allerede capitalized
  // Familiemedlemmer der har primary_income_source sat men ingen paychecks
  // registreret. Bruges til at forklare et tilsyneladende underskud - fx
  // når Mikkel's løn er registreret men Louise's mangler, ser husstands-
  // tallet rødt ud uden at det reelt er et problem.
  missingIncomeContributors?: string[];
};

// Beløbsgrænser for fortolkning. Tærsklerne er bevidst forsigtige - vi vil
// hellere sige "du går omtrent lige op" end at fejre 200 kr som overskud.
const SMALL_OERE = 50_000; // 500 kr

function statusFor(net: number): { label: string; tone: 'positive' | 'neutral' | 'negative' } {
  if (net > SMALL_OERE) return { label: 'Du har overskud denne måned', tone: 'positive' };
  if (net >= -SMALL_OERE) return { label: 'Du går omtrent lige op', tone: 'neutral' };
  return { label: 'Dine udgifter overstiger dine indtægter', tone: 'negative' };
}

export function HeroStatus({
  income,
  expense,
  net,
  monthLabel,
  missingIncomeContributors = [],
}: Props) {
  const status = statusFor(net);
  // Hvis der er bidragydere uden registreret indkomst, viser vi en notis
  // uanset om net er positivt eller negativt. Tidligere viste vi den kun
  // ved underskud - men selv et "positivt" tal kan være misvisende hvis
  // det forventede partner-bidrag mangler. Brugeren skal vide at billedet
  // ikke er komplet før de tager beslutninger på baggrund af det.
  const showMissingIncomeNotice = missingIncomeContributors.length > 0;
  const netSign = net >= 0 ? '+' : '−';
  const netClass =
    net > 0
      ? 'text-emerald-800'
      : net < 0
        ? 'text-red-900'
        : 'text-neutral-900';
  const statusToneClass = {
    positive: 'text-emerald-800',
    neutral: 'text-neutral-600',
    negative: 'text-red-900',
  }[status.tone];

  return (
    <section
      data-tour="hero-status"
      className="mt-6 overflow-hidden rounded-lg border border-neutral-200 bg-white"
    >
      <div className="flex items-baseline justify-between border-b border-neutral-100 px-5 py-3">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Er du på rette spor?
          <InfoTooltip>
            Husstandens samlede netto for den aktuelle måned: indtægter
            (forecast fra 3 seneste lønudbetalinger + recurring income)
            minus alle faste udgifter på tværs af jeres konti. Et negativt
            tal betyder ikke nødvendigvis krise - tjek om en bidragyder
            mangler at registrere sin løn.
          </InfoTooltip>
        </h2>
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {monthLabel}
        </span>
      </div>
      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <div className={`tabnum font-mono text-3xl font-semibold sm:text-4xl ${netClass}`}>
          {netSign} {formatAmount(Math.abs(net))} kr
        </div>
        <p className={`mt-1 text-sm font-medium ${statusToneClass}`}>
          {status.label}
        </p>

        {showMissingIncomeNotice && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="font-medium">
              Tallet er ikke komplet -{' '}
              {missingIncomeContributors.length === 1
                ? `${missingIncomeContributors[0]} har endnu ingen indkomst registreret.`
                : `${missingIncomeContributors.join(' og ')} har endnu ingen indkomst registreret.`}
            </span>{' '}
            {net < 0
              ? 'Underskuddet løses sandsynligvis når lønnen er logget, men husstandens billede er først retvisende når alle bidragydere har registreret deres indkomst.'
              : 'Husstandens nettoflow vises højere/lavere end det reelt er, indtil alle bidragydere har registreret deres indkomst.'}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-2">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Indtægter
            </div>
            <div className="tabnum mt-1 font-mono text-base font-semibold text-emerald-800">
              + {formatAmount(income)}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Udgifter
            </div>
            <div className="tabnum mt-1 font-mono text-base font-semibold text-red-900">
              − {formatAmount(expense)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
