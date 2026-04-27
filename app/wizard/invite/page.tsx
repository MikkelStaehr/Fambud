import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import { CopyInviteButton } from '@/app/(app)/indstillinger/_components/CopyInviteButton';
import { generateWizardInvite } from './actions';

export default async function WizardInvitePage() {
  // Owner only.
  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { data: invites } = await supabase
    .from('household_invites')
    .select('id, code, expires_at')
    .eq('household_id', householdId)
    .is('used_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });

  const hasInvite = (invites?.length ?? 0) > 0;

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 6 af 7
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Inviter din partner
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Generér en kode og send linket. Koden udløber om 7 dage og kan kun
        bruges én gang.
      </p>

      {!hasInvite ? (
        <form action={generateWizardInvite} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Generér invitation
          </button>
        </form>
      ) : (
        <div className="mt-6 space-y-4">
          {invites?.map((inv) => (
            <div
              key={inv.id}
              className="rounded-md border border-neutral-200 bg-white p-4"
            >
              <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Invitationskode
              </div>
              <div className="mt-1 font-mono text-2xl font-semibold tracking-widest text-neutral-900">
                {inv.code}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CopyInviteButton value={inv.code} kind="link" />
                <CopyInviteButton value={inv.code} kind="code" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Link
          href="/wizard/done"
          className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Næste
        </Link>
        {!hasInvite && (
          <Link
            href="/wizard/done"
            className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Hop over
          </Link>
        )}
      </div>
    </div>
  );
}
