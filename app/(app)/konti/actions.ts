'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getHouseholdContext } from '@/lib/dal';
import { parseAmountToOere, parseOptionalAmount } from '@/lib/format';
import { noticeUrl } from '@/lib/flash';
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
        savings_purpose: SavingsPurpose | null;
        opening_balance: number;
        goal_amount: number | null;
        goal_date: string | null;
        goal_label: string | null;
        editable_by_all: boolean;
      };
    } {
  const name = String(formData.get('name') ?? '').trim();
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

  // Samme pattern for savings_purpose: kun meningsfuld når kind='savings'.
  const savingsPurposeRaw = String(formData.get('savings_purpose') ?? '').trim();
  let savings_purpose: SavingsPurpose | null = null;
  if (kind === 'savings' && savingsPurposeRaw) {
    if (!VALID_SAVINGS_PURPOSES.includes(savingsPurposeRaw as SavingsPurpose)) {
      return { error: 'Ugyldig opsparingstype' };
    }
    savings_purpose = savingsPurposeRaw as SavingsPurpose;
  }

  const openingRaw = String(formData.get('opening_balance') ?? '0');
  const opening_balance = parseAmountToOere(openingRaw) ?? 0;

  const goalRes = parseOptionalAmount(
    String(formData.get('goal_amount') ?? ''),
    'Målbeløb',
    { allowZero: false }
  );
  if (!goalRes.ok) return { error: goalRes.error };
  const goal_amount = goalRes.value;

  const goalDateRaw = String(formData.get('goal_date') ?? '').trim();
  const goal_date = goalDateRaw || null;

  const goalLabelRaw = String(formData.get('goal_label') ?? '').trim();
  const goal_label = goalLabelRaw || null;

  const ownerRaw = String(formData.get('owner_name') ?? '').trim();
  const owner_name = ownerRaw || null;

  // Checkbox: present in formData ('on') means checked, absent means unchecked.
  const editable_by_all = formData.get('editable_by_all') === 'on';

  return {
    data: {
      name, owner_name, kind, investment_type, savings_purpose,
      opening_balance, goal_amount, goal_date, goal_label, editable_by_all,
    },
  };
}

export async function createAccount(formData: FormData) {
  const parsed = readAccountForm(formData);
  if ('error' in parsed) {
    redirect('/konti/ny?error=' + encodeURIComponent(parsed.error));
  }

  const { supabase, householdId } = await getHouseholdContext();
  const { error } = await supabase.from('accounts').insert({
    household_id: householdId,
    ...parsed.data,
  });
  if (error) {
    redirect('/konti/ny?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/konti');
  revalidatePath('/dashboard');
  redirect(noticeUrl('/konti', `${parsed.data.name} oprettet`));
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
    redirect(`/konti/${encodeURIComponent(id)}?error=` + encodeURIComponent(error.message));
  }

  revalidatePath('/konti');
  revalidatePath('/dashboard');
  redirect(noticeUrl('/konti', `${parsed.data.name} gemt`));
}

// Soft-delete: transactions/transfers reference accounts ON DELETE RESTRICT,
// so a hard delete fails the moment any history exists. Archiving is the
// equivalent UI affordance — archived accounts disappear from the default
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
  if (error) throw new Error(error.message);
  revalidatePath('/konti');
  revalidatePath('/dashboard');
  redirect(noticeUrl('/konti', 'Konto arkiveret'));
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
  if (error) throw new Error(error.message);
  revalidatePath('/konti');
  revalidatePath('/dashboard');
  redirect(noticeUrl('/konti?archived=1', 'Konto gendannet'));
}
