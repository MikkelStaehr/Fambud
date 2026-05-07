import type {
  AccountKind,
  InvestmentType,
  LifeEvent,
  LifeEventItem,
  LifeEventItemStatus,
  LifeEventStatus,
  LifeEventTimeframe,
  LifeEventType,
  RecurrenceFreq,
  SavingsPurpose,
} from '@/lib/database.types';

// Danish labels for the account_kind enum - single source of truth.
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
// hvor det er relevant. Lofterne her er dem der gælder pr. 2026 - opdatér
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
// af denne type. Kun typer med et reelt årligt loft er listet -
// aktiesparekonto har et samlet livstidsloft (135.900) som ikke giver
// mening at dele på 12. Pension har personlige forskelle vi ikke modellerer.
export const INVESTMENT_TYPE_ANNUAL_CAP_KR: Partial<Record<InvestmentType, number>> = {
  aldersopsparing: 9900,
  boerneopsparing: 6000,
};

// Specialformål for opsparingskonti (kind='savings'). Hver har en beregnet
// anbefaling baseret på brugerens egne tal (faste udgifter / nettoindkomst)
// - det er det der gør dem "specielle" frem for almindelige savings.
export const SAVINGS_PURPOSE_LABEL_DA: Record<SavingsPurpose, string> = {
  buffer: 'Buffer Konto',
  predictable_unexpected: 'Forudsigelige uforudsete',
};

export const SAVINGS_PURPOSE_DESC_DA: Record<SavingsPurpose, string> = {
  buffer:
    'Nødfond - kunne dække 3 mdr af jeres faste udgifter som minimum, 6 mdr ved godt niveau. Til jobtab, sygdom, akut reparation.',
  predictable_unexpected:
    'Pulje til ting du VED kommer - bilvedligehold, tandlæge, gaver, ferie. Når 1.500 kr overrasker dig hver kvartal slår budgettet kludder; med en pulje kan I bare bruge.',
};

export const RECURRENCE_LABEL_DA: Record<RecurrenceFreq, string> = {
  once: 'engangs',
  weekly: 'ugentligt',
  monthly: 'månedligt',
  quarterly: 'kvartalvis',
  semiannual: 'halvårligt',
  yearly: 'årligt',
};

// Begivenheder (life_events) - danske labels for de fire enums.
export const LIFE_EVENT_TYPE_LABEL_DA: Record<LifeEventType, string> = {
  konfirmation: 'Konfirmation',
  bryllup: 'Bryllup',
  foedselsdag: 'Rund fødselsdag',
  rejse: 'Større rejse',
  bolig: 'Bolig- eller bilkøb',
  studie: 'Studieafslutning',
  andet: 'Andet',
};

export const LIFE_EVENT_STATUS_LABEL_DA: Record<LifeEventStatus, string> = {
  planning: 'Under planlægning',
  active: 'Aktiv opsparing',
  completed: 'Gennemført',
  cancelled: 'Aflyst',
};

export const LIFE_EVENT_TIMEFRAME_LABEL_DA: Record<
  LifeEventTimeframe,
  string
> = {
  within_1y: 'Inden for 1 år',
  within_2y: 'Inden for 2 år',
  within_5y: 'Inden for 5 år',
  within_10y: 'Inden for 10 år',
};

// Antal måneder vi bruger som "deadline" når brugeren har valgt en
// bucket-tidsramme i stedet for en konkret dato. Brugt af UI til at
// foreslå en månedlig opsparingsrate (totalBudget / months).
//
// Vi tager midten af bucketens åbne interval - "inden for 1 år" = 9 mdr
// (matcher landing-flow's TIMEFRAME_MONTHS), "inden for 2 år" = 18 mdr,
// "5 år" = 42 mdr (3.5 år), "10 år" = 84 mdr (7 år). Hvis brugeren
// faktisk har sat en target_date, bruges den istedet.
export const LIFE_EVENT_TIMEFRAME_MONTHS: Record<LifeEventTimeframe, number> =
  {
    within_1y: 9,
    within_2y: 18,
    within_5y: 42,
    within_10y: 84,
  };

export const LIFE_EVENT_ITEM_STATUS_LABEL_DA: Record<
  LifeEventItemStatus,
  string
> = {
  planlagt: 'Planlagt',
  booket: 'Booket',
  betalt: 'Betalt',
};

// Total-budget for en begivenhed: hvis use_items_for_budget=true, bruges
// summen af items.amount; ellers det frie tal i total_budget. Returnerer
// null hvis ingen af delene er sat (brugeren har ikke besluttet endnu).
export function lifeEventTotalBudget(
  event: Pick<LifeEvent, 'total_budget' | 'use_items_for_budget'>,
  items: Pick<LifeEventItem, 'amount'>[]
): number | null {
  if (event.use_items_for_budget) {
    if (items.length === 0) return null;
    return items.reduce((sum, item) => sum + item.amount, 0);
  }
  return event.total_budget;
}

// Antal måneder fra i dag til target_date. Negativ hvis datoen er passeret.
// Bruges til at beregne månedlig opsparing nødvendig for at nå målet.
function monthsUntilTargetDate(targetISO: string, today: Date = new Date()): number {
  const [y, m, d] = targetISO.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const months =
    (target.getFullYear() - today.getFullYear()) * 12 +
    (target.getMonth() - today.getMonth());
  // Korriger med dag-niveau så "31. december" til "1. januar" ikke
  // tæller som 1 måned.
  if (target.getDate() < today.getDate()) return months - 1;
  return months;
}

// Antal måneder for en begivenheds deadline. target_date har forrang;
// ellers bucket-tidsrammen. Returnerer null hvis hverken er sat.
export function lifeEventMonthsRemaining(
  event: Pick<LifeEvent, 'target_date' | 'timeframe'>,
  today: Date = new Date()
): number | null {
  if (event.target_date) {
    return Math.max(1, monthsUntilTargetDate(event.target_date, today));
  }
  if (event.timeframe) {
    return LIFE_EVENT_TIMEFRAME_MONTHS[event.timeframe];
  }
  return null;
}

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

// All money is stored as integer øre (1/100 DKK). Display goes via
// formatAmount - kr-suffix tilføjes inline af kalderen så vi har ét sted
// at justere antallet af decimaler eller tusind-separator.

const dkkPlainFormatter = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// SECURITY: Cap'er fri-tekst-input fra brugeren. Postgres text-kolonner
// har ingen indbygget grænse, så uden et cap kunne en bruger indsætte
// MB-store strenge og DoS'e read-queries der senere streamer dataen
// ud i UI'et.
//
// UTF-16 awareness: hvis vi slice'r midt i et surrogate pair (fx en
// emoji som 🎉 = U+1F389 = D83C+DF89), efterlader vi en lone high
// surrogate. JSON.stringify accepterer det, men Postgres TEXT/citext
// rejecter med 'invalid byte sequence for encoding UTF8'. Vi tjekker
// om sidste char er en high surrogate og dropper den.
export function capLength(s: string, max: number): string {
  if (s.length <= max) return s;
  const lastCharCode = s.charCodeAt(max - 1);
  // High surrogate range: U+D800 to U+DBFF
  const cut = lastCharCode >= 0xd800 && lastCharCode <= 0xdbff ? max - 1 : max;
  return s.slice(0, cut);
}

// Standardgrænser - matcher fornuftige UX-værdier (et navn er aldrig
// 200 tegn; en beskrivelse sjældent over 1000).
export const TEXT_LIMITS = {
  shortName: 100,        // navne, account-names, family-member-names
  mediumName: 200,       // adresser, household-names
  description: 1000,     // beskrivelser, notes
  longText: 5000,        // feedback, store fritekst-felter
  url: 500,              // page_url, urls
  userAgent: 500,        // user-agent strings
} as const;

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

// Range-validation på user-provided datoer (transaktioner, indkomst,
// budget-poster). Postgres date-kolonnen accepterer år 4713 BC til
// 5874897 AD, så uden eksplicit tjek kan en bruger oprette en post i
// år 9999 der ville skævvride forecasts og charts. 1900-2100 dækker alt
// realistic - personlig økonomi er ikke 200+ år gammel og ikke
// 75+ år ind i fremtiden.
const MIN_OCCURS_ON_YEAR = 1900;
const MAX_OCCURS_ON_YEAR = 2100;

export function isValidOccursOn(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const year = parseInt(iso.slice(0, 4), 10);
  if (year < MIN_OCCURS_ON_YEAR || year > MAX_OCCURS_ON_YEAR) return false;
  // Ekstra sanity: er datoen overhovedet en gyldig dato? "2026-02-30"
  // matcher regexen men er ikke valid. Vi roundtripper gennem Date og
  // tjekker at kalenderkomponenterne stadig matcher.
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

// Parses a user-typed money input into integer øre. Accepts:
//   '1234.56'      - period decimal (canonical)
//   '1234,56'      - comma decimal (Danish keyboard, normalised to period)
//   '1 234.56'     - with thousand-separator spaces (AmountInput renders these)
//   '-209 132'     - negatives for credit balances
// Returns null for empty/invalid input.
// SECURITY: Vi clampe input til ±10 mia. kr (1e10). Realistisk
// husstandsøkonomi er langt under det. Uden cap kunne en bruger
// indsætte n=1e15 som ville overflow'e Number.MAX_SAFE_INTEGER (2^53)
// efter et par summeringer i cashflow-aggregations - dashboards ville
// vise garbage uden noget tydeligt symptom.
const MAX_AMOUNT_OERE = 1_000_000_000_000; // 10 mia. kr i øre

export function parseAmountToOere(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Strip whitespace (thousand separators) and normalise comma → period.
  const normalised = trimmed.replace(/\s/g, '').replace(/,/g, '.');
  const n = Number(normalised);
  if (!Number.isFinite(n)) return null;
  // Math.round avoids float drift like 12.34 * 100 = 1233.9999999998.
  const oere = Math.round(n * 100);
  if (Math.abs(oere) > MAX_AMOUNT_OERE) return null;
  return oere;
}

// Result-typer til de validerende parsers nedenfor. Server actions bruger
// `{ ok: false, error }` mønstret til at returnere fejlbesked til redirect
// uden at throw'e - så den helper-trio matcher det stilistisk.
export type AmountParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export type OptionalAmountParseResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

// Validér og parse et beløb der SKAL være sat. Tom værdi → fejl med givet
// label ("X er påkrævet"). Negativ → fejl, medmindre allowNegative=true.
//
// Sparer mønsteret `parseAmountToOere(raw); if (v === null || v < 0) return
// { error: '...' };` der ellers gentages ~10 steder i actions.
export function parseRequiredAmount(
  raw: string,
  label: string,
  opts: { allowNegative?: boolean; allowZero?: boolean } = {}
): AmountParseResult {
  const v = parseAmountToOere(raw);
  if (v === null) return { ok: false, error: `${label} er påkrævet` };
  if (!opts.allowNegative && v < 0)
    return { ok: false, error: `${label} skal være et positivt tal` };
  if (!opts.allowZero && v === 0)
    return { ok: false, error: `${label} skal være større end 0` };
  return { ok: true, value: v };
}

// Tom værdi → null (ok, ikke fejl). Sat værdi → samme regler som
// parseRequiredAmount. Bruges til valgfrie felter (mål, fradrag, etc.).
export function parseOptionalAmount(
  raw: string,
  label: string,
  opts: { allowNegative?: boolean; allowZero?: boolean } = { allowZero: true }
): OptionalAmountParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  const v = parseAmountToOere(trimmed);
  if (v === null) return { ok: false, error: `Ugyldigt beløb i ${label}` };
  if (!opts.allowNegative && v < 0)
    return { ok: false, error: `${label} skal være et positivt tal` };
  if (!opts.allowZero && v === 0)
    return { ok: false, error: `${label} skal være større end 0` };
  return { ok: true, value: v };
}

// Renders an øre value as the string that should appear in an AmountInput's
// defaultValue - period-decimal, exactly two digits.
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

// "Effective" amount of an expense - what's actually withdrawn each occurrence.
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
    case 'weekly':     return 0; // step in weeks instead - handled separately
    case 'once':       return 0;
  }
}

// Given an anchor date (a known occurrence - typically the user's last
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
  // Strip time on `today` so the comparison is date-only - otherwise an
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
