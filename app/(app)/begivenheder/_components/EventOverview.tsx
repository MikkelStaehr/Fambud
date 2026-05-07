// Read-only overblik øverst på begivenhedens detalje-side. Giver
// brugeren et hurtigt billede af status, tid og pengestrøm FØR de
// scroller ned i edit-formularen.
//
// Post-migration 0059: vi tracker IKKE saldo længere. Fremdrift måles
// via om der er opsat månedlige overførsler tied til event'et og om
// summen af dem dækker det krævede månedlige beløb.

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  Wallet,
} from 'lucide-react';
import {
  formatAmount,
  formatShortDateDA,
  LIFE_EVENT_TIMEFRAME_LABEL_DA,
  type LifeEventAlert,
} from '@/lib/format';
import { ACCOUNT_KIND_LABEL_DA } from '@/lib/format';
import type { LifeEventWithItems } from '@/lib/dal';

type Props = {
  event: LifeEventWithItems;
  totalBudget: number | null;
  monthsRemaining: number | null;
  monthlyTarget: number | null;
  alert: LifeEventAlert | null;
  // Pre-fill href til /overforsler/ny med life_event_id + krævet beløb,
  // så CTA'en på no_active_transfer-alerten er ét klik væk fra at
  // oprette overførslen.
  setupTransferHref: string;
};

export function EventOverview({
  event,
  totalBudget,
  monthsRemaining,
  monthlyTarget,
  alert,
  setupTransferHref,
}: Props) {
  // Aggreger transfer-info: hvis alle transfers peger på samme to_account,
  // vis det som "Tilknyttet X". Hvis flere konti, vis "fordelt på N konti".
  const targetAccounts = new Map<
    string,
    { name: string; kind: typeof event.transfers[number]['to_account_kind'] }
  >();
  for (const tr of event.transfers) {
    if (!targetAccounts.has(tr.to_account_id)) {
      targetAccounts.set(tr.to_account_id, {
        name: tr.to_account_name,
        kind: tr.to_account_kind,
      });
    }
  }
  const targetAccountList = [...targetAccounts.values()];

  return (
    <section className="mt-6 rounded-md border border-neutral-200 bg-white p-5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Overblik
      </h2>

      {/* Stat-grid */}
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-neutral-500">Deadline</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1 font-medium text-neutral-900">
            {event.target_date ? (
              <>
                <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                {formatShortDateDA(event.target_date)}
              </>
            ) : event.timeframe ? (
              LIFE_EVENT_TIMEFRAME_LABEL_DA[event.timeframe]
            ) : (
              <span className="text-neutral-400">Ikke sat</span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-neutral-500">Måneder tilbage</dt>
          <dd className="mt-0.5 inline-flex items-center gap-1 font-mono tabnum text-base font-semibold text-neutral-900">
            <Clock className="h-3.5 w-3.5 text-neutral-400" />
            {monthsRemaining != null ? monthsRemaining : '–'}
          </dd>
        </div>

        <div>
          <dt className="text-xs text-neutral-500">Totalbudget</dt>
          <dd className="mt-0.5 font-mono tabnum font-semibold text-neutral-900">
            {totalBudget != null ? `${formatAmount(totalBudget)} kr` : '–'}
          </dd>
          {event.use_items_for_budget && (
            <dd className="text-[11px] text-neutral-500">
              Sum af {event.items.length}{' '}
              {event.items.length === 1 ? 'post' : 'poster'}
            </dd>
          )}
        </div>

        <div>
          <dt className="text-xs text-neutral-500">Krævet pr. måned</dt>
          <dd className="mt-0.5 font-mono tabnum font-semibold text-neutral-900">
            {monthlyTarget != null ? `${formatAmount(monthlyTarget)} kr` : '–'}
          </dd>
          {monthlyTarget == null && (
            <dd className="text-[11px] text-neutral-500">
              Mangler budget eller deadline
            </dd>
          )}
        </div>
      </dl>

      {/* Aktuel månedlig opsparing - kun når der er transfers */}
      {event.transfers.length > 0 && (
        <div className="mt-4 rounded-md bg-stone-50 px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-500">Aktuel pr. måned</span>
            <span className="font-mono tabnum font-semibold text-neutral-900">
              {formatAmount(event.monthlyTotal)} kr
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Sum af {event.transfers.length}{' '}
            {event.transfers.length === 1
              ? 'månedlig overførsel'
              : 'månedlige overførsler'}
          </p>
        </div>
      )}

      {/* Tilknyttet(e) konto(er) */}
      {targetAccountList.length > 0 && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-stone-50 px-3 py-2 text-sm text-neutral-700">
          <Wallet className="h-3.5 w-3.5 text-neutral-400" />
          <span>
            {targetAccountList.length === 1 ? (
              <>
                Tilknyttet{' '}
                <strong className="font-medium text-neutral-900">
                  {targetAccountList[0]!.name}
                </strong>{' '}
                <span className="text-neutral-500">
                  ({ACCOUNT_KIND_LABEL_DA[targetAccountList[0]!.kind]})
                </span>
              </>
            ) : (
              <>
                Fordelt på{' '}
                <strong className="font-medium text-neutral-900">
                  {targetAccountList.length} konti
                </strong>
              </>
            )}
          </span>
        </div>
      )}

      {/* Alert-banner: agentens advarsel hvis den gælder */}
      {alert && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">
            {alert.kind === 'no_budget' && (
              <>
                <strong className="font-semibold">Mangler budget.</strong> Sæt
                et totalbudget for at vi kan beregne en månedlig
                opsparingsrate.
              </>
            )}
            {alert.kind === 'no_active_transfer' && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <strong className="font-semibold">
                    Ingen overførsel opsat endnu.
                  </strong>{' '}
                  Begivenheden står som idé indtil I opretter en månedlig
                  overførsel
                  {alert.required != null && (
                    <>
                      {' '}
                      på cirka{' '}
                      <strong className="font-semibold">
                        {formatAmount(alert.required)} kr/md
                      </strong>
                    </>
                  )}
                  .
                </span>
                <Link
                  href={setupTransferHref}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-800 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-900"
                >
                  Opsæt overførsel
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
            {alert.kind === 'underfunded' && (
              <>
                <strong className="font-semibold">
                  Sparer for lidt op til at nå målet.
                </strong>{' '}
                Aktuelt {formatAmount(alert.actual)} kr/md, men målet kræver{' '}
                {formatAmount(alert.required)} kr/md. Forskel:{' '}
                <strong className="font-semibold">
                  {formatAmount(alert.required - alert.actual)} kr/md
                </strong>
                .
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
