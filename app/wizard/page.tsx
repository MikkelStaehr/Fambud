import { redirect } from 'next/navigation';
import { getMyMembership } from '@/lib/dal';

// Wizard-router: bestemmer hvilket trin brugeren skal lande på baseret på
// hvad de allerede har sat op. Det er ikke en fuld state-machine — vi
// detekterer kun "har du oprettet en konto?" og sender derefter videre til
// rolle-specifikke næste trin. Hvis bruger åbner /wizard mens de er midt
// i flowet er det acceptabelt at lande på et tidligere trin og klikke
// "Næste" igennem til hvor de slap. (Mulig forbedring senere: explicit
// wizard_step på family_members.)
export default async function WizardEntryPage() {
  const { supabase, user, membership } = await getMyMembership();

  if (!membership) {
    // Skulle ikke ske — auth-trigger opretter altid en family_member-række.
    // Hvis det sker, er en re-auth den hurtigste vej tilbage til en kendt
    // tilstand.
    redirect('/login');
  }

  if (membership.setup_completed_at) {
    redirect('/dashboard');
  }

  const isOwner = membership.role === 'owner';

  // Har brugeren oprettet sin lønkonto? Det er trin 1 i begge flows. Hvis
  // ikke, send dem dertil — der oprettes både konto og første lønudbetaling
  // i samme transaktion.
  const { count } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id);

  if ((count ?? 0) === 0) {
    redirect('/wizard/lonkonto');
  }

  // Lønkonto er på plads — gå til næste rolle-specifikke trin. Owner
  // fortsætter med fælleskonti, partner skipper fælleskonti og familie
  // (begge er ejer-only) og går direkte til private opsparinger.
  redirect(isOwner ? '/wizard/faelleskonti' : '/wizard/opsparing');
}
