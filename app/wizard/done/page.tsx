// /wizard/done — Sidste trin. Viser kort opsummering af hvad der er sat
// op og giver ejeren mulighed for at generere en invitations-kode hvis de
// har pre-godkendt partner. Invitations-trinet er flyttet hertil så det
// føles som "send det sidste afsted og kør" frem for et separat skridt.

import { CheckCircle2, Mail } from 'lucide-react';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import { CopyInviteButton } from '@/app/(app)/indstillinger/_components/CopyInviteButton';
import { completeSetup, generateInviteFromDone } from './actions';

export default async function WizardDonePage() {
  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';
  const totalSteps = isOwner ? 7 : 4;
  const stepNumber = totalSteps;

  // Pre-godkendte partnere (family_member med email men uden user_id) er
  // dem der venter på at joine. Hvis der er nogen, viser vi invitations-
  // sektionen så ejeren kan generere kode med det samme.
  const { supabase, householdId } = await getHouseholdContext();
  const { data: pendingPartners } = isOwner
    ? await supabase
        .from('family_members')
        .select('id, name, email')
        .eq('household_id', householdId)
        .is('user_id', null)
        .not('email', 'is', null)
    : { data: null };
  const hasPendingPartners = (pendingPartners?.length ?? 0) > 0;

  // Eksisterende ubrugte invitations.
  const { data: invites } = isOwner
    ? await supabase
        .from('household_invites')
        .select('id, code, expires_at')
        .eq('household_id', householdId)
        .is('used_at', null)
        .or(
          `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`
        )
        .order('created_at', { ascending: false })
    : { data: null };
  const hasInvite = (invites?.length ?? 0) > 0;

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

      {/* Invitations-sektion: vises kun for ejer hvis der er pre-godkendt
          partner. Genererer kode med ét klik og viser resultatet inline. */}
      {isOwner && hasPendingPartners && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-left">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
              <Mail className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-amber-900">
                {pendingPartners?.length === 1
                  ? `Inviter ${pendingPartners[0].name}`
                  : `Inviter ${pendingPartners?.length} partnere`}
              </h2>
              <p className="mt-1 text-xs text-amber-900/80">
                Generér en kode og send linket. Koden udløber om 7 dage og
                kan kun bruges én gang.
              </p>

              {!hasInvite ? (
                <form action={generateInviteFromDone} className="mt-3">
                  <button
                    type="submit"
                    className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-800"
                  >
                    Generér invitation
                  </button>
                </form>
              ) : (
                <div className="mt-3 space-y-3">
                  {invites?.map((inv) => (
                    <div
                      key={inv.id}
                      className="rounded-md border border-amber-200 bg-white p-3"
                    >
                      <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                        Invitationskode
                      </div>
                      <div className="mt-1 font-mono text-lg font-semibold tracking-widest text-neutral-900">
                        {inv.code}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CopyInviteButton value={inv.code} kind="link" />
                        <CopyInviteButton value={inv.code} kind="code" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
