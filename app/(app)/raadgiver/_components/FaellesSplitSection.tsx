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
};

export function FaellesSplitSection({
  split,
  faellesMonthlyExpense,
  currentUserId,
  primaryFaellesAccountId,
  primaryFaellesAccountName,
}: Props) {
  const [model, setModel] = useState<Model>('proportional');

  const shareOf = (m: FaellesSplit['members'][number]) =>
    model === 'proportional'
      ? m.proportional
      : model === 'equal'
        ? m.equal
        : m.equalRemaining;

  const totalShare = split.members.reduce((s, m) => s + shareOf(m), 0);
  const totalIncome = split.totalIncome;
  const totalRemaining = totalIncome - totalShare;
  const totalCurrent = split.members.reduce((s, m) => s + m.current, 0);

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
        Jeres fælles udgifter er{' '}
        <span className="tabnum font-mono font-semibold text-neutral-900">
          {formatAmount(faellesMonthlyExpense)} kr/md
        </span>
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
              <th className="px-4 py-2.5 text-right font-medium">Bidrager nu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {split.members.map((m) => {
              const share = shareOf(m);
              const remaining = m.member.monthlyIncome - share;
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
                    {formatAmount(share)}
                  </td>
                  <td className="tabnum px-4 py-2.5 text-right font-mono font-semibold text-emerald-800">
                    {formatAmount(remaining)}
                  </td>
                  <td
                    className={`tabnum px-4 py-2.5 text-right font-mono ${
                      m.current >= share ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {formatAmount(m.current)}
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
                {formatAmount(totalShare)}
              </td>
              <td className="tabnum px-4 py-2.5 text-right font-mono">
                {formatAmount(totalRemaining)}
              </td>
              <td className="tabnum px-4 py-2.5 text-right font-mono">
                {formatAmount(totalCurrent)}
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
          </span>
          . Du bidrager{' '}
          <span className="tabnum font-mono">{formatAmount(me.current)} kr</span>{' '}
          i dag, og ville have{' '}
          <span className="tabnum font-mono font-semibold text-emerald-800">
            {formatAmount(me.member.monthlyIncome - shareOf(me))} kr
          </span>{' '}
          tilbage til dig selv.
        </div>
      )}

      <TransferRecommendations
        members={split.members}
        shareOf={shareOf}
        primaryFaellesAccountId={primaryFaellesAccountId}
        primaryFaellesAccountName={primaryFaellesAccountName}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Konkret-handlings-panel: oversætter den valgte fordelingsmodel til reelle
// overførsler. For hver bidragyder vises beløb + diff vs. nuværende bidrag.
// CTA'en deep-linker til /overforsler/ny med pre-fyldte felter når
// vedkommendes lønkonto findes; hvis lønkonto mangler vises en tydelig
// instruktion i stedet. Knappen virker for caller's egen række altid; under
// proxy virker den også for grantorens række fordi createTransfer-action
// er perspective-aware (v1.7).
// ---------------------------------------------------------------------------

type FaellesSplitMember = FaellesSplit['members'][number];

function TransferRecommendations({
  members,
  shareOf,
  primaryFaellesAccountId,
  primaryFaellesAccountName,
}: {
  members: FaellesSplitMember[];
  shareOf: (m: FaellesSplitMember) => number;
  primaryFaellesAccountId: string | null;
  primaryFaellesAccountName: string | null;
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
      <div className="space-y-2">
        {members.map((m) => (
          <TransferRecommendationRow
            key={m.member.id}
            member={m}
            share={shareOf(m)}
            faellesAccountId={primaryFaellesAccountId}
            faellesAccountName={primaryFaellesAccountName}
          />
        ))}
      </div>
    </div>
  );
}

function TransferRecommendationRow({
  member: m,
  share,
  faellesAccountId,
  faellesAccountName,
}: {
  member: FaellesSplitMember;
  share: number;
  faellesAccountId: string;
  faellesAccountName: string;
}) {
  const { member } = m;
  const diff = share - m.current;
  // Threshold på 50 kr så små afrundinger ikke flagges som "skal justeres".
  const onTarget = Math.abs(diff) < 5000;
  const needsIncrease = diff >= 5000;

  const hasLonkonto = member.lonkontoId != null;
  const prefillUrl = hasLonkonto
    ? `/overforsler/ny?from=${encodeURIComponent(member.lonkontoId!)}&to=${encodeURIComponent(faellesAccountId)}&amount=${encodeURIComponent(formatOereForInput(share))}&recurrence=monthly&description=${encodeURIComponent('Fælles bidrag')}`
    : null;

  return (
    <div className="rounded-md border border-amber-100 bg-amber-50/40 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2 text-neutral-900">
            <span className="font-medium">{member.name}</span>
            <span className="text-neutral-500">overfører</span>
            <span className="tabnum font-mono font-semibold">
              {formatAmount(share)} kr/md
            </span>
            <span className="text-neutral-500">til</span>
            <span className="font-medium">{faellesAccountName}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
            {hasLonkonto ? (
              <span>
                Fra <span className="text-neutral-700">{member.lonkontoName}</span> · Månedlig
              </span>
            ) : (
              <span className="text-amber-700">
                {member.name} mangler en lønkonto. Skal igennem sin egen wizard
              </span>
            )}
            <span className="text-neutral-300">·</span>
            {onTarget ? (
              <span className="text-emerald-700">
                På mål ({formatAmount(m.current)} kr/md i dag)
              </span>
            ) : needsIncrease ? (
              <span className="text-amber-700">
                I dag: {formatAmount(m.current)} kr. Øg med{' '}
                {formatAmount(Math.abs(diff))} kr
              </span>
            ) : (
              <span className="text-neutral-600">
                I dag: {formatAmount(m.current)} kr. Reducér med{' '}
                {formatAmount(Math.abs(diff))} kr
              </span>
            )}
          </div>
        </div>
        {prefillUrl && !onTarget && (
          <Link
            href={prefillUrl}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-900"
          >
            Opsæt overførsel
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
