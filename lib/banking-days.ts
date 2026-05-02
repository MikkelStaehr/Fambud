// Banking-day arithmetic for Danish payroll conventions.
//
// Scope: WEEKEND-only adjustment. We do NOT account for Danish public holidays
// (helligdage). If you get paid on the 1st and that's both Saturday and a
// holiday, real life shifts you to Friday for the weekend reason — same end
// result, but if the 1st is a Tuesday holiday, real life shifts to the
// previous banking day (Monday). We don't model that yet. Add a holiday list
// here when forecast accuracy requires it.

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

// If `d` is Saturday or Sunday, return the previous Friday. Otherwise return
// `d` unchanged (a fresh copy).
function adjustToBankingDay(d: Date): Date {
  const r = new Date(d);
  const dow = r.getDay(); // 0=Sun..6=Sat
  if (dow === 0) r.setDate(r.getDate() - 2); // Sun → Fri
  else if (dow === 6) r.setDate(r.getDate() - 1); // Sat → Fri
  return r;
}

// Last weekday (Mon-Fri) in the given calendar month. `month` is 0-indexed
// to match JS Date conventions.
export function lastBankingDayOfMonth(year: number, month: number): Date {
  // Day 0 of next month = last day of this month.
  const d = new Date(year, month + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

// First future occurrence at the given day-of-month, with weekend → previous
// Friday adjustment. If today's adjusted occurrence has already passed,
// roll to next month.
export function nextFixedDayOccurrence(today: Date, dayOfMonth: number): Date {
  const t = startOfDay(today);
  let candidate = adjustToBankingDay(
    new Date(t.getFullYear(), t.getMonth(), dayOfMonth)
  );
  if (candidate < t) {
    candidate = adjustToBankingDay(
      new Date(t.getFullYear(), t.getMonth() + 1, dayOfMonth)
    );
  }
  return candidate;
}

// First future last-banking-day. If this month's has already passed, use next
// month's.
export function nextLastBankingDay(today: Date): Date {
  const t = startOfDay(today);
  let candidate = lastBankingDayOfMonth(t.getFullYear(), t.getMonth());
  if (candidate < t) {
    candidate = lastBankingDayOfMonth(t.getFullYear(), t.getMonth() + 1);
  }
  return candidate;
}

// 'YYYY-MM-DD' for a Postgres date column.
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// First day of the chosen month (1-12). If that month has already passed in
// the current calendar year, roll to next year. Used when the user only
// picks a "first payment month" for quarterly/semiannual/yearly recurrences
// — we don't ask for a specific day, just the month.
export function nextMonthOccurrence(
  monthOneIndexed: number,
  today: Date = new Date()
): Date {
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const candidate = new Date(t.getFullYear(), monthOneIndexed - 1, 1);
  if (candidate < t) {
    return new Date(t.getFullYear() + 1, monthOneIndexed - 1, 1);
  }
  return candidate;
}
