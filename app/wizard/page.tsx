import { redirect } from 'next/navigation';
import { getMyMembership } from '@/lib/dal';

// Entry point. Routes to the right step based on user state. Visiting /wizard
// directly is the only "smart" entry — once inside a step, navigation between
// steps is linear via Links/forms.
export default async function WizardEntryPage() {
  const { supabase, user, membership } = await getMyMembership();

  if (!membership) {
    // Shouldn't happen — auth-trigger creates a membership row. If it does,
    // sending them to /login forces a re-authentication cycle which usually
    // fixes broken state.
    redirect('/login');
  }

  if (membership.setup_completed_at) {
    redirect('/dashboard');
  }

  // Has the user already created their personal account? If so, skip past
  // /wizard/lonkonto so they can resume mid-flow.
  const { count } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', user.id);

  if ((count ?? 0) === 0) {
    redirect('/wizard/lonkonto');
  }
  redirect('/wizard/indkomst');
}
