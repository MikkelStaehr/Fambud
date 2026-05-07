// Public landing page. Vises til ikke-loggede besøgende. Allerede-loggede
// brugere bouncer videre til dashboardet (samme rolle som proxy-redirect
// havde tidligere - vi gør det her så landing kan ses uden auth).
//
// Layout-system:
// - Type-scale: φ-baseret (1.6×) display-tier defineret i globals.css som
//   .text-display-lg/.text-display/.text-display-sm/.text-lead/.text-eyebrow.
//   Body bruger Tailwind's default skala. Display-tier bruger clamp() så
//   sizes skalerer fluid mellem mobile-floor og desktop-cap uden bp-spring.
// - Grid: hero bruger 1.618fr/1fr (gyldne snit) på lg+. Mobile er single-col.
// - Vertikal rytme: Fibonacci-derived padding (16/26/40/64/104/168 px) via
//   Tailwind's spacing-skala (py-4/-6.5/-10/-16/-26/-42 - 26 og 42 er
//   arbitrary values fordi Tailwind ikke har dem standard).
// - Mobile-first: alle klasser starter med mobile-værdier; sm:/lg: kun
//   hvor desktop-spec afviger fra fluid clamp().

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Home,
  LineChart,
  PiggyBank,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { HeroDemoMockup } from '@/app/_components/HeroDemoMockup';
import { DemoStripMockup } from '@/app/_components/DemoStripMockup';
import { HowItWorksSteps } from '@/app/_components/HowItWorksSteps';
import { LandingFlowModalTrigger } from '@/app/_components/landing-flow/LandingFlowModalTrigger';

const FAMBUD_FONT = 'var(--font-zt-nature), system-ui, sans-serif';

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-stone-50">
      <TopNav />
      <Hero />
      <Features />
      <DemoStrip />
      <HowItWorksSteps />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-stone-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <Link
          href="/"
          aria-label="Fambud forsiden"
          className="text-lg tracking-tight text-neutral-900 sm:text-xl"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Fambud
        </Link>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Link
            href="/login"
            className="rounded-md px-2.5 py-1.5 text-sm font-medium text-neutral-700 transition hover:text-neutral-900 sm:px-3"
          >
            Log ind
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Kom i gang
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    // Vertikal padding: Fibonacci-baseret. 64px (py-16) mobile bund, 104px
    // (py-26 = 6.5rem) desktop. Top er let trimmet (py-12/py-20) så det
    // ikke føles air-heavy på små skærme hvor sticky-nav allerede tager 56px.
    <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-20 lg:px-8 lg:pt-24 lg:pb-[6.5rem]">
      {/* Grid: 1.618fr/1fr på lg+ er det gyldne snit. Tekst får 61.8% af
          bredden, mockup 38.2%. Gap 64px (gap-16 = 4rem) på lg matcher
          Fibonacci-skridt. */}
      <div className="grid gap-10 sm:gap-14 lg:grid-cols-[1.618fr_1fr] lg:items-center lg:gap-16">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-eyebrow text-emerald-900">
            <Sparkles className="h-3 w-3" />
            Økonomisk planlægning for almindelige mennesker
          </p>
          <h1
            className="mt-5 text-display-lg text-neutral-900"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Se hvor pengene løber hen, før de gør det
          </h1>
          <p className="mt-5 max-w-[34rem] text-lead text-neutral-600">
            Fambud hjælper dig med at sætte din økonomi i system. Du fortæller
            os hvad der kommer ind, hvad der går ud, og hvad du gerne vil
            spare op. Vi viser dig hvordan månederne kommer til at se ud, og
            hvor du kan justere, før overraskelserne indtræffer.
          </p>
          {/* CTA-hierarki:
              1. Primær: "Find ud af hvor I står" (trigger til flow-modal,
                 emerald-800 fyldt, lidt større padding/text)
              2. Sekundær: "Kom i gang gratis" (emerald outline)
              3. Tertiær: "Log ind" (neutral outline)
              Flowet er primær path - brugere skal kunne se deres tal FØR
              de forpligter sig til signup. På mobile stacker buttons
              vertikalt; på sm+ side-by-side med wrap hvis trangt. */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <LandingFlowModalTrigger />
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-800 bg-white px-5 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 sm:w-auto"
            >
              Kom i gang gratis
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-md border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 sm:w-auto"
            >
              Log ind
            </Link>
          </div>
          {/* Trust-row: 2-kolonne grid på mobile (max 4 items i 2x2), inline
              på sm+. Det undgår at items wrapper i en single column på
              375px-skærme der ser tomt ud. */}
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-neutral-500 sm:flex sm:flex-wrap sm:gap-x-4 sm:gap-y-1.5">
            <span className="inline-flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-700" />
              19 kr/md
            </span>
            <span className="inline-flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-700" />
              Dine data bliver i EU
            </span>
            <span className="inline-flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-700" />
              Uafhængig af banker
            </span>
            <span className="inline-flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-700" />
              GDPR-compliant
            </span>
          </div>
        </div>

        <HeroDemoMockup />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="border-y border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-[6.5rem]">
        {/* Centeret intro-blok. Max-width 42rem (672px) holder lead-tekst
            i ~60-75 chars per line på alle viewports - læsbarheds-optimum. */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-eyebrow text-emerald-800">Hvorfor Fambud</p>
          <h2
            className="mt-3 text-display text-neutral-900"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Lavet til hverdagen, ikke regnearket
          </h2>
          <p className="mt-5 text-lead text-neutral-600">
            De fleste banker antager at økonomi er simpelt. Det er det
            sjældent. Fambud er bygget til at håndtere det rigtige billede
            med fælles og private udgifter, forskellige indkomster,
            opsparinger med formål, og alt det der ikke passer ind i en
            standard-skabelon.
          </p>
        </div>

        {/* Feature-grid: 1 kol mobile, 2 kol sm (640px+), 3 kol lg (1024px+).
            Gap 24px (gap-6 = 1.5rem) er sweet-spot mellem cards der føles
            relaterede men separate. */}
        <div className="mt-12 grid gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="Til dig, og dem du deler med"
            body="Bor du alene, holder Fambud styr på dine indtægter, udgifter og opsparing. Bor du sammen med nogen, holder den styr på hvem der bidrager med hvad til de fælles udgifter, og hvad der er jeres eget. Inviter din partner med ét klik når det giver mening."
          />
          <FeatureCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Forecast der ved hvad du tjener"
            body="De fleste apps får dig til at gætte din indkomst. Fambud bruger dine sidste tre lønudbetalinger og fanger overtid, ferietillæg og bonus automatisk. Du indtaster ikke månedlige skøn, vi regner det ud fra det der faktisk er kommet ind."
          />
          <FeatureCard
            icon={<PiggyBank className="h-5 w-5" />}
            title="Opsparing med formål, og i system"
            body="En bufferfond på 3-6 måneders faste udgifter. En pulje til tandlægen, bilen og julegaver. Fambud strukturerer det så du ved hvad pengene er der til, og hvor meget der mangler."
          />
          <FeatureCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="Se hvor pengene rent faktisk ender"
            body="En graf der viser hvordan din løn fordeler sig: hvor meget der går til faste udgifter, hvor meget til fælles, hvor meget til opsparing, og hvor meget der er tilbage. Hvis en konto er ved at være underdækket, får du besked i god tid."
          />
          <FeatureCard
            icon={<Home className="h-5 w-5" />}
            title="Realkredit der regnes som realkredit"
            body="Et realkreditlån har rente, afdrag, bidragssats og eventuelle rabatter. Det skal regnes hver for sig, ikke smides i én pose som 'boliglån: 12.000 kr'. Fambud viser dig hvad der faktisk går til hvad, så du kan se effekten af en omlægning eller en ekstra afdragsfri periode."
          />
          <FeatureCard
            icon={<LineChart className="h-5 w-5" />}
            title="Pension med både din og firmaets andel"
            body="Din pensionsindbetaling er ikke bare ét tal. Der er din egen procent og firmaets procent, og det skal med i billedet hvis du skal forstå hvad du faktisk sparer op. Fambud regner det rigtigt, også når du skifter job eller justerer din egen procent."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    // Card-padding: 24px (p-6 = 1.5rem) mobile, 32px (p-8 = 2rem) på sm+.
    // Begge er Fibonacci-tal (24=Fib₈, 32 nær Fib₉=34) hvilket giver harmonic
    // proportions internt mellem card-bredde, padding og typografi.
    <div className="rounded-lg border border-neutral-200 bg-stone-50/50 p-6 transition hover:border-emerald-300 hover:bg-emerald-50/30 sm:p-8">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
        {icon}
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-neutral-900 sm:text-xl">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">{body}</p>
    </div>
  );
}

// Et lille demo-strip mellem features og how-it-works der viser et
// stiliseret budget-tabel-uddrag. Det er statisk, men giver et 2. visuelt
// holdepunkt på siden ud over hero-mockuppen.
function DemoStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-[6.5rem]">
      {/* Mobile: tekst først (order-1), mockup under (order-2). Desktop:
          mockup til venstre (order-1), tekst til højre (order-2). Det er
          samme indhold men omvendt orden afhængigt af viewport - gør at
          tekst-først pattern bevares på små skærme hvor brugeren scroller
          og vil have kontekst først. */}
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="order-2 lg:order-1">
          <DemoStripMockup />
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-eyebrow text-emerald-800">Hvor går pengene hen?</p>
          <h2
            className="mt-3 text-display text-neutral-900"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Fra detaljerede tal til ét klart billede
          </h2>
          <p className="mt-5 text-lead text-neutral-600">
            Indtast jeres faste udgifter med kategori, og Fambud ruller dem
            op til tematiske grupper du kan forstå med ét blik. Filtrér på
            fælles eller privat. Skift mellem måned, kvartal og år. Klik en
            gruppe for at se de individuelle poster.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-neutral-700">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>9 tematiske grupper: Bolig, Transport, Børn, Mad...</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>Andele af det samlede budget, så du finder de store sten</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>Klik en gruppe for at se de enkelte poster</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

// FAQ bruger native <details>/<summary> så det er fuldt tilgængeligt og
// fungerer uden JS. Klik på spørgsmålet folder svaret ud.
function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-[6.5rem]">
      <div className="text-center">
        <p className="text-eyebrow text-emerald-800">
          Ofte stillede spørgsmål
        </p>
        <h2
          className="mt-3 text-display text-neutral-900"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Det praktiske
        </h2>
      </div>

      <div className="mt-10 space-y-3 sm:mt-12">
        <FaqItem
          q="Skal I have adgang til min bank?"
          a="Nej. Fambud importerer ikke fra din bank. Du indtaster selv dine faste udgifter og lønsedler - det giver fuld kontrol og ingen samtykke-risiko."
        />
        <FaqItem
          q="Hvad koster det?"
          a="Fambud er gratis under udvikling. Den endelige pris er 19 kr/md - fast, uden tier-systemer eller pakker. Det dækker driften med god margin og holder appen tilgængelig for alle. Eksisterende brugere får fair varsel før den faktiske betaling starter."
        />
        <FaqItem
          q="Hvem er Fambud til?"
          a={
            <>
              Fambud er til dig - uanset om du bor alene, deler økonomi med
              en partner, har en stor familie, er studerende, midt i karrieren
              eller pensioneret. Appen tilpasser sig din situation: bor du
              alene fokuserer den på dit eget cashflow; deler I økonomi
              tilføjes fælles/private-skillet med per-person bidrag; har I
              børn kan deres opsparinger og udgifter også registreres. Du
              behøver ikke have alt på plads fra dag ét - Fambud guider dig
              roligt igennem opsætningen og lader dig udvide efterhånden som
              dit liv ændrer sig.
            </>
          }
        />
        <FaqItem
          q="Mine data - hvor ligger de?"
          a={
            <>
              Dine data ligger på krypterede servere i Frankfurt - inden for
              EU og under GDPR. Alt er beskyttet med TLS 1.3 i transit og
              AES-256 i hvile, og Row Level Security gør at selv ikke andre
              brugere af samme database kan se dine konti. Vi læser{' '}
              <strong>aldrig</strong> dine tal manuelt. Ingen banker,
              rådgivere eller marketing-firmaer får adgang. Du kan slette din
              konto når som helst og alt forsvinder inden for 30 dage - også
              fra backups efterhånden som de roterer ud. Vi har en hel side
              dedikeret til det her -{' '}
              <Link
                href="/privatliv"
                className="font-medium text-emerald-800 underline hover:text-emerald-900"
              >
                læs vores fulde dataerklæring
              </Link>
              .
            </>
          }
        />
        <FaqItem
          q="Hvad gør Fambud anderledes?"
          a="Du er 100% uafhængig hos os. Ingen banker har adgang til dine data. Ingen rådgivere skal sælge dig produkter du ikke har bedt om. Ingen tredjeparter kigger med over skulderen. Det er bare dig og Fambud - hvor vores indbyggede agent guider dig roligt igennem din økonomi, opdager mønstre du selv ville overse, og foreslår konkrete næste skridt mod dine egne mål. Vi dømmer ikke valg - vi hjælper dig med at træffe dem mere bevidst, så din økonomi vokser i en sund og struktureret retning."
        />
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-neutral-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-neutral-900 sm:px-6 sm:text-base">
        <span>{q}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600 sm:px-6">
        {a}
      </div>
    </details>
  );
}

function FinalCTA() {
  return (
    <section className="bg-emerald-800">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8 lg:py-[6.5rem]">
        <h2
          className="text-display text-white"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Klar til at få overblik?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lead text-emerald-50">
          10 minutter med Fambud - og du ved præcis hvor jeres penge løber
          hen de næste 12 måneder.
        </p>
        {/* CTA-stack samme pattern som hero: full-width mobile, auto sm+ */}
        <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-white px-6 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-stone-50"
          >
            Kom i gang gratis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-emerald-700 px-6 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-700"
          >
            Jeg har allerede en konto
          </Link>
        </div>
        <p className="mt-5 text-xs text-emerald-100">
          Senere 19 kr/md - fast pris, aldrig dyrere
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-stone-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span
            className="text-base tracking-tight text-neutral-700"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Fambud
          </span>
          <span>- familie + budget</span>
          <Link
            href="/privatliv"
            className="text-neutral-600 hover:text-neutral-900"
          >
            Privatliv & data
          </Link>
          <Link
            href="/security"
            className="text-neutral-600 hover:text-neutral-900"
          >
            Sikkerhed
          </Link>
        </div>
        <div>
          © {new Date().getFullYear()} · En del af{' '}
          <a
            href="https://www.stæhrs.dk"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-neutral-700 underline-offset-2 hover:text-emerald-800 hover:underline"
          >
            Stærhs
          </a>
          .
        </div>
      </div>
    </footer>
  );
}
