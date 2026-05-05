'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

// Server-action submit-knap der instant viser spinner + disabler sig
// selv når form'en submitter. Uden den ser brugeren ingen feedback i
// de 200-1500ms server actions tager - de tror knappen er ødelagt og
// klikker igen. useFormStatus() er Next.js' anbefalede pattern; den
// hooker ind i <form action>'s pending state automatisk.
//
// Brug i stedet for <button type="submit">:
//   <SubmitButton>Log ind</SubmitButton>
//   <SubmitButton pendingText="Opretter...">Opret konto</SubmitButton>
//
// className kan overskrives for non-default styling. Default matcher
// vores primary-CTA-stil (neutral-900 → emerald-700 hover).

type Props = {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  // Lille variant til inline-actions (Gem-knap i edit-form osv.)
  variant?: 'primary' | 'secondary';
  // For situationer hvor knappen er disabled af andre grunde end pending
  disabled?: boolean;
};

const VARIANT_CLASSES: Record<NonNullable<Props['variant']>, string> = {
  primary:
    'bg-neutral-900 text-white hover:bg-emerald-700 disabled:bg-neutral-400',
  secondary:
    'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50',
};

export function SubmitButton({
  children,
  pendingText,
  className,
  variant = 'primary',
  disabled = false,
}: Props) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

  const baseClasses = `inline-flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${VARIANT_CLASSES[variant]}`;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={pending}
      className={className ?? baseClasses}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      <span>{pending && pendingText ? pendingText : children}</span>
    </button>
  );
}
