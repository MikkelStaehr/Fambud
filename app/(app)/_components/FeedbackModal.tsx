'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X } from 'lucide-react';
import { submitFeedback } from '../actions';

// Klikbar trigger + selve modalen i én komponent. Renderes i sidebaren.
// Vi bruger React state frem for native <dialog> fordi vi vil have
// fade-in/backdrop og custom escape-håndtering.
export function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal();
    }
    window.addEventListener('keydown', handleEsc);
    // Fokus på textarea når modallen åbnes - sparer brugeren et klik.
    setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open]);

  function closeModal() {
    setOpen(false);
    // Reset success-tilstand når modallen lukkes så næste åbning
    // viser en frisk form igen.
    setTimeout(() => {
      setSubmitted(false);
      setError(null);
    }, 200);
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    // Berigelse af payload med kontekst-info klienten kender
    formData.set('page_url', pathname);
    formData.set('user_agent', navigator.userAgent);
    startTransition(async () => {
      const result = await submitFeedback(formData);
      if (result.ok) {
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
      >
        <MessageSquare className="h-4 w-4" />
        Send feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          onClick={closeModal}
        >
          <div
            className="relative w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Luk"
              className="absolute right-3 top-3 rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              <X className="h-4 w-4" />
            </button>

            {submitted ? (
              <div>
                <h2
                  id="feedback-title"
                  className="text-lg font-semibold tracking-tight text-neutral-900"
                >
                  Tak!
                </h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Din besked er sendt. Vi læser alt selv - du hører fra os hvis
                  vi har opfølgende spørgsmål.
                </p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="mt-6 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  Luk
                </button>
              </div>
            ) : (
              <form action={handleSubmit}>
                <h2
                  id="feedback-title"
                  className="text-lg font-semibold tracking-tight text-neutral-900"
                >
                  Send feedback
                </h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Hvad virker, hvad mangler, hvad driller? Alt er velkomment -
                  også korte ting.
                </p>

                <div className="mt-4">
                  <label
                    htmlFor="feedback-message"
                    className="block text-xs font-medium text-neutral-600"
                  >
                    Din besked
                  </label>
                  <textarea
                    ref={textareaRef}
                    id="feedback-message"
                    name="message"
                    required
                    rows={5}
                    maxLength={5000}
                    placeholder="Fx: 'Cashflow-grafen er svær at læse på mobil', eller 'jeg ville ønske jeg kunne...' "
                    className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    disabled={pending}
                  />
                </div>

                {error && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={pending}
                    className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
                  >
                    Annullér
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {pending ? 'Sender...' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
