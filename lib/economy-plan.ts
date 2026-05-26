// Økonomi-rådgiveren: rene funktioner der omsætter husstandens indtastede
// data til konkrete anbefalinger. Ligesom cashflow-analysis.ts er det IKKE
// en ML-model - bare gennemsigtige regler ("fordel fælles udgifter efter
// indkomst", "buffer = 3 mdr. faste udgifter"). Lever adskilt fra DAL'en så
// logikken kan testes og genbruges uden DB.

// ----------------------------------------------------------------------------
// Fordeling af fælles udgifter
// ----------------------------------------------------------------------------
// Vi viser TO modeller side om side, så parret selv kan vælge:
//   • proportional - hver betaler sin andel af de fælles udgifter i forhold
//     til sin indkomst (den der tjener mest, betaler mest). Fair når
//     indkomsterne er skæve.
//   • equal (50/50) - alle bidragydere betaler lige meget uanset indkomst.
//
// Alle beløb er øre/md (bigint-konvention fra resten af appen).

export type PlanMember = {
  id: string;
  name: string;
  userId: string | null;
  monthlyIncome: number;        // forecast netto/md, eller bedste skøn
  incomeComplete: boolean;      // 3+ lønsedler registreret (ellers usikkert)
  currentContribution: number;  // nuværende månedlige overførsler til fælles
};

export type MemberShare = {
  member: PlanMember;
  proportional: number;  // anbefalet andel - indkomst-proportional
  equal: number;         // anbefalet andel - 50/50
  current: number;       // nuværende bidrag
};

export type FaellesSplit = {
  total: number;          // samlede fælles udgifter/md
  totalIncome: number;    // sum af bidragydernes indkomst
  members: MemberShare[];
  // True hvis mindst én bidragyders indkomst er ufuldstændig - så den
  // proportionale fordeling er et foreløbigt skøn.
  hasIncompleteIncome: boolean;
};

export function splitFaellesExpenses(
  members: PlanMember[],
  total: number
): FaellesSplit {
  const totalIncome = members.reduce((s, m) => s + m.monthlyIncome, 0);
  const n = Math.max(1, members.length);
  const equalShare = Math.round(total / n);

  return {
    total,
    totalIncome,
    hasIncompleteIncome: members.some((m) => !m.incomeComplete),
    members: members.map((m) => ({
      member: m,
      // Hvis ingen indkomst er registreret endnu, falder vi tilbage til
      // ligedeling så den proportionale kolonne ikke bliver 0 for alle.
      proportional:
        totalIncome > 0
          ? Math.round(total * (m.monthlyIncome / totalIncome))
          : equalShare,
      equal: equalShare,
      current: m.currentContribution,
    })),
  };
}

// ----------------------------------------------------------------------------
// Buffer-anbefaling (flow-orienteret)
// ----------------------------------------------------------------------------
// Klassisk tommelfingerregel: en buffer på 3 måneders faste udgifter dækker
// de fleste pludselige tab af indkomst. Appen har ingen saldo-data (kun
// flow), så vi kan ikke sige "du mangler X på din buffer". I stedet regner vi
// målbeløbet og viser, ud fra hvad I PT. indskyder månedligt, hvor lang tid
// der går før målet er nået - og en anbefalet rate hvis I vil nå det hurtigere.
export type BufferPlan = {
  coverMonths: number;          // mål: antal måneders dækning
  target: number;               // målbeløb (coverMonths * faste udgifter)
  monthlyFixedExpenses: number;
  currentMonthly: number;       // nuværende månedlige indskud til buffer
  reachInMonths: number;        // tidshorisont for anbefalet rate
  recommendedMonthly: number;   // rate der når målet på reachInMonths
  monthsAtCurrentRate: number | null; // tid ved nuværende rate (null hvis 0)
};

export function bufferRecommendation(
  monthlyFixedExpenses: number,
  currentMonthly: number,
  opts: { coverMonths?: number; reachInMonths?: number } = {}
): BufferPlan {
  const coverMonths = opts.coverMonths ?? 3;
  const reachInMonths = opts.reachInMonths ?? 12;
  const target = monthlyFixedExpenses * coverMonths;
  const recommendedMonthly =
    reachInMonths > 0 ? Math.round(target / reachInMonths) : 0;
  const monthsAtCurrentRate =
    currentMonthly > 0 ? Math.ceil(target / currentMonthly) : null;
  return {
    coverMonths,
    target,
    monthlyFixedExpenses,
    currentMonthly,
    reachInMonths,
    recommendedMonthly,
    monthsAtCurrentRate,
  };
}
