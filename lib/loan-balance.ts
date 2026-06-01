// Auto-amortisering: beregn current restgæld på et lån ud fra hvornår
// brugeren sidst satte opening_balance + hvor mange betalingsperioder à
// payment_afdrag der er gået siden.
//
// Modellen er bevidst SIMPEL og forudsigelig: payment_afdrag tages som
// konstant pr. periode. For annuitetslån vil det reelle afdrag stige
// langsomt over tid (rente-andelen falder), men forskellen er minimal
// over ~12 måneder og bliver alligevel "rettet ind" når brugeren næste
// gang opdaterer fra bankens egen opgørelse. Hellere et stabilt skøn der
// matcher de fleste betalinger end et komplekst amortisations-simuleret
// tal der overgår brugerens mentale model.
//
// Hvis lånet ikke har data nok (payment_afdrag null, eller anker mangler),
// returneres den gemte opening_balance uændret - så vi aldrig bryder
// eksisterende UI hvor felterne ikke er udfyldt.

import type { RecurrenceFreq } from '@/lib/database.types';

type LoanLike = {
  opening_balance: number;
  payment_afdrag: number | null;
  payment_interval: RecurrenceFreq;
  balance_as_of_date: string | null;
};

// Antal måneder mellem to datoer (afrundet ned). Tæller fulde måneds-
// overgange: 1. januar → 15. februar = 1 måned, ikke 1.5. Bruges sammen
// med periodeMonthsFor() til at finde antallet af KOMPLET BETALTE
// perioder, så vi ikke trækker af for en periode der ikke er falden endnu.
function monthsBetween(from: Date, to: Date): number {
  const yearDiff = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  let total = yearDiff * 12 + monthDiff;
  if (to.getDate() < from.getDate()) total -= 1;
  return total;
}

function periodMonthsFor(interval: RecurrenceFreq): number {
  switch (interval) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 3;
    case 'semiannual':
      return 6;
    case 'yearly':
      return 12;
    case 'weekly':
    case 'once':
    default:
      return 0; // ingen meningsfuld auto-amortisering
  }
}

// Returnerer den aktuelle restgæld (positivt øre-tal) ud fra anker-snapshot
// + antal fulde betalingsperioder siden. Aldrig under 0.
//
// `today` defaultes til "nu" men kan injectes til test eller for at undgå
// hydration-mismatch (server vs klient kunne lande på forskellige minutter,
// men da vi runder til dage er det praktisk taget umuligt at få en off-by-
// one på samme sekund).
export function currentLoanBalance(
  loan: LoanLike,
  today: Date = new Date()
): number {
  const stored = Math.abs(loan.opening_balance);
  if (
    !loan.balance_as_of_date ||
    loan.payment_afdrag == null ||
    loan.payment_afdrag <= 0
  ) {
    return stored;
  }
  const periodMonths = periodMonthsFor(loan.payment_interval);
  if (periodMonths <= 0) return stored;

  const anchor = new Date(loan.balance_as_of_date);
  if (Number.isNaN(anchor.getTime())) return stored;

  const months = monthsBetween(anchor, today);
  if (months <= 0) return stored;

  const periodsElapsed = Math.floor(months / periodMonths);
  if (periodsElapsed <= 0) return stored;

  const deducted = stored - periodsElapsed * loan.payment_afdrag;
  return Math.max(0, deducted);
}
