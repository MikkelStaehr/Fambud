// "Allokér dit overskud": en prioriterings-guide for det den indloggede
// bruger har TILBAGE hver måned (dashboardets Privat-net). Arbejder på det
// FAKTISKE overskud - ikke opdigtede penge - og giver en gennemsigtig
// prioritetsrækkefølge fra standard personlig økonomi:
//   1. buffer (sikkerhed)  2. dyreste gæld  3. mål/begivenheder  4. fri opsparing
//
// Bevidst ikke prækriptive kr-beløb pr. trin (det ville blive lige så naivt
// som "find 10k"); i stedet rationalet bag hver prioritet, så parret selv
// fordeler deres overskud klogt.

import { formatAmount } from '@/lib/format';
import { extraPaymentImpact } from '@/lib/economy-plan';

type Props = {
  surplus: number;
  bufferOnTrack: boolean;
  mostExpensiveLoan: {
    name: string;
    rate: number;
    balance: number;
    monthlyPayment: number;
  } | null;
};

type Step = { title: string; body: React.ReactNode };

// Et relaterbart "hvad nu hvis"-beløb til at illustrere effekten af ekstra
// afdrag. 1.000 kr/md er lille nok til at virke opnåeligt, men stort nok til
// at vise tydelig effekt.
const ILLUSTRATIVE_EXTRA = 100_000; // 1.000 kr i øre

function formatMonthsSaved(months: number): string {
  if (months < 12) return `${months} mdr.`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const yLabel = years === 1 ? '1 år' : `${years} år`;
  return rem === 0 ? yLabel : `${yLabel} ${rem} mdr.`;
}

export function AllokerSection({
  surplus,
  bufferOnTrack,
  mostExpensiveLoan,
}: Props) {
  if (surplus <= 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-600">
        Du har ikke noget overskud at fordele lige nu - dit private forbrug og
        dine overførsler bruger hele din indkomst. Kig på{' '}
        <span className="font-medium text-neutral-900">Poster</span> for at se
        hvor der eventuelt kan skæres.
      </div>
    );
  }

  const steps: Step[] = [];

  if (!bufferOnTrack) {
    steps.push({
      title: 'Byg din buffer op',
      body: (
        <>
          Din økonomiske sikkerhed kommer først. Læg en fast del her hver måned
          indtil 3-måneders-bufferen er på plads - så er I dækket hvis indkomsten
          pludselig falder bort.
        </>
      ),
    });
  }

  if (mostExpensiveLoan) {
    // Konkret effekt af et relaterbart ekstra-afdrag, hvis vi har restgæld +
    // ydelse. Gør rådet håndgribeligt frem for abstrakt.
    const impact = extraPaymentImpact({
      balance: mostExpensiveLoan.balance,
      annualRatePct: mostExpensiveLoan.rate,
      monthlyPayment: mostExpensiveLoan.monthlyPayment,
      extraMonthly: ILLUSTRATIVE_EXTRA,
    });
    steps.push({
      title: 'Ekstra afdrag på dyreste lån',
      body: (
        <>
          <span className="font-medium text-neutral-900">
            {mostExpensiveLoan.name}
          </span>{' '}
          har den højeste rente ({mostExpensiveLoan.rate}%), så ekstra afdrag
          her sparer dig mest.{' '}
          {impact && impact.monthsSaved > 0 ? (
            <>
              Lægger du fx{' '}
              <span className="font-medium text-neutral-900">
                {formatAmount(ILLUSTRATIVE_EXTRA)} kr ekstra
              </span>{' '}
              på det hver måned, er lånet betalt ud{' '}
              <span className="font-semibold text-emerald-800">
                {formatMonthsSaved(impact.monthsSaved)}
              </span>{' '}
              tidligere, og du sparer ca.{' '}
              <span className="tabnum font-mono font-semibold text-emerald-800">
                {formatAmount(impact.interestSaved)} kr
              </span>{' '}
              i rente over lånets løbetid.
            </>
          ) : (
            <>
              Hver ekstra krone går direkte til at nedbringe gælden og give et
              garanteret {'“'}afkast{'”'} svarende til renten.
            </>
          )}
        </>
      ),
    });
  }

  steps.push({
    title: 'Sæt til side til jeres mål',
    body: (
      <>
        Planlagte begivenheder (ferie, bil, ny bolig) bliver billigere at
        håndtere når I sparer op løbende i stedet for at låne til dem.
      </>
    ),
  });

  steps.push({
    title: 'Fri opsparing eller investering',
    body: (
      <>
        Når buffer og dyr gæld er håndteret, kan resten arbejde langsigtet -
        fx aktiesparekonto eller pension afhængigt af jeres horisont.
      </>
    ),
  });

  return (
    <div className="rounded-lg border border-emerald-200 bg-white">
      <div className="border-b border-emerald-100 bg-emerald-50/60 px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Du har tilbage hver måned
        </div>
        <div className="tabnum mt-0.5 font-mono text-2xl font-semibold text-emerald-800">
          {formatAmount(surplus)} kr
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">
          Efter dit private forbrug og dine overførsler. Sådan får du mest ud af
          det, i prioriteret rækkefølge:
        </p>
      </div>

      <ol className="divide-y divide-neutral-100">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[11px] font-semibold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-900">
                {s.title}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
