'use client';

// Måneds-overblik over faktiske posteringer som hierarkisk tabel - gruppe
// (Bolig & lån, Forsyning & forsikring, …) som parent-række, posterne som
// foldbare børn. Forskellen til /budget: her viser vi det faktiske beløb
// der er bogført i den valgte måned (incl. årlige/kvartalvise poster med
// deres fulde beløb), ikke en monthlyEquivalent-normalisering.
//
// Fælles/Private-tab matcher dashboardet og /budget. Edit/slet-handlinger
// pr. række er bevaret.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Pencil, Repeat, Trash2 } from 'lucide-react';
import type { CategoryGroup } from '@/lib/categories';
import type { RecurrenceFreq } from '@/lib/database.types';
import { formatAmount, formatShortDateDA, RECURRENCE_LABEL_DA } from '@/lib/format';
import { deleteTransaction } from '../actions';

export type PosterRow = {
  id: string;
  description: string;
  group: CategoryGroup;
  groupColor: string;
  categoryName: string;
  categoryColor: string;
  occursOn: string;       // ISO YYYY-MM-DD
  recurrence: RecurrenceFreq;
  accountId: string;
  accountName: string;
  isShared: boolean;
  amount: number;         // faktisk debiteret beløb (ikke monthlyEquivalent)
};

type SortKey = 'amount' | 'name' | 'date' | 'account';
type SortDir = 'asc' | 'desc';
type ScopeTab = 'shared' | 'private';

type Props = {
  rows: PosterRow[];
};

export function PosterTable({ rows }: Props) {
  const [scope, setScope] = useState<ScopeTab>('shared');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expanded, setExpanded] = useState<Set<CategoryGroup>>(new Set());

  const scopeRows = useMemo(
    () => rows.filter((r) => (scope === 'shared' ? r.isShared : !r.isShared)),
    [rows, scope]
  );

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopeRows.filter((r) => {
      if (accountFilter !== 'all' && r.accountId !== accountFilter) return false;
      if (groupFilter !== 'all' && r.group !== groupFilter) return false;
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
  }, [scopeRows, accountFilter, groupFilter, search]);

  const hasActiveFilters =
    accountFilter !== 'all' || groupFilter !== 'all' || search.trim() !== '';

  // Grupper på kategori-gruppe + sortér både grupper og children.
  const grouped = useMemo(() => {
    const map = new Map<CategoryGroup, PosterRow[]>();
    for (const r of filtered) {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const sortChildren = (a: PosterRow, b: PosterRow): number => {
      switch (sortKey) {
        case 'amount':
          return (a.amount - b.amount) * dir;
        case 'name':
          return a.description.localeCompare(b.description, 'da') * dir;
        case 'date':
          return a.occursOn.localeCompare(b.occursOn) * dir;
        case 'account':
          return a.accountName.localeCompare(b.accountName, 'da') * dir;
      }
    };
    const groups = Array.from(map.entries()).map(([group, items]) => {
      const total = items.reduce((s, r) => s + r.amount, 0);
      const color = items[0]?.groupColor ?? '#94a3b8';
      const sorted = [...items].sort(sortChildren);
      return { group, color, total, items: sorted };
    });
    // Grupper sorteret efter total desc - størst betalt først
    groups.sort((a, b) => b.total - a.total);
    return groups;
  }, [filtered, sortKey, sortDir]);

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);
  const totalCount = filtered.length;

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

  const switchScope = (next: ScopeTab) => {
    if (next === scope) return;
    setScope(next);
    setAccountFilter('all');
    setGroupFilter('all');
    setSearch('');
    setExpanded(new Set());
  };

  const sharedTotal = useMemo(
    () => rows.filter((r) => r.isShared).reduce((s, r) => s + r.amount, 0),
    [rows]
  );
  const privateTotal = useMemo(
    () => rows.filter((r) => !r.isShared).reduce((s, r) => s + r.amount, 0),
    [rows]
  );

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

  return (
    <div>
      {/* Scope-tab - Fælles / Private */}
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
            {formatAmount(sharedTotal)} kr
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
            {formatAmount(privateTotal)} kr
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
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setAccountFilter('all');
              setGroupFilter('all');
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
                  onClick={() => toggleSort('date')}
                  indicator={sortIndicator('date')}
                  hideOnMobile
                >
                  Dato
                </Th>
                <Th
                  onClick={() => toggleSort('account')}
                  indicator={sortIndicator('account')}
                  hideOnMobile
                >
                  Konto
                </Th>
                <Th
                  onClick={() => toggleSort('amount')}
                  indicator={sortIndicator('amount')}
                  align="right"
                >
                  Beløb
                </Th>
                <th scope="col" className="w-px px-4 py-2.5" aria-label="Handlinger" />
              </tr>
            </thead>
            {grouped.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">
                    Ingen poster matcher filteret.
                  </td>
                </tr>
              </tbody>
            ) : (
              grouped.map((g) => {
                const open = isExpanded(g.group);
                const interactive = !hasActiveFilters;
                return (
                  <tbody key={g.group} className="border-b border-neutral-100 last:border-b-0">
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
                      <td className="hidden px-4 py-2.5 sm:table-cell" />
                      <td className="hidden px-4 py-2.5 sm:table-cell" />
                      <td className="px-3 py-2.5 text-right sm:px-4">
                        <div className="tabnum font-mono text-sm font-semibold text-neutral-900">
                          {formatAmount(g.total)} kr
                        </div>
                      </td>
                      <td className="px-2 py-2.5 sm:px-4" />
                    </tr>

                    {open &&
                      g.items.map((r) => (
                        <tr key={r.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                          <td className="px-3 py-2 pl-8 sm:px-4 sm:pl-12">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-neutral-900">
                                {r.description}
                              </span>
                              {r.recurrence !== 'once' && (
                                <span
                                  className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500"
                                  title={`Gentages ${RECURRENCE_LABEL_DA[r.recurrence]}`}
                                >
                                  <Repeat className="h-2.5 w-2.5" />
                                  {RECURRENCE_LABEL_DA[r.recurrence]}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[11px] text-neutral-500">
                              {r.categoryName}
                            </div>
                            {/* På mobile vises dato+konto her som
                                metadata - kolonnerne er hidden under sm */}
                            <div className="mt-0.5 truncate text-[11px] text-neutral-400 sm:hidden">
                              {formatShortDateDA(r.occursOn)} · {r.accountName}
                            </div>
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-2 text-xs text-neutral-600 sm:table-cell">
                            {formatShortDateDA(r.occursOn)}
                          </td>
                          <td className="hidden px-4 py-2 text-neutral-900 sm:table-cell">
                            {r.accountName}
                          </td>
                          <td className="px-3 py-2 text-right sm:px-4">
                            <div className="tabnum font-mono text-sm font-medium text-neutral-900">
                              {formatAmount(r.amount)} kr
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-right sm:px-4">
                            <div className="inline-flex items-center gap-1">
                              <Link
                                href={`/poster/${r.id}`}
                                aria-label="Rediger"
                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
                              >
                                <Pencil className="h-3 w-3" />
                                <span className="hidden sm:inline">Rediger</span>
                              </Link>
                              <form action={deleteTransaction}>
                                <input type="hidden" name="id" value={r.id} />
                                <button
                                  type="submit"
                                  aria-label="Slet"
                                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span className="hidden sm:inline">Slet</span>
                                </button>
                              </form>
                            </div>
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
                  <td className="px-4 py-2.5 text-xs font-medium text-neutral-600">
                    {totalCount} {totalCount === 1 ? 'post' : 'poster'} i alt
                  </td>
                  {/* Tomme celler matcher de hidden-on-mobile kolonner
                      så Beløb lander i højre kolonne uanset viewport */}
                  <td className="hidden px-4 py-2.5 sm:table-cell" />
                  <td className="hidden px-4 py-2.5 sm:table-cell" />
                  <td className="px-4 py-2.5 text-right">
                    <div className="tabnum font-mono text-sm font-semibold text-neutral-900">
                      {formatAmount(totalAmount)} kr
                    </div>
                  </td>
                  <td className="px-4 py-2.5" />
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
  hideOnMobile = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  indicator: string;
  align?: 'left' | 'right';
  hideOnMobile?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 ${align === 'right' ? 'text-right' : 'text-left'} ${
        hideOnMobile ? 'hidden sm:table-cell' : ''
      }`}
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
