import { CheckCircle2 } from 'lucide-react';
import { getMyMembership } from '@/lib/dal';
import { completeSetup } from './actions';

export default async function WizardDonePage() {
  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';
  const totalSteps = isOwner ? 7 : 5;
  const stepNumber = totalSteps;

  return (
    <div className="text-center">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin {stepNumber} af {totalSteps}
      </div>

      <div className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-700">
        <CheckCircle2 className="h-6 w-6" />
      </div>

      <h1 className="mt-4 text-xl font-semibold tracking-tight text-neutral-900">
        Du er klar
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Din opsætning er gemt. Du kan altid tilføje konti, kategorier og
        invitationer fra menuen senere.
      </p>

      <form action={completeSetup} className="mt-8">
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Til dashboard
        </button>
      </form>
    </div>
  );
}
