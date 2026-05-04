// Offentlig data- og privatlivs-side. Forklarer ærligt hvad der sker med
// brugerens data: hvad vi gemmer, hvor det ligger, hvem der kan se det,
// hvilke cookies vi bruger, og hvad vi aldrig gør. Tilgængelig uden login.
//
// Sproget er bevidst varmt og plain dansk - ingen jura-floskler. Målet er
// at folk forlader siden trygge ved at indtaste deres økonomi i Fambud.

import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Database,
  Eye,
  Globe,
  Lock,
  ShieldCheck,
  UserX,
  X,
} from 'lucide-react';

const FAMBUD_FONT = 'var(--font-zt-nature), system-ui, sans-serif';

export const metadata = {
  title: 'Privatliv & data - Fambud',
  description:
    'Hvad sker der med dine data hos Fambud? Fuld åbenhed om opbevaring, cookies og hvem der kan se hvad.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <TopNav />

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <header className="border-b border-neutral-200 pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-3 w-3" />
            Tilbage til forsiden
          </Link>
          <h1
            className="mt-4 text-3xl tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Dine data, dit ansvar - ikke vores at læse.
          </h1>
          <p className="mt-4 text-base text-neutral-600 sm:text-lg">
            Når du indtaster din økonomi i Fambud, fortæller du os noget
            personligt. Vi tager det alvorligt. Her er præcis hvad der sker
            med dine data - uden jurasprog og uden small print.
          </p>
        </header>

        <Section
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Vores løfte"
          accent
        >
          <p>
            Vi læser <strong>aldrig</strong> dine data manuelt. Vi sælger dem
            <strong> aldrig</strong>. Vi deler dem <strong>aldrig</strong> med
            banker, rådgivere eller marketing-firmaer. Vi bruger dem
            <strong> aldrig</strong> til at træne AI-modeller udenfor din egen
            konto.
          </p>
          <p className="mt-3">
            Det du indtaster i Fambud er dit. Vi opbevarer det sikkert så du
            kan komme tilbage til det - men ud over det rører vi det ikke.
          </p>
        </Section>

        <Section
          icon={<Database className="h-5 w-5" />}
          title="Hvad gemmer vi om dig?"
        >
          <p>
            Kun det vi har brug for til at appen virker. Konkret:
          </p>
          <List
            items={[
              {
                title: 'Login-info',
                body: 'Email og en krypteret hash af dit kodeord (vi kan ikke se det rigtige kodeord - kun en envejs-beregnet hash).',
              },
              {
                title: 'Profil',
                body: 'Dit navn, din bopælsadresse og evt. arbejdsadresse hvis du vælger at indtaste den (bruges til befordringsfradrag-beregning senere).',
              },
              {
                title: 'Familie',
                body: 'Hvem der er medlemmer af din husstand, og hvilken rolle (voksen, barn, partner). Hvis du har inviteret nogen, gemmes deres email.',
              },
              {
                title: 'Konti og økonomi',
                body: 'De konti du opretter (lønkonto, budget, opsparing osv.), faste udgifter, lønudbetalinger, lån, overførsler og opsparingsmål - alt det du selv har indtastet.',
              },
              {
                title: 'Indstillinger',
                body: 'Hvor langt du er i onboarding-flowet, hvilke tutorials du har set, og om du har valgt "særskilt" eller "fælles" økonomi.',
              },
            ]}
          />
          <p className="mt-4 text-sm text-neutral-600">
            Vi opretter <strong>ikke</strong> tracking-profiler om dig. Vi har{' '}
            <strong>ingen analytics</strong> der følger dig på tværs af sider.
            Vi har <strong>intet ad-netværk</strong>.
          </p>
        </Section>

        <Section
          icon={<Eye className="h-5 w-5" />}
          title="Hvem kan se hvad?"
          accent
        >
          <p>
            Det her er det vigtigste afsnit. Læs det.
          </p>

          <SubSection title="Du selv">
            Alt du indtaster er synligt for dig - altid. Du kan eksportere
            det, redigere det, og slette det.
          </SubSection>

          <SubSection title="Dine familiemedlemmer">
            Familiemedlemmer ser <strong>kun</strong> det der er markeret som{' '}
            <em>Fælles</em>. Når du opretter en konto kan du vælge om den er
            privat (kun dig) eller fælles (hele husstanden). Det er ikke bare
            et UI-flag - det er håndhævet på databaseniveau via Row Level
            Security, så selv hvis nogen prøver at gå udenom appen, kan de
            ikke se dine private konti.
          </SubSection>

          <SubSection title="Os hos Fambud">
            Vi <strong>kan</strong> teknisk set tilgå databasen for at
            vedligeholde tjenesten - men vi <strong>gør det ikke</strong> for
            at læse dine personlige tal. Når vi skal lave debugging eller
            support, beder vi dig først om eksplicit tilladelse, og vi
            arbejder med anonymiseret data hvor det overhovedet er muligt.
          </SubSection>

          <SubSection title="Tredjeparter">
            <strong>Ingen.</strong> Hverken banker, rådgivere, marketing-
            firmaer, AI-trænere eller andre. Dine data forlader ikke vores
            servere ud over til den infrastruktur der kører appen (se{' '}
            <a href="#underleverandorer" className="text-emerald-800 underline">
              underleverandører
            </a>{' '}
            nedenfor).
          </SubSection>
        </Section>

        <Section
          icon={<Globe className="h-5 w-5" />}
          title="Hvor ligger dine data?"
        >
          <p>
            På servere i Frankfurt, Tyskland - inden for EU og under GDPR.
            Vi bruger Supabase som database-platform. Data er krypteret:
          </p>
          <List
            items={[
              {
                title: 'I transit',
                body: 'Alt mellem din browser og vores servere er krypteret med TLS 1.3 (HTTPS). Ingen kan opfange dit data undervejs.',
              },
              {
                title: 'I hvile',
                body: 'Databasen krypterer data på disk med AES-256. Selv hvis nogen fysisk fik fat i en harddisk, er indholdet ulæseligt.',
              },
              {
                title: 'Backups',
                body: 'Daglige backups med 7 dages historik. De er krypterede med samme nøgler som live-databasen, og slettes automatisk efter 7 dage.',
              },
            ]}
          />
        </Section>

        <Section
          icon={<Lock className="h-5 w-5" />}
          title="Cookies — kun det nødvendige"
        >
          <p>
            Vi bruger ingen marketing-cookies, ingen tracking, ingen
            tredjeparts-cookies. Kun det der er nødvendigt for at appen virker:
          </p>
          <CookieTable
            rows={[
              {
                name: 'sb-* (auth)',
                purpose: 'Holder dig logget ind. Sat af Supabase, vores auth-system.',
                duration: 'Persistent eller session - du vælger via "Husk mig" ved login.',
              },
              {
                name: 'fambud_session_only',
                purpose: 'Husker dit valg af "Husk mig". Hvis sat til 1, behandles auth-cookies som session-only og slettes når du lukker browseren.',
                duration: 'Session - slettes ved browser-luk.',
              },
            ]}
          />
          <p className="mt-4 text-sm text-neutral-600">
            Det er det. Ingen Google Analytics. Ingen Facebook Pixel. Ingen{' '}
            cookies til ad-personalization. Du behøver ikke acceptere noget
            cookie-banner - der er ikke noget at samtykke til ud over det
            tekniske minimum der gør at du kan logge ind.
          </p>
        </Section>

        <Section
          icon={<UserX className="h-5 w-5" />}
          title="Dine rettigheder"
        >
          <p>
            Under GDPR har du flere rettigheder. Vi tager dem alle alvorligt:
          </p>
          <List
            items={[
              {
                title: 'Indsigt',
                body: 'Du kan se al din data direkte i appen. Vil du have en maskin-læsbar kopi af alt? Skriv til os og vi sender en JSON-eksport inden for 30 dage.',
              },
              {
                title: 'Rettelse',
                body: 'Alt kan redigeres direkte i appen. Hvis noget ikke kan, skriv til os.',
              },
              {
                title: 'Sletning',
                body: 'Slet din konto under /indstillinger. Alt dit data slettes inden for 30 dage - også fra vores backups efterhånden som de roterer ud.',
              },
              {
                title: 'Dataportabilitet',
                body: 'Eksport-funktionen leverer dine data i et åbent format (JSON) så du kan tage dem med hvis du forlader os.',
              },
              {
                title: 'Indsigelse',
                body: 'Mener du vi behandler dine data forkert? Skriv til os, eller klag direkte til Datatilsynet (datatilsynet.dk).',
              },
            ]}
          />
        </Section>

        <Section
          icon={<X className="h-5 w-5" />}
          title="Hvad vi aldrig gør"
          accent
        >
          <ul className="space-y-3">
            <NeverItem>
              Vi sælger ikke dine data - til nogen, for nogen pris, under
              nogen omstændigheder.
            </NeverItem>
            <NeverItem>
              Vi deler ikke med banker eller financial advisors. De har intet
              at gøre i din private økonomi-app.
            </NeverItem>
            <NeverItem>
              Vi bruger ikke dine data til at træne AI-modeller. Den agent
              der hjælper dig i appen kører på regler og dine egne tal -
              ikke på et neuralt net trænet på andre brugeres økonomi.
            </NeverItem>
            <NeverItem>
              Vi læser ikke dine data manuelt for sjov, statistik eller
              "produktforbedring". Vi måler kun aggregerede ting som
              "hvor mange brugere har vi" og "hvor mange opretter en
              bufferkonto" - aldrig hvad enkeltpersoner gemmer.
            </NeverItem>
            <NeverItem>
              Vi sender ikke dine data ud af EU. Alt forbliver i Frankfurt.
            </NeverItem>
            <NeverItem>
              Vi sender ikke spam, marketing-emails eller "tilbud fra
              partnere". Du får kun emails der er nødvendige (kodeord-reset,
              invitations-koder, drift-meddelelser).
            </NeverItem>
          </ul>
        </Section>

        <Section
          icon={<Database className="h-5 w-5" />}
          title="Underleverandører"
          id="underleverandorer"
        >
          <p>
            Vi bygger ikke vores egen database eller hosting fra bunden. Tre
            tjenester hjælper med at køre Fambud:
          </p>
          <List
            items={[
              {
                title: 'Supabase (database og auth)',
                body: 'Hostet i Frankfurt. Behandler al din data som pålagt af os. Data forlader aldrig EU. Læs deres privatlivspolitik på supabase.com/privacy.',
              },
              {
                title: 'Vercel (hosting af appen)',
                body: 'Serverer Fambud-siderne. Ser kun forespørgsels-metadata (IP, browser-type, sider du besøger) - ikke indholdet af det du indtaster (det går direkte til databasen via krypteret kanal).',
              },
              {
                title: 'DAWA (Danmarks Adresseregister)',
                body: 'Når du skriver din adresse foreslår vi forslag fra api.dataforsyningen.dk - et offentligt dansk adresseregister. Vi sender kun det du skriver i adressefeltet, intet andet om dig. DAWA logger ikke til en personlig profil.',
              },
            ]}
          />
        </Section>

        <Section title="Spørgsmål?">
          <p>
            Hvis du er i tvivl om noget af det ovenstående - hvis du vil have
            din data eksporteret, slette din konto, eller bare har et spørgsmål
            - så skriv til os på{' '}
            <a
              href="mailto:privatliv@stæhrs.dk"
              className="font-medium text-emerald-800 underline hover:text-emerald-900"
            >
              privatliv@stæhrs.dk
            </a>
            . Vi svarer inden for 5 hverdage.
          </p>
          <p className="mt-3 text-sm text-neutral-600">
            Mener du vi har overtrådt dine rettigheder, kan du klage direkte
            til{' '}
            <a
              href="https://www.datatilsynet.dk"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-800 underline hover:text-emerald-900"
            >
              Datatilsynet
            </a>{' '}
            uden at gå igennem os først.
          </p>
        </Section>

        <div className="mt-12 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <p>
              <strong>Sidst opdateret:</strong> 4. maj 2026. Hvis vi ændrer
              noget væsentligt sender vi dig en email - du behøver ikke selv
              holde øje.
            </p>
          </div>
        </div>
      </article>

      <Footer />
    </div>
  );
}

function TopNav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-stone-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-xl tracking-tight text-neutral-900"
          style={{ fontFamily: FAMBUD_FONT }}
        >
          Fambud
        </Link>
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

function Section({
  icon,
  title,
  children,
  accent = false,
  id,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`mt-10 rounded-xl border p-6 sm:p-7 ${
        accent
          ? 'border-emerald-200 bg-emerald-50/40'
          : 'border-neutral-200 bg-white'
      }`}
    >
      <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-neutral-900">
        {icon && (
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${
              accent
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            {icon}
          </span>
        )}
        {title}
      </h2>
      <div className="mt-4 space-y-1 text-base leading-relaxed text-neutral-700">
        {children}
      </div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h3>
      <p className="mt-1.5 text-base leading-relaxed text-neutral-700">
        {children}
      </p>
    </div>
  );
}

function List({
  items,
}: {
  items: { title: string; body: string }[];
}) {
  return (
    <ul className="mt-3 space-y-3">
      {items.map((item) => (
        <li key={item.title} className="flex items-start gap-3">
          <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
          <div>
            <span className="font-semibold text-neutral-900">{item.title}.</span>{' '}
            <span className="text-neutral-700">{item.body}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CookieTable({
  rows,
}: {
  rows: { name: string; purpose: string; duration: string }[];
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-neutral-200">
      <table className="min-w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="px-4 py-2.5 text-left">Navn</th>
            <th className="px-4 py-2.5 text-left">Formål</th>
            <th className="px-4 py-2.5 text-left">Levetid</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <tr key={r.name} className="bg-white">
              <td className="px-4 py-3 align-top">
                <code className="font-mono text-xs text-neutral-900">
                  {r.name}
                </code>
              </td>
              <td className="px-4 py-3 align-top text-neutral-700">
                {r.purpose}
              </td>
              <td className="px-4 py-3 align-top text-neutral-600">
                {r.duration}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NeverItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-neutral-700">
      <X className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
      <span>{children}</span>
    </li>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-stone-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Link
            href="/"
            className="text-base tracking-tight text-neutral-700"
            style={{ fontFamily: FAMBUD_FONT }}
          >
            Fambud
          </Link>
          <span>- familie + budget</span>
          <Link href="/privatliv" className="text-neutral-600 hover:text-neutral-900">
            Privatliv & data
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
