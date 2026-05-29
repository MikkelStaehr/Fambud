'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import {
  generateProxyToken,
  hashProxyToken,
  setActiveProxyCookie,
  clearActiveProxyCookie,
  getActiveProxyContext,
} from '@/lib/proxy';
import { sendProxyRequestEmail } from '@/lib/email/proxy-request';
import { resolveSiteOrigin } from '@/lib/site-url';

// ============================================================================
// requestSetupProxy - Mikkel anmoder om at hjælpe et familiemedlem
// ============================================================================
// Opretter en pending grant + sender email til grantor (modtageren).
// Vi sender plain-text token i email, gemmer kun hash i DB.
//
// Anmoderen (caller) bliver GRANTEE - dvs. den der får adgang når Louise
// klikker ja. Modtageren af mailen (Louise) bliver GRANTOR (den der GIVER
// adgang). Det matcher hvordan "I want to delegate access TO X" reads.
//
// Vent - læs igen: i delegation-terminologi er grantor=giver. Mikkel vil
// have Louise til at GIVE ham adgang. Så Louise=grantor, Mikkel=grantee.
// Det matcher vores DB-skema og hjælper med at undgå forvirring senere:
// "har Louise (grantor) givet Mikkel (grantee) adgang?"

export async function requestSetupProxy(formData: FormData) {
  const targetFamilyMemberId = String(formData.get('family_member_id') ?? '').trim();
  if (!targetFamilyMemberId) {
    redirect('/indstillinger?error=' + encodeURIComponent('Vælg et familiemedlem'));
  }

  const { supabase, householdId, user } = await getHouseholdContext();

  // Hent target-medlemmet og verificér at:
  // 1. Det er i samme husstand
  // 2. Det har en user_id (kun authenticated brugere kan give samtykke)
  // 3. Det har en email vi kan sende til
  // 4. Det er ikke den anmodende bruger selv
  const { data: target } = await supabase
    .from('family_members')
    .select('id, name, email, user_id')
    .eq('id', targetFamilyMemberId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (!target) {
    redirect('/indstillinger?error=' + encodeURIComponent('Familiemedlemmet findes ikke'));
  }
  if (!target.user_id) {
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent('Det familiemedlem har ikke en aktiv konto endnu - de skal selv signe op først')
    );
  }
  if (target.user_id === user.id) {
    redirect('/indstillinger?error=' + encodeURIComponent('Du kan ikke anmode dig selv'));
  }
  if (!target.email) {
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent('Vi har ikke en email på dette familiemedlem - de skal opdatere deres profil først')
    );
  }

  // Tjek at der ikke allerede er en aktiv (pending eller accepted) grant
  // mellem disse to brugere - undgår spam og duplikater
  const { data: existing } = await supabase
    .from('setup_proxy_grants')
    .select('id, accepted_at, revoked_at, expires_at')
    .eq('grantor_user_id', target.user_id)
    .eq('grantee_user_id', user.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existing) {
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent(
          existing.accepted_at
            ? 'Du har allerede en aktiv hjælper-adgang til denne person'
            : 'Du har allerede sendt en anmodning - vent på svar eller revoke den først'
        )
    );
  }

  // Hent caller's navn til at vise i emailen
  const { data: callerMember } = await supabase
    .from('family_members')
    .select('name')
    .eq('user_id', user.id)
    .eq('household_id', householdId)
    .maybeSingle();
  const callerName = callerMember?.name ?? 'Et familiemedlem';

  // Hent husstandsnavn til email-kontekst
  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle();
  const householdName = household?.name ?? 'jeres husstand';

  // Generér token + opret grant. Plain-text token bæres i emailen;
  // kun hash gemmes i DB.
  const { plain, hash } = generateProxyToken();
  const { data: grant, error: insertErr } = await supabase
    .from('setup_proxy_grants')
    .insert({
      household_id: householdId,
      grantor_user_id: target.user_id,
      grantee_user_id: user.id,
      scope: ['setup'],
      request_token_hash: hash,
      // expires_at default = now() + 7 days fra migration
    })
    .select('id, expires_at')
    .single();

  if (insertErr || !grant) {
    console.error('requestSetupProxy: failed to insert grant', insertErr?.message);
    redirect('/indstillinger?error=' + encodeURIComponent('Kunne ikke oprette anmodningen - prøv igen'));
  }

  // Send email til grantor (Louise)
  const origin = await resolveSiteOrigin();
  const acceptUrl = `${origin}/accept-proxy/${plain}`;

  try {
    await sendProxyRequestEmail({
      toEmail: target.email,
      toName: target.name,
      fromName: callerName,
      householdName,
      acceptUrl,
      expiresAt: new Date(grant.expires_at),
    });
  } catch (err) {
    // Hvis email fejler, slet grant'en så bruger ikke ender med dead state
    console.error('requestSetupProxy: email send failed', err);
    await supabase.from('setup_proxy_grants').delete().eq('id', grant.id);
    redirect(
      '/indstillinger?error=' +
        encodeURIComponent('Kunne ikke sende emailen. Tjek at familiemedlemmets email er korrekt.')
    );
  }

  revalidatePath('/indstillinger');
  redirect(
    '/indstillinger?notice=' +
      encodeURIComponent(`Anmodning sendt til ${target.name ?? 'familiemedlemmet'}`)
  );
}

// ============================================================================
// acceptSetupProxy - Louise klikker "Ja" på samtykke-siden
// ============================================================================
export async function acceptSetupProxy(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim();
  if (!token) {
    redirect('/accept-proxy?error=' + encodeURIComponent('Ugyldigt link'));
  }

  const tokenHash = hashProxyToken(token);
  const { supabase, user } = await getHouseholdContext();

  // Slå grant op via hash + validér at caller er grantor (den der skal sige ja)
  const { data: grant } = await supabase
    .from('setup_proxy_grants')
    .select('id, grantor_user_id, expires_at, accepted_at, revoked_at')
    .eq('request_token_hash', tokenHash)
    .maybeSingle();

  if (!grant) {
    redirect('/accept-proxy?error=' + encodeURIComponent('Linket er ugyldigt eller er allerede brugt'));
  }
  if (grant.grantor_user_id !== user.id) {
    redirect(
      '/accept-proxy?error=' +
        encodeURIComponent('Du er logget ind som en anden bruger end den anmodningen er til')
    );
  }
  if (grant.revoked_at) {
    redirect('/accept-proxy?error=' + encodeURIComponent('Anmodningen er trukket tilbage'));
  }
  if (new Date(grant.expires_at) <= new Date()) {
    redirect('/accept-proxy?error=' + encodeURIComponent('Anmodningen er udløbet'));
  }
  if (grant.accepted_at) {
    // Allerede accepteret - bare videresend til dashboard
    redirect('/dashboard?notice=' + encodeURIComponent('Adgangen er allerede aktiveret'));
  }

  const { error: updateErr } = await supabase
    .from('setup_proxy_grants')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', grant.id);

  if (updateErr) {
    console.error('acceptSetupProxy: update failed', updateErr.message);
    redirect('/accept-proxy?error=' + encodeURIComponent('Kunne ikke aktivere - prøv igen'));
  }

  revalidatePath('/indstillinger');
  redirect(
    '/dashboard?notice=' +
      encodeURIComponent('Tak! Adgangen er aktiveret og udløber automatisk efter 7 dage')
  );
}

// ============================================================================
// rejectSetupProxy - Louise siger "Nej tak"
// ============================================================================
export async function rejectSetupProxy(formData: FormData) {
  const token = String(formData.get('token') ?? '').trim();
  if (!token) {
    redirect('/accept-proxy?error=' + encodeURIComponent('Ugyldigt link'));
  }

  const tokenHash = hashProxyToken(token);
  const { supabase, user } = await getHouseholdContext();

  const { data: grant } = await supabase
    .from('setup_proxy_grants')
    .select('id, grantor_user_id')
    .eq('request_token_hash', tokenHash)
    .maybeSingle();

  if (!grant || grant.grantor_user_id !== user.id) {
    redirect('/accept-proxy?error=' + encodeURIComponent('Ugyldigt link'));
  }

  await supabase
    .from('setup_proxy_grants')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by_user_id: user.id,
    })
    .eq('id', grant.id);

  redirect('/dashboard?notice=' + encodeURIComponent('Anmodningen er afvist'));
}

// ============================================================================
// revokeSetupProxy - Trække aktiv grant tilbage (begge parter kan)
// ============================================================================
export async function revokeSetupProxy(formData: FormData) {
  const grantId = String(formData.get('grant_id') ?? '').trim();
  if (!grantId) return;

  const { supabase, user } = await getHouseholdContext();

  const { data: grant } = await supabase
    .from('setup_proxy_grants')
    .select('id, grantor_user_id, grantee_user_id')
    .eq('id', grantId)
    .maybeSingle();

  if (!grant) return;
  if (![grant.grantor_user_id, grant.grantee_user_id].includes(user.id)) return;

  await supabase
    .from('setup_proxy_grants')
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by_user_id: user.id,
    })
    .eq('id', grantId);

  // Hvis det er grantee der revoker, ryd også deres cookie
  if (user.id === grant.grantee_user_id) {
    await clearActiveProxyCookie();
  }

  revalidatePath('/indstillinger');
}

// ============================================================================
// activateProxySession - Mikkel toggler "Skift til X's perspektiv"
// ============================================================================
export async function activateProxySession(formData: FormData) {
  const grantId = String(formData.get('grant_id') ?? '').trim();
  if (!grantId) return;

  const { supabase, user } = await getHouseholdContext();

  const { data: grant } = await supabase
    .from('setup_proxy_grants')
    .select('id, grantee_user_id, accepted_at, revoked_at, expires_at')
    .eq('id', grantId)
    .maybeSingle();

  if (!grant) return;
  if (grant.grantee_user_id !== user.id) return;
  if (!grant.accepted_at) return;
  if (grant.revoked_at) return;
  if (new Date(grant.expires_at) <= new Date()) return;

  await setActiveProxyCookie(grant.id);
  revalidatePath('/', 'layout');
  redirect('/dashboard?notice=' + encodeURIComponent('Du redigerer nu for et familiemedlem'));
}

// ============================================================================
// deactivateProxySession - Skift tilbage til egen profil
// ============================================================================
export async function deactivateProxySession() {
  const ctx = await getActiveProxyContext();
  await clearActiveProxyCookie();
  revalidatePath('/', 'layout');
  if (ctx) {
    redirect(
      '/indstillinger?notice=' +
        encodeURIComponent('Tilbage på din egen profil')
    );
  }
  redirect('/dashboard');
}
