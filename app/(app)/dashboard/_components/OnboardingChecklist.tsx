// Post-wizard checkliste der viser brugeren hvilke fundamentale trin der
// mangler for at komme godt i gang. Erstatter den enkelt-CTA "Lad os fylde
// budgettet op" der kun spørgte om faste udgifter - efter wizard har
// brugeren mere end én ting at gøre, og ingen vej til at se hele billedet.
//
// Komponenten skjules helt når alle tre fundamentale trin er færdige. Det
// er en bevidst beslutning: post-wizard onboarding er IKKE permanent UI,
// brugeren skal komme videre til "rigtigt" dashboard-arbejde når tingene
// er på plads.

import Link from 'next/link';
import { ArrowRight, Check, Circle, Sparkles } from 'lucide-react';
import type { OnboardingProgress } from '@/lib/dal';
import { InfoTooltip } from '@/app/_components/InfoTooltip';

type Step = {
  done: boolean;
  label: string;
  description: string;
  cta: string;
  href: string;
};

type Props = {
  progress: OnboardingProgress;
};

export function OnboardingChecklist({ progress }: Props) {
  const steps: Step[] = [
    {
      done: progress.hasRecurringExpenses,
      label: 'Tilføj jeres faste udgifter',
      description:
        'Husleje, abonnementer, forsikringer - alle de regninger der kommer hver måned.',
      cta: progress.hasRecurringExpenses ? 'Se faste udgifter' : 'Kom i gang',
      href: '/faste-udgifter',
    },
    {
      done: progress.hasRecurringTransfers,
      label: 'Sæt månedlige overførsler op',
      description:
        'Hvor skal lønnen hen hver måned? Til budgetkonto, husholdning, opsparing.',
      cta: progress.hasRecurringTransfers ? 'Se overførsler' : 'Sæt op',
      href: progress.hasRecurringTransfers ? '/overforsler' : '/overforsler/ny',
    },
    {
      done: progress.hasBufferAccount,
      label: 'Opret bufferkonto',
      description:
        'Nødfond til jobtab, sygdom, akut reparation. Tommelfinger: 3 mdr af jeres faste udgifter.',
      cta: progress.hasBufferAccount ? 'Se buffer' : 'Opret',
      href: '/opsparinger/buffer',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;

  // Skjul checklisten helt når alle trin er færdige. Brugeren skal videre
  // til det rigtige dashboard-indhold uden gammel onboarding-UI i vejen.
  if (doneCount === totalCount) return null;

  return (
    <section
      data-tour="onboarding-checklist"
      className="mt-6 rounded-md border border-emerald-200 bg-emerald-50/50 p-4"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-emerald-900">
          <Sparkles className="h-3 w-3" />
          Kom godt i gang
          <InfoTooltip>
            Post-wizard checkliste over de fundamentale trin. Skjuler sig
            selv når alle tre er færdige - og kommer ikke tilbage. Det er
            en engangs-rejse, ikke permanent dashboard-støj.
          </InfoTooltip>
        </h2>
        <span className="tabnum font-mono text-xs text-emerald-800">
          {doneCount} af {totalCount} trin
        </span>
      </div>

      <ul className="space-y-2">
        {steps.map((s) => (
          <li
            key={s.label}
            className={`flex items-start gap-3 rounded-md border bg-white p-3 ${
              s.done ? 'border-emerald-100 opacity-70' : 'border-neutral-200'
            }`}
          >
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                s.done
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'border border-neutral-300 bg-white text-neutral-300'
              }`}
              aria-hidden
            >
              {s.done ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2 fill-current" />}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm font-medium ${
                  s.done ? 'text-neutral-500 line-through' : 'text-neutral-900'
                }`}
              >
                {s.label}
              </div>
              {!s.done && (
                <p className="mt-0.5 text-xs text-neutral-500">{s.description}</p>
              )}
            </div>
            {!s.done && (
              <Link
                href={s.href}
                className="inline-flex shrink-0 items-center gap-1 self-center rounded-md bg-emerald-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-800"
              >
                {s.cta}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
