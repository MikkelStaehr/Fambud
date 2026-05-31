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
  currentContribution: number;  // total = expense + husholdning + savings
  // Split af currentContribution efter destinations-kontotype. Tre buckets:
  //   - Expense: transfers til kind in {budget, checking, other} fælleskonti
  //     (faste udgifter til Budget-hub)
  //   - Husholdning: transfers til kind=household fælleskonti (daglige
  //     udgifter - splittet ud så Budget ikke pretender at hub'e Husholdning)
  //   - Savings: transfers til kind in {savings, investment} fælleskonti
  //     (Buffer, ferieopsparing)
  currentToExpenseAccounts: number;
  currentToHusholdningAccounts: number;
  currentToSavingsAccounts: number;
  // Medlemmets egen lønkonto - kilde til foreslået "Opret overførsel"-CTA.
  // null hvis vedkommende ikke har oprettet en endnu (så viser vi i stedet
  // en note om at de skal igennem deres egen wizard).
  lonkontoId: string | null;
  lonkontoName: string | null;
};

export type MemberShare = {
  member: PlanMember;
  proportional: number;    // anbefalet andel - indkomst-proportional
  equal: number;           // anbefalet andel - 50/50
  equalRemaining: number;  // anbefalet andel - så alle ender med samme rådighed
  current: number;         // total nuværende bidrag (alle 3 buckets)
  // Anbefalet andel til opsparing (Buffer) - splittet efter samme model
  // som udgifter. Total opsparingsbidrag summer til bufferRecommendedMonthly.
  savingsProportional: number;
  savingsEqual: number;
  savingsEqualRemaining: number;
  // Anbefalet andel til husholdning (daglig forbrug) - splittet efter
  // samme model. Total summer til husholdning monthly_budget (eller faktiske
  // expenses som fallback). Vises som 3. obligatorisk overførsel.
  husholdningProportional: number;
  husholdningEqual: number;
  husholdningEqualRemaining: number;
};

export type FaellesSplit = {
  total: number;          // samlede fælles udgifter/md (excl. husholdning)
  totalIncome: number;    // sum af bidragydernes indkomst
  members: MemberShare[];
  equalRemainingTarget: number;
  hasIncompleteIncome: boolean;
  // Anbefalet samlet månedlig opsparing til fælles buffer.
  savingsTotal: number;
  // Husholdnings månedlige obligation (monthly_budget eller faktiske
  // expenses). Splittes per medlem via samme model.
  husholdningTotal: number;
};

export function splitFaellesExpenses(
  members: PlanMember[],
  total: number,
  // Den anbefalede samlede buffer-opsparingsrate per måned. Defaultet til
  // 0 så eksisterende callers (uden buffer-info) ikke breaker.
  savingsTotal: number = 0,
  // Husholdnings månedlige obligation (monthly_budget eller faktiske
  // expenses). Splittes per medlem - 3. obligatorisk overførsel.
  husholdningTotal: number = 0
): FaellesSplit {
  const totalIncome = members.reduce((s, m) => s + m.monthlyIncome, 0);
  const n = Math.max(1, members.length);
  const equalShare = Math.round(total / n);
  const equalSavings = Math.round(savingsTotal / n);
  const equalHusholdning = Math.round(husholdningTotal / n);

  // "Lige rådighed": hver beholder samme beløb R = (indkomst - total cost)/n.
  // Total cost inkluderer nu ALLE tre obligationer.
  const totalCost = total + savingsTotal + husholdningTotal;
  const equalRemainingTarget = Math.round((totalIncome - totalCost) / n);

  // Hjælper: beregn proportional + equal-remaining for én obligation type.
  // Tager medlemmets indkomst eksplicit ind så den er pure (ikke closure).
  const splitFor = (
    income: number,
    obligationTotal: number,
    equalForObligation: number
  ) => ({
    proportional:
      totalIncome > 0
        ? Math.round(obligationTotal * (income / totalIncome))
        : equalForObligation,
    equalRemaining:
      totalIncome > 0
        ? Math.max(
            0,
            Math.round(
              (income - equalRemainingTarget) *
                (totalCost > 0 ? obligationTotal / totalCost : 0)
            )
          )
        : equalForObligation,
  });

  return {
    total,
    totalIncome,
    equalRemainingTarget,
    savingsTotal,
    husholdningTotal,
    hasIncompleteIncome: members.some((m) => !m.incomeComplete),
    members: members.map((m) => {
      const expenseShare = splitFor(m.monthlyIncome, total, equalShare);
      const savingsShare = splitFor(m.monthlyIncome, savingsTotal, equalSavings);
      const husholdningShare = splitFor(
        m.monthlyIncome,
        husholdningTotal,
        equalHusholdning
      );
      return {
        member: m,
        proportional: expenseShare.proportional,
        equal: equalShare,
        equalRemaining: expenseShare.equalRemaining,
        current: m.currentContribution,
        savingsProportional: savingsShare.proportional,
        savingsEqual: equalSavings,
        savingsEqualRemaining: savingsShare.equalRemaining,
        husholdningProportional: husholdningShare.proportional,
        husholdningEqual: equalHusholdning,
        husholdningEqualRemaining: husholdningShare.equalRemaining,
      };
    }),
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
  Husholdning: 'needs',
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

// ----------------------------------------------------------------------------
// Manglende opsætning
// ----------------------------------------------------------------------------
// Strukturelle huller i husstandens opsætning. For den indloggede brugers
// EGNE huller giver vi en konkret handling (link); for partneres huller en
// forklaring (de skal selv gøre det). Detektionen er bevidst tilbageholdende:
// vi viser kun ting vi er sikre på, så rådgiveren ikke nagger om falske huller.
export type SetupGap = {
  tone: 'action' | 'info';
  title: string;
  body: string;
  action?: { label: string; href: string };
};

export type MemberSetupStatus = {
  name: string;
  hasLogin: boolean;
  hasOwnCheckingAccount: boolean;
  paycheckCount: number;
};

export function detectSetupGaps(opts: {
  myHasLonkonto: boolean;
  myHasAnyIncome: boolean;
  myIncomeComplete: boolean;
  members: MemberSetupStatus[];
  paychecksRequired?: number;
}): SetupGap[] {
  const required = opts.paychecksRequired ?? 3;
  const gaps: SetupGap[] = [];

  // Egne huller - med handling.
  if (!opts.myHasLonkonto) {
    gaps.push({
      tone: 'action',
      title: 'Du mangler en lønkonto',
      body: 'Opret din lønkonto, så din indtægt og dine overførsler har et hjem.',
      action: { label: 'Opret konto', href: '/konti/ny' },
    });
  } else if (!opts.myHasAnyIncome) {
    gaps.push({
      tone: 'action',
      title: 'Du mangler at registrere din løn',
      body: 'Registrér dine seneste lønudbetalinger, så forecastet kan regne med din indkomst.',
      action: { label: 'Registrér løn', href: '/indkomst' },
    });
  } else if (!opts.myIncomeComplete) {
    gaps.push({
      tone: 'action',
      title: 'Registrér flere lønudbetalinger',
      body: `Forecastet bliver præcist når du har registreret ${required} lønudbetalinger.`,
      action: { label: 'Registrér løn', href: '/indkomst' },
    });
  }

  // Partneres huller - som forklaring (de skal selv gøre det).
  //
  // VIGTIGT om lønkonto-detektion: en partners private lønkonto er skjult for
  // os via RLS, så hasOwnCheckingAccount kan være false selvom kontoen findes.
  // Men hvis partneren HAR registreret lønudbetalinger, eksisterer kontoen
  // (lønnen skal jo ligge et sted) - vi kan bare ikke se den. Derfor fyrer
  // "mangler lønkonto" KUN når der hverken er konto ELLER løn, så vi undgår
  // en falsk advarsel om en privat konto vi ikke har adgang til.
  for (const m of opts.members) {
    if (!m.hasLogin) {
      gaps.push({
        tone: 'info',
        title: `${m.name} har ikke oprettet sin bruger`,
        body: `${m.name} er pre-godkendt men mangler at gennemføre sin egen wizard. Indtil da viser tjekket kun din andel af de fælles konti.`,
      });
    } else if (m.paycheckCount === 0) {
      if (!m.hasOwnCheckingAccount) {
        gaps.push({
          tone: 'info',
          title: `${m.name} mangler at sætte sin økonomi op`,
          body: `${m.name} har hverken en lønkonto eller registreret løn endnu. De sætter det op i deres egen wizard, så jeres husstands-overblik bliver komplet.`,
        });
      } else {
        gaps.push({
          tone: 'info',
          title: `${m.name} mangler at registrere løn`,
          body: `${m.name} har endnu ikke registreret lønudbetalinger - så deres del af husstandens indkomst mangler i overblikket.`,
        });
      }
    } else if (m.paycheckCount < required) {
      gaps.push({
        tone: 'info',
        title: `${m.name}: ${m.paycheckCount}/${required} lønudbetalinger`,
        body: `${m.name}s indkomst-forecast bliver præcist når der er registreret ${required} lønudbetalinger.`,
      });
    }
  }

  return gaps;
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
