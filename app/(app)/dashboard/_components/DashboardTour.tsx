'use client';

// Definerer dashboard-tour'ens steps. Selve auto-start- og persistence-
// logikken bor i den generiske PageTour-komponent som tager tourKey +
// steps + autoStart-flag.
//
// Steps refererer til [data-tour="..."]-attributter på dashboard-elementer.
// Hvis et element ikke er på siden lige nu (fx OnboardingChecklist
// forsvinder når alle trin er færdige), falder Tour tilbage til en
// centreret modal med samme indhold.

import { PageTour } from '@/app/(app)/_components/PageTour';
import type { TourStep } from '@/app/(app)/_components/Tour';

type Props = {
  ownerName: string | null;
  autoStart: boolean;
};

function buildSteps(ownerName: string | null): TourStep[] {
  const greeting = ownerName ? `Velkommen, ${ownerName}!` : 'Velkommen!';
  return [
    {
      title: greeting,
      content: (
        <>
          <p>
            Lad os tage en kort rundtur så du ved hvor tingene er. Det tager
            under et minut, og du kan altid springe over.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Tip: du kan genstarte rundturen senere i Indstillinger.
          </p>
        </>
      ),
    },
    {
      target: '[data-tour="onboarding-checklist"]',
      title: 'Dine næste skridt',
      content: (
        <>
          <p>
            Her ser du de 3 vigtigste ting at sætte op nu - faste udgifter,
            månedlige overførsler og bufferkonto.
          </p>
          <p className="mt-2">
            Klik på en knap for at gå direkte til den side hvor du gør
            arbejdet. Listen forsvinder helt når du er færdig.
          </p>
        </>
      ),
    },
    {
      target: '[data-tour="hero-status"]',
      title: 'Er du på rette spor?',
      content: (
        <>
          <p>
            Det her tal er husstandens netto pr. måned: indtægter minus
            udgifter. <strong>Grøn</strong> = overskud,{' '}
            <strong>rød</strong> = underskud.
          </p>
          <p className="mt-2">
            Hvis tallet er rødt, kan det være fordi en partner mangler at
            registrere sin løn - vi siger til.
          </p>
        </>
      ),
    },
    {
      target: '[data-tour="cashflow-warnings"]',
      title: 'Agenten advarer hvis noget ikke er dækket',
      content: (
        <>
          <p>
            Hvis nogen af jeres fælles-konti ikke har nok overførsler hver
            måned, fanger agenten det her - sammen med en knap der opretter
            den manglende overførsel for dig.
          </p>
        </>
      ),
    },
    {
      target: '[data-tour="cashflow-graph"]',
      title: 'Hvor flyder pengene?',
      content: (
        <>
          <p>
            Den her graf viser hvordan løn fordeles på private udgifter,
            fælles regninger og opsparing.
          </p>
          <p className="mt-2">
            Bredden af hvert bånd er proportional med beløbet - så du
            hurtigt ser hvor pengene faktisk hen.
          </p>
        </>
      ),
    },
    {
      target: '[data-tour="sidebar-tools"]',
      title: 'Værktøjer',
      content: (
        <>
          <p>
            I sidebaren under <strong>Værktøjer</strong> tilføjer du faste
            udgifter, planlægger dagligvarer og sætter opsparingsmål.
          </p>
          <p className="mt-2">
            Begynd med dem der står på checklisten - så bygger appen sig
            selv op rundt om jeres tal.
          </p>
        </>
      ),
    },
    {
      title: 'Du er klar!',
      content: (
        <>
          <p>
            Det er det! Klik på et punkt på checklisten for at komme i gang.
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Hvis du vil se rundturen igen, kan du genstarte den fra
            Indstillinger - Min profil.
          </p>
        </>
      ),
    },
  ];
}

export function DashboardTour({ ownerName, autoStart }: Props) {
  const steps = buildSteps(ownerName);
  return (
    <PageTour tourKey="dashboard" steps={steps} autoStart={autoStart} />
  );
}
