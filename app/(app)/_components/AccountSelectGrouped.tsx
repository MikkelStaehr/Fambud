// Dropdown der grupperer konti efter ejer via <optgroup>. Bruges i forms
// hvor brugeren skal v&aelig;lge en konto - is&aelig;r relevant i proxy-mode
// hvor b&aring;de Mikkels og Louises konti er synlige og man hurtigt skal
// kunne sk&aelig;lne hvis er hvis.
//
// Gruppering bygger p&aring; owner_name (free-text felt brugeren selv s&aelig;tter
// p&aring; kontoen). Tomme/null owner_name f&aring;r label "F&aelig;lles". F&aelig;lles vises altid
// f&oslash;rst; resten alfabetisk dansk.

'use client';

type GroupableAccount = {
  id: string;
  name: string;
  archived?: boolean;
  owner_name?: string | null;
};

export function groupAccountsByOwner<T extends GroupableAccount>(
  accounts: T[]
): { label: string; accounts: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const a of accounts) {
    const owner = a.owner_name?.trim();
    const label = owner && owner.length > 0 ? owner : 'Fælles';
    const arr = groups.get(label) ?? [];
    arr.push(a);
    groups.set(label, arr);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => {
      if (a === 'Fælles') return -1;
      if (b === 'Fælles') return 1;
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
  // Hvis sat: kun grupp&eacute;r n&aring;r der er konti fra mere end &eacute;n ejer.
  // Med &eacute;n ejer er det st&oslash;j; med to+ er det skelnen-v&aelig;rdi.
  smartGrouping?: boolean;
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
}: Props<T>) {
  const groups = groupAccountsByOwner(accounts);
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
