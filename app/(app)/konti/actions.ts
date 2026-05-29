'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseAmountToOere, capLength, TEXT_LIMITS } from '@/lib/format';
import { setFlashCookie } from '@/lib/flash';
import { mapDbError } from '@/lib/actions/error-map';
import { resolveEffectiveUser } from '@/lib/proxy';
import { logAuditEvent } from '@/lib/audit-log';
import type {
  AccountKind,
  InvestmentType,
  SavingsPurpose,
} from '@/lib/database.types';

const VALID_KINDS: readonly AccountKind[] = [
  'checking',
  'budget',
  'household',
  'savings',
  'investment',
  'credit',
  'cash',
  'other',
];

const VALID_INVESTMENT_TYPES: readonly InvestmentType[] = [
  'aldersopsparing',
  'aktiesparekonto',
  'aktiedepot',
  'pension',
  'boerneopsparing',
];

const VALID_SAVINGS_PURPOSES: readonly SavingsPurpose[] = [
  'buffer',
  'predictable_unexpected',
];

// Pulls the common fields out of a FormData. Returns either an error message
// (string) or a normalised payload (the second tuple element). We don't throw
// because actions redirect with ?error=... rather than crashing the page.
function readAccountForm(formData: FormData):
  | { error: string }
  | {
      data: {
        name: string;
        owner_name: string | null;
        kind: AccountKind;
        investment_type: InvestmentType | null;
        savings_purposes: SavingsPurpose[] | null;
        opening_balance: number;
        editable_by_all: boolean;
      };
    } {
  const name = capLength(String(formData.get('name') ?? '').trim(), TEXT_LIMITS.shortName);
  if (!name) return { error: 'Navn er påkrævet' };

  const kindRaw = String(formData.get('kind') ?? 'checking');
  if (!VALID_KINDS.includes(kindRaw as AccountKind)) {
    return { error: 'Ugyldig kontotype' };
  }
  const kind = kindRaw as AccountKind;

  // investment_type er kun meningsfuld når kind='investment'. For alle andre
  // kinds nuller vi det ud så subtypen ikke hænger ved hvis brugeren skifter
  // type på en eksisterende konto.
  const investmentTypeRaw = String(formData.get('investment_type') ?? '').trim();
  let investment_type: InvestmentType | null = null;
  if (kind === 'investment' && investmentTypeRaw) {
    if (!VALID_INVESTMENT_TYPES.includes(investmentTypeRaw as InvestmentType)) {
      return { error: 'Ugyldig investeringstype' };
    }
    investment_type = investmentTypeRaw as InvestmentType;
  }

  // savings_purposes: nu et multi-checkbox felt. FormData.getAll henter ALLE
  // checked værdier under samme name. Tom liste = ingen specialfunktion
  // (almindelig opsparing). Begge værdier = én konto der dækker både
  // buffer og forudsigelige uforudsete.
  let savings_purposes: SavingsPurpose[] | null = null;
  if (kind === 'savings') {
    const raw = formData.getAll('savings_purposes').map((v) => String(v).trim());
    const valid: SavingsPurpose[] = [];
    for (const r of raw) {
      if (!r) continue;
      if (!VALID_SAVINGS_PURPOSES.includes(r as SavingsPurpose)) {
        return { error: 'Ugyldig opsparingstype' };
      }
      valid.push(r as SavingsPurpose);
    }
    savings_purposes = valid.length > 0 ? valid : null;
  }

  const openingRaw = String(formData.get('opening_balance') ?? '0');
  const opening_balance = parseAmountToOere(openingRaw) ?? 0;

  const ownerRaw = capLength(String(formData.get('owner_name') ?? '').trim(), TEXT_LIMITS.shortName);
  const owner_name = ownerRaw || null;

  // Checkbox: present in formData ('on') means checked, absent means unchecked.
  const editable_by_all = formData.get('editable_by_all') === 'on';

  return {
    data: {
      name, owner_name, kind, investment_type, savings_purposes,
      opening_balance, editable_by_all,
    },
  };
}

export async function createAccount(formData: FormData) {
  const parsed = readAccountForm(formData);
  if ('error' in parsed) {
    redirect('/konti/ny?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();

  // Proxy-mode (migration 0065): hvis Mikkel hjælper Louise med at sætte
  // hendes økonomi op, skal kontoen tilskrives hende - ikke Mikkel.
  // - created_by = Louise.id (audit-spor)
  // - owner_name = Louises navn (medmindre brugeren eksplicit har valgt
  //   "Fælles" eller andet i form'en)
  const proxy = await resolveEffectiveUser('setup');
  const ownerNameOverride =
    proxy.isProxyActive && !parsed.data.owner_name && proxy.grantorName
      ? proxy.grantorName
      : parsed.data.owner_name;

  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    ...parsed.data,
    owner_name: ownerNameOverride,
    created_by: proxy.effectiveUserId,
  });
  if (error) {
    console.error('createAccount failed:', error.message);
    redirect('/konti/ny?error=' + encodeURIComponent('Operationen fejlede - prøv igen'));
  }

  // Audit (migration 0067): konto oprettet under aktiv proxy. user_id =
  // grantor (ejeren), acting_user_id = grantee (den der faktisk oprettede).
  if (proxy.isProxyActive) {
    await logAuditEvent({
      action: 'proxy.resource_created',
      result: 'success',
      user_id: proxy.effectiveUserId,
      acting_user_id: proxy.authUserId,
      household_id: householdId,
      resource: 'account',
      metadata: {
        resource_type: 'account',
        name: parsed.data.name,
        kind: parsed.data.kind,
        grant_id: proxy.grantId,
      },
    });
  }

  revalidatePath('/konti');
  revalidatePath('/dashboard');
  const noticeSuffix = proxy.isProxyActive ? ` for ${proxy.grantorName ?? 'familiemedlem'}` : '';
  await setFlashCookie(`${parsed.data.name} oprettet${noticeSuffix}`);
  redirect('/konti');
}

export async function updateAccount(id: string, formData: FormData) {
  const parsed = readAccountForm(formData);
  if ('error' in parsed) {
    redirect(`/konti/${encodeURIComponent(id)}?error=` + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .update(parsed.data)
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) {
    console.error('updateAccount failed:', error.message);
    redirect(`/konti/${encodeURIComponent(id)}?error=` + encodeURIComponent(mapDbError(error, 'Kunne ikke gemme kontoen')));
  }

  revalidatePath('/konti');
  revalidatePath('/dashboard');
  await setFlashCookie(`${parsed.data.name} gemt`);
  redirect('/konti');
}

// Soft-delete: transactions/transfers reference accounts ON DELETE RESTRICT,
// so a hard delete fails the moment any history exists. Archiving is the
// equivalent UI affordance - archived accounts disappear from the default
// list view and from the dashboard.
export async function archiveAccount(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .update({ archived: true })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) { console.error('Action error:', error.message); throw new Error('Internal error'); }
  revalidatePath('/konti');
  revalidatePath('/dashboard');
  await setFlashCookie('Konto arkiveret');
  redirect('/konti');
}

export async function restoreAccount(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase
    .from('accounts')
    .update({ archived: false })
    .eq('id', id)
    .eq('household_id', householdId);
  if (error) { console.error('Action error:', error.message); throw new Error('Internal error'); }
  revalidatePath('/konti');
  revalidatePath('/dashboard');
  await setFlashCookie('Konto gendannet');
  redirect('/konti?archived=1');
}
