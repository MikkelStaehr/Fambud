// /wizard/ejere - Trin 6 i ejer-flowet, kun for familier. Brugeren går
// igennem alle konti der er oprettet i wizarden og bekræfter/justerer
// hvem der ejer hver. Solo-brugere har ingen tvetydighed (alt er ejerens
// eller barnets), så vi auto-redirecter dem direkte til /done.
//
// Smart defaults er allerede sat under konto-oprettelse (Fælles-konti har
// owner_name='Fælles', børnekonti har owner_name=barnets navn osv.).
// Det her trin er en "review and adjust" - typisk klik én gang igennem.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import { ACCOUNT_KIND_LABEL_DA } from '@/lib/format';
import type { Account } from '@/lib/database.types';
import { updateAccountOwner } from './actions';

// Smart default-ejer pr. konto. Familier deler typisk buffer (det er
// fundamentet for hele husstanden), så hvis owner_name ikke er sat
// eksplicit på en buffer-tagget konto, peger vi på 'Fælles' frem for
// ejeren. Andre konti med null owner_name peger på ejeren som rimelig
// default. Konti med eksplicit owner_name (børnekonti, fælleskonti)
// bevarer det.
function smartOwnerDefault(
  a: Pick<Account, 'owner_name' | 'savings_purposes'>,
  ownerName: string | undefined
): string {
  if (a.owner_name) return a.owner_name;
  if (a.savings_purposes?.includes('buffer')) return 'Fælles';
  return ownerName ?? '';
}

export default async function WizardEjerePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { membership } = await getMyMembership();
  if (membership?.role !== 'owner') {
    redirect('/wizard/done');
  }

  const sp = await searchParams;
  const error = sp.error;

  const { supabase, user, householdId } = await getHouseholdContext();

  // Familie-medlemmer i husstanden. Vi adskiller adults (bruger eller
  // pre-godkendt med email) fra børn (uden begge dele) - alle bruges
  // som options i dropdownet sammen med 'Fælles'.
  const { data: familyMembers } = await supabase
    .from('family_members')
    .select('id, name, email, user_id')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  const owner = (familyMembers ?? []).find((m) => m.user_id === user.id);
  const dependents = (familyMembers ?? []).filter((m) => m.user_id !== user.id);
  const adults = (familyMembers ?? []).filter(
    (m) => m.user_id != null || m.email != null
  );
  const children = (familyMembers ?? []).filter(
    (m) => m.email == null && m.user_id == null
  );

  // Solo: ingen pårørende = ingen ejerskabs-tvetydighed. Skip trinet.
  if (dependents.length === 0) {
    redirect('/wizard/done');
  }

  // Vis alle konti oprettet af ejeren under wizarden. Vi springer
  // arkiverede over og sorterer så Fælles-konti samles, derefter ejer,
  // derefter børn - det matcher den mentale model "fra fælles til personlig".
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, kind, owner_name, savings_purposes, investment_type')
    .eq('household_id', householdId)
    .eq('archived', false)
    .order('created_at', { ascending: true });

  // Dropdown-options: ejer + alle pre-godkendte voksne + 'Fælles' +
  // alle børn. Hver option har value=navn (string der gemmes som-er
  // i owner_name).
  const ownerOptions: { value: string; label: string }[] = [];
  if (owner) ownerOptions.push({ value: owner.name, label: owner.name });
  for (const a of adults) {
    if (a.user_id !== user.id) {
      ownerOptions.push({ value: a.name, label: a.name });
    }
  }
  ownerOptions.push({ value: 'Fælles', label: 'Fælles' });
  for (const c of children) {
    ownerOptions.push({ value: c.name, label: c.name + ' (barn)' });
  }

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 6 af 7
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Bekræft ejere
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Gå igennem listen og justér hvis nogen konti skal have en anden
        ejer. Vi har sat smart-defaults - for de fleste er det rigtigt fra
        start.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          <span>Konto</span>
          <span>Ejer</span>
        </div>
        {(accounts ?? []).length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-neutral-500">
            Ingen konti oprettet endnu.
          </div>
        ) : (
          (accounts ?? []).map((a) => (
            <form
              key={a.id}
              action={updateAccountOwner}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-neutral-100 px-4 py-2.5 last:border-b-0"
            >
              <input type="hidden" name="id" value={a.id} />
              <div>
                <div className="text-sm font-medium text-neutral-900">
                  {a.name}
                </div>
                <div className="text-xs text-neutral-500">
                  {ACCOUNT_KIND_LABEL_DA[a.kind] ?? a.kind}
                  {a.savings_purposes?.includes('buffer') && ' · Buffer'}
                </div>
              </div>
              <select
                name="owner_name"
                defaultValue={smartOwnerDefault(a, owner?.name)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              >
                {ownerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Gem
              </button>
            </form>
          ))
        )}
      </div>

      <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-500">
        <Users className="h-3 w-3" />
        Du kan altid ændre ejer senere på{' '}
        <span className="text-neutral-700">/konti</span>.
      </p>

      <div className="mt-6">
        <Link
          href="/wizard/done"
          className="block w-full rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Næste
        </Link>
      </div>
    </div>
  );
}
