// Trin 1 i wizarden — kombinerer lønkonto-oprettelse og første lønudbetaling
// fordi de hører naturligt sammen. Uden et lønbeløb har resten af appen
// intet at vise (cashflow, forecast, dashboardet osv.), så vi gør begge
// ting i samme transaktion frem for to skærme i træk hvor anden trin
// føles som et "ekstra"-step.

import { getMyMembership } from '@/lib/dal';
import { LonkontoIncomeForm } from './_components/LonkontoIncomeForm';
import { createPersonalAccountWithIncome } from './actions';

export default async function WizardLonkontoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';
  // Owner: 7 trin (lonkonto, faelleskonti, familie, opsparing, kredit,
  // invite, done). Partner: 4 trin (lonkonto, opsparing, kredit, done).
  // Tallene afspejler det forenklede flow uden separat indkomst-trin.
  const totalSteps = isOwner ? 7 : 4;

  return (
    <div>
      {/* Velkomst-intro som sektion (ikke separat skærm) — sætter mental
          model uden at koste en klik. Kort og handlingsorienteret. */}
      <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50/60 p-4">
        <h2 className="text-sm font-semibold text-emerald-900">
          {isOwner ? 'Velkommen til Fambud' : 'Velkommen til husstanden'}
        </h2>
        <p className="mt-1 text-xs text-emerald-900/80">
          {isOwner
            ? 'Vi guider dig igennem opsætningen af jeres familiebudget. Det tager 5–10 minutter — vi springer udgifter, lån og overførsler over og tager dem efter wizarden i stedet.'
            : 'Husstanden er allerede sat op af din partner. Vi mangler bare din side: lønkonto, indkomst og eventuelle private opsparinger.'}
        </p>
      </div>

      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 1 af {totalSteps}
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Din lønkonto og indkomst
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Opret den konto hvor du modtager løn, og fortæl os hvor meget der
        kommer ind hver måned.
      </p>

      <div className="mt-6">
        <LonkontoIncomeForm
          action={createPersonalAccountWithIncome}
          isOwner={isOwner}
          error={error}
        />
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Du kan registrere flere konkrete lønudbetalinger på{' '}
        <span className="text-neutral-700">/indkomst</span> efter wizarden —
        med 3 udbetalinger laver vi et nøjagtigt forecast af din månedsløn.
      </p>
    </div>
  );
}
