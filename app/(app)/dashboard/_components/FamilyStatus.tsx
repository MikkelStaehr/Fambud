// "Familie-status"-sektion på dashboardet — viser om de andre voksne i
// husstanden har sat deres del op (lønkonto, indkomst, overførsler).
// Den indloggede bruger har sin egen OnboardingChecklist længere oppe så
// vi ekskluderer dem fra listen.
//
// Komponenten skjuler sig selv når der enten ikke er nogen andre voksne,
// eller når alle de andre er fuldt sat op — så er den irrelevant og
// dashboardet skal bruge pladsen til andet.

import Link from 'next/link';
import { Check, Circle, Mail, Users } from 'lucide-react';
import type { MemberOnboardingStatus } from '@/lib/dal';

type Props = {
  members: MemberOnboardingStatus[];
};

type Status = {
  label: string;
  hint: string | null;
  tone: 'pending' | 'partial' | 'done';
};

function statusFor(m: MemberOnboardingStatus): Status {
  if (!m.hasLogin) {
    return {
      label: 'Afventer signup',
      hint: 'Del invitations-linket fra Indstillinger så de kan logge ind',
      tone: 'pending',
    };
  }
  if (!m.hasOwnCheckingAccount) {
    return {
      label: 'Mangler lønkonto',
      hint: 'De skal igennem deres egen wizard for at oprette den',
      tone: 'partial',
    };
  }
  if (m.paycheckCount === 0) {
    return {
      label: 'Mangler indkomst',
      hint: 'Forecast venter på første registrerede lønudbetaling',
      tone: 'partial',
    };
  }
  if (m.paycheckCount < 3) {
    return {
      label: `${m.paycheckCount}/3 lønudbetalinger`,
      hint: `${3 - m.paycheckCount} mere giver et præcist månedligt forecast`,
      tone: 'partial',
    };
  }
  if (!m.hasRecurringTransfersOut) {
    return {
      label: 'Mangler overførsler',
      hint: 'De har indkomst men sender intet til fælles-konti endnu',
      tone: 'partial',
    };
  }
  return { label: 'Klar', hint: null, tone: 'done' };
}

export function FamilyStatus({ members }: Props) {
  if (members.length === 0) return null;
  // Skjul hele sektionen hvis alle de andre er klar — så er der intet at
  // handle på.
  if (members.every((m) => statusFor(m).tone === 'done')) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
        <Users className="h-3 w-3" />
        Familie-status
      </h2>
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        {members.map((m) => {
          const s = statusFor(m);
          const toneClasses =
            s.tone === 'done'
              ? 'bg-emerald-50 text-emerald-800'
              : s.tone === 'pending'
                ? 'bg-amber-50 text-amber-800'
                : 'bg-neutral-100 text-neutral-700';
          return (
            <div
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3 text-sm last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                    {s.tone === 'done' ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : s.tone === 'pending' ? (
                      <Mail className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                  </span>
                  <span className="font-medium text-neutral-900">{m.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${toneClasses}`}
                  >
                    {s.label}
                  </span>
                </div>
                {s.hint && (
                  <div className="mt-0.5 ml-8 text-xs text-neutral-500">
                    {s.hint}
                  </div>
                )}
              </div>
              {s.tone === 'pending' && (
                <Link
                  href="/indstillinger"
                  className="shrink-0 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  Se invitation
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
