import type { AccountKind, RecurrenceFreq } from '@/lib/database.types';

// Danish labels for the account_kind enum — single source of truth.
export const ACCOUNT_KIND_LABEL_DA: Record<AccountKind, string> = {
  checking: 'Lønkonto',
  budget: 'Budgetkonto',
  household: 'Husholdningskonto',
  savings: 'Opsparing',
  credit: 'Kredit',
  cash: 'Kontanter',
  other: 'Anden',
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
