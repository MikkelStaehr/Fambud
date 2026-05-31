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

type GroupableAccount = {
  id: string;
  name: string;
  archived?: boolean;
  owner_name?: string | null;
  created_by?: string | null;
  editable_by_all?: boolean;
};

type OwnerCtx = {
  currentUserId?: string;
  currentLabel?: string;  // default "Dig"
  partnerUserId?: string;
  partnerLabel?: string;
};

function ownerLabelFor<T extends GroupableAccount>(
  a: T,
  ctx: OwnerCtx
): string {
  // created_by vinder over owner_name - en konto du oprettede er DIN
  // selv hvis labels er rodede.
  if (ctx.currentUserId && a.created_by === ctx.currentUserId) {
    return ctx.currentLabel ?? 'Dig';
  }
  if (ctx.partnerUserId && a.created_by === ctx.partnerUserId) {
    return ctx.partnerLabel ?? 'Partner';
  }
  if (a.editable_by_all || a.owner_name === 'Fælles') {
    return 'Fælles';
  }
  const owner = a.owner_name?.trim();
  return owner && owner.length > 0 ? owner : 'Fælles';
}

export function groupAccountsByOwner<T extends GroupableAccount>(
  accounts: T[],
  ctx: OwnerCtx = {}
): { label: string; accounts: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const a of accounts) {
    const label = ownerLabelFor(a, ctx);
    const arr = groups.get(label) ?? [];
    arr.push(a);
    groups.set(label, arr);
  }
  const currentLabel = ctx.currentLabel ?? 'Dig';
  const partnerLabel = ctx.partnerLabel ?? 'Partner';
  // Sortering: Dig -> Partner -> Fælles -> alfabetisk
  const weight = (l: string) => {
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
  const groups = groupAccountsByOwner(accounts, {
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
