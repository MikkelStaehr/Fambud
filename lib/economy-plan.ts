// Økonomi-rådgiveren: rene funktioner der omsætter husstandens indtastede
// data til konkrete anbefalinger. Ligesom cashflow-analysis.ts er det IKKE
// en ML-model - bare gennemsigtige regler ("fordel fælles udgifter efter
// indkomst", "buffer = 3 mdr. faste udgifter"). Lever adskilt fra DAL'en så
// logikken kan testes og genbruges uden DB.

import type { CategoryGroup } from './categories';

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

// ----------------------------------------------------------------------------
// Ekstra-afdrag: håndgribelig effekt af at lægge lidt ekstra på et lån
// ----------------------------------------------------------------------------
// Vi simulerer amortisering måned for måned (ikke en lukket formel) så vi kan
// vise konkret: hvor mange måneder hurtigere er lånet ud, og hvor meget rente
// spares - de tal gør "ekstra afdrag" personligt for brugeren i stedet for et
// abstrakt "garanteret afkast".
//
// Alle beløb i øre. annualRatePct er fx 4 for 4%.
export type ExtraPaymentImpact = {
  extraMonthly: number;
  monthsBaseline: number;
  monthsWithExtra: number;
  monthsSaved: number;
  interestSaved: number;
};

function amortize(
  balance: number,
  monthlyRate: number,
  payment: number
): { months: number; totalInterest: number } | null {
  let b = balance;
  let totalInterest = 0;
  let months = 0;
  // Max 1200 mdr (100 år) som sikkerhedsventil mod uendelig løkke når ydelsen
  // knap dækker renten.
  while (b > 0 && months < 1200) {
    const interest = Math.round(b * monthlyRate);
    const principal = payment - interest;
    if (principal <= 0) return null; // ydelsen dækker ikke renten - betales aldrig ud
    b -= principal;
    totalInterest += interest;
    months++;
  }
  if (b > 0) return null;
  return { months, totalInterest };
}

export function extraPaymentImpact(opts: {
  balance: number;
  annualRatePct: number;
  monthlyPayment: number;
  extraMonthly: number;
}): ExtraPaymentImpact | null {
  const { balance, annualRatePct, monthlyPayment, extraMonthly } = opts;
  if (balance <= 0 || monthlyPayment <= 0) return null;
  const monthlyRate = annualRatePct / 100 / 12;
  const baseline = amortize(balance, monthlyRate, monthlyPayment);
  if (!baseline) return null;
  const withExtra = amortize(balance, monthlyRate, monthlyPayment + extraMonthly);
  if (!withExtra) return null;
  return {
    extraMonthly,
    monthsBaseline: baseline.months,
    monthsWithExtra: withExtra.months,
    monthsSaved: baseline.months - withExtra.months,
    interestSaved: baseline.totalInterest - withExtra.totalInterest,
  };
}

// ----------------------------------------------------------------------------
// 50/30/20-budgetmodel
// ----------------------------------------------------------------------------
// Tommelfingerregel: ~50% af nettoindkomsten til nødvendigheder, ~30% til
// forbrug/lyst, ~20% til opsparing. Vi anvender den på DEN INDLOGGEDE BRUGERS
// økonomi (ikke husstanden) - partnerens private forbrug er skjult via RLS,
// så et husstands-tal ville være ufuldstændigt.
//
// Klassificeringen er bevidst GENNEMSIGTIG (vi viser hvilke grupper der
// tæller som nødvendigt vs. forbrug) frem for en sort boks - så brugeren selv
// kan vurdere om mappingen passer. Bidrag til fælleskonti regnes som
// nødvendigt (husleje, mad, børn er typisk det fælles dækker).
export const GROUP_BUCKET: Record<CategoryGroup, 'needs' | 'wants'> = {
  'Bolig & lån': 'needs',
  'Forsyning & forsikring': 'needs',
  Transport: 'needs',
  Børn: 'needs',
  Mad: 'needs',
  'A-kasse': 'needs',
  Underholdning: 'wants',
  Personligt: 'wants',
  Andet: 'wants',
};

export type FiftyThirtyTwenty = {
  income: number;
  needs: number;
  wants: number;
  savings: number; // income - needs - wants (gulvet ved 0)
  needsPct: number;
  wantsPct: number;
  savingsPct: number;
  needsGroups: string[]; // til gennemsigtighed: hvad tæller som nødvendigt
  wantsGroups: string[]; // ... og hvad tæller som forbrug
};

export function computeFiftyThirtyTwenty(opts: {
  income: number;
  faellesContribution: number;
  privateGroups: { group: CategoryGroup; monthly: number }[];
}): FiftyThirtyTwenty {
  const { income, faellesContribution, privateGroups } = opts;

  let needs = faellesContribution;
  let wants = 0;
  const needsGroups: string[] = faellesContribution > 0 ? ['Bidrag til fælles'] : [];
  const wantsGroups: string[] = [];

  for (const g of privateGroups) {
    if (g.monthly <= 0) continue;
    if (GROUP_BUCKET[g.group] === 'needs') {
      needs += g.monthly;
      if (!needsGroups.includes(g.group)) needsGroups.push(g.group);
    } else {
      wants += g.monthly;
      if (!wantsGroups.includes(g.group)) wantsGroups.push(g.group);
    }
  }

  const savings = Math.max(0, income - needs - wants);
  const denom = Math.max(1, income);
  return {
    income,
    needs,
    wants,
    savings,
    needsPct: Math.round((needs / denom) * 100),
    wantsPct: Math.round((wants / denom) * 100),
    savingsPct: Math.round((savings / denom) * 100),
    needsGroups,
    wantsGroups,
  };
}

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
