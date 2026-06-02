// /indstillinger/profil - Min profil + Notifikationer + Slet konto.
//
// Tab i indstillinger-layoutet. Indeholder alt der KUN handler om den
// indloggede bruger som individ (ikke om husstanden). Farezonen ligger
// her fordi sletning af KONTOEN er en personlig handling - sletning af
// HUSSTANDEN sker separat hvis brugeren er ejer.

import { getSettingsData } from '@/lib/dal';
import { DawaAddressInput } from '@/app/_components/DawaAddressInput';
import {
  updateMyProfile,
  restartTour,
  deleteMyAccount,
  setMonthlySummaryEmail,
  sendMyMonthlySummaryTest,
  setPaymentReminderEmail,
} from '../actions';

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const { familyMembers, currentUserId } = await getSettingsData();
  const me = familyMembers.find((fm) => fm.user_id === currentUserId);

  if (!me) {
    return (
      <p className="text-sm text-neutral-500">
        Kunne ikke finde din profil. Prøv at logge ud og ind igen.
      </p>
    );
  }

  return (
    <div>
      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}
      {/* Min profil - den indloggede brugers egne felter (navn, adresser).
          Workplace-adressen vil senere drive befordringsfradrag-beregning;
          home-adressen indtastes typisk ved signup men kan rettes her. */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Min profil
        </h2>
        <form
          action={updateMyProfile}
          className="space-y-4 rounded-md border border-neutral-200 bg-white p-4"
        >
          <div>
            <label htmlFor="me_name" className="block text-xs font-medium text-neutral-600">
              Navn
            </label>
            <input
              id="me_name"
              name="name"
              type="text"
              required
              defaultValue={me.name}
              className="mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <DawaAddressInput
            legend="Bopælsadresse (valgfrit)"
            namePrefix="home"
            defaults={{
              address: me.home_address,
              zip_code: me.home_zip_code,
              city: me.home_city,
            }}
          />
          <DawaAddressInput
            legend="Arbejdsplads-adresse (valgfrit)"
            namePrefix="workplace"
            defaults={{
              address: me.workplace_address,
              zip_code: me.workplace_zip_code,
              city: me.workplace_city,
            }}
            hint="Bruges på sigt til at beregne dit befordringsfradrag og pendel-statistik."
          />
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Gem
          </button>
        </form>

        {/* Genstart alle rundture - nuller tours_completed jsonb og
            redirecter til /dashboard. Hver side med onboarding viser
            sin tour igen næste gang du besøger den. */}
        <form action={restartTour} className="mt-3">
          <button
            type="submit"
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            Genstart rundture i appen →
          </button>
        </form>
      </section>

      {/* Notifikationer - per-bruger email-præferencer */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Notifikationer
        </h2>
        <form
          action={setMonthlySummaryEmail}
          className="rounded-md border border-neutral-200 bg-white p-4"
        >
          <label
            htmlFor="monthly_summary_email_enabled"
            className="flex cursor-pointer items-start gap-3"
          >
            <input
              id="monthly_summary_email_enabled"
              name="monthly_summary_email_enabled"
              type="checkbox"
              defaultChecked={me.monthly_summary_email_enabled}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-700"
            />
            <span className="flex-1">
              <span className="block text-sm font-medium text-neutral-900">
                Månedlig oversigts-email
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                Vi sender en kort mail i slutningen af hver måned med
                din indtægt, udgift og overskud. Slå fra hvis du ikke
                vil have den.
              </span>
            </span>
          </label>
          <button
            type="submit"
            className="mt-3 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Gem
          </button>
        </form>

        {/* Test-send-knap: validerer email-template + Resend-deliverability
            ved at sende ÉN test-mail til den indloggede bruger. Opdaterer
            ikke last_monthly_summary_sent_at, så den almindelige
            månedlige cron fyrer stadig som forventet. */}
        <form action={sendMyMonthlySummaryTest} className="mt-3">
          <button
            type="submit"
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:border-neutral-900 hover:bg-neutral-50"
          >
            Send test-mail til mig selv
          </button>
          <p className="mt-1.5 text-[11px] text-neutral-500">
            Bruger din nuværende månedsdata. Subject præfikses med
            [TEST] så du kan kende den fra den rigtige.
          </p>
        </form>

        <form
          action={setPaymentReminderEmail}
          className="mt-3 rounded-md border border-neutral-200 bg-white p-4"
        >
          <label
            htmlFor="payment_reminder_email_enabled"
            className="flex cursor-pointer items-start gap-3"
          >
            <input
              id="payment_reminder_email_enabled"
              name="payment_reminder_email_enabled"
              type="checkbox"
              defaultChecked={me.payment_reminder_email_enabled}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-emerald-700"
            />
            <span className="flex-1">
              <span className="block text-sm font-medium text-neutral-900">
                Ugentlig betalings-påmindelse
              </span>
              <span className="mt-0.5 block text-xs text-neutral-500">
                Hver mandag sender vi en mail med de regninger og
                overførsler der forfalder den kommende uge på dine egne
                og fælles konti. Du får kun mailen når der faktisk er
                noget på vej.
              </span>
            </span>
          </label>
          <button
            type="submit"
            className="mt-3 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            Gem
          </button>
        </form>
      </section>

      {/* Danger zone - slet hele kontoen. Bevidst placeret allernederst og
          stylet med rød accent så det ikke kan klikkes ved en fejl. Kræver
          at brugeren skriver sin email for at bekræfte. */}
      <DangerZone email={me.email} isOwner={me.role === 'owner'} />
    </div>
  );
}

function DangerZone({
  email,
  isOwner,
}: {
  email: string | null;
  isOwner: boolean;
}) {
  return (
    <section className="mt-12">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-red-700">
        Farezone
      </h2>
      <details className="group rounded-md border border-red-200 bg-red-50/40">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-medium text-red-900">
          <span>Slet min konto</span>
          <span className="text-xs font-normal text-red-700 group-open:hidden">
            Klik for at folde ud
          </span>
        </summary>
        <div className="border-t border-red-200 px-5 py-4">
          <p className="text-sm text-red-900">
            Dette sletter din konto og alle dine data permanent.{' '}
            {isOwner ? (
              <>
                Du er <strong>ejer</strong> af husstanden - hvis du er det
                eneste aktive medlem slettes hele husstanden inkl. konti,
                udgifter, indkomster og overførsler. Hvis andre voksne er
                aktive medlemmer kan du ikke slette din konto via denne
                knap; fjern dem først eller kontakt support.
              </>
            ) : (
              <>
                Din egen profil fjernes fra husstanden. Husstanden og andre
                medlemmer består - din partner kan fortsat bruge appen.
              </>
            )}
          </p>
          <p className="mt-3 text-sm text-red-900">
            Vi sletter også din auth-konto, så du kan ikke logge ind igen
            bagefter. Vil du oprette en ny senere er det med en helt frisk
            start.
          </p>
          <form action={deleteMyAccount} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="confirm_email"
                className="block text-xs font-medium text-red-900"
              >
                Skriv din email for at bekræfte
              </label>
              <input
                id="confirm_email"
                name="confirm_email"
                type="email"
                required
                autoComplete="off"
                placeholder={email ?? 'din@email.dk'}
                className="mt-1 block w-full max-w-md rounded-md border border-red-300 bg-white px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-800"
            >
              Slet min konto permanent
            </button>
          </form>
        </div>
      </details>
    </section>
  );
}
