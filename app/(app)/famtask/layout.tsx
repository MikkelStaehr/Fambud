// /famtask - husstandens planlægning: sparks (ønsker og idéer) → projekter
// → skridt. Fælles header med faner og "Ny spark" for alle Famtask-sider.

import { CaptureButton } from './_components/CaptureButton';
import { FamtaskTabs } from './_components/FamtaskTabs';

export default function FamtaskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-neutral-200 pb-4">
        <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Famtask
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Ønsker, projekter og skridt. Fang idéen nu, planlæg den senere.
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <FamtaskTabs />
          <CaptureButton />
        </div>
      </header>
      {children}
    </div>
  );
}
