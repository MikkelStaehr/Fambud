'use client';

// Handlinger på et begivenheds-kort i listen:
//   • Ingen overførsel  → "Opret overførsel" (prefilled /overforsler/ny)
//   • Har overførsel     → "Redigér overførsel" + "Stop overførsel"
//   • Altid              → "Slet begivenhed" med inline bekræftelse, der
//                          spørger om den tilknyttede overførsel også skal
//                          stoppes (kun hvis der findes en).
//
// Slet-bekræftelsen er den eneste interaktive del, derfor 'use client'.
// "Stop også overførsel"-valget er en native checkbox (name=stop_transfers,
// value=1) - den sender kun værdien når den er tjekket, så vi slipper for
// controlled state.

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Ban, Trash2 } from 'lucide-react';
import { formatAmount } from '@/lib/format';
import { deleteLifeEvent, stopEventTransfer } from '../actions';

type Props = {
  eventId: string;
  eventName: string;
  transferCount: number;
  firstTransferId: string | null;
  monthlyTotal: number;
  createTransferHref: string;
};

const btnBase =
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition';

export function EventCardActions({
  eventId,
  eventName,
  transferCount,
  firstTransferId,
  monthlyTotal,
  createTransferHref,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const hasTransfer = transferCount > 0;

  if (confirming) {
    return (
      <form
        action={deleteLifeEvent}
        className="mt-3 rounded-md border border-red-200 bg-red-50/50 px-3 py-2.5"
      >
        <input type="hidden" name="id" value={eventId} />
        <p className="text-xs text-neutral-700">
          Slet{' '}
          <span className="font-semibold text-neutral-900">{eventName}</span>?
          Det kan ikke fortrydes.
        </p>
        {hasTransfer && (
          <label className="mt-2 flex items-start gap-2 text-xs text-neutral-700">
            <input
              type="checkbox"
              name="stop_transfers"
              value="1"
              className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300"
            />
            <span>
              Stop også den månedlige overførsel
              {monthlyTotal > 0 && (
                <span className="tabnum font-mono"> ({formatAmount(monthlyTotal)} kr/md)</span>
              )}
              . Ellers fortsætter den som almindelig opsparing.
            </span>
          </label>
        )}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="submit"
            className={`${btnBase} bg-red-700 text-white hover:bg-red-800`}
          >
            <Trash2 className="h-3 w-3" />
            Slet begivenhed
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className={`${btnBase} text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900`}
          >
            Annullér
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
      {hasTransfer ? (
        <>
          {firstTransferId && (
            <Link
              href={`/overforsler/${firstTransferId}`}
              className={`${btnBase} border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900`}
            >
              <Pencil className="h-3 w-3" />
              Redigér overførsel
            </Link>
          )}
          <form action={stopEventTransfer}>
            <input type="hidden" name="event_id" value={eventId} />
            <button
              type="submit"
              className={`${btnBase} border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900`}
            >
              <Ban className="h-3 w-3" />
              Stop overførsel
            </button>
          </form>
        </>
      ) : (
        <Link
          href={createTransferHref}
          className={`${btnBase} bg-emerald-700 text-white hover:bg-emerald-800`}
        >
          <Plus className="h-3 w-3" />
          Opret overførsel
        </Link>
      )}

      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${btnBase} ml-auto text-neutral-500 hover:bg-red-50 hover:text-red-700`}
      >
        <Trash2 className="h-3 w-3" />
        Slet begivenhed
      </button>
    </div>
  );
}
