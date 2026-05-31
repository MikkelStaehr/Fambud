// Eneste autoritative kilde til "hvis konto er det her?"-spørgsmålet.
// Bruges af /konti's tracks, /overforsler's rækker, AccountSelectGrouped's
// <optgroup>-grupper og hvor end vi i fremtiden skal klassificere konti
// efter ejer.
//
// PRIORITET: created_by vinder over owner_name og editable_by_all. En
// konto du selv oprettede er DIN selv hvis labels er rodede (fx owner_name
// fejlagtigt sat til 'Fælles' på en privat konto). editable_by_all er den
// faktiske DB-truth for "delt" og bruges som fallback når created_by ikke
// matcher en kendt bruger.
//
// V1 havde tre divergerende klassifikationer:
//   - lib/cashflow-analysis.classifyAccountTrack (owner_name='Fælles' først)
//   - /overforsler/page.tsx classifyOwner (created_by først)
//   - AccountSelectGrouped ownerLabelFor (owner_name først)
// De er nu konsolideret hertil så fremtidige call-sites ikke kan vælge
// "den forkerte" - der findes kun én.

import type { Account } from '@/lib/database.types';

export type OwnershipTrack = 'mine' | 'partner' | 'shared' | 'other';

export type OwnershipResult = {
  track: OwnershipTrack;
  // Labels: kontekst-afhængigt navn til UI. 'mine' bruger currentLabel
  // ('Dig' eller dit navn); 'partner' bruger partnerLabel; 'shared' er
  // altid 'Fælles'; 'other' bruger owner_name eller fallback.
  label: string;
};

export type OwnershipContext = {
  // Den indloggede brugers user_id (auth.uid). En konto med created_by =
  // currentUserId klassificeres som 'mine'.
  currentUserId?: string;
  // Vises som label for 'mine' konti ('Dig', 'Mikkel', etc).
  currentLabel?: string;
  // Hvis sat: en proxy-grantor (partner) hvis private konti vises i UI.
  // created_by = partnerUserId klassificeres som 'partner'.
  partnerUserId?: string;
  partnerLabel?: string;
};

// Minimum-feltsæt en konto skal have for at klassificeres. Loose typing
// (string | null | undefined) så både fuld Account-type og slimme picks
// (fx fra dropdowns) accepteres.
export type OwnableAccount = {
  owner_name?: string | null;
  created_by?: string | null;
  editable_by_all?: boolean | null;
};

// Den rene klassifikations-funktion. Pure - intet IO, intet state.
//
// PRIORITET (vigtig - testet i account-ownership.test.ts):
//   1. editable_by_all=true       → shared  (DB-truth for delt konto)
//   2. created_by = currentUserId → mine    (din egen konto)
//   3. created_by = partnerUserId → partner (proxy-grantor's konto)
//   4. owner_name = 'Fælles'      → shared  (legacy fallback - før vi
//                                            havde editable_by_all)
//   5. owner_name som label       → other   (partnerens private uden
//                                            partnerCtx, fx normal-mode)
//
// Hvorfor editable_by_all FØR created_by: en bruger der opretter
// Budgetkontoen i wizarden får både created_by=dem OG editable_by_all=true.
// Vi vil have Budgetkontoen klassificeret som "shared" for alle, ikke
// "mine" for den der oprettede den. editable_by_all er den eksplicitte
// "jeg deler denne konto"-toggle.
//
// Hvorfor created_by FØR owner_name='Fælles' fallback: brugere har
// sat owner_name='Fælles' på private lønkonti ved et uheld (eller fra
// gammel wizard-konfig). created_by er den ægte ownership-signal.
export function classifyAccountOwnership(
  account: OwnableAccount,
  ctx: OwnershipContext = {}
): OwnershipResult {
  // Skridt 1: DB-niveau "delt" - editable_by_all=true vinder altid.
  if (account.editable_by_all === true) {
    return { track: 'shared', label: 'Fælles' };
  }

  // Skridt 2: created_by-match. En konto du oprettede er din uanset
  // hvad owner_name-label er sat til (gamle data-issues).
  if (ctx.currentUserId && account.created_by === ctx.currentUserId) {
    return { track: 'mine', label: ctx.currentLabel ?? 'Dig' };
  }
  if (ctx.partnerUserId && account.created_by === ctx.partnerUserId) {
    return { track: 'partner', label: ctx.partnerLabel ?? 'Partner' };
  }

  // Skridt 3: legacy fallback - owner_name='Fælles' på konti uden
  // editable_by_all (gammel data fra før migration 0031).
  if (account.owner_name === 'Fælles') {
    return { track: 'shared', label: 'Fælles' };
  }

  // Skridt 4: ukendt ejer - fald tilbage til owner_name som label.
  const ownerName = account.owner_name?.trim();
  return {
    track: 'other',
    label: ownerName && ownerName.length > 0 ? ownerName : 'Andet',
  };
}

// Gruppér en liste af konti efter ownership. Vægt-sorteres så Dig altid
// kommer først, derefter Partner, derefter Fælles, derefter alfabetisk
// dansk. Bruges af AccountSelectGrouped til <optgroup>-rækkefølge.
export function groupAccountsByOwnership<T extends OwnableAccount>(
  accounts: T[],
  ctx: OwnershipContext = {}
): { label: string; accounts: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const a of accounts) {
    const { label } = classifyAccountOwnership(a, ctx);
    const arr = groups.get(label) ?? [];
    arr.push(a);
    groups.set(label, arr);
  }
  const currentLabel = ctx.currentLabel ?? 'Dig';
  const partnerLabel = ctx.partnerLabel ?? 'Partner';
  const weight = (l: string): number => {
    if (l === currentLabel) return 0;
    if (l === partnerLabel) return 1;
    if (l === 'Fælles') return 2;
    return 3;
  };
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      const wa = weight(a);
      const wb = weight(b);
      if (wa !== wb) return wa - wb;
      return a.localeCompare(b, 'da');
    })
    .map(([label, accs]) => ({ label, accounts: accs }));
}
