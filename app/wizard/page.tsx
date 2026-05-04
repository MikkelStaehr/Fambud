import { redirect } from 'next/navigation';
import { getHouseholdEconomyType, getMyMembership } from '@/lib/dal';

// Wizard-router: bestemmer hvilket trin brugeren skal lande på baseret på
// hvad de allerede har sat op. Det er ikke en fuld state-machine - vi
// detekterer kun "har du oprettet en konto?" og sender derefter videre til
// rolle-specifikke næste trin. Hvis bruger åbner /wizard mens de er midt
// i flowet er det acceptabelt at lande på et tidligere trin og klikke
// "Næste" igennem til hvor de slap. (Mulig forbedring senere: explicit
// wizard_step på family_members.)
export default async function WizardEntryPage() {
  const { supabase, user, membership } = await getMyMembership();

  if (!membership) {
    // Skulle ikke ske - auth-trigger opretter altid en family_member-række.
    // Hvis det sker, er en re-auth den hurtigste vej tilbage til en kendt
    // tilstand.
    redirect('/login');
  }

  if (membership.setup_completed_at) {
    redirect('/dashboard');
  }

  const isOwner = membership.role === 'owner';

  // For partner i fællesøkonomi-mode: de opretter ikke en lønkonto
  // (den fælles eksisterer fra ejer's wizard), men registrerer indkomst
  // på den fælles. Vi router dem til /wizard/lonkonto hvis de endnu ikke
  // har gjort det - der detekterer page'n shared-mode og viser det rigtige
  // form.
  const economyType = await getHouseholdEconomyType();
  const isPartnerInSharedMode = !isOwner && economyType === 'shared';

  if (isPartnerInSharedMode) {
    const { data: myFm } = await supabase
      .from('family_members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (myFm) {
      const { count: ownIncome } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('family_member_id', myFm.id)
        .eq('income_role', 'primary')
        .eq('recurrence', 'once');
      if ((ownIncome ?? 0) === 0) {
        redirect('/wizard/lonkonto');
      }
    }
    redirect('/wizard/oversigt');
  }

  // Har brugeren oprettet sin lønkonto? Det er trin 1 i de andre flows.
  // Hvis ikke, send dem dertil - der oprettes både konto og første
  // lønudbetaling i samme transaktion.
  const { count } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id);

  if ((count ?? 0) === 0) {
    redirect('/wizard/lonkonto');
  }

  // Lønkonto er på plads - gå til næste rolle-specifikke trin. Owner
  // fortsætter med fælleskonti, partner skipper fælleskonti og familie
  // (begge er ejer-only) og går direkte til oversigt.
  redirect(isOwner ? '/wizard/faelleskonti' : '/wizard/oversigt');
}
