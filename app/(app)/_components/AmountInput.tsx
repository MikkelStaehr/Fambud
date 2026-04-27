'use client';

import { useEffect, useRef, useState } from 'react';

// Money input with live thousand-separator formatting.
//   - Decimal separator: '.' (matches user preference; ',' is auto-converted).
//   - Thousand separator: ' ' (space). Avoids the period/comma conflict that
//     comes from picking either US or Danish locale.
//   - Cursor position is preserved across re-renders so typing in the middle
//     of a number doesn't jump the caret to the end.
//
// The underlying form value is the formatted string ('1 234.56'); the server
// action's parseAmountToOere() strips whitespace before parsing.

type Props = {
  id?: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
};

const baseClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-right font-mono tabnum text-sm placeholder:text-neutral-300 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

// Strip everything except a leading '-', digits and one '.'.
function sanitize(raw: string): string {
  let result = '';
  let dotSeen = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '-' && i === 0 && result.length === 0) {
      result += c;
    } else if (c >= '0' && c <= '9') {
      result += c;
    } else if (c === '.' && !dotSeen) {
      result += c;
      dotSeen = true;
    }
  }
  return result;
}

// '1234567.89' → '1 234 567.89'. Decimal part is left untouched.
function formatDisplay(raw: string): string {
  if (!raw) return '';
  const sign = raw.startsWith('-') ? '-' : '';
  const unsigned = sign ? raw.slice(1) : raw;
  const dotIdx = unsigned.indexOf('.');
  const intPart = dotIdx === -1 ? unsigned : unsigned.slice(0, dotIdx);
  const decPart = dotIdx === -1 ? '' : unsigned.slice(dotIdx);
  // \B(?=(\d{3})+(?!\d)) — match positions inside the number where a group of
  // three digits ends without another digit after. Standard thousand-grouping.
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return sign + grouped + decPart;
}

// Count "meaningful" chars (digits + '.' + leading '-') in `s` up to position
// `cursor`. Used to translate cursor position from raw input → formatted output.
function meaningfulCharsBefore(raw: string, cursor: number): number {
  // Strip spaces from the slice, then sanitize. The result length is the
  // number of valid characters that should appear before the cursor in the
  // canonical (unformatted) string.
  const slice = raw.slice(0, cursor).replace(/\s/g, '').replace(/,/g, '.');
  return sanitize(slice).length;
}

// Find the position in `formatted` where `targetCount` non-space chars have
// passed. Used to place the cursor after re-formatting.
function findCursorAt(formatted: string, targetCount: number): number {
  if (targetCount === 0) return 0;
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ' ') count++;
    if (count === targetCount) return i + 1;
  }
  return formatted.length;
}

export function AmountInput({
  id,
  name,
  defaultValue = '',
  required = false,
  placeholder = '0.00',
  className,
}: Props) {
  const [value, setValue] = useState(() => formatDisplay(sanitize(defaultValue.replace(/,/g, '.'))));
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);

  // After every render where we changed the value programmatically, restore
  // the cursor to where it should be.
  useEffect(() => {
    if (pendingCursor.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.target;
    const incoming = el.value;
    const incomingCursor = el.selectionStart ?? incoming.length;

    // Compute what the cursor *means* in canonical terms (count of valid
    // non-space chars to the left of it).
    const charsBeforeCursor = meaningfulCharsBefore(incoming, incomingCursor);

    // Normalise → format.
    const canonical = sanitize(incoming.replace(/,/g, '.'));
    const formatted = formatDisplay(canonical);

    // Translate cursor back into the formatted string.
    const newCursor = findCursorAt(formatted, charsBeforeCursor);

    setValue(formatted);
    pendingCursor.current = newCursor;
  }

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={value}
      onChange={handleChange}
      required={required}
      placeholder={placeholder}
      className={className ?? baseClass}
    />
  );
}
