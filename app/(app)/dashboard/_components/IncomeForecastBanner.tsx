// Banner på dashboard der opfordrer brugeren til at registrere flere
// lønudbetalinger hvis nogen family_member med primary_income_source='salary'
// endnu ikke har 3 logged paychecks. Bliver først meningsfuldt visuelt
// fokus, og forsvinder helt så snart alle har nok data — så det føles ikke
// som permanent støj.

import Link from 'next/link';
import { Sparkles, Plus } from 'lucide-react';
import { getFamilyMembers, getPrimaryIncomeForecast } from '@/lib/dal';
import { formatAmount } from '@/lib/format';

export async function IncomeForecastBanner() {
  const members = await getFamilyMembers();

  // Hent kun forecasts for personer der har 'salary' som primær kilde —
  // ydelses-folk og u-klassificerede behøver ikke status-tjekket her.
  const salaryMembers = members.filter((m) => m.primary_income_source === 'salary');
  if (salaryMembers.length === 0) return null;

  const forecasts = await Promise.all(
    salaryMembers.map(async (m) => ({
      member: m,
      forecast: await getPrimaryIncomeForecast(m.id),
    }))
  );

  const insufficient = forecasts.filter((f) => f.forecast.status === 'insufficient');
  const ready = forecasts.filter((f) => f.forecast.status === 'ready');

  // Helt dækket — ingen banner.
  if (insufficient.length === 0) return null;

  // Den første som mangler får sit "registrer"-link prefilled. De andre
  // listes som status-tekst.
  const firstNeeded = insufficient[0];
  const newPaycheckHref = `/indkomst/ny?role=primary&recurrence=once&member=${encodeURIComponent(firstNeeded.member.id)}`;

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-100 text-blue-700">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-blue-900">
          Indkomst-forecast er ikke klar endnu
        </div>
        <p className="mt-0.5 text-sm text-blue-800">
          Vi beregner et månedligt forecast ud fra de seneste 3 lønudbetalinger.
          Når der er logget nok udbetalinger, kan vi forudsige resten af året.
        </p>
        <ul className="mt-2 space-y-0.5 text-xs text-blue-800">
          {forecasts.map(({ member, forecast }) => (
            <li key={member.id}>
              <span className="font-medium">{member.name}:</span>{' '}
              {forecast.status === 'ready' ? (
                <span>
                  ✓ {formatAmount(forecast.monthlyNet)} kr/md netto (forecast klar)
                </span>
              ) : (
                <span>
                  {forecast.paychecksUsed} / {forecast.paychecksNeeded}{' '}
                  udbetalinger registreret
                </span>
              )}
            </li>
          ))}
          {/* Marker readyness eksplicit hvis alle var ready (vi viser banneret
              kun når mindst én er insufficient — denne sti rammes ikke,
              men den holder logikken læselig). */}
          {ready.length > 0 && insufficient.length === 0 && (
            <li className="text-blue-700">Forecast er klar for alle.</li>
          )}
        </ul>
      </div>
      <Link
        href={newPaycheckHref}
        className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md bg-blue-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-800"
      >
        <Plus className="h-3.5 w-3.5" />
        Registrer lønudbetaling
      </Link>
    </div>
  );
}
