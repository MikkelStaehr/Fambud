'use client';

// Budget-overblik som hierarkisk tabel — udgifter er grupperet på kategori-
// gruppe (Bolig & lån, Forsyning & forsikring, …) og hver gruppe er en
// sammenklappelig parent-række. Default: grupperne er foldet sammen så
// brugeren ser 9 totaler i stedet for 30 enkelt-poster. "Fold alt ud"-knap
// lader dem se det hele på én gang.
//
// Klik på en udgift åbner /faste-udgifter/[accountId] for redigering.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { CategoryGroup } from '@/lib/categories';
import type { RecurrenceFreq } from '@/lib/database.types';
import { formatAmount, RECURRENCE_LABEL_DA } from '@/lib/format';

export type BudgetRow = {
  id: string;
  description: string;
  group: CategoryGroup;
  groupColor: string;
  categoryName: string;
  categoryColor: string;
  recurrence: RecurrenceFreq;
  accountId: string;
  accountName: string;
  isShared: boolean;
  effective: number;     // base + components, faktisk debitering
  monthly: number;       // monthlyEquivalent — bruges til sortering & total
};

type SortKey = 'monthly' | 'name' | 'recurrence' | 'account';
type SortDir = 'asc' | 'desc';
type ScopeTab = 'shared' | 'private';

type Props = {
  rows: BudgetRow[];
};

export function BudgetTable({ rows }: Props) {
  // Scope-toggle (Fælles / Private) er primær — matcher dashboardets
  // CategoryGroupChart + UpcomingEvents. Default 'shared' så folk lander
  // på fælles-økonomien som er den oftest interessante for husstanden.
  const [scope, setScope] = useState<ScopeTab>('shared');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('monthly');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState<Set<CategoryGroup>>(new Set());

  // Filtrér rækkerne ned til den valgte scope FØR alt andet — alle
  // efterfølgende dropdowns og memos ser kun rows i det aktive scope.
  const scopeRows = useMemo(
    () => rows.filter((r) => (scope === 'shared' ? r.isShared : !r.isShared)),
    [rows, scope]
  );

  // Unikke værdier til filter-dropdowns. Vi viser kun værdier der faktisk
  // optræder i det aktive scope — så fx Underholdning ikke står som tom
  // option hvis ingen private udgifter er i den gruppe.
  const accounts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of scopeRows) seen.set(r.accountId, r.accountName);
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [scopeRows]);

  const allGroups = useMemo(() => {
    const seen = new Set<CategoryGroup>();
    for (const r of scopeRows) seen.add(r.group);
    return Array.from(seen);
  }, [scopeRows]);

  const recurrences = useMemo(() => {
    const seen = new Set<RecurrenceFreq>();
    for (const r of scopeRows) seen.add(r.recurrence);
    return Array.from(seen);
  }, [scopeRows]);

  // Filtrér på alle aktive filtre. Search matcher case-insensitive på navn
  // OG på kontonavn (så "lønkonto" filtrerer alt på Lønkontoen).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopeRows.filter((r) => {
      if (accountFilter !== 'all' && r.accountId !== accountFilter) return false;
      if (groupFilter !== 'all' && r.group !== groupFilter) return false;
      if (recurrenceFilter !== 'all' && r.recurrence !== recurrenceFilter) return false;
      if (
        q &&
        !r.description.toLowerCase().includes(q) &&
        !r.accountName.toLowerCase().includes(q) &&
        !r.categoryName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [scopeRows, accountFilter, groupFilter, recurrenceFilter, search]);

  const hasActiveFilters =
    accountFilter !== 'all' ||
    groupFilter !== 'all' ||
    recurrenceFilter !== 'all' ||
    search.trim() !== '';

  // Grupper rækker pr. gruppe og beregn totaler. Child-rækker sorteres
  // efter den valgte sort-key. Selve grupperne sorteres altid efter total
  // monthly desc — det er det mest naturlige overblik (de største poster
  // øverst), uafhængigt af hvad child-sortering er sat til.
  const grouped = useMemo(() => {
    const map = new Map<CategoryGroup, BudgetRow[]>();
    for (const r of filtered) {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const sortChildren = (a: BudgetRow, b: BudgetRow): number => {
      switch (sortKey) {
        case 'monthly':
          return (a.monthly - b.monthly) * dir;
        case 'name':
          return a.description.localeCompare(b.description, 'da') * dir;
        case 'recurrence':
          return a.recurrence.localeCompare(b.recurrence, 'da') * dir;
        case 'account':
          return a.accountName.localeCompare(b.accountName, 'da') * dir;
      }
    };
    const groups = Array.from(map.entries()).map(([group, items]) => {
      const total = items.reduce((s, r) => s + r.monthly, 0);
      const color = items[0]?.groupColor ?? '#94a3b8';
      const sorted = [...items].sort(sortChildren);
      return { group, color, total, items: sorted };
    });
    // Grupper altid sorteret efter total desc — overblik prioriterer størrelse.
    groups.sort((a, b) => b.total - a.total);
    return groups;
  }, [filtered, sortKey, sortDir]);

  const totalMonthly = filtered.reduce((s, r) => s + r.monthly, 0);
  const totalCount = filtered.length;

  // Når brugeren søger eller filtrerer aktivt, fold automatisk alt ud så
  // matchene er synlige uden ekstra klik. Når filtre er tomme, brug
  // brugerens manuelle expand-state.
  const isExpanded = (g: CategoryGroup): boolean =>
    hasActiveFilters || expanded.has(g);

  const toggleGroup = (g: CategoryGroup) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const allExpanded = expanded.size === grouped.length && grouped.length > 0;
  const expandAll = () => setExpanded(new Set(grouped.map((g) => g.group)));
  const collapseAll = () => setExpanded(new Set());

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };
  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '';

  // Når brugeren skifter scope nulstiller vi sekundære filtre — ellers
  // risikerer man at filtrere på en privat konto, skifte til Fælles og
  // ende med et tomt resultat-set uden synlig grund.
  const switchScope = (next: ScopeTab) => {
    if (next === scope) return;
    setScope(next);
    setAccountFilter('all');
    setGroupFilter('all');
    setRecurrenceFilter('all');
    setSearch('');
    setExpanded(new Set());
  };

  // Total for hele scopet (uafhængigt af aktive filtre) — vises på tab'en
  // så brugeren ser fælles vs. private totaler uden at skulle klikke.
  const sharedTotal = useMemo(
    () =>
      rows
        .filter((r) => r.isShared)
        .reduce((s, r) => s + r.monthly, 0),
    [rows]
  );
  const privateTotal = useMemo(
    () =>
      rows
        .filter((r) => !r.isShared)
        .reduce((s, r) => s + r.monthly, 0),
    [rows]
  );

  return (
    <div>
      {/* Scope-tab — Fælles / Private. Matcher dashboardets toggle. */}
      <div className="mb-4 inline-flex rounded-md border border-neutral-200 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => switchScope('shared')}
          className={`rounded px-3 py-1.5 font-medium transition ${
            scope === 'shared'
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Fælles{' '}
          <span className="tabnum ml-1 font-mono opacity-70">
            {formatAmount(sharedTotal)} kr/md
          </span>
        </button>
        <button
          type="button"
          onClick={() => switchScope('private')}
          className={`rounded px-3 py-1.5 font-medium transition ${
            scope === 'private'
              ? 'bg-neutral-900 text-white'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Private{' '}
          <span className="tabnum ml-1 font-mono opacity-70">
            {formatAmount(privateTotal)} kr/md
          </span>
        </button>
      </div>

      {/* Filter-bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søg navn, konto, kategori…"
          className="flex-1 min-w-[200px] rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none"
        />
        <select
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-400 focus:outline-none"
        >
          <option value="all">Alle konti</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-400 focus:outline-none"
        >
          <option value="all">Alle grupper</option>
          {allGroups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={recurrenceFilter}
          onChange={(e) => setRecurrenceFilter(e.target.value)}
          className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm focus:border-neutral-400 focus:outline-none"
        >
          <option value="all">Alle intervaller</option>
          {recurrences.map((r) => (
            <option key={r} value={r}>
              {RECURRENCE_LABEL_DA[r]}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setAccountFilter('all');
              setGroupFilter('all');
              setRecurrenceFilter('all');
              setSearch('');
            }}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            Nulstil
          </button>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={allExpanded ? collapseAll : expandAll}
            disabled={hasActiveFilters || grouped.length === 0}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {allExpanded ? 'Fold alle sammen' : 'Fold alle ud'}
          </button>
        </div>
      </div>

      {/* Tabellen */}
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
              <tr>
                <th scope="col" className="w-[34%] px-4 py-2.5 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-1 font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
                  >
                    Gruppe / Navn
                    {sortIndicator('name') && (
                      <span className="text-[9px]">{sortIndicator('name')}</span>
                    )}
                  </button>
                </th>
                <Th
                  onClick={() => toggleSort('recurrence')}
                  indicator={sortIndicator('recurrence')}
                >
                  Interval
                </Th>
                <Th onClick={() => toggleSort('account')} indicator={sortIndicator('account')}>
                  Konto
                </Th>
                <Th
                  onClick={() => toggleSort('monthly')}
                  indicator={sortIndicator('monthly')}
                  align="right"
                >
                  Beløb / md
                </Th>
              </tr>
            </thead>
            {grouped.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-neutral-500">
                    Ingen udgifter matcher filteret.
                  </td>
                </tr>
              </tbody>
            ) : (
              grouped.map((g) => {
                const open = isExpanded(g.group);
                const interactive = !hasActiveFilters; // når filtre er aktive er rækken altid foldet ud
                return (
                  <tbody key={g.group} className="border-b border-neutral-100 last:border-b-0">
                    {/* Parent-række — gruppe-header */}
                    <tr
                      className={`bg-neutral-50/60 transition ${
                        interactive ? 'cursor-pointer hover:bg-neutral-100/70' : ''
                      }`}
                      onClick={interactive ? () => toggleGroup(g.group) : undefined}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {interactive ? (
                            <ChevronRight
                              className={`h-4 w-4 shrink-0 text-neutral-400 transition ${
                                open ? 'rotate-90' : ''
                              }`}
                            />
                          ) : (
                            <span className="h-4 w-4 shrink-0" aria-hidden />
                          )}
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: g.color }}
                            aria-hidden
                          />
                          <span className="font-semibold text-neutral-900">
                            {g.group}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {g.items.length}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 text-right">
                        <div className="tabnum font-mono text-sm font-semibold text-neutral-900">
                          {formatAmount(g.total)} kr
                        </div>
                      </td>
                    </tr>

                    {/* Child-rækker — udgifter under gruppen */}
                    {open &&
                      g.items.map((r) => (
                        <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                          <td className="px-4 py-2 pl-12">
                            <Link
                              href={`/faste-udgifter/${r.accountId}#expense-${r.id}`}
                              className="block truncate text-neutral-900 hover:underline"
                            >
                              {r.description}
                            </Link>
                            <div className="truncate text-[11px] text-neutral-500">
                              {r.categoryName}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-xs text-neutral-600">
                            {RECURRENCE_LABEL_DA[r.recurrence]}
                          </td>
                          <td className="px-4 py-2 text-neutral-900">
                            {r.accountName}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="tabnum font-mono text-sm font-medium text-neutral-900">
                              {formatAmount(r.monthly)} kr
                            </div>
                            {r.recurrence !== 'monthly' && (
                              <div className="tabnum font-mono text-[11px] text-neutral-500">
                                {formatAmount(r.effective)} kr/{RECURRENCE_LABEL_DA[r.recurrence].slice(0, 3)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                );
              })
            )}
            {grouped.length > 0 && (
              <tfoot className="border-t-2 border-neutral-200 bg-neutral-50">
                <tr>
                  <td colSpan={3} className="px-4 py-2.5 text-xs font-medium text-neutral-600">
                    {totalCount} {totalCount === 1 ? 'udgift' : 'udgifter'} i alt
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="tabnum font-mono text-sm font-semibold text-neutral-900">
                      {formatAmount(totalMonthly)} kr/md
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  onClick,
  indicator,
  align = 'left',
}: {
  children: React.ReactNode;
  onClick: () => void;
  indicator: string;
  align?: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 font-medium uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
      >
        {children}
        {indicator && <span className="text-[9px]">{indicator}</span>}
      </button>
    </th>
  );
}
