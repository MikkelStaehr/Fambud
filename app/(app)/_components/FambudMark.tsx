// Fambud wordmark - sat i MADE Awelier Black 900 med +0.05em letter-
// spacing. Wordmark'et er all-lowercase ("fambud") som testet på
// /wordmark-test og brand-vedtaget. Font loades via next/font/local i
// app/fonts.ts.
//
// ⚠ LICENS: MADE Awelier er PERSONAL USE-licens. KAN IKKE deployes
// til prod før vi køber kommerciel licens (~$50 hos Fontfabric.com).
// Indtil licensen er på plads er wordmark'et kun til lokal/intern brug.

type Props = {
  // Kontrol over størrelse - sidebar = base, marketing/auth = lg.
  size?: 'sm' | 'base' | 'lg';
  // Hvis brugt på mørk baggrund (fx hero), vendes farven til hvid.
  inverted?: boolean;
  className?: string;
};

const SIZES = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-2xl',
} as const;

export function FambudMark({ size = 'base', inverted = false, className = '' }: Props) {
  return (
    <span
      className={`inline-flex ${
        inverted ? 'text-white' : 'text-neutral-900'
      } ${SIZES[size]} ${className}`}
      style={{
        fontFamily: 'var(--font-made-awelier-black), system-ui, sans-serif',
        fontWeight: 900,
        letterSpacing: '0.05em',
      }}
      aria-label="Fambud"
    >
      fambud
    </span>
  );
}
