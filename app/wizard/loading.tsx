import { Loader2 } from 'lucide-react';

export default function WizardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="flex items-center gap-2 text-sm text-neutral-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Indlæser...</span>
      </div>
    </main>
  );
}
