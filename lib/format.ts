import type {
  AccountKind,
  InvestmentType,
  RecurrenceFreq,
  SavingsPurpose,
} from '@/lib/database.types';

// Danish labels for the account_kind enum — single source of truth.
export const ACCOUNT_KIND_LABEL_DA: Record<AccountKind, string> = {
  checking: 'Lønkonto',
  budget: 'Budgetkonto',
  household: 'Husholdningskonto',
  savings: 'Opsparing',
  investment: 'Investering',
  credit: 'Kredit',
  cash: 'Kontanter',
  other: 'Anden',
};

// Subtyper når kind='investment'. Vises som badge på /konti og som loft-info
// hvor det er relevant. Lofterne her er dem der gælder pr. 2026 — opdatér
// årligt hvis Skattestyrelsen ændrer satserne.
export const INVESTMENT_TYPE_LABEL_DA: Record<InvestmentType, string> = {
  aldersopsparing: 'Aldersopsparing',
  aktiesparekonto: 'Aktiesparekonto (ASK)',
  aktiedepot: 'Aktiedepot',
  pension: 'Pension (rate/livrente)',
  boerneopsparing: 'Børneopsparing',
};

// Kort tekst-info om indbetalingsloft til visning ved siden af kontoen.
// `null` betyder "intet loft" (alm. aktiedepot, pension som er individuel).
export const INVESTMENT_TYPE_CAP_DA: Record<InvestmentType, string | null> = {
  aldersopsparing: 'Loft: 9.900 kr/år',
  aktiesparekonto: 'Loft: 135.900 kr i alt',
  aktiedepot: null,
  pension: null,
  boerneopsparing: 'Loft: 6.000 kr/år, 72.000 kr i alt',
};

// Programmatisk udgave: ÅRLIGT loft i hele kroner. Bruges af forms til at
// foreslå "del loft ud på 12 måneder"-knapper når brugeren vælger en konto
// af denne type. Kun typer med et reelt årligt loft er listet —
// aktiesparekonto har et samlet livstidsloft (135.900) som ikke giver
// mening at dele på 12. Pension har personlige forskelle vi ikke modellerer.
export const INVESTMENT_TYPE_ANNUAL_CAP_KR: Partial<Record<InvestmentType, number>> = {
  aldersopsparing: 9900,
  boerneopsparing: 6000,
};

// Specialformål for opsparingskonti (kind='savings'). Hver har en beregnet
// anbefaling baseret på brugerens egne tal (faste udgifter / nettoindkomst)
// — det er det der gør dem "specielle" frem for almindelige savings.
export const SAVINGS_PURPOSE_LABEL_DA: Record<SavingsPurpose, string> = {
  buffer: 'Buffer Konto',
  predictable_unexpected: 'Forudsigelige uforudsete',
};

export const SAVINGS_PURPOSE_DESC_DA: Record<SavingsPurpose, string> = {
  buffer:
    'Nødfond — kunne dække 3 mdr af jeres faste udgifter som minimum, 6 mdr ved godt niveau. Til jobtab, sygdom, akut reparation.',
  predictable_unexpected:
    'Pulje til ting du VED kommer — bilvedligehold, tandlæge, gaver, ferie. Når 1.500 kr overrasker dig hver kvartal slår budgettet kludder; med en pulje kan I bare bruge.',
};

export const RECURRENCE_LABEL_DA: Record<RecurrenceFreq, string> = {
  once: 'engangs',
  weekly: 'ugentligt',
  monthly: 'månedligt',
  quarterly: 'kvartalvis',
  semiannual: 'halvårligt',
  yearly: 'årligt',
};

// Danish month names, indexed by 1-12. Month picker uses these labels.
export const MONTHS_DA: { value: number; label: string }[] = [
  { value: 1,  label: 'Januar' },
  { value: 2,  label: 'Februar' },
  { value: 3,  label: 'Marts' },
  { value: 4,  label: 'April' },
  { value: 5,  label: 'Maj' },
  { value: 6,  label: 'Juni' },
  { value: 7,  label: 'Juli' },
  { value: 8,  label: 'August' },
  { value: 9,  label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

// All money is stored as integer øre (1/100 DKK). Display always goes through
// these formatters — never inline an Intl.NumberFormat in a component.

const dkkFormatter = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dkkPlainFormatter = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatDKK(oere: number): string {
  return dkkFormatter.format(oere / 100);
}

// Without the "kr." suffix — useful in tables where the column header carries the unit.
export function formatAmount(oere: number): string {
  return dkkPlainFormatter.format(oere / 100);
}

export function formatLongDateDA(d: Date): string {
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatShortDateDA(iso: string): string {
  // iso = 'YYYY-MM-DD' from a Postgres date column.
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

// Parses a user-typed money input into integer øre. Accepts:
//   '1234.56'      — period decimal (canonical)
//   '1234,56'      — comma decimal (Danish keyboard, normalised to period)
//   '1 234.56'     — with thousand-separator spaces (AmountInput renders these)
//   '-209 132'     — negatives for credit balances
// Returns null for empty/invalid input.
export function parseAmountToOere(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Strip whitespace (thousand separators) and normalise comma → period.
  const normalised = trimmed.replace(/\s/g, '').replace(/,/g, '.');
  const n = Number(normalised);
  if (!Number.isFinite(n)) return null;
  // Math.round avoids float drift like 12.34 * 100 = 1233.9999999998.
  return Math.round(n * 100);
}

// Renders an øre value as the string that should appear in an AmountInput's
// defaultValue — period-decimal, exactly two digits.
export function formatOereForInput(oere: number): string {
  return (oere / 100).toFixed(2);
}

// 'YYYY-MM' for the current month, used as the default month filter.
export function currentYearMonth(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthYearDA(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Intl.DateTimeFormat('da-DK', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, 1));
}

// Inclusive [start, end] date strings ('YYYY-MM-DD') for a given 'YYYY-MM'.
export function monthBounds(yearMonth: string): { start: string; end: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = `${yearMonth}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export type ComponentsMode = 'additive' | 'breakdown';

// "Effective" amount of an expense — what's actually withdrawn each occurrence.
// Two semantics depending on components_mode:
//   - 'additive' (default): parent is a base price, components stack on top.
//     "Mobilabonnement 170 + tilkøb 328 = 498 kr/md"
//   - 'breakdown': parent IS the total, components are informational decomposition.
//     "Bilforsikring 806.09 kr/md, broken down as: Ansvar 164 + Kasko 438 + …"
export function effectiveAmount(
  parentAmount: number,
  components: { amount: number }[],
  mode: ComponentsMode = 'additive'
): number {
  if (mode === 'breakdown') return parentAmount;
  return parentAmount + components.reduce((s, c) => s + c.amount, 0);
}

// Convert a recurring amount to its per-month equivalent so totals can be
// compared across mixed recurrences. Returns 0 for 'once' since one-shots
// don't contribute to the monthly load. Weekly is approximated as
// 52/12 ≈ 4.345 weeks per month.
export function monthlyEquivalent(amount: number, recurrence: RecurrenceFreq): number {
  switch (recurrence) {
    case 'once':       return 0;
    case 'weekly':     return Math.round(amount * (52 / 12));
    case 'monthly':    return amount;
    case 'quarterly':  return Math.round(amount / 3);
    case 'semiannual': return Math.round(amount / 6);
    case 'yearly':     return Math.round(amount / 12);
  }
}

// Add `months` to a date, clamping the day to the last day of the target
// month (Jan 31 + 1 month → Feb 28/29, not Mar 3). Mirrors Postgres
// `date + INTERVAL '1 month'`. Used to roll a loan's anchor date forward
// to the next occurrence.
function addMonthsClamped(d: Date, months: number): Date {
  const targetMonth = d.getMonth() + months;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const normMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normMonth + 1, 0).getDate();
  const next = new Date(targetYear, normMonth, Math.min(d.getDate(), lastDay));
  return next;
}

function recurrenceStepMonths(freq: RecurrenceFreq): number {
  switch (freq) {
    case 'monthly':    return 1;
    case 'quarterly':  return 3;
    case 'semiannual': return 6;
    case 'yearly':     return 12;
    case 'weekly':     return 0; // step in weeks instead — handled separately
    case 'once':       return 0;
  }
}

// Given an anchor date (a known occurrence — typically the user's last
// payment) and a recurrence, return the next date strictly after `today`.
// If the anchor is already in the future, it IS the next occurrence.
//
// `anchorISO` is 'YYYY-MM-DD' from a Postgres date column.
export function nextOccurrenceAfter(
  anchorISO: string,
  recurrence: RecurrenceFreq,
  today: Date = new Date()
): string {
  const [y, m, d] = anchorISO.split('-').map(Number);
  let next = new Date(y, m - 1, d);
  // Strip time on `today` so the comparison is date-only — otherwise an
  // anchor of "today" is sometimes < today by a few hours.
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const stepMonths = recurrenceStepMonths(recurrence);

  if (recurrence === 'weekly') {
    while (next <= todayDateOnly) {
      next = new Date(next);
      next.setDate(next.getDate() + 7);
    }
  } else if (stepMonths > 0) {
    while (next <= todayDateOnly) {
      next = addMonthsClamped(next, stepMonths);
    }
  }
  // 'once' falls through and just returns the anchor.

  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, '0');
  const dd = String(next.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
