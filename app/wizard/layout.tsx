// Minimal wrapper — no sidebar, no app chrome. Auth is handled by the proxy.
export default function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
