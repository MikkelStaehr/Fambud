'use client';

// Famtask quick-capture: Cmd+K (Mac) / Ctrl+K (andre) åbner ét felt der
// gemmer en spark med det samme. Enter = gem, Esc = luk.
//
// Mountes én gang i (app)-layoutet, så genvejen virker på alle sider. På
// mobil (intet tastatur) åbnes den via openQuickCapture() fra "Ny spark"-
// knappen i Famtask.
//
// Mac bruger kun Cmd+K, så Ctrl+K ("slet til linjeslut") i tekstfelter
// stadig virker. Feltet lukker straks ved Enter; fejler gemningen, åbner
// det igen med teksten og fejlen, så intet går tabt.

import { useEffect, useRef, useState, useTransition } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { createSpark } from '../famtask/actions';

const OPEN_EVENT = 'famtask:quick-capture';
const SAVED_TOAST_MS = 2500;

// Kaldes fra en knap: sender et event som QuickCapture lytter på. Holder
// knappen og dialogen løst koblet uden context-provider.
export function openQuickCapture() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
}

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Åbn + fokusér i samme kald-stak som klikket/tastetrykket. flushSync
    // render'er dialogen synkront, så focus() rammer inputtet mens vi
    // stadig er i brugerens gesture - ellers viser iOS ikke tastaturet.
    function openNow() {
      flushSync(() => setOpen(true));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    const mac = isMacPlatform();
    function onKey(e: KeyboardEvent) {
      const mod = mac ? e.metaKey : e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openNow();
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_EVENT, openNow);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_EVENT, openNow);
    };
  }, []);

  // Esc lukker, også hvis fokus er flyttet væk fra inputtet.
  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), SAVED_TOAST_MS);
    return () => clearTimeout(t);
  }, [saved]);

  function save() {
    const title = value.trim();
    if (!title) return;
    setOpen(false);
    setValue('');
    setError(null);
    setSaved(false);

    const fd = new FormData();
    fd.set('title', title);
    startTransition(async () => {
      const res = await createSpark(fd);
      if (res.ok) {
        setSaved(true);
      } else {
        setValue(title);
        setError(res.error);
        setOpen(true);
      }
    });
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 px-4 pt-[12vh] backdrop-blur-sm print:hidden"
          onClick={() => setOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Ny spark"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="w-full max-w-lg overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl"
          >
            <div className="flex items-center gap-3 px-4">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              {/* text-base (16px) så iOS ikke zoomer ind ved fokus */}
              <input
                ref={inputRef}
                autoFocus
                name="title"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                maxLength={200}
                autoComplete="off"
                enterKeyHint="done"
                placeholder="Nyt ønske eller idé…"
                aria-label="Ny spark"
                className="w-full bg-transparent py-4 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
            </div>
            {error && (
              <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="hidden border-t border-neutral-100 bg-stone-50 px-4 py-2 text-xs text-neutral-500 sm:block">
              Enter gemmer som spark · Esc lukker
            </div>
          </form>
        </div>
      )}

      {saved && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 print:hidden"
        >
          <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 shadow-lg">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Spark gemt</span>
            <Link
              href="/famtask/sparks"
              onClick={() => setSaved(false)}
              className="font-medium underline underline-offset-2"
            >
              Se sparks
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
