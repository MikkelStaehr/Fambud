// 50/30/20-budgetmodel for den indloggede brugers økonomi. Viser de tre
// buckets (nødvendigt / forbrug / opsparing) som andel af nettoindkomsten,
// med målet (50/30/20) markeret, en GENNEMSIGTIG liste over hvad der tæller
// hvor, og et enkelt tip baseret på den største afvigelse.

import { formatAmount } from '@/lib/format';
import type { FiftyThirtyTwenty } from '@/lib/economy-plan';

const IDEAL = { needs: 50, wants: 30, savings: 20 };

function tipFor(ftt: FiftyThirtyTwenty): string {
  if (ftt.savingsPct < 15) {
    return 'Du sparer under 20% op. Se om noget kan flyttes fra forbrug til opsparing - det er her 50/30/20 giver mest.';
  }
  if (ftt.wantsPct > 35) {
    return 'Dit forbrug ligger over 30%. Det er typisk her det er lettest at justere hvis du vil spare mere op.';
  }
  if (ftt.needsPct > 60) {
    return 'Dine faste fornødenheder fylder meget. Svært at ændre på kort sigt, men hold øje med de store poster (bolig, transport, lån).';
  }
  return 'Din fordeling ligger tæt på 50/30/20 - flot balance mellem nødvendigt, forbrug og opsparing.';
}

function Bar({
  pct,
  ideal,
  color,
}: {
  pct: number;
  ideal: number;
  color: string;
}) {
  return (
    <div className="relative h-2 w-full rounded-full bg-neutral-100">
      <div
        className="h-2 rounded-full"
        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
      />
      {/* Mål-markør */}
      <div
        className="absolute -top-0.5 h-3 w-0.5 bg-neutral-500"
        style={{ left: `${ideal}%` }}
        title={`Mål ${ideal}%`}
      />
    </div>
  );
}

export function FiftyThirtyTwentySection({ ftt }: { ftt: FiftyThirtyTwenty }) {
  if (ftt.income <= 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-4 py-6 text-sm text-neutral-500">
        Registrér din indkomst, så kan jeg vise hvordan din økonomi fordeler sig
        ift. 50/30/20.
      </div>
    );
  }

  const rows = [
    {
      key: 'needs',
      label: 'Nødvendigt',
      amount: ftt.needs,
      pct: ftt.needsPct,
      ideal: IDEAL.needs,
      color: '#8B8C6E', // olive-muted
    },
    {
      key: 'wants',
      label: 'Forbrug',
      amount: ftt.wants,
      pct: ftt.wantsPct,
      ideal: IDEAL.wants,
      color: '#E8C97A', // sandy amber
    },
    {
      key: 'savings',
      label: 'Opsparing',
      amount: ftt.savings,
      pct: ftt.savingsPct,
      ideal: IDEAL.savings,
      color: '#5F6244', // olive
    },
  ];

  return (
    <div className="rounded-lg border border-emerald-200 bg-white">
      <div className="border-b border-emerald-100 bg-emerald-50/60 px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Din nettoindkomst
        </div>
        <div className="tabnum mt-0.5 font-mono text-xl font-semibold text-neutral-900">
          {formatAmount(ftt.income)} kr/md
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-neutral-900">{r.label}</span>
              <span className="tabnum font-mono text-neutral-700">
                {formatAmount(r.amount)} kr
                <span className="ml-2 font-semibold text-neutral-900">
                  {r.pct}%
                </span>
                <span className="ml-1.5 text-xs text-neutral-400">
                  mål {r.ideal}%
                </span>
              </span>
            </div>
            <Bar pct={r.pct} ideal={r.ideal} color={r.color} />
          </div>
        ))}
      </div>

      {/* Gennemsigtig klassificering */}
      <div className="border-t border-neutral-100 px-4 py-3 text-xs leading-relaxed text-neutral-500">
        <span className="font-medium text-neutral-700">Sådan er det talt:</span>{' '}
        Nødvendigt ={' '}
        {ftt.needsGroups.length > 0 ? ftt.needsGroups.join(', ') : '–'}. Forbrug
        = {ftt.wantsGroups.length > 0 ? ftt.wantsGroups.join(', ') : '–'}.
        Opsparing = resten af din indkomst. Passer mappingen ikke, kan en
        kategori flyttes ved at omdøbe den.
      </div>

      <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
        <span className="font-medium text-neutral-900">Tip:</span> {tipFor(ftt)}
      </div>
    </div>
  );
}
