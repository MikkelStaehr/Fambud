import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonthYearDA } from '@/lib/format';

// Server component — just renders prev/next links to ?month=YYYY-MM. Pass
// `basePath` so the same component can drive /poster, /overforsler etc.
type Props = {
  yearMonth: string;
  basePath: string;
};

function shift(yearMonth: string, deltaMonths: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthFilter({ yearMonth, basePath }: Props) {
  const prev = shift(yearMonth, -1);
  const next = shift(yearMonth, 1);
  const label = formatMonthYearDA(yearMonth);

  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-1 py-1">
      <Link
        href={`${basePath}?month=${prev}`}
        className="rounded p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        aria-label="Forrige måned"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <span className="min-w-32 text-center text-sm font-medium text-neutral-900 first-letter:uppercase">
        {label}
      </span>
      <Link
        href={`${basePath}?month=${next}`}
        className="rounded p-1 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        aria-label="Næste måned"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
