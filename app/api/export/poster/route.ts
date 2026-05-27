// CSV-eksport af en måneds poster (indtægter + udgifter) til regneark.
//
// Bruger-initieret download: knappen på /poster linker hertil med ?month=.
// Auth sker via getTransactionsForMonth -> getHouseholdContext, der
// redirecter til /login hvis der ikke er en session. Ingen CRON_SECRET her
// (det er kun til cron-jobs uden bruger-session).
//
// Vi eksporterer BÅDE indtægts- og udgiftsposter (modsat /poster-tabellen der
// kun viser udgifter) - en eksport bør være det fulde billede af måneden.
// Beløb er fortegns-bærende (indtægt +, udgift -) så en SUM i regnearket
// giver månedens netto direkte.

import { type NextRequest } from 'next/server';
import { getTransactionsForMonth } from '@/lib/dal';
import { buildCsv, csvAmountDA } from '@/lib/csv';
import { currentYearMonth, RECURRENCE_LABEL_DA } from '@/lib/format';

function normaliseYearMonth(raw: string | null): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return currentYearMonth();
}

export async function GET(request: NextRequest) {
  const month = normaliseYearMonth(request.nextUrl.searchParams.get('month'));
  const transactions = await getTransactionsForMonth(month);

  // Sortér stigende på dato - mest naturligt at læse i et regneark, modsat
  // DAL'ens faldende rækkefølge (nyeste først) som passer til UI-tabellen.
  const sorted = [...transactions].sort((a, b) =>
    a.occurs_on.localeCompare(b.occurs_on)
  );

  const headers = [
    'Dato',
    'Type',
    'Beskrivelse',
    'Kategori',
    'Konto',
    'Deling',
    'Frekvens',
    'Beløb (kr)',
  ];

  const rows = sorted.map((t) => {
    const isIncome = t.category?.kind === 'income';
    const signedOere = isIncome ? t.amount : -t.amount;
    return [
      t.occurs_on,
      isIncome ? 'Indtægt' : 'Udgift',
      t.description ?? t.category?.name ?? 'Uden beskrivelse',
      t.category?.name ?? '',
      t.account?.name ?? '',
      t.account?.owner_name === 'Fælles' ? 'Fælles' : 'Privat',
      RECURRENCE_LABEL_DA[t.recurrence],
      csvAmountDA(signedOere),
    ];
  });

  const csv = buildCsv(headers, rows);
  const filename = `fambud-poster-${month}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // Eksport indeholder husstandens finansielle data - må aldrig caches
      // af mellemliggende proxies eller browseren.
      'Cache-Control': 'no-store',
    },
  });
}
