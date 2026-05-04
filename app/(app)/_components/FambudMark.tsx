// Fambud wordmark - Familie + Budget. Sat i ZT Nature Bold (loaded via
// next/font/local i app/fonts.ts) i én farve. Wordmark'et bærer brandet
// alene gennem sin font-personlighed; brand-farverne lever i resten af
// UI'et (CTAs, charts, badges).

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
      className={`inline-flex tracking-tight ${
        inverted ? 'text-white' : 'text-neutral-900'
      } ${SIZES[size]} ${className}`}
      style={{ fontFamily: 'var(--font-zt-nature), system-ui, sans-serif' }}
      aria-label="Fambud"
    >
      Fambud
    </span>
  );
}
