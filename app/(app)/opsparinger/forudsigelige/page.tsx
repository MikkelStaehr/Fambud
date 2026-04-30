// /opsparinger/forudsigelige — detail-side til at sætte de konkrete
// kategorier op for "Forudsigelige uforudsete"-puljen. Selve oversigten
// (/opsparinger) viser kun en summary; al CRUD sker her.
//
// Mental model: brugeren tænker "hvad bruger vi om året på de ting der
// VED kommer men har uforudsigelig timing? Tandlæge, gaver, bilvedligehold,
// etc." og indtaster et yearly_amount pr. kategori. Sum / 12 = anbefalet
// månedlig overførsel til den dedikerede konto.
//
// Default-rækker (Gaver, Tandlæge, Bil, Cykel) seedes via "Brug forslag"-
// knappen — bevidst manuel handling så brugeren ejer sit eget budget i
// stedet for at få det hældt ned over hovedet.

import Link from 'next/link';
import { ArrowLeft, CalendarRange, Trash2 } from 'lucide-react';
import {
  getPredictableEstimates,
  sumYearlyEstimates,
} from '@/lib/dal';
import { formatAmount } from '@/lib/format';
import type { PredictableEstimate } from '@/lib/database.types';
import {
  addPredictableEstimate,
  deletePredictableEstimate,
  seedDefaultEstimates,
  updatePredictableEstimate,
} from '../actions';

export default async function ForudsigeligePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const estimates = await getPredictableEstimates();
  const yearlyTotal = sumYearlyEstimates(estimates);
  const monthlyRecommend = Math.round(yearlyTotal / 12 / 100) * 100;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/opsparinger"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til opsparinger
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded bg-amber-50 text-amber-800">
            <CalendarRange className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
              Forudsigelige uforudsete
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500">
              Pulje til ting du VED kommer — bilvedligehold, tandlæge, gaver,
              ferie. Sæt jeres egne tal op nedenfor.
            </p>
          </div>
        </div>
      </header>

      {sp.error && (
        <div className="mt-4 max-w-2xl rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <div className="mt-6 max-w-2xl space-y-6">
        {/* Summary-kort: hvor meget kommer der ud af kategorierne? */}
        {estimates.length > 0 && yearlyTotal > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="text-[10px] font-medium uppercase tracking-wider text-amber-800">
              Anbefalet månedligt indskud
            </div>
            <div className="mt-1 tabnum font-mono text-3xl font-semibold text-amber-900">
              {formatAmount(monthlyRecommend)} kr
            </div>
            <p className="mt-1 text-xs text-amber-800">
              {formatAmount(yearlyTotal)} kr/år fordelt på 12 måneder. Bygger
              op løbende — pulje bruges når udgifterne dukker op.
            </p>
          </div>
        )}

        {/* Kategori-editor */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Kategorier
            </h2>
            {estimates.length > 0 && (
              <span className="tabnum font-mono text-xs text-neutral-500">
                {formatAmount(yearlyTotal)} kr/år i alt
              </span>
            )}
          </div>

          <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
            {estimates.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">
                <p>Ingen kategorier endnu.</p>
                <p className="mt-1 text-xs text-neutral-400">
                  Brug forslaget herunder eller tilføj dine egne i form'et nederst.
                </p>
                <form action={seedDefaultEstimates} className="mt-4">
                  <button
                    type="submit"
                    className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                  >
                    Brug forslag (Gaver, Tandlæge, Bil, Cykel)
                  </button>
                </form>
              </div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {estimates.map((e) => (
                  <EstimateRow key={e.id} estimate={e} />
                ))}
              </ul>
            )}

            {/* Add-form — altid synlig så det er nemt at tilføje. */}
            <form
              action={addPredictableEstimate}
              className="border-t border-neutral-100 bg-neutral-50/50 p-3"
            >
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                <input
                  name="label"
                  type="text"
                  required
                  placeholder="F.eks. Briller, Kæledyr, Ferie"
                  className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <input
                  name="yearly_amount"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="kr/år"
                  className="w-32 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-right font-mono tabnum text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <button
                  type="submit"
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-neutral-800"
                >
                  Tilføj
                </button>
              </div>
            </form>
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            Eksempler på beløb: en benzin-bil koster typisk 6.000–10.000 kr/år
            i vedligehold (el-bil 2.000–6.000). Tandlæge ca. 600–800 kr pr.
            besøg pr. person, 2× om året. Gaver: antal gaver × pris × personer.
          </p>
        </section>
      </div>
    </div>
  );
}

function EstimateRow({ estimate }: { estimate: PredictableEstimate }) {
  const updateAction = updatePredictableEstimate.bind(null, estimate.id);
  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <form action={updateAction} className="flex flex-1 items-center gap-2">
        <input
          name="label"
          type="text"
          required
          defaultValue={estimate.label}
          className="flex-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <input
          name="yearly_amount"
          type="text"
          inputMode="decimal"
          required
          defaultValue={(estimate.yearly_amount / 100).toFixed(0)}
          className="w-28 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-right font-mono tabnum text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <span className="text-xs text-neutral-500">kr/år</span>
        <button
          type="submit"
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Gem
        </button>
      </form>
      <form action={deletePredictableEstimate}>
        <input type="hidden" name="id" value={estimate.id} />
        <button
          type="submit"
          aria-label="Slet kategori"
          className="rounded-md p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </form>
    </li>
  );
}
