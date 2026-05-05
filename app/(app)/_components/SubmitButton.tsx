// Submit-knap der reagerer på form-state via React's useFormStatus.
// Mens server-action'en kører bliver knappen disabled og labelen skifter
// til "Gemmer…" (eller hvad caller giver via pendingLabel) - så brugeren
// kan se at klikket er registreret og ikke spammer en ekstra submit.
//
// Stiles som primary-knap by default; caller kan overskrive via variant
// hvis det er en sekundær handling (fx "Slet" som danger-styling).

'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'danger';

type Props = {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  className?: string;
};

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-emerald-800 text-white hover:bg-emerald-900 disabled:bg-emerald-800/60',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-red-700/60',
};

export function SubmitButton({
  children,
  pendingLabel = 'Gemmer…',
  variant = 'primary',
  className = '',
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}
