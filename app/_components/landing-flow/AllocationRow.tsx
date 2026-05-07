// Genbrugelig række i plan-tabs. To modi:
//   - filled:  hvid baggrund, tal med vægt, sub-text neutral
//   - empty:   stribet baggrund, "0 kr" eller "-" dæmpet, sub-text
//              dæmpet (signaler "der er ingen plads til det her endnu")
//
// Icon er en Unicode-streg (matcher mockup'ens æstetik bedre end
// lucide-ikoner her, flowet skal føles som et "håndskrevet" bud,
// ikke en SaaS-app).

const FAMBUD_FONT = 'var(--font-zt-nature), system-ui, sans-serif';

type Variant = 'filled' | 'empty';

type Props = {
  icon: string;
  iconBg: string;
  label: string;
  subtext: string;
  amount: string;
  amountSub?: string;
  variant?: Variant;
};

export function AllocationRow({
  icon,
  iconBg,
  label,
  subtext,
  amount,
  amountSub,
  variant = 'filled',
}: Props) {
  const isEmpty = variant === 'empty';

  return (
    <div
      className={`grid grid-cols-[32px_1fr_auto] items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5 sm:py-4 ${
        isEmpty
          ? 'bg-[repeating-linear-gradient(45deg,#fafaf9_0,#fafaf9_8px,#f5f5f4_8px,#f5f5f4_9px)]'
          : 'bg-white'
      }`}
    >
      {/* Icon-cirkel */}
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
          isEmpty ? 'border border-dashed border-neutral-300 text-neutral-400' : ''
        }`}
        style={!isEmpty ? { backgroundColor: iconBg } : undefined}
        aria-hidden
      >
        {icon}
      </div>

      {/* Label + sub-text */}
      <div className="min-w-0">
        <strong
          className={`block text-sm font-semibold leading-tight ${
            isEmpty ? 'text-neutral-400' : 'text-neutral-900'
          }`}
        >
          {label}
        </strong>
        <span className="mt-0.5 block text-xs text-neutral-500">
          {subtext}
        </span>
      </div>

      {/* Amount + sub-info */}
      <div className="text-right">
        <span
          className={`block text-base font-semibold tabular-nums sm:text-lg ${
            isEmpty ? 'italic text-neutral-400' : 'text-neutral-900'
          }`}
          style={{ fontFamily: FAMBUD_FONT }}
        >
          {amount}
        </span>
        {amountSub && (
          <span className="mt-0.5 block text-[11px] text-neutral-500">
            {amountSub}
          </span>
        )}
      </div>
    </div>
  );
}
