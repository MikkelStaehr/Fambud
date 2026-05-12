// /wordmark-test - intern test-side til at sammenligne "fambud"-wordmark
// i alle tilgængelige fonte fra font/-mappen. Ingen auth, ingen sidebar -
// bare et galleri vi kan vise eller screenshot'e.
//
// Hver familie får en sektion med alle dens vægte rendret. To stør-
// relser (stor + lille) så vi kan se hvordan wordmark'et opfører sig
// både som hero-titel og som lille mark. To baggrunde (lys + mørk) så
// kontrast kan vurderes.

import Link from 'next/link';
import {
  FAMILIES,
  madeAwelier,
  madeInfinity,
  madeInfinityBeside,
  madeInfinityOutline,
  madeVoyager,
  magnolia,
  ztNatureFull,
  type WordmarkFamily,
} from './fonts';

export const metadata = {
  title: 'Wordmark-test - Fambud',
};

// Alle font-classNames der skal applies på root så CSS-variablerne er
// tilgængelige overalt på siden.
const ALL_FONT_CLASSES = [
  madeAwelier.variable,
  madeInfinity.variable,
  madeInfinityBeside.variable,
  madeInfinityOutline.variable,
  madeVoyager.variable,
  magnolia.variable,
  ztNatureFull.variable,
].join(' ');

export default function WordmarkTestPage() {
  return (
    <div className={`${ALL_FONT_CLASSES} min-h-screen bg-stone-50 text-neutral-900`}>
      <header className="border-b border-neutral-200 bg-white px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard"
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            ← Tilbage til dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">
            Wordmark-test: &ldquo;fambud&rdquo; i alle tilgængelige fonte
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Hver familie vises i alle sine vægte, både stor og lille,
            på både lys og mørk baggrund.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-10">
        {FAMILIES.map((family) => (
          <FamilySection key={family.name} family={family} />
        ))}
      </main>
    </div>
  );
}

function FamilySection({ family }: { family: WordmarkFamily }) {
  return (
    <section>
      <header className="mb-4 border-b border-neutral-200 pb-3">
        <h2 className="text-lg font-semibold text-neutral-900">
          {family.name}
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">{family.description}</p>
      </header>

      <div className="space-y-4">
        {family.variants.map((variant) => (
          <div
            key={variant.label}
            className="rounded-md border border-neutral-200 bg-white overflow-hidden"
          >
            <div className="border-b border-neutral-100 bg-stone-50 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              {variant.label}
              {variant.italic && ' · italic'}
            </div>

            {/* Lys baggrund */}
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 bg-white px-6 py-6">
              <span
                style={{
                  fontFamily: family.cssVar,
                  fontWeight: variant.weight,
                  fontStyle: variant.italic ? 'italic' : 'normal',
                  fontSize: '72px',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                fambud
              </span>
              <span
                style={{
                  fontFamily: family.cssVar,
                  fontWeight: variant.weight,
                  fontStyle: variant.italic ? 'italic' : 'normal',
                  fontSize: '32px',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                fambud
              </span>
              <span
                style={{
                  fontFamily: family.cssVar,
                  fontWeight: variant.weight,
                  fontStyle: variant.italic ? 'italic' : 'normal',
                  fontSize: '18px',
                  lineHeight: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                fambud
              </span>
            </div>

            {/* Mørk baggrund */}
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3 bg-neutral-900 px-6 py-6 text-white">
              <span
                style={{
                  fontFamily: family.cssVar,
                  fontWeight: variant.weight,
                  fontStyle: variant.italic ? 'italic' : 'normal',
                  fontSize: '72px',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                fambud
              </span>
              <span
                style={{
                  fontFamily: family.cssVar,
                  fontWeight: variant.weight,
                  fontStyle: variant.italic ? 'italic' : 'normal',
                  fontSize: '32px',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                }}
              >
                fambud
              </span>
              <span
                style={{
                  fontFamily: family.cssVar,
                  fontWeight: variant.weight,
                  fontStyle: variant.italic ? 'italic' : 'normal',
                  fontSize: '18px',
                  lineHeight: 1,
                  letterSpacing: '-0.01em',
                }}
              >
                fambud
              </span>
            </div>

            {/* Emerald-accent (matcher app's primær-farve) - til at se
                hvordan wordmark'et opfører sig hvis vi farver det med
                FamBud-brand-grønnen */}
            <div className="bg-white px-6 py-4">
              <span
                style={{
                  fontFamily: family.cssVar,
                  fontWeight: variant.weight,
                  fontStyle: variant.italic ? 'italic' : 'normal',
                  fontSize: '48px',
                  lineHeight: 1,
                  letterSpacing: '-0.02em',
                  color: '#065f46', // emerald-800
                }}
              >
                fambud
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
