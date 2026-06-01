'use client';

// Interaktiv fordelings-sektion: lader parret skifte mellem proportional og
// 50/50 og se konsekvensen - hvad hver person har TILBAGE efter at have
// betalt sin andel af de fælles udgifter. "Tilbage" gør forskellen mellem
// modellerne konkret: med 50/50 har den der tjener mindst markant mindre
// tilbage, hvilket er hele pointen med at kunne vælge proportional.
//
// "Tilbage efter fælles" = indkomst - andel. Det er bevidst FØR privat
// forbrug, så vi ikke afslører partnerens private udgifter (de er private
// via RLS). Det er beløbet hver har til sig selv (privat forbrug + opsparing)
// efter de fælles forpligtelser er dækket.
//
// Konkret-handling-panelet nedenfor oversætter den valgte model til reelle
// overførsler: "Mikkel: overfør X kr/md fra Lønkonto til Budgetkonto" med
// deep-link til /overforsler/ny som pre-udfylder formen. Det fjerner det
// mest almindelige post-rådgivnings-friktionspunkt: "hvad gør jeg nu?".

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatAmount, formatOereForInput } from '@/lib/format';
import type { FaellesSplit } from '@/lib/economy-plan';

type Model = 'proportional' | 'equal' | 'equalRemaining';

type Props = {
  split: FaellesSplit;
  faellesMonthlyExpense: number;
  currentUserId: string;
  // Mål for de foreslåede overførsler. Hvis null har husstanden ingen
  // fælleskonti endnu - så viser vi en henvisning til at oprette en først.
  primaryFaellesAccountId: string | null;
  primaryFaellesAccountName: string | null;
  // Buffer-konto: destination for opsparings-overførsler. Hvis null vises
  // en note om at oprette en buffer-konto i stedet for selve CTAen.
  bufferAccountId: string | null;
  bufferAccountName: string | null;
  // Husholdnings-konto: destination for husholdnings-overførsler (3.
  // obligatoriske). Hvis null vises som "opret en fælles husholdningskonto".
  husholdningAccountId: string | null;
  husholdningAccountName: string | null;
  // Begivenheder som FRIVILLIGE obligationer (ferie, bryllup, bil osv.). Hver
  // begivenhed bliver en ekstra overførsels-række pr. person under de tre
  // obligatoriske. Tomt array hvis husstanden ingen aktive events har.
  eventObligations: EventObligation[];
};

export type EventObligation = {
  id: string;
  name: string;
  monthly: number;
  targetAccountId: string;
  targetAccountName: string;
};

export function FaellesSplitSection({
  split,
  faellesMonthlyExpense,
  currentUserId,
  primaryFaellesAccountId,
  primaryFaellesAccountName,
  bufferAccountId,
  bufferAccountName,
  husholdningAccountId,
  husholdningAccountName,
  eventObligations,
}: Props) {
  const [model, setModel] = useState<Model>('proportional');

  const shareOf = (m: FaellesSplit['members'][number]) =>
    model === 'proportional'
      ? m.proportional
      : model === 'equal'
        ? m.equal
        : m.equalRemaining;
  const savingsShareOf = (m: FaellesSplit['members'][number]) =>
    model === 'proportional'
      ? m.savingsProportional
      : model === 'equal'
        ? m.savingsEqual
        : m.savingsEqualRemaining;
  const husholdningShareOf = (m: FaellesSplit['members'][number]) =>
    model === 'proportional'
      ? m.husholdningProportional
      : model === 'equal'
        ? m.husholdningEqual
        : m.husholdningEqualRemaining;

  // Per-event split: events er FRIVILLIGE obligationer (begivenheder) der
  // splittes efter samme model som de tre obligatoriske. Equal-remaining
  // er ikke meningsfuld pr. event uden re-fordeling af alle obligationer,
  // så vi falder tilbage til equal for den model. Acceptabelt v1; senere
  // refactor til array-baseret obligation-model kan håndtere det rigtigt.
  const eventShareFor = (
    m: FaellesSplit['members'][number],
    monthly: number
  ): number => {
    if (split.members.length === 0) return 0;
    if (model === 'proportional' && split.totalIncome > 0) {
      return Math.round((monthly * m.member.monthlyIncome) / split.totalIncome);
    }
    return Math.round(monthly / split.members.length);
  };

  const totalShare = split.members.reduce((s, m) => s + shareOf(m), 0);
  const totalSavings = split.members.reduce((s, m) => s + savingsShareOf(m), 0);
  const totalHusholdning = split.members.reduce(
    (s, m) => s + husholdningShareOf(m),
    0
  );

  // Events bidrager til "Betaler til fælles" på samme måde som de tre
  // obligatoriske. Andelen pr. medlem = sum over alle events af deres andel.
  // Skal beregnes FØR totalRemaining (som trækker dem fra) så ingen
  // hoisting-fælder.
  const eventShareTotalFor = (m: FaellesSplit['members'][number]): number =>
    eventObligations.reduce((s, e) => s + eventShareFor(m, e.monthly), 0);
  const eventsMonthlyTotal = eventObligations.reduce((s, e) => s + e.monthly, 0);
  const totalEvents = split.members.reduce(
    (s, m) => s + eventShareTotalFor(m),
    0
  );
  const totalCurrentEvents = split.members.reduce(
    (s, m) => s + m.member.currentToEventAccounts,
    0
  );
  const hasEvents = eventObligations.length > 0;

  const totalIncome = split.totalIncome;
  // Events skal med så "tilbage til sig selv" reflekterer ALLE forpligtede
  // overførsler, ikke kun de tre obligatoriske. Ellers viser tabellen et
  // for-højt rådighedsbeløb der ikke matcher dashboardet eller rapporten.
  const totalRemaining =
    totalIncome - totalShare - totalSavings - totalHusholdning - totalEvents;
  const totalCurrentExpense = split.members.reduce(
    (s, m) => s + m.member.currentToExpenseAccounts,
    0
  );
  const totalCurrentHusholdning = split.members.reduce(
    (s, m) => s + m.member.currentToHusholdningAccounts,
    0
  );
  const totalCurrentSavings = split.members.reduce(
    (s, m) => s + m.member.currentToSavingsAccounts,
    0
  );
  const hasSavings = split.savingsTotal > 0;
  const hasHusholdning = split.husholdningTotal > 0;

  const me = split.members.find((m) => m.member.userId === currentUserId);

  if (faellesMonthlyExpense === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-6 text-sm text-neutral-500">
        Ingen fælles udgifter registreret endnu. Tilføj faste udgifter på jeres
        fælleskonti, så kan jeg foreslå en fordeling.
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 max-w-2xl text-sm text-neutral-600">
        Jeres fælles forpligtelser:{' '}
        <span className="tabnum font-mono font-semibold text-neutral-900">
          {formatAmount(faellesMonthlyExpense)} kr/md
        </span>{' '}
        i faste udgifter
        {hasHusholdning && (
          <>
            ,{' '}
            <span className="tabnum font-mono font-semibold text-neutral-900">
              {formatAmount(split.husholdningTotal)} kr/md
            </span>{' '}
            til husholdning
          </>
        )}
        {hasSavings && (
          <>
            ,{' '}
            <span className="tabnum font-mono font-semibold text-neutral-900">
              {formatAmount(split.savingsTotal)} kr/md
            </span>{' '}
            til buffer-opsparing
          </>
        )}
        {hasEvents && (
          <>
            , og{' '}
            <span className="tabnum font-mono font-semibold text-neutral-900">
              {formatAmount(eventsMonthlyTotal)} kr/md
            </span>{' '}
            til begivenheder
          </>
        )}
        . Vælg en fordelingsmodel og se hvad hver har tilbage bagefter:
      </p>

      {/* Model-toggle */}
      <div className="mb-3 inline-flex rounded-md border border-neutral-200 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setModel('proportional')}
          className={`rounded px-3 py-1.5 font-medium transition ${
            model === 'proportional'
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Proportional
        </button>
        <button
          type="button"
          onClick={() => setModel('equal')}
          className={`rounded px-3 py-1.5 font-medium transition ${
            model === 'equal'
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          50/50
        </button>
        <button
          type="button"
          onClick={() => setModel('equalRemaining')}
          className={`rounded px-3 py-1.5 font-medium transition ${
            model === 'equalRemaining'
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Udlignet rådighed
        </button>
      </div>

      {model === 'equalRemaining' && (
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-neutral-500">
          Den der tjener mest betaler tilsvarende mere, så I begge ender med
          præcis det samme rådighedsbeløb -{' '}
          <span className="tabnum font-mono">
            {formatAmount(split.equalRemainingTarget)} kr
          </span>{' '}
          hver - efter de fælles udgifter er dækket.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-amber-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-100 bg-amber-50/60 text-left text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Person</th>
              <th className="px-4 py-2.5 text-right font-medium">Indkomst</th>
              <th className="px-4 py-2.5 text-right font-medium">
                Betaler til fælles
              </th>
              <th className="px-4 py-2.5 text-right font-medium">
                Tilbage til sig selv
              </th>
              <th className="px-4 py-2.5 text-right font-medium">
                Bidrager nu
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {split.members.map((m) => {
              const share = shareOf(m);
              const savingsShare = savingsShareOf(m);
              const husholdningShare = husholdningShareOf(m);
              const eventShare = eventShareTotalFor(m);
              const totalThisRow =
                share + savingsShare + husholdningShare + eventShare;
              const remaining = m.member.monthlyIncome - totalThisRow;
              const currentTotal =
                m.member.currentToExpenseAccounts +
                m.member.currentToHusholdningAccounts +
                m.member.currentToSavingsAccounts +
                m.member.currentToEventAccounts;
              return (
                <tr key={m.member.id}>
                  <td className="px-4 py-2.5 font-medium text-neutral-900">
                    {m.member.name}
                    {!m.member.incomeComplete && (
                      <span className="ml-1.5 text-[10px] font-normal text-amber-700">
                        (indkomst ufuldstændig)
                      </span>
                    )}
                  </td>
                  <td className="tabnum px-4 py-2.5 text-right font-mono text-neutral-600">
                    {formatAmount(m.member.monthlyIncome)}
                  </td>
                  <td className="tabnum px-4 py-2.5 text-right font-mono font-semibold text-neutral-900">
                    {formatAmount(totalThisRow)}
                  </td>
                  <td className="tabnum px-4 py-2.5 text-right font-mono font-semibold text-emerald-800">
                    {formatAmount(remaining)}
                  </td>
                  <td
                    className={`tabnum px-4 py-2.5 text-right font-mono ${
                      currentTotal >= totalThisRow ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {formatAmount(currentTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-neutral-200 text-[13px] font-semibold text-neutral-900">
              <td className="px-4 py-2.5">I alt</td>
              <td className="tabnum px-4 py-2.5 text-right font-mono">
                {formatAmount(totalIncome)}
              </td>
              <td className="tabnum px-4 py-2.5 text-right font-mono">
                {formatAmount(
                  totalShare + totalHusholdning + totalSavings + totalEvents
                )}
              </td>
              <td className="tabnum px-4 py-2.5 text-right font-mono">
                {formatAmount(totalRemaining)}
              </td>
              <td className="tabnum px-4 py-2.5 text-right font-mono">
                {formatAmount(
                  totalCurrentExpense +
                    totalCurrentHusholdning +
                    totalCurrentSavings +
                    totalCurrentEvents
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {split.hasIncompleteIncome && (
        <p className="mt-2 text-xs text-amber-700">
          En eller flere bidragydere mangler at registrere nok lønudbetalinger,
          så den proportionale fordeling er et foreløbigt skøn indtil indkomsten
          er fuldt registreret.
        </p>
      )}

      {me && (
        <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
          <span className="font-medium text-neutral-900">Din andel</span> med
          denne model:{' '}
          <span className="tabnum font-mono font-semibold">
            {formatAmount(shareOf(me))} kr
          </span>{' '}
          udgifter
          {hasHusholdning && (
            <>
              {' '}+{' '}
              <span className="tabnum font-mono font-semibold">
                {formatAmount(husholdningShareOf(me))} kr
              </span>{' '}
              husholdning
            </>
          )}
          {hasSavings && (
            <>
              {' '}+{' '}
              <span className="tabnum font-mono font-semibold">
                {formatAmount(savingsShareOf(me))} kr
              </span>{' '}
              opsparing
            </>
          )}
          {hasEvents && (
            <>
              {' '}+{' '}
              <span className="tabnum font-mono font-semibold">
                {formatAmount(eventShareTotalFor(me))} kr
              </span>{' '}
              begivenheder
            </>
          )}
          . Du bidrager{' '}
          <span className="tabnum font-mono">
            {formatAmount(me.member.currentToExpenseAccounts)} kr
          </span>{' '}
          til udgifter
          {hasHusholdning && (
            <>
              {' '}+{' '}
              <span className="tabnum font-mono">
                {formatAmount(me.member.currentToHusholdningAccounts)} kr
              </span>{' '}
              husholdning
            </>
          )}
          {hasSavings && (
            <>
              {' '}+{' '}
              <span className="tabnum font-mono">
                {formatAmount(me.member.currentToSavingsAccounts)} kr
              </span>{' '}
              opsparing
            </>
          )}
          {hasEvents && (
            <>
              {' '}+{' '}
              <span className="tabnum font-mono">
                {formatAmount(me.member.currentToEventAccounts)} kr
              </span>{' '}
              begivenheder
            </>
          )}{' '}
          i dag, og ville have{' '}
          <span className="tabnum font-mono font-semibold text-emerald-800">
            {formatAmount(
              me.member.monthlyIncome -
                shareOf(me) -
                savingsShareOf(me) -
                husholdningShareOf(me) -
                eventShareTotalFor(me)
            )} kr
          </span>{' '}
          tilbage til dig selv.
        </div>
      )}

      <TransferRecommendations
        members={split.members}
        shareOf={shareOf}
        savingsShareOf={savingsShareOf}
        husholdningShareOf={husholdningShareOf}
        eventShareFor={eventShareFor}
        primaryFaellesAccountId={primaryFaellesAccountId}
        primaryFaellesAccountName={primaryFaellesAccountName}
        bufferAccountId={bufferAccountId}
        bufferAccountName={bufferAccountName}
        husholdningAccountId={husholdningAccountId}
        husholdningAccountName={husholdningAccountName}
        eventObligations={eventObligations}
        hasSavings={hasSavings}
        hasHusholdning={hasHusholdning}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Konkret-handlings-panel: oversætter den valgte fordelingsmodel til reelle
// overførsler. For hver bidragyder vises 1-2 rækker: én til UDGIFTER og
// (hvis buffer-anbefaling > 0) én til OPSPARING. Hver række har sin egen
// status (på mål / øg / reducér) og deep-link til /overforsler/ny.
// CTA'en virker for caller's egen række altid; under proxy virker den
// også for grantorens række fordi createTransfer-action er perspective-
// aware (v1.7).
// ---------------------------------------------------------------------------

type FaellesSplitMember = FaellesSplit['members'][number];

function TransferRecommendations({
  members,
  shareOf,
  savingsShareOf,
  husholdningShareOf,
  eventShareFor,
  primaryFaellesAccountId,
  primaryFaellesAccountName,
  bufferAccountId,
  bufferAccountName,
  husholdningAccountId,
  husholdningAccountName,
  eventObligations,
  hasSavings,
  hasHusholdning,
}: {
  members: FaellesSplitMember[];
  shareOf: (m: FaellesSplitMember) => number;
  savingsShareOf: (m: FaellesSplitMember) => number;
  husholdningShareOf: (m: FaellesSplitMember) => number;
  eventShareFor: (m: FaellesSplitMember, monthly: number) => number;
  primaryFaellesAccountId: string | null;
  primaryFaellesAccountName: string | null;
  bufferAccountId: string | null;
  bufferAccountName: string | null;
  husholdningAccountId: string | null;
  husholdningAccountName: string | null;
  eventObligations: EventObligation[];
  hasSavings: boolean;
  hasHusholdning: boolean;
}) {
  if (!primaryFaellesAccountId || !primaryFaellesAccountName) {
    return (
      <div className="mt-5 rounded-md border border-dashed border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-500">
        Opret en fælleskonto (Budget, Husholdning eller buffer) før jeg kan
        foreslå konkrete overførsler.{' '}
        <Link
          href="/konti/ny"
          className="font-medium text-neutral-900 underline hover:text-emerald-700"
        >
          Opret konto
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        Sådan sætter I overførslerne op
      </h3>
      <div className="space-y-3">
        {members.map((m) => (
          <PersonRecommendationBlock
            key={m.member.id}
            member={m}
            expenseShare={shareOf(m)}
            husholdningShare={husholdningShareOf(m)}
            savingsShare={savingsShareOf(m)}
            eventShares={eventObligations.map((e) => ({
              event: e,
              share: eventShareFor(m, e.monthly),
            }))}
            faellesAccountId={primaryFaellesAccountId}
            faellesAccountName={primaryFaellesAccountName}
            bufferAccountId={bufferAccountId}
            bufferAccountName={bufferAccountName}
            husholdningAccountId={husholdningAccountId}
            husholdningAccountName={husholdningAccountName}
            showSavingsRow={hasSavings}
            showHusholdningRow={hasHusholdning}
          />
        ))}
      </div>
    </div>
  );
}

function PersonRecommendationBlock({
  member: m,
  expenseShare,
  husholdningShare,
  savingsShare,
  eventShares,
  faellesAccountId,
  faellesAccountName,
  bufferAccountId,
  bufferAccountName,
  husholdningAccountId,
  husholdningAccountName,
  showSavingsRow,
  showHusholdningRow,
}: {
  member: FaellesSplitMember;
  expenseShare: number;
  husholdningShare: number;
  savingsShare: number;
  eventShares: { event: EventObligation; share: number }[];
  faellesAccountId: string;
  faellesAccountName: string;
  bufferAccountId: string | null;
  bufferAccountName: string | null;
  husholdningAccountId: string | null;
  husholdningAccountName: string | null;
  showSavingsRow: boolean;
  showHusholdningRow: boolean;
}) {
  const { member } = m;
  return (
    <div className="overflow-hidden rounded-md border border-amber-200 bg-white">
      <div className="border-b border-amber-100 bg-amber-50/60 px-4 py-2 text-xs font-medium uppercase tracking-wider text-neutral-700">
        {member.name}
        {!member.lonkontoId && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal text-amber-800">
            Mangler lønkonto - skal igennem sin egen wizard
          </span>
        )}
      </div>
      <div className="divide-y divide-neutral-100">
        <RecommendationRow
          kind="udgifter"
          memberName={member.name}
          lonkontoId={member.lonkontoId}
          lonkontoName={member.lonkontoName}
          targetAccountId={faellesAccountId}
          targetAccountName={faellesAccountName}
          recommendedAmount={expenseShare}
          currentAmount={member.currentToExpenseAccounts}
          description="Fælles udgifter"
        />
        {showHusholdningRow && husholdningShare > 0 && (
          husholdningAccountId && husholdningAccountName ? (
            <RecommendationRow
              kind="husholdning"
              memberName={member.name}
              lonkontoId={member.lonkontoId}
              lonkontoName={member.lonkontoName}
              targetAccountId={husholdningAccountId}
              targetAccountName={husholdningAccountName}
              recommendedAmount={husholdningShare}
              currentAmount={member.currentToHusholdningAccounts}
              description="Husholdning"
            />
          ) : (
            <div className="px-4 py-3 text-xs text-amber-700">
              Husstanden mangler en husholdnings-konto. {' '}
              <Link
                href="/konti/ny"
                className="font-medium text-amber-900 underline hover:text-amber-700"
              >
                Opret en fælles husholdningskonto
              </Link>
              {' '} så kan jeg foreslå den månedlige overførsel.
            </div>
          )
        )}
        {showSavingsRow && savingsShare > 0 && (
          bufferAccountId && bufferAccountName ? (
            <RecommendationRow
              kind="opsparing"
              memberName={member.name}
              lonkontoId={member.lonkontoId}
              lonkontoName={member.lonkontoName}
              targetAccountId={bufferAccountId}
              targetAccountName={bufferAccountName}
              recommendedAmount={savingsShare}
              currentAmount={member.currentToSavingsAccounts}
              description="Buffer-opsparing"
            />
          ) : (
            <div className="px-4 py-3 text-xs text-amber-700">
              Husstanden mangler en buffer-konto. {' '}
              <Link
                href="/konti/ny"
                className="font-medium text-amber-900 underline hover:text-amber-700"
              >
                Opret en opsparingskonto med formål &ldquo;Buffer&rdquo;
              </Link>
              {' '} så kan jeg foreslå den månedlige overførsel.
            </div>
          )
        )}
        {eventShares.map(({ event, share }) =>
          share > 0 ? (
            <RecommendationRow
              key={event.id}
              kind="event"
              memberName={member.name}
              lonkontoId={member.lonkontoId}
              lonkontoName={member.lonkontoName}
              targetAccountId={event.targetAccountId}
              targetAccountName={event.targetAccountName}
              recommendedAmount={share}
              currentAmount={0}
              description={event.name}
              eventLabel={event.name}
              lifeEventId={event.id}
              hideCurrent
            />
          ) : null
        )}
      </div>
    </div>
  );
}

function RecommendationRow({
  kind,
  memberName,
  lonkontoId,
  lonkontoName,
  targetAccountId,
  targetAccountName,
  recommendedAmount,
  currentAmount,
  description,
  eventLabel,
  lifeEventId,
  hideCurrent = false,
}: {
  kind: 'udgifter' | 'husholdning' | 'opsparing' | 'event';
  memberName: string;
  lonkontoId: string | null;
  lonkontoName: string | null;
  targetAccountId: string;
  targetAccountName: string;
  recommendedAmount: number;
  currentAmount: number;
  description: string;
  // Begivenheds-titel til badge ("Til Ferie 2026" frem for "Til begivenhed").
  eventLabel?: string;
  // Linker overførslen til en begivenhed i transfer-formularens prefill.
  lifeEventId?: string;
  // Skjul "I dag: X kr. Øg/Reducér med Y"-linjen. Bruges for events hvor vi
  // (v1) ikke har per-medlem-current-data.
  hideCurrent?: boolean;
}) {
  const diff = recommendedAmount - currentAmount;
  const onTarget = Math.abs(diff) < 5000;
  const needsIncrease = diff >= 5000;

  const hasLonkonto = lonkontoId != null;
  const prefillUrl = hasLonkonto
    ? `/overforsler/ny?from=${encodeURIComponent(lonkontoId)}&to=${encodeURIComponent(targetAccountId)}&amount=${encodeURIComponent(formatOereForInput(recommendedAmount))}&recurrence=monthly&description=${encodeURIComponent(description)}${lifeEventId ? `&life_event_id=${encodeURIComponent(lifeEventId)}` : ''}`
    : null;

  const kindLabel =
    kind === 'udgifter'
      ? 'Til udgifter'
      : kind === 'husholdning'
        ? 'Til husholdning'
        : kind === 'opsparing'
          ? 'Til opsparing'
          : `Til ${eventLabel ?? 'begivenhed'}`;
  const kindBadgeClass =
    kind === 'udgifter'
      ? 'bg-amber-100 text-amber-900'
      : kind === 'husholdning'
        ? 'bg-sky-100 text-sky-900'
        : kind === 'opsparing'
          ? 'bg-emerald-100 text-emerald-900'
          : 'bg-violet-100 text-violet-900';

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-2 text-neutral-900">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${kindBadgeClass}`}>
            {kindLabel}
          </span>
          <span className="tabnum font-mono font-semibold">
            {formatAmount(recommendedAmount)} kr/md
          </span>
          <span className="text-neutral-500">til</span>
          <span className="font-medium">{targetAccountName}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
          {hasLonkonto ? (
            <span>
              Fra <span className="text-neutral-700">{lonkontoName}</span> · Månedlig
            </span>
          ) : (
            <span className="text-amber-700">{memberName} mangler en lønkonto</span>
          )}
          {!hideCurrent && (
            <>
              <span className="text-neutral-300">·</span>
              {onTarget ? (
                <span className="text-emerald-700">
                  På mål ({formatAmount(currentAmount)} kr/md i dag)
                </span>
              ) : needsIncrease ? (
                <span className="text-amber-700">
                  I dag: {formatAmount(currentAmount)} kr. Øg med{' '}
                  {formatAmount(Math.abs(diff))} kr
                </span>
              ) : (
                <span className="text-amber-700">
                  I dag: {formatAmount(currentAmount)} kr. Reducér med{' '}
                  {formatAmount(Math.abs(diff))} kr
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {prefillUrl && (hideCurrent || !onTarget) && (
        <Link
          href={prefillUrl}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-900"
        >
          Opsæt overførsel
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
