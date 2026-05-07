'use client';

// LongTermEventBlock - "større, langsigtede opsparinger" der ikke
// hører hjemme i månedlig cashflow-plan. Når en event har timeframe
// '2-plus' OG budget >= 100.000 kr, klassificeres den som langsigtet
// (se LONG_TERM_THRESHOLD_* i calculatePlan.ts) og vises her i stedet
// for som plan-række.
//
// Tone: respektfuld, ikke nedladende. De her mål kræver en strategi
// brugeren ikke kan løse i en 2-minutters landingflow, så vi peger
// mod FamBud frem for at give et færdigt forslag.
//
// Placering på Step 3: efter praise/insights, før plan-tabs. Dermed
// signaler vi "det her er et separat spor" uden at gøre det til
// hovedfokus af resultatsiden.

import { formatKr, type LongTermEvent } from '@/lib/landing/calculatePlan';
import type { EventType } from '@/lib/landing/types';

const FAMBUD_FONT = 'var(--font-zt-nature), system-ui, sans-serif';

type Props = {
  events: LongTermEvent[];
};

// Titel-form (fx på h4) - matcher det brugeren så på StepTwo-pillen.
function typeTitle(type: EventType): string {
  switch (type) {
    case 'konfirmation':
      return 'Konfirmation';
    case 'bryllup':
      return 'Bryllup';
    case 'foedselsdag':
      return 'Rund fødselsdag';
    case 'rejse':
      return 'Større rejse';
    case 'bolig':
      return 'Bolig- eller bilkøb';
    case 'studie':
      return 'Studieafslutning';
    case 'ingen':
      return '';
  }
}

// Inline-form til prosa ("...som et bryllup..."). Bruges efter "som"
// så artikel skal være ubestemt entals (et/en).
function typeNoun(type: EventType): string {
  switch (type) {
    case 'konfirmation':
      return 'en konfirmation';
    case 'bryllup':
      return 'et bryllup';
    case 'foedselsdag':
      return 'en rund fødselsdag';
    case 'rejse':
      return 'en større rejse';
    case 'bolig':
      return 'en bolig eller bil';
    case 'studie':
      return 'en studieafslutning';
    case 'ingen':
      return '';
  }
}

export function LongTermEventBlock({ events }: Props) {
  if (events.length === 0) return null;

  return (
    <div className="mt-6 sm:mt-7">
      {events.map((event, idx) => (
        <div
          key={`${event.type}-${idx}`}
          className={`rounded border border-stone-200 bg-stone-100 px-6 py-5 sm:px-7 sm:py-6 ${
            idx > 0 ? 'mt-3' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-base text-neutral-700 shadow-sm"
              aria-hidden
            >
              ◆
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Langsigtet opsparingsmål
              </p>
              <h4
                className="mt-1 text-base leading-tight text-neutral-900 sm:text-lg"
                style={{ fontFamily: FAMBUD_FONT, letterSpacing: '-0.01em' }}
              >
                {typeTitle(event.type)}
              </h4>
              <p className="mt-0.5 text-sm text-neutral-600">
                <strong className="font-semibold text-neutral-900">
                  {formatKr(event.budget)} kr
                </strong>{' '}
                på 2+ år
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-neutral-700">
            Det her er et opsparingsmål i en helt anden størrelsesorden.
            Større, langsigtede opsparinger som {typeNoun(event.type)}{' '}
            kræver typisk en strategi der både ser på cashflow,
            eksisterende formue, og hvilken løsning der passer jer.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
            I FamBud kan I oprette en dedikeret langsigtet opsparing der
            ikke konkurrerer med jeres månedlige cashflow. Vi tager det
            med ind når I er klar til at bygge planen ud.
          </p>
        </div>
      ))}

      <p className="mt-3 text-xs italic leading-relaxed text-neutral-500">
        Resten af jeres plan herunder er baseret på jeres øvrige
        begivenheder og månedlige forbrug.
      </p>
    </div>
  );
}
