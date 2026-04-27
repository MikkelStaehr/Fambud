'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Two modes:
//  - kind="code": copies the raw code, useful when reading aloud isn't an option
//  - kind="link": copies a full https URL built from window.location.origin so
//    the same component works in dev (localhost) and prod without env wiring
type Props = { value: string; kind: 'code' | 'link' };

export function CopyInviteButton({ value, kind }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const toCopy = kind === 'link' ? `${window.location.origin}/join/${value}` : value;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail (insecure context, no permission). Silently noop —
      // the user will notice and can copy manually from the visible code.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
      title={kind === 'link' ? 'Kopiér link' : 'Kopiér kode'}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-600" />
          Kopieret
        </>
      ) : (
        <>
          <Copy className="h-3 w-3 text-neutral-400" />
          {kind === 'link' ? 'Kopiér link' : 'Kopiér kode'}
        </>
      )}
    </button>
  );
}
