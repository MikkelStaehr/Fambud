// Dropdown der grupperer konti efter ejer via <optgroup>. Bruges i forms
// hvor brugeren skal vælge en konto - især relevant i proxy-mode hvor
// både Mikkels og Louises konti er synlige og man hurtigt skal kunne
// skelne hvis er hvis.
//
// Gruppering PRIMÆRT efter created_by (når currentUserId er sat): din
// egen konto havner i "Dig"/dit-navn-gruppen selv hvis owner_name
// fejlagtigt er sat til "Fælles". Falder tilbage til owner_name som
// label-kilde for andre.

'use client';

import {
  groupAccountsByOwnership,
  type OwnershipContext,
} from '@/lib/account-ownership';

type GroupableAccount = {
  id: string;
  name: string;
  archived?: boolean;
  owner_name?: string | null;
  created_by?: string | null;
  editable_by_all?: boolean;
};

// Re-export under det gamle navn for bagudkompat-imports. Delegerer til
// den fælles ownership-helper (lib/account-ownership.ts) som er den
// autoritative klassifikator overalt i appen.
export function groupAccountsByOwner<T extends GroupableAccount>(
  accounts: T[],
  ctx: OwnershipContext = {}
): { label: string; accounts: T[] }[] {
  return groupAccountsByOwnership(accounts, ctx);
}

type Props<T extends GroupableAccount> = {
  id?: string;
  name: string;
  required?: boolean;
  className?: string;
  accounts: T[];
  defaultValue?: string;
  value?: string;
  onChange?: (id: string) => void;
  emptyOption?: string;
  smartGrouping?: boolean;
  // Identitets-kontekst: bruges til at klassificere konti efter created_by
  // i stedet for blot owner_name. Optional for bagudkompatibilitet -
  // uden den falder vi tilbage til owner_name-only.
  currentUserId?: string;
  currentLabel?: string;
  partnerUserId?: string;
  partnerLabel?: string;
};

export function AccountSelectGrouped<T extends GroupableAccount>({
  id,
  name,
  required,
  className,
  accounts,
  defaultValue,
  value,
  onChange,
  emptyOption = 'Vælg konto',
  smartGrouping = true,
  currentUserId,
  currentLabel,
  partnerUserId,
  partnerLabel,
}: Props<T>) {
  const groups = groupAccountsByOwnership(accounts, {
    currentUserId,
    currentLabel,
    partnerUserId,
    partnerLabel,
  });
  const useGrouping = !smartGrouping || groups.length > 1;

  const controlled = value !== undefined;

  return (
    <select
      id={id}
      name={name}
      required={required}
      className={className}
      {...(controlled
        ? { value, onChange: (e) => onChange?.(e.target.value) }
        : { defaultValue: defaultValue ?? '' })}
    >
      <option value="" disabled>
        {emptyOption}
      </option>
      {useGrouping
        ? groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.archived ? ' (arkiveret)' : ''}
                </option>
              ))}
            </optgroup>
          ))
        : accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.archived ? ' (arkiveret)' : ''}
            </option>
          ))}
    </select>
  );
}
