// /farve-test - preview af foreslåede brand-farver (olive + cream)
// appliceret på rigtige komponenter: wordmark, CTA-knapper, hero,
// dashboard-mockup. Erstatter den slettede /wordmark-test-side.
//
// Den nuværende app bruger emerald-700/800 + stone-50 som primær +
// background. Denne side tester hvordan #4B4D39 (muted olive) +
// #EDE6D4 (warm cream) ville føles som et alternativ.
//
// Ingen auth, ingen sidebar - bare et galleri til at træffe brand-
// beslutning. Slettes igen når palette er valgt.

import Link from 'next/link';
import { ArrowRight, Calendar, Goal, Wallet } from 'lucide-react';
import { FambudMark } from '@/app/_components/FambudMark';

export const metadata = {
  title: 'Farve-test - Fambud',
};

// Palette - centralt så vi ikke skal gentage HEX-koder overalt
const OLIVE = '#4B4D39';
const CREAM = '#EDE6D4';
// Afledte farver til praktisk brug
const OLIVE_DARK = '#3B3D2B'; // hover/pressed states
const OLIVE_LIGHT = '#6B6D55'; // muted text på cream
const CREAM_DEEP = '#E0D8C0'; // borders/dividers på cream-bg
const TEXT_ON_CREAM = '#1F1F18'; // body-text - mere kontrast end OLIVE
const POSITIVE = '#5F6244'; // muted lime - til overskud/positiv
const NEGATIVE = '#A0392E'; // muted terracotta - til underskud/negativ

export default function FarveTestPage() {
  return (
    <div style={{ backgroundColor: CREAM, color: TEXT_ON_CREAM }} className="min-h-screen">
      <header
        className="border-b px-6 py-6"
        style={{ borderColor: CREAM_DEEP, backgroundColor: CREAM }}
      >
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard"
            className="text-xs font-medium hover:underline"
            style={{ color: OLIVE_LIGHT }}
          >
            ← Tilbage til dashboard
          </Link>
          <h1
            className="mt-2 text-2xl font-semibold tracking-tight"
            style={{ color: OLIVE }}
          >
            Farve-test: olive + cream
          </h1>
          <p className="mt-1 text-sm" style={{ color: OLIVE_LIGHT }}>
            Forslag til ny brand-palette. Sammenlign med den nuværende
            emerald + stone ved at åbne en anden fane.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-6 py-10">
        {/* Palette swatches */}
        <section>
          <SectionHeading>Palette</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <Swatch
              hex={OLIVE}
              name="Olive"
              note="Primær - CTAs, accents, brand-tekst"
              textColor={CREAM}
            />
            <Swatch
              hex={CREAM}
              name="Cream"
              note="Baggrund + tekst på olive"
              textColor={OLIVE}
              outline
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Swatch hex={OLIVE_DARK} name="Olive dark" note="Hover/pressed" textColor={CREAM} small />
            <Swatch hex={OLIVE_LIGHT} name="Olive light" note="Muted text" textColor={CREAM} small />
            <Swatch hex={POSITIVE} name="Positive" note="Overskud, positive tal" textColor={CREAM} small />
            <Swatch hex={NEGATIVE} name="Negative" note="Underskud, advarsel" textColor={CREAM} small />
          </div>
        </section>

        {/* Wordmark */}
        <section>
          <SectionHeading>Wordmark</SectionHeading>
          <div className="space-y-4">
            {/* Olive on cream */}
            <div
              className="flex items-center justify-center rounded-md border px-8 py-12"
              style={{ borderColor: CREAM_DEEP, backgroundColor: CREAM }}
            >
              <FambudMark size="hero" color={OLIVE} />
            </div>

            {/* Cream on olive */}
            <div
              className="flex items-center justify-center rounded-md px-8 py-12"
              style={{ backgroundColor: OLIVE }}
            >
              <FambudMark size="hero" color={CREAM} />
            </div>

            {/* Mindre størrelser */}
            <div
              className="flex flex-wrap items-baseline gap-x-12 gap-y-6 rounded-md border px-6 py-6"
              style={{ borderColor: CREAM_DEEP, backgroundColor: 'white' }}
            >
              <FambudMark size="xl" color={OLIVE} />
              <FambudMark size="lg" color={OLIVE} />
              <FambudMark size="base" color={OLIVE} />
              <FambudMark size="sm" color={OLIVE} />
            </div>
          </div>
        </section>

        {/* CTA-knapper */}
        <section>
          <SectionHeading>CTA-knapper</SectionHeading>
          <div
            className="rounded-md border p-6"
            style={{ borderColor: CREAM_DEEP, backgroundColor: CREAM }}
          >
            <div className="flex flex-wrap items-center gap-3">
              {/* Primary - default */}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md px-6 py-3 text-base font-semibold transition"
                style={{ backgroundColor: OLIVE, color: CREAM }}
              >
                Kom i gang
                <ArrowRight className="h-4 w-4" />
              </button>

              {/* Primary - hover state (vis manuelt med darker olive) */}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md px-6 py-3 text-base font-semibold"
                style={{ backgroundColor: OLIVE_DARK, color: CREAM }}
              >
                Hover state
                <ArrowRight className="h-4 w-4" />
              </button>

              {/* Secondary - outline */}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border-2 bg-transparent px-6 py-3 text-base font-semibold transition"
                style={{ borderColor: OLIVE, color: OLIVE }}
              >
                Log ind
              </button>

              {/* Tertiary - text only */}
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-3 text-sm font-medium underline"
                style={{ color: OLIVE_LIGHT }}
              >
                Lær mere
              </button>

              {/* Disabled */}
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 rounded-md px-6 py-3 text-base font-semibold opacity-50"
                style={{ backgroundColor: OLIVE, color: CREAM }}
              >
                Disabled
              </button>
            </div>

            <p className="mt-4 text-xs" style={{ color: OLIVE_LIGHT }}>
              Primary = olive baggrund, cream tekst. Secondary = olive outline
              på cream. Tertiary = olive-light underlined.
            </p>
          </div>
        </section>

        {/* Hero-style */}
        <section>
          <SectionHeading>Hero-overskrift (landing-stil)</SectionHeading>
          <div
            className="rounded-md border p-10"
            style={{ borderColor: CREAM_DEEP, backgroundColor: CREAM }}
          >
            <span
              className="inline-block rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{
                backgroundColor: 'transparent',
                border: `1px solid ${OLIVE}`,
                color: OLIVE,
              }}
            >
              ✦ Økonomisk planlægning for almindelige mennesker
            </span>
            <h2
              className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl"
              style={{
                color: OLIVE,
                fontFamily: 'var(--font-zt-nature), system-ui, sans-serif',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              Se hvor pengene løber hen, før de gør det
            </h2>
            <p
              className="mt-4 max-w-xl text-base leading-relaxed"
              style={{ color: OLIVE_LIGHT }}
            >
              Fambud hjælper dig med at sætte din økonomi i system. Du
              fortæller os hvad der kommer ind, hvad der går ud, og hvad
              du gerne vil spare op.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md px-6 py-3 text-base font-semibold"
                style={{ backgroundColor: OLIVE, color: CREAM }}
              >
                Prøv det med jeres egne tal
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border-2 bg-transparent px-6 py-3 text-base font-semibold"
                style={{ borderColor: OLIVE, color: OLIVE }}
              >
                Kom i gang gratis
              </button>
            </div>
          </div>
        </section>

        {/* Dashboard-mockup */}
        <section>
          <SectionHeading>Dashboard-mockup</SectionHeading>
          <div
            className="rounded-md border p-6"
            style={{ borderColor: CREAM_DEEP, backgroundColor: CREAM }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: OLIVE_LIGHT }}
            >
              Tirsdag den 12. maj 2026
            </p>
            <h3
              className="mt-2 text-2xl font-semibold tracking-tight"
              style={{ color: OLIVE }}
            >
              Goddag, Mikkel
            </h3>

            {/* Hero status */}
            <div
              className="mt-6 rounded-md border bg-white p-6"
              style={{ borderColor: CREAM_DEEP }}
            >
              <p
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: OLIVE_LIGHT }}
              >
                Er du på rette spor?
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span
                  className="font-mono tabnum text-4xl font-bold sm:text-5xl"
                  style={{ color: POSITIVE }}
                >
                  + 13.421,98
                </span>
                <span className="text-2xl font-semibold" style={{ color: POSITIVE }}>
                  kr
                </span>
              </div>
              <p className="mt-1 text-sm" style={{ color: OLIVE_LIGHT }}>
                Du har overskud denne måned
              </p>

              <div className="mt-6 grid grid-cols-2 gap-6 border-t pt-4" style={{ borderColor: CREAM_DEEP }}>
                <div>
                  <dt
                    className="text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: OLIVE_LIGHT }}
                  >
                    Indtægter
                  </dt>
                  <dd
                    className="mt-0.5 font-mono tabnum text-xl font-semibold"
                    style={{ color: TEXT_ON_CREAM }}
                  >
                    + 54.873,33
                  </dd>
                </div>
                <div>
                  <dt
                    className="text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: OLIVE_LIGHT }}
                  >
                    Udgifter
                  </dt>
                  <dd
                    className="mt-0.5 font-mono tabnum text-xl font-semibold"
                    style={{ color: NEGATIVE }}
                  >
                    − 41.451,35
                  </dd>
                </div>
              </div>
            </div>

            {/* Begivenheds-kort */}
            <div
              className="mt-4 rounded-md border bg-white p-4"
              style={{ borderColor: CREAM_DEEP }}
            >
              <header className="mb-3 flex items-center justify-between">
                <h4
                  className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider"
                  style={{ color: OLIVE_LIGHT }}
                >
                  <Goal className="h-3 w-3" />
                  Begivenheder
                </h4>
                <Link
                  href="#"
                  className="inline-flex items-center gap-1 text-xs hover:underline"
                  style={{ color: OLIVE_LIGHT }}
                >
                  Se alle
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </header>
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium"
                      style={{ color: TEXT_ON_CREAM }}
                    >
                      Thailand 2027
                    </span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: CREAM,
                        color: OLIVE,
                      }}
                    >
                      Større rejse
                    </span>
                  </div>
                  <div
                    className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
                    style={{ color: OLIVE_LIGHT }}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      11. okt 2027
                    </span>
                    <span>3.125 kr/md for at nå målet</span>
                  </div>
                </div>
                <span
                  className="shrink-0 font-mono tabnum text-xs"
                  style={{ color: OLIVE_LIGHT }}
                >
                  50.000 kr
                </span>
              </div>
            </div>

            {/* Wallet-konti-row */}
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm"
              style={{ backgroundColor: 'white', color: TEXT_ON_CREAM }}
            >
              <Wallet className="h-3.5 w-3.5" style={{ color: OLIVE_LIGHT }} />
              <span>
                Tilknyttet{' '}
                <strong className="font-semibold">Buffer</strong>{' '}
                <span style={{ color: OLIVE_LIGHT }}>(Opsparing)</span>
              </span>
            </div>
          </div>
        </section>

        {/* Pille-typografi + labels */}
        <section>
          <SectionHeading>Pille + labels</SectionHeading>
          <div
            className="flex flex-wrap items-center gap-3 rounded-md border p-6"
            style={{ borderColor: CREAM_DEEP, backgroundColor: CREAM }}
          >
            <span
              className="inline-block rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ border: `1px solid ${OLIVE}`, color: OLIVE }}
            >
              ✦ Pille - outline
            </span>
            <span
              className="inline-block rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em]"
              style={{ backgroundColor: OLIVE, color: CREAM }}
            >
              ✦ Pille - solid
            </span>
            <span
              className="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: CREAM_DEEP, color: OLIVE }}
            >
              Type-badge
            </span>
            <span
              className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: POSITIVE, color: CREAM }}
            >
              Aktiv opsparing
            </span>
            <span
              className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: 'rgba(160, 57, 46, 0.15)',
                color: NEGATIVE,
              }}
            >
              Underskud
            </span>
          </div>
        </section>

        {/* Body-text-kontrast */}
        <section>
          <SectionHeading>Body-tekst på cream</SectionHeading>
          <div
            className="rounded-md border p-6"
            style={{ borderColor: CREAM_DEEP, backgroundColor: CREAM }}
          >
            <p className="text-base leading-relaxed" style={{ color: TEXT_ON_CREAM }}>
              Dette er body-tekst sat i #1F1F18 (nær-sort) på cream-baggrunden.
              Kontrast-ratio ~13:1 - passer AAA. Vi bruger ikke olive til
              body fordi #4B4D39 på cream giver ~6.3:1 (kun AA på normal tekst,
              AAA på stor).
            </p>
            <p className="mt-3 text-sm" style={{ color: OLIVE_LIGHT }}>
              Sekundær tekst sættes i olive-light (#6B6D55) når den er muted -
              som her. Kontrast-ratio ~4.5:1 mod cream, AA-godkendt for normal
              tekst.
            </p>
          </div>
        </section>
      </main>

      <footer
        className="mt-16 border-t px-6 py-8"
        style={{ borderColor: CREAM_DEEP, backgroundColor: CREAM }}
      >
        <div className="mx-auto flex max-w-5xl items-baseline gap-4">
          <FambudMark size="base" color={OLIVE} />
          <span style={{ color: OLIVE_LIGHT }} className="text-xs">
            - familie + budget
          </span>
        </div>
      </footer>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-4 border-b pb-2 text-lg font-semibold"
      style={{ borderColor: OLIVE, color: OLIVE }}
    >
      {children}
    </h2>
  );
}

function Swatch({
  hex,
  name,
  note,
  textColor,
  outline,
  small,
}: {
  hex: string;
  name: string;
  note: string;
  textColor: string;
  outline?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-md ${outline ? 'border-2' : ''} ${small ? 'p-4' : 'p-6'}`}
      style={{
        backgroundColor: hex,
        borderColor: outline ? CREAM_DEEP : 'transparent',
      }}
    >
      <p
        className={`font-mono tabnum ${small ? 'text-base' : 'text-2xl'} font-bold`}
        style={{ color: textColor }}
      >
        {hex.toUpperCase()}
      </p>
      <p
        className={`mt-1 font-semibold ${small ? 'text-xs' : 'text-sm'}`}
        style={{ color: textColor }}
      >
        {name}
      </p>
      <p
        className={`mt-0.5 ${small ? 'text-[11px]' : 'text-xs'} opacity-80`}
        style={{ color: textColor }}
      >
        {note}
      </p>
    </div>
  );
}
