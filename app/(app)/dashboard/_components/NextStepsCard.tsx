// "Næste skridt"-kort der vises NÅR onboarding-checklisten er færdig - så
// brugeren ikke falder af kanten med et "nu hvad?". Modsat checklisten, som
// dækker det fundamentale, peger dette på det der gør appen rig: rådgiveren,
// begivenheder og at få partneren med.
//
// Auto-skjuler sig: kortet vises kun når der faktisk ER et konkret næste
// skridt (ingen begivenheder endnu, eller en partner der mangler at signe
// op). Når de ting er på plads, forsvinder det af sig selv - ingen permanent
// dashboard-støj, ingen dismiss-knap nødvendig. Synligheds-gaten ligger i
// page.tsx; her antager vi at kortet skal vises.

import Link from 'next/link';
import { ArrowRight, Sparkles, CalendarPlus, UserPlus } from 'lucide-react';

type NextStep = {
  icon: typeof Sparkles;
  label: string;
  description: string;
  href: string;
};

type Props = {
  hasEvents: boolean;
  pendingMemberNames: string[];
};

export function NextStepsCard({ hasEvents, pendingMemberNames }: Props) {
  const steps: NextStep[] = [];

  // Rådgiveren er appens stærkeste feature, men gemmer sig i Værktøjer -
  // peg på den her, så den bliver opdaget.
  steps.push({
    icon: Sparkles,
    label: 'Få råd om jeres opsætning',
    description:
      'Rådgiveren foreslår hvordan I fordeler fælles udgifter, bygger buffer op og optimerer afdrag.',
    href: '/raadgiver',
  });

  if (!hasEvents) {
    steps.push({
      icon: CalendarPlus,
      label: 'Planlæg en begivenhed',
      description:
        'Rejse, bryllup, konfirmation, boligkøb - sæt budget og deadline, så hjælper vi med at spare op.',
      href: '/begivenheder/ny',
    });
  }

  if (pendingMemberNames.length > 0) {
    const names = pendingMemberNames.join(', ');
    steps.push({
      icon: UserPlus,
      label: `Få ${names} med`,
      description:
        'De er pre-godkendt men mangler at oprette deres bruger. Del invitationen fra Indstillinger.',
      href: '/indstillinger',
    });
  }

  return (
    <section className="mt-6 rounded-md border border-emerald-200 bg-emerald-50/50 p-4">
      <h2 className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-emerald-900">
        <Sparkles className="h-3 w-3" />
        Godt i gang - næste skridt
      </h2>
      <p className="mb-3 text-xs text-emerald-800">
        Jeres grundopsætning er på plads. Her er et par ting der gør mest ud af
        FamBud.
      </p>

      <ul className="space-y-2">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.href}
              className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white p-3"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Icon className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-neutral-900">
                  {s.label}
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {s.description}
                </p>
              </div>
              <Link
                href={s.href}
                className="inline-flex shrink-0 items-center gap-1 self-center rounded-md bg-emerald-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-800"
              >
                Åbn
                <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
