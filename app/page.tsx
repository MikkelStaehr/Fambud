// Public landing page. Vises til ikke-loggede besøgende. Allerede-loggede
// brugere bouncer videre til dashboardet (samme rolle som proxy-redirect
// havde tidligere - vi gør det her så landing kan ses uden auth).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  Check,
  ChevronDown,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { HeroDemoMockup } from '@/app/_components/HeroDemoMockup';

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
      <HowItWorks />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-stone-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <span
          className="text-xl tracking-tight text-neutral-900"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Fambud
        </span>
        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:text-neutral-900"
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
    <section className="mx-auto max-w-6xl px-4 pt-12 pb-20 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24 lg:pb-28">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900">
            <Sparkles className="h-3 w-3" />
            Økonomisk planlægning for almindelige mennesker
          </p>
          <h1
            className="mt-5 text-4xl leading-tight tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Se hvor pengene løber hen — før de gør det
          </h1>
          <p className="mt-5 max-w-lg text-base text-neutral-600 sm:text-lg">
            Fambud hjælper dig med at sætte din økonomi i system. Du fortæller
            os hvad der kommer ind, hvad der går ud, og hvad du gerne vil
            spare op. Vi viser dig hvordan månederne kommer til at se ud — og
            hvor du kan justere, før overraskelserne indtræffer.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              Kom i gang gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400"
            >
              Log ind
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-500">
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
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">
            Hvorfor Fambud
          </p>
          <h2
            className="mt-2 text-3xl tracking-tight text-neutral-900 sm:text-4xl"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Bygget til familier - ikke til bogholderi
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-neutral-600">
            De fleste budget-apps regner som om du er alene. Fambud forstår
            at jeres økonomi har fælles udgifter, private udgifter og
            forskellige indkomster - og holder styr på det hele.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="Familie-økonomi indbygget"
            body="Fælles vs. private udgifter holdes adskilt automatisk. Per-bruger andele af fælles-konti viser præcis hvor meget hver bidrager. Inviter din partner med ét klik."
          />
          <FeatureCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Forecast fra faktiske lønsedler"
            body="Registrer 3 lønudbetalinger og vi beregner et glidende gennemsnit som forecast. Fanger overtid, ferietillæg og bonus uden at du skal indtaste det manuelt."
          />
          <FeatureCard
            icon={<PiggyBank className="h-5 w-5" />}
            title="Strategisk opsparing"
            body="Bufferfond (3-6 mdr af jeres faste udgifter) og forudsigelige uforudsete (tandlæge, bil, gaver) som strukturerede koncepter - ikke bare en tom konto."
          />
          <FeatureCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Cashflow-rådgiver"
            body="Sankey-graf der viser hvordan pengene flyder - først dig selv, så fælles, så opsparing. Aktive advarsler hvis en konto er underdækket, med ét-kliks-løsning."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Privatliv som standard"
            body="Private konti er reelt private - din partner ser dem ikke. RLS på databaseniveau, ikke bare et UI-flag. Du bestemmer hvad der er fælles."
          />
          <FeatureCard
            icon={<Check className="h-5 w-5" />}
            title="Lån + pension forstået"
            body="Realkredit med rente, afdrag, bidrag og rabat-breakdown. Pension med egen og firma-procent. Ikke en feature-mangel der bare ignoreres som i andre apps."
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
    <div className="rounded-lg border border-neutral-200 bg-stone-50/50 p-6 transition hover:border-emerald-300 hover:bg-emerald-50/30">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-neutral-900">
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
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl shadow-neutral-300/30">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3">
              <span className="text-xs font-medium uppercase tracking-wider text-neutral-500">
                Udgifter pr. gruppe - Fælles
              </span>
            </div>
            <div className="space-y-2.5 p-4">
              <BudgetBar label="Bolig & lån" pct={43} amount="16.378 kr" color="#7c3aed" />
              <BudgetBar label="Forsyning & forsikring" pct={22} amount="8.352 kr" color="#0891b2" />
              <BudgetBar label="Børn" pct={18} amount="6.823 kr" color="#eab308" />
              <BudgetBar label="Mad" pct={12} amount="4.500 kr" color="#16a34a" />
              <BudgetBar label="Underholdning" pct={5} amount="1.890 kr" color="#9333ea" />
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">
            Hvor går pengene hen?
          </p>
          <h2
            className="mt-2 text-3xl tracking-tight text-neutral-900 sm:text-4xl"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Fra detaljerede tal til ét klart billede
          </h2>
          <p className="mt-4 text-neutral-600">
            Indtast jeres faste udgifter med kategori, og Fambud ruller dem
            op til tematiske grupper du kan forstå med ét blik. Filtrér på
            fælles eller privat. Skift mellem måned, kvartal og år. Klik en
            gruppe for at se de individuelle poster.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-neutral-700">
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>9 tematiske grupper - Bolig, Transport, Børn, Mad...</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>Andele af det samlede budget - find de store sten</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <span>Hierarkisk drill-down til hver enkelt post</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function BudgetBar({
  label,
  pct,
  amount,
  color,
}: {
  label: string;
  pct: number;
  amount: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span className="text-neutral-900">{label}</span>
          <span className="text-xs text-neutral-400">{pct}%</span>
        </span>
        <span className="tabnum font-mono text-sm text-neutral-700">
          {amount}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="border-y border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">
            Sådan kommer du i gang
          </p>
          <h2
            className="mt-2 text-3xl tracking-tight text-neutral-900 sm:text-4xl"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            4 trin til overblik
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-neutral-600">
            Hele opsætningen tager ca. 10 minutter. Du behøver ikke have alt
            klar fra starten - Fambud guider dig igennem.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Step n={1} title="Opret konto" body="Email, navn og adresse. 30 sekunder." />
          <Step n={2} title="Tilføj løn" body="3 lønsedler er nok til pålideligt forecast." />
          <Step n={3} title="Faste udgifter" body="Husleje, lån, forsikringer, abonnementer." />
          <Step n={4} title="Få overblik" body="Cashflow, advarsler, og strategiske anbefalinger." />
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="relative rounded-lg border border-neutral-200 bg-stone-50/50 p-6">
      <div
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-800 text-sm font-semibold text-white"
        style={{ fontFamily: FAMBUD_FONT }}
      >
        {n}
      </div>
      <h3 className="mt-4 text-base font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{body}</p>
    </div>
  );
}

// FAQ bruger native <details>/<summary> så det er fuldt tilgængeligt og
// fungerer uden JS. Klik på spørgsmålet folder svaret ud.
function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">
          Ofte stillede spørgsmål
        </p>
        <h2
          className="mt-2 text-3xl tracking-tight text-neutral-900 sm:text-4xl"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Det praktiske
        </h2>
      </div>

      <div className="mt-10 space-y-3">
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
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-neutral-900">
        <span>{q}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-neutral-100 px-5 py-4 text-sm leading-relaxed text-neutral-600">
        {a}
      </div>
    </details>
  );
}

function FinalCTA() {
  return (
    <section className="bg-emerald-800">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <h2
          className="text-3xl tracking-tight text-white sm:text-4xl"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Klar til at få overblik?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-emerald-50">
          10 minutter med Fambud - og du ved præcis hvor jeres penge løber
          hen de næste 12 måneder.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-6 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-stone-50"
          >
            Kom i gang gratis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-emerald-700 px-6 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-700"
          >
            Jeg har allerede en konto
          </Link>
        </div>
        <p className="mt-4 text-xs text-emerald-100">
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
