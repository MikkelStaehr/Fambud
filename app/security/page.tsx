// Public-facing responsible disclosure-side. Forklarer reglerne for
// security researchers der finder en sårbarhed: hvor rapporterer de,
// hvad er in-scope, hvad lover vi, og hvad er deres safe harbor.
//
// Sproget matcher /privatliv: varmt + ærligt + ingen jura-floskler.
// Målet er at sænke barrieren for at melde noget ind.
//
// Reference: SECURITY_AUDITS.md Prompt 13 + /.well-known/security.txt

import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Clock,
  Mail,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

const FAMBUD_FONT = 'var(--font-zt-nature), system-ui, sans-serif';

export const metadata = {
  title: 'Sikkerhed & disclosure - Fambud',
  description:
    'Har du fundet en sårbarhed i Fambud? Sådan rapporterer du den, og hvad du kan forvente fra os.',
};

export default function SecurityPage() {
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
            Hjælp os med at holde Fambud sikker
          </h1>
          <p className="mt-4 text-base text-neutral-600 sm:text-lg">
            Hvis du har fundet en sårbarhed i Fambud, er vi taknemmelige
            for at du tager dig tid til at melde den. Her er hvad vi
            beder dig om - og hvad du kan forvente fra os.
          </p>
        </header>

        <Section
          icon={<Mail className="h-5 w-5" />}
          title="Sådan rapporterer du"
          accent
        >
          <p>
            Send en email til{' '}
            <a
              href="mailto:support@fambud.dk?subject=Security%20disclosure"
              className="font-medium text-emerald-800 underline hover:text-emerald-900"
            >
              support@fambud.dk
            </a>{' '}
            med emnet <strong>&quot;Security disclosure&quot;</strong>. Beskriv:
          </p>
          <List
            items={[
              {
                title: 'Hvad du fandt',
                body: 'Beskriv sårbarheden så præcist du kan - hvilken side, hvilken handling, hvilke data der potentielt er eksponeret.',
              },
              {
                title: 'Sådan reproducerer du den',
                body: 'Step-by-step så vi kan bekræfte. Skærmbilleder eller en kort video hjælper meget.',
              },
              {
                title: 'Hvor du fandt den',
                body: 'Production (www.fambud.dk), preview-environment, eller lokalt? Hvilken browser/OS?',
              },
              {
                title: 'Hvordan vi må kontakte dig',
                body: 'Email er fint. Hvis du vil i Hall of Fame med navn eller pseudonym, så fortæl os hvilket.',
              },
            ]}
          />
          <p className="mt-4 text-sm text-neutral-600">
            Du behøver ikke vente på vores svar før du undersøger
            videre, men vi sætter pris på at du venter med offentlig
            disclosure indtil vi har haft chancen for at fixe det
            (se tidsfrist nedenfor).
          </p>
        </Section>

        <Section
          icon={<Check className="h-5 w-5" />}
          title="Hvad der er in-scope"
        >
          <p>
            Vi ser særligt gerne rapporter på følgende:
          </p>
          <List
            items={[
              {
                title: 'fambud.dk og alle subdomæner',
                body: 'Hovedapp, autentifikation, husstands-data, betalingsflows (når de findes).',
              },
              {
                title: 'Cross-household-adgang',
                body: 'Hvis du kan se data fra en husstand du ikke er medlem af, er det det vigtigste vi vil høre om.',
              },
              {
                title: 'Privilegie-eskalering',
                body: 'Almindeligt medlem der opnår ejer-rettigheder, eller bruger der opnår admin-rettigheder.',
              },
              {
                title: 'Authentication-svagheder',
                body: 'Login-bypass, session-fixering, password-reset-issues, MFA-svagheder (hvis vi tilbyder MFA).',
              },
              {
                title: 'XSS, CSRF, IDOR, SSRF, SQL-injection',
                body: 'Klassiske webvulnerability-klasser i vores egen kode.',
              },
              {
                title: 'Data-eksponering',
                body: 'Hvis du finder PII eller finansielle data der lækker via fejl-meddelelser, logs, eller cache-headers.',
              },
            ]}
          />
        </Section>

        <Section
          icon={<X className="h-5 w-5" />}
          title="Hvad der ikke er in-scope"
        >
          <p>
            Følgende rapporter behandler vi ikke - de er enten ikke
            relevante for os eller skal sendes til en anden:
          </p>
          <ul className="mt-3 space-y-3">
            <NotInScope>
              <strong>Denial of service (DoS/DDoS).</strong> Vi sætter
              pris på defensiv research, men aktiv DoS-testning mod
              vores produktion er ikke ønsket. Rapportér frem for at
              demonstrere.
            </NotInScope>
            <NotInScope>
              <strong>Social engineering.</strong> Phishing af brugere
              eller medarbejdere, vishing, smishing. Vi har ingen
              medarbejdere endnu, og vi vil ikke have at vores brugere
              testes uden samtykke.
            </NotInScope>
            <NotInScope>
              <strong>Fysiske angreb.</strong> Vores eneste fysiske
              attribut er hostingen hos vores underleverandører
              (Supabase, Vercel) - du skal ikke besøge deres datacentre.
            </NotInScope>
            <NotInScope>
              <strong>Issues hos tredjeparter.</strong> Hvis du finder
              noget i Supabase, Vercel, Resend eller en anden af vores
              underleverandører (se{' '}
              <Link href="/privatliv#underleverandorer" className="text-emerald-800 underline hover:text-emerald-900">
                privatlivspolitikken
              </Link>
              ), så rapportér til dem direkte.
            </NotInScope>
            <NotInScope>
              <strong>Selv-XSS</strong> (kræver at brugeren selv paste'r
              kode i devtools), <strong>UI-redress uden security-impact</strong>,
              <strong> rate-limit-bypass på offentlige sider</strong>,{' '}
              <strong>information disclosure af ikke-følsomme data</strong>
              {' '}(fx vores teknologi-stack).
            </NotInScope>
            <NotInScope>
              <strong>Mangel på sikkerheds-headere</strong> hvor vi
              allerede har en bevidst beslutning om at ikke have dem
              (se{' '}
              <a
                href="https://github.com/MikkelStaehr/Fambud/blob/main/SECURITY_AUDITS.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-800 underline hover:text-emerald-900"
              >
                SECURITY_AUDITS.md
              </a>
              ).
            </NotInScope>
          </ul>
        </Section>

        <Section
          icon={<Clock className="h-5 w-5" />}
          title="Hvad du kan forvente fra os"
          accent
        >
          <p>
            Vi er en lille operation, men vi tager security alvorligt.
            Her er vores SLA:
          </p>
          <SlaTable
            rows={[
              {
                step: 'Acknowledgment',
                deadline: 'Inden for 48 timer',
                detail: 'Vi bekræfter at vi har modtaget din rapport.',
              },
              {
                step: 'Initial vurdering',
                deadline: 'Inden for 7 dage',
                detail: 'Vi melder tilbage med vores vurdering af severity og en plan.',
              },
              {
                step: 'Fix - kritisk',
                deadline: '24 timer',
                detail: 'Aktive exploits eller PII-eksponering.',
              },
              {
                step: 'Fix - høj',
                deadline: '7 dage',
                detail: 'Privilegie-eskalering, authentication-bypass.',
              },
              {
                step: 'Fix - medium',
                deadline: '30 dage',
                detail: 'IDOR, XSS uden følsom data-impact.',
              },
              {
                step: 'Fix - lav',
                deadline: '90 dage',
                detail: 'Information disclosure, defense-in-depth-gaps.',
              },
            ]}
          />
          <p className="mt-4 text-sm text-neutral-600">
            <strong>Public disclosure:</strong> vi beder dig vente med
            at offentliggøre detaljer indtil 90 dage efter din rapport,
            eller indtil et fix er deployet - hvad end der kommer
            først. Hvis vi ikke har respondert eller fixet inden for
            tidsfristen, må du gerne offentliggøre.
          </p>
        </Section>

        <Section
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Safe harbor"
        >
          <p>
            Hvis du følger denne politik i god tro, lover vi:
          </p>
          <List
            items={[
              {
                title: 'Vi forfølger dig ikke juridisk',
                body: 'Hverken civilt eller strafferetligt. Vi anser dit arbejde som autoriseret testing under denne policy.',
              },
              {
                title: 'Vi rapporterer dig ikke til myndighederne',
                body: 'For aktivitet der er konsistent med denne policy.',
              },
              {
                title: 'Vi arbejder med dig',
                body: 'Vi vil i god tro forsøge at forstå din rapport, lukke sårbarheden, og holde dig informeret undervejs.',
              },
            ]}
          />
          <p className="mt-4 text-sm text-neutral-600">
            Vi forventer til gengæld at du: (1) ikke tilgår mere data
            end nødvendigt for at demonstrere, (2) ikke ændrer eller
            sletter andres data, (3) ikke deler dine fund med andre
            før de er fixet, og (4) ikke afpresser os eller forlanger
            penge for ikke at offentliggøre.
          </p>
        </Section>

        <Section
          icon={<Users className="h-5 w-5" />}
          title="Anerkendelse"
        >
          <p>
            Vi tilbyder ikke pengebelønninger lige nu - Fambud er ikke
            en kommerciel app endnu, så vi har ingen omsætning at
            betale ud af. Til gengæld:
          </p>
          <List
            items={[
              {
                title: 'Hall of Fame',
                body: 'Hvis du vil, anerkender vi dig offentligt på denne side med navn eller pseudonym efter sårbarheden er fixet.',
              },
              {
                title: 'Reference',
                body: 'Vi skriver gerne en kort reference du kan bruge - "har bidraget til Fambud sikkerhedsmæssigt" eller tilsvarende.',
              },
              {
                title: 'Tak',
                body: 'Hvis vi mødes nogensinde, første øl er på os. Vi mener det.',
              },
            ]}
          />
        </Section>

        <Section title="Spørgsmål?">
          <p>
            Skriv til os på{' '}
            <a
              href="mailto:support@fambud.dk"
              className="font-medium text-emerald-800 underline hover:text-emerald-900"
            >
              support@fambud.dk
            </a>
            . Vi har også en{' '}
            <a
              href="/.well-known/security.txt"
              className="font-medium text-emerald-800 underline hover:text-emerald-900"
            >
              security.txt
            </a>{' '}
            hvis du foretrækker det format (RFC 9116).
          </p>
        </Section>

        <div className="mt-12 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            <p>
              <strong>Sidst opdateret:</strong> 6. maj 2026. Denne
              policy gælder for alle rapporter modtaget fra denne dato
              og frem.
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
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <section
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

function List({ items }: { items: { title: string; body: string }[] }) {
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

function NotInScope({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-neutral-700">
      <X className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
      <span>{children}</span>
    </li>
  );
}

function SlaTable({
  rows,
}: {
  rows: { step: string; deadline: string; detail: string }[];
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-md border border-neutral-200">
      <table className="min-w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          <tr>
            <th className="px-4 py-2.5 text-left">Trin</th>
            <th className="px-4 py-2.5 text-left">Tidsfrist</th>
            <th className="px-4 py-2.5 text-left">Detalje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r) => (
            <tr key={r.step} className="bg-white">
              <td className="px-4 py-3 align-top font-medium text-neutral-900">
                {r.step}
              </td>
              <td className="px-4 py-3 align-top text-neutral-700">
                {r.deadline}
              </td>
              <td className="px-4 py-3 align-top text-neutral-600">
                {r.detail}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          <Link href="/security" className="text-neutral-600 hover:text-neutral-900">
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
