// Progress-dots over flow-card. Tre faste dots der ændrer farve
// efter trin-status: completed (mørk), active (emerald), pending
// (lys neutral). Bredde 56px matcher mockup'en.

type Props = {
  currentStep: 1 | 2 | 3;
};

export function StepProgress({ currentStep }: Props) {
  return (
    <div
      className="mb-10 flex justify-center gap-2"
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={3}
      aria-label={`Trin ${currentStep} af 3`}
    >
      {[1, 2, 3].map((n) => {
        const status =
          n < currentStep ? 'completed' : n === currentStep ? 'active' : 'pending';
        const colorClass =
          status === 'completed'
            ? 'bg-neutral-900'
            : status === 'active'
              ? 'bg-emerald-700'
              : 'bg-neutral-200';
        return (
          <div
            key={n}
            className={`h-1 w-14 rounded-sm transition-colors duration-400 ${colorClass}`}
            aria-hidden
          />
        );
      })}
    </div>
  );
}
