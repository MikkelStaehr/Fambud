// Fambud wordmark - sat i MADE Awelier Black 900 med +0.05em letter-
// spacing. Wordmark'et er all-lowercase ("fambud") som testet på
// /wordmark-test og brand-vedtaget. Font loades via next/font/local i
// app/fonts.ts.
//
// Komponenten lever i app/_components/ (delt mellem landing og (app))
// så både offentlige sider og auth'ed UI bruger samme wordmark.
//
// ⚠ LICENS: MADE Awelier er PERSONAL USE-licens. KAN IKKE deployes
// til prod før vi køber kommerciel licens (~$50 hos Fontfabric.com).
// Indtil licensen er på plads er wordmark'et kun til lokal/intern brug.

type Props = {
  // Kontrol over størrelse:
  //   sm   = text-sm     (~14 px)         - kompakt mobile-nav
  //   base = text-base   (~16 px)         - sjælden, til footer-marks
  //   lg   = text-3xl    (~30/36 px)      - sidebar + signup/auth
  //   xl   = text-5xl    (~48/60 px)      - landing top-nav
  //   hero = text-7xl    (~72/96 px)      - login (blast it i ansigtet)
  size?: 'sm' | 'base' | 'lg' | 'xl' | 'hero';
  // Hvis brugt på mørk baggrund (fx hero), vendes farven til hvid.
  // Ignoreres når color-prop'en er sat.
  inverted?: boolean;
  // Eksplicit farve-override (CSS-farve). Bruges på fx /farve-test til
  // at vise wordmark'et i alternative brand-paletter. Trumfer inverted.
  color?: string;
  className?: string;
};

const SIZES = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-3xl sm:text-4xl',
  xl: 'text-5xl sm:text-6xl',
  hero: 'text-7xl sm:text-8xl',
} as const;

export function FambudMark({
  size = 'base',
  inverted = false,
  color,
  className = '',
}: Props) {
  const colorClass = color
    ? '' // farve sættes via inline style i stedet
    : inverted
      ? 'text-white'
      : 'text-neutral-900';
  return (
    <span
      className={`inline-flex ${colorClass} ${SIZES[size]} ${className}`}
      style={{
        fontFamily: 'var(--font-made-awelier-black), system-ui, sans-serif',
        fontWeight: 900,
        letterSpacing: '0.05em',
        ...(color ? { color } : {}),
      }}
      aria-label="Fambud"
    >
      fambud
    </span>
  );
}
