import { LogOut } from 'lucide-react';
import { signOut } from '../(app)/actions';

// Minimal wrapper — no sidebar, no app chrome. Auth is handled by the proxy.
// We do show a top-right "Log ud" so users who land here mid-wizard (or get
// stuck on it via the setup gate) can always escape.
export default function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-12">
      <form action={signOut} className="absolute right-4 top-4">
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log ud
        </button>
      </form>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
