// Formaterer en audit_log-række som læsbar prose for husstands-aktivitets-
// siden. Hver action-type får sin egen tekst-builder + ikon. Råt metadata
// kan slås op via "vis detaljer" hvis brugeren vil se hele diff'en.
//
// Tekst-builderne er bevidst defensive: hvis metadata.changes eller
// snapshot mangler nøgler, viser vi en mere generisk beskrivelse.
// Triggers kan ændres senere uden at brække visningen.

'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CreditCard,
  Edit3,
  Landmark,
  Receipt,
  Trash2,
  UserPlus,
  UserMinus,
  UserCog,
  Mail,
  Handshake,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import { formatAmount } from '@/lib/format';
import type { ActivityRow as ActivityRowType } from '@/lib/dal/activity';

const RELATIVE_THRESHOLD_DAYS = 7;

function formatRelativeOrDate(iso: string): string {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 1) return 'lige nu';
  if (diffMin < 60) return `${diffMin} min siden`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'time' : 'timer'} siden`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < RELATIVE_THRESHOLD_DAYS) {
    return `${diffDays} ${diffDays === 1 ? 'dag' : 'dage'} siden`;
  }
  return then.toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function actorLabel(row: ActivityRowType): string {
  // Proxy-tilfælde: en bruger handler PÅ VEGNE AF en anden. Visningen
  // skal være "X (på vegne af Y)" så den læsende kan se delegationen.
  if (row.acting_user_id && row.acting_user_id !== row.user_id) {
    const actor = row.acting_user_name ?? 'En bruger';
    const subject = row.user_name ?? 'et familiemedlem';
    return `${actor} på vegne af ${subject}`;
  }
  return row.user_name ?? 'En bruger';
}

type Change = { before: unknown; after: unknown };
type ChangesMap = Record<string, Change>;

function readChanges(metadata: unknown): ChangesMap {
  if (!metadata || typeof metadata !== 'object') return {};
  const m = metadata as Record<string, unknown>;
  if (!m.changes || typeof m.changes !== 'object') return {};
  return m.changes as ChangesMap;
}

function readSnapshot(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};
  const m = metadata as Record<string, unknown>;
  if (!m.snapshot || typeof m.snapshot !== 'object') return {};
  return m.snapshot as Record<string, unknown>;
}

function readKind(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, unknown>;
  return typeof m.kind === 'string' ? m.kind : null;
}

function describe(row: ActivityRowType): { icon: React.ReactNode; text: React.ReactNode } {
  const actor = actorLabel(row);
  const changes = readChanges(row.metadata);
  const snapshot = readSnapshot(row.metadata);

  switch (row.action) {
    case 'transaction.updated': {
      const changedKeys = Object.keys(changes);
      const summary =
        changes.amount && typeof changes.amount.before === 'number' && typeof changes.amount.after === 'number'
          ? `beløb fra ${formatAmount(changes.amount.before)} kr til ${formatAmount(changes.amount.after)} kr`
          : changedKeys.length === 1
            ? `${changedKeys[0]}`
            : `${changedKeys.length} felter`;
      return {
        icon: <Edit3 className="h-3.5 w-3.5 text-neutral-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            ændrede {summary} på en transaktion
          </>
        ),
      };
    }
    case 'transaction.deleted': {
      const amount = snapshot.amount;
      const desc = snapshot.description;
      return {
        icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            slettede en transaktion
            {typeof amount === 'number' && (
              <>
                {' '}på <span className="tabnum font-mono">{formatAmount(amount)} kr</span>
              </>
            )}
            {typeof desc === 'string' && desc.length > 0 && (
              <> &ldquo;{desc}&rdquo;</>
            )}
          </>
        ),
      };
    }
    case 'account.updated': {
      const kind = readKind(row.metadata);
      const changedKeys = Object.keys(changes);
      const summary =
        changes.name && typeof changes.name.before === 'string' && typeof changes.name.after === 'string'
          ? `navn fra "${changes.name.before}" til "${changes.name.after}"`
          : changes.archived
            ? changes.archived.after
              ? 'arkivering'
              : 'gen-aktivering'
            : changedKeys.length === 1
              ? changedKeys[0]
              : `${changedKeys.length} felter`;
      return {
        icon: <Receipt className="h-3.5 w-3.5 text-neutral-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            ændrede {summary} på en {kind ?? 'konto'}
          </>
        ),
      };
    }
    case 'account.deleted': {
      const kind = readKind(row.metadata);
      const name = snapshot.name;
      return {
        icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            slettede {kind ?? 'kontoen'}
            {typeof name === 'string' && (
              <> &ldquo;{name}&rdquo;</>
            )}
          </>
        ),
      };
    }
    case 'loan.updated': {
      const changedKeys = Object.keys(changes);
      const summary =
        changes.interest_rate &&
        typeof changes.interest_rate.before === 'number' &&
        typeof changes.interest_rate.after === 'number'
          ? `rente fra ${changes.interest_rate.before}% til ${changes.interest_rate.after}%`
          : changes.opening_balance &&
              typeof changes.opening_balance.before === 'number' &&
              typeof changes.opening_balance.after === 'number'
            ? `restgæld fra ${formatAmount(Math.abs(changes.opening_balance.before as number))} kr til ${formatAmount(Math.abs(changes.opening_balance.after as number))} kr`
            : changes.payment_amount
              ? 'ydelse'
              : changedKeys.length === 1
                ? changedKeys[0]
                : `${changedKeys.length} felter`;
      return {
        icon: <Landmark className="h-3.5 w-3.5 text-amber-700" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            ændrede {summary} på et lån
          </>
        ),
      };
    }
    case 'loan.deleted': {
      const name = snapshot.name;
      const restgaeld = snapshot.opening_balance;
      return {
        icon: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            slettede lånet
            {typeof name === 'string' && (
              <> &ldquo;{name}&rdquo;</>
            )}
            {typeof restgaeld === 'number' && (
              <>
                {' '}(restgæld <span className="tabnum font-mono">{formatAmount(Math.abs(restgaeld))} kr</span>)
              </>
            )}
          </>
        ),
      };
    }
    case 'member.added':
      return {
        icon: <UserPlus className="h-3.5 w-3.5 text-emerald-700" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            tilføjede et familiemedlem
          </>
        ),
      };
    case 'member.removed':
      return {
        icon: <UserMinus className="h-3.5 w-3.5 text-red-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            fjernede et familiemedlem
          </>
        ),
      };
    case 'member.role_changed':
      return {
        icon: <UserCog className="h-3.5 w-3.5 text-neutral-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            ændrede rolle på et familiemedlem
          </>
        ),
      };
    case 'invite.created':
      return {
        icon: <Mail className="h-3.5 w-3.5 text-neutral-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            oprettede en invitation
          </>
        ),
      };
    case 'invite.redeemed':
      return {
        icon: <UserPlus className="h-3.5 w-3.5 text-emerald-700" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            tilsluttede sig husstanden via invitation
          </>
        ),
      };
    case 'proxy.requested':
      return {
        icon: <Handshake className="h-3.5 w-3.5 text-neutral-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            anmodede om hjælper-adgang
          </>
        ),
      };
    case 'proxy.accepted':
      return {
        icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            accepterede hjælper-adgang
          </>
        ),
      };
    case 'proxy.rejected':
      return {
        icon: <ShieldX className="h-3.5 w-3.5 text-red-500" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            afviste hjælper-adgang
          </>
        ),
      };
    case 'proxy.revoked':
      return {
        icon: <ShieldX className="h-3.5 w-3.5 text-amber-700" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            tilbagekaldte hjælper-adgang
          </>
        ),
      };
    case 'proxy.activated':
      return {
        icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            startede en hjælper-session
          </>
        ),
      };
    case 'proxy.resource_created': {
      const m = row.metadata as Record<string, unknown>;
      const resourceType =
        typeof m.resource_type === 'string' ? m.resource_type : 'en ressource';
      return {
        icon: <CreditCard className="h-3.5 w-3.5 text-emerald-700" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            oprettede {resourceType} (via hjælper-adgang)
          </>
        ),
      };
    }
    default:
      // Fallback for evt. nye action-typer der ikke endnu har en pæn
      // formattering. Bedre at vise rå end at skjule events.
      return {
        icon: <Edit3 className="h-3.5 w-3.5 text-neutral-400" />,
        text: (
          <>
            <strong className="font-medium text-neutral-900">{actor}</strong>{' '}
            udførte handlingen <code className="text-xs">{row.action}</code>
          </>
        ),
      };
  }
}

export function ActivityRow({ row }: { row: ActivityRowType }) {
  const [showDetails, setShowDetails] = useState(false);
  const { icon, text } = describe(row);
  const hasMetadata =
    row.metadata &&
    typeof row.metadata === 'object' &&
    Object.keys(row.metadata).length > 0;

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-1 shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-700">{text}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-neutral-500">
            <time dateTime={row.occurred_at} title={new Date(row.occurred_at).toLocaleString('da-DK')}>
              {formatRelativeOrDate(row.occurred_at)}
            </time>
            {hasMetadata && (
              <>
                <span className="text-neutral-300">·</span>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="inline-flex items-center gap-0.5 text-neutral-500 hover:text-neutral-900"
                >
                  {showDetails ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {showDetails ? 'Skjul detaljer' : 'Vis detaljer'}
                </button>
              </>
            )}
          </div>
          {showDetails && hasMetadata && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-neutral-50 px-3 py-2 text-[11px] text-neutral-700">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </li>
  );
}
