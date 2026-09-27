// Rene helpers til Famtask (plan-schemaet, migration 0070). Ingen DB, ingen
// React - så de kan unit-testes direkte (se famtask.test.ts).

import type { PlanProjectStatus, PlanStepStatus } from '@/lib/database.types';

export const PROJECT_STATUS_LABEL_DA: Record<PlanProjectStatus, string> = {
  ide: 'Idé',
  aktiv: 'Aktiv',
  pause: 'På pause',
  faerdig: 'Færdig',
};

export const STEP_STATUS_LABEL_DA: Record<PlanStepStatus, string> = {
  todo: 'Todo',
  i_gang: 'I gang',
  faerdig: 'Færdig',
};

export const PROJECT_STATUSES = Object.keys(
  PROJECT_STATUS_LABEL_DA
) as PlanProjectStatus[];
export const STEP_STATUSES = Object.keys(STEP_STATUS_LABEL_DA) as PlanStepStatus[];

export function isProjectStatus(v: string): v is PlanProjectStatus {
  return (PROJECT_STATUSES as string[]).includes(v);
}

export function isStepStatus(v: string): v is PlanStepStatus {
  return (STEP_STATUSES as string[]).includes(v);
}

// Ét tryk på status-knappen: todo → i gang → færdig → todo.
export function nextStepStatus(s: PlanStepStatus): PlanStepStatus {
  if (s === 'todo') return 'i_gang';
  if (s === 'i_gang') return 'faerdig';
  return 'todo';
}

// Route-params og hidden inputs valideres før de rammer PostgREST, så en
// ugyldig id giver 404 i stedet for en 22P02-fejl fra Postgres.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

// <input type="month"> giver 'YYYY-MM'. DB'en gemmer første dag i måneden
// (check-constraint i 0070). Browsere uden month-picker (fx Firefox desktop)
// viser et tekstfelt, så vi accepterer samme format skrevet i hånden.
// Tom værdi = null (ingen måned). Samme årsinterval som isValidOccursOn.
export type MonthParseResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export function parseMonthInput(raw: string): MonthParseResult {
  const v = raw.trim();
  if (!v) return { ok: true, value: null };
  const m = /^(\d{4})-(\d{1,2})$/.exec(v);
  if (!m) return { ok: false, error: 'Måned skal skrives som ÅÅÅÅ-MM' };
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return { ok: false, error: 'Ugyldig måned' };
  if (year < 1900 || year > 2100) return { ok: false, error: 'Ugyldigt år' };
  return { ok: true, value: `${year}-${String(month).padStart(2, '0')}-01` };
}

// DB-dato 'YYYY-MM-01' → 'YYYY-MM' til <input type="month"> defaultValue.
export function monthInputValue(date: string | null): string {
  return date ? date.slice(0, 7) : '';
}

// 'YYYY-MM-01' → 'nov. 2026'. Kort form til skridt-rækker på mobil.
export function formatMonthShortDA(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('da-DK', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, 1));
}

// Flyt `id` én plads op eller ned i en ordnet liste. Returnerer den nye
// rækkefølge, eller null hvis flytningen ikke giver mening (ukendt id,
// allerede øverst/nederst).
export function moveInOrder(
  ids: string[],
  id: string,
  direction: 'up' | 'down'
): string[] | null {
  const i = ids.indexOf(id);
  if (i === -1) return null;
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return null;
  const next = [...ids];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
