'use client';

// Klient-knap der kaster en runtime-fejl. Bevidst ikke fanget af nogen
// error-boundary - vi vil have den til at bubble op til Sentry's globale
// handler så vi ser det i Issues-panelet.
export function TestClientButton() {
  return (
    <button
      type="button"
      onClick={() => {
        throw new Error(`Sentry client-test ${Date.now()}`);
      }}
      className="mt-2 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
    >
      Trigger client-fejl
    </button>
  );
}
