// Pure-math amortisation projection for loans entered in the /laan section.
//
// Assumes an annuitetslån: total ydelse pr. periode holder sig konstant.
// Rente og bidrag falder over tid efterhånden som restgælden betales af, og
// afdraget vokser tilsvarende. Rabat (KundeKroner) holdes konstant pr.
// betaling - i praksis varierer det med restgælden, men den nuance er for
// fin til formålet her.
//
// Derived rates: vi tager den NUVÆRENDE rente og bidrag som % af nuværende
// restgæld, og bruger dem som konstanter fremad. F1/F3-lånsrentejusteringer
// indregnes ikke.

import type { RecurrenceFreq } from '@/lib/database.types';

const PERIODS_PER_YEAR: Record<RecurrenceFreq, number> = {
  once: 0,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  yearly: 1,
};

export type ProjectionInput = {
  remainingPrincipal: number;  // øre, positive
  rentePerPeriod: number;      // øre, positive
  afdragPerPeriod: number;     // øre, positive
  bidragPerPeriod: number;     // øre, positive (or 0)
  rabatPerPeriod: number;      // øre, signed (negative for KundeKroner)
  paymentInterval: RecurrenceFreq;
};

export type ProjectionPeriod = {
  periodIndex: number; // 1-based
  yearAfter: number;   // year offset from now (0.25, 1.0, 5.0 …)
  rente: number;
  afdrag: number;
  bidrag: number;
  rabat: number;
  remaining: number;   // remaining principal AFTER this period
};

export type ProjectionResult =
  | {
      ok: true;
      periods: ProjectionPeriod[];
      totalRente: number;
      totalBidrag: number;
      payoffYears: number;
      crossoverYear: number | null;
    }
  | { ok: false; reason: string };

export function projectAmortisation(input: ProjectionInput): ProjectionResult {
  const {
    remainingPrincipal,
    rentePerPeriod,
    afdragPerPeriod,
    bidragPerPeriod,
    rabatPerPeriod,
    paymentInterval,
  } = input;

  if (remainingPrincipal <= 0) {
    return { ok: false, reason: 'Ingen restgæld at projicere' };
  }
  if (rentePerPeriod <= 0 || afdragPerPeriod <= 0) {
    return {
      ok: false,
      reason: 'Udfyld både rente og afdrag for at se forløbet',
    };
  }

  const periodsPerYear = PERIODS_PER_YEAR[paymentInterval];
  if (!periodsPerYear) {
    return { ok: false, reason: 'Ugyldigt betalingsinterval' };
  }

  const renteRate = rentePerPeriod / remainingPrincipal;
  const bidragRate = bidragPerPeriod / remainingPrincipal;
  // Total ydelse pr. periode - holdes konstant (annuitetslån-antagelse).
  const totalPayment =
    rentePerPeriod + afdragPerPeriod + bidragPerPeriod + rabatPerPeriod;

  let remaining = remainingPrincipal;
  const periods: ProjectionPeriod[] = [];
  let totalRente = 0;
  let totalBidrag = 0;
  let crossoverPeriod: number | null = null;

  // Cap at 50 years - anything beyond that is unrealistic/atypical and we
  // bail rather than loop endlessly.
  const maxPeriods = periodsPerYear * 50;

  for (let i = 1; i <= maxPeriods; i++) {
    const rente = Math.round(remaining * renteRate);
    const bidrag = Math.round(remaining * bidragRate);
    const rabat = rabatPerPeriod;
    let afdrag = totalPayment - rente - bidrag - rabat;

    // Sanity: a non-annuity loan (or wrong inputs) drives afdrag negative.
    if (afdrag <= 0) {
      return {
        ok: false,
        reason:
          'Ydelsen er ikke konsistent med en annuitetsstruktur - kan ikke projicere',
      };
    }

    // Last period: clamp afdrag to whatever is left so we don't overshoot.
    if (afdrag > remaining) {
      afdrag = remaining;
      remaining = 0;
    } else {
      remaining -= afdrag;
    }

    periods.push({
      periodIndex: i,
      yearAfter: i / periodsPerYear,
      rente,
      afdrag,
      bidrag,
      rabat,
      remaining,
    });

    totalRente += rente;
    totalBidrag += bidrag;

    if (crossoverPeriod === null && afdrag > rente) {
      crossoverPeriod = i;
    }

    if (remaining <= 0) break;
  }

  if (periods[periods.length - 1].remaining > 0) {
    return {
      ok: false,
      reason:
        'Lånet bliver ikke betalt af inden for 50 år med nuværende ydelse - tjek input',
    };
  }

  return {
    ok: true,
    periods,
    totalRente,
    totalBidrag,
    payoffYears: periods.length / periodsPerYear,
    crossoverYear:
      crossoverPeriod !== null ? crossoverPeriod / periodsPerYear : null,
  };
}

// Returns the periods closest to each milestone year (1, 5, 10, …, 30) that
// still fall within the loan's lifetime, plus the very last period. Used for
// a compact "Om N år"-table without showing all 120 quarters.
export function pickMilestones(
  periods: ProjectionPeriod[],
  milestoneYears: readonly number[] = [1, 5, 10, 15, 20, 25, 30]
): ProjectionPeriod[] {
  if (periods.length === 0) return [];
  const last = periods[periods.length - 1];

  const result: ProjectionPeriod[] = [];
  const seen = new Set<number>();

  for (const year of milestoneYears) {
    if (year >= last.yearAfter) continue;
    let best = periods[0];
    let bestDiff = Math.abs(best.yearAfter - year);
    for (const p of periods) {
      const diff = Math.abs(p.yearAfter - year);
      if (diff < bestDiff) {
        best = p;
        bestDiff = diff;
      }
    }
    if (!seen.has(best.periodIndex)) {
      result.push(best);
      seen.add(best.periodIndex);
    }
  }

  if (!seen.has(last.periodIndex)) {
    result.push(last);
  }

  return result;
}
