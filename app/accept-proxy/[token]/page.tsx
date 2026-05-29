import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashProxyToken } from '@/lib/proxy';
import {
  acceptSetupProxy,
  rejectSetupProxy,
} from '@/app/(app)/indstillinger/proxy-actions';
import { SubmitButton } from '@/app/_components/SubmitButton';

// Samtykke-side til proxy-grant. Louise lander her fra emailen og skal
// eksplicit klikke "Ja" for at adgangen aktiveres.
//
// Public route - kræver ikke at brugeren er logget ind ved første visit.
// Hvis ikke logget ind, sender vi dem til /login med callbackUrl der
// bringer dem tilbage. Hvis logget ind som forkert bruger, viser vi en
// klar besked om at de skal skifte konto.

export default async function AcceptProxyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token || token.length < 20) {
    return <InvalidLink />;
  }

  const tokenHash = hashProxyToken(token);

  // VIGTIGT: token er selv credential'en på den her side. Vi skal kunne
  // se grant-info SELVOM brugeren ikke er logget ind endnu - så vi kan
  // vise samtykke-siden eller bede dem logge ind. Anon-client + RLS
  // ville blokere SELECT for ikke-authentificerede, så vi bruger
  // service-role admin-client for selve lookup'et. Selve accept-action'en
  // bruger normal user-client + RLS som beskyttelse.
  const adminSupabase = createAdminClient();
  const { data: grant } = await adminSupabase
    .from('setup_proxy_grants')
    .select(
      'id, grantor_user_id, grantee_user_id, expires_at, accepted_at, revoked_at, household_id, scope'
    )
    .eq('request_token_hash', tokenHash)
    .maybeSingle();

  if (!grant) return <InvalidLink />;
  if (grant.revoked_at) return <Revoked />;
  if (new Date(grant.expires_at) <= new Date()) return <Expired />;

  // Hent grantor og grantee navne + husstandsnavn til samtykke-siden.
  // Disse skal også fungere pre-auth (vi vil vise siden til Louise
  // selvom hun ikke har logget ind endnu), så vi bruger samme
  // admin-client som grant-lookup'et.
  const [{ data: grantorMember }, { data: granteeMember }, { data: household }] =
    await Promise.all([
      adminSupabase
        .from('family_members')
        .select('name')
        .eq('user_id', grant.grantor_user_id)
        .maybeSingle(),
      adminSupabase
        .from('family_members')
        .select('name')
        .eq('user_id', grant.grantee_user_id)
        .maybeSingle(),
      adminSupabase.from('households').select('name').eq('id', grant.household_id).maybeSingle(),
    ]);

  const grantorName = grantorMember?.name ?? 'Du';
  const granteeName = granteeMember?.name ?? 'et familiemedlem';
  const householdName = household?.name ?? 'jeres husstand';

  // Auth-check kører via almindelig user-client - vi vil vide om DEN
  // pågældende bruger der ser siden er logget ind, ikke service-role.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Bruger ikke logget ind → send til login med callback
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/accept-proxy/${token}`)}`);
  }

  // Logget ind som forkert bruger
  if (user.id !== grant.grantor_user_id) {
    return <WrongUser />;
  }

  // Allerede accepteret
  if (grant.accepted_at) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>
          <div className="mt-8 rounded-md border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="text-base font-semibold text-emerald-900">
              Adgangen er allerede aktiveret
            </h2>
            <p className="mt-2 text-sm text-emerald-800">
              Du har allerede sagt ja til denne anmodning. Hvis du har fortrudt, kan
              du trække adgangen tilbage i Indstillinger.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="mt-6 inline-block text-sm font-medium text-neutral-900 hover:underline"
          >
            Til dashboard
          </Link>
        </div>
      </main>
    );
  }

  const expiryFormatted = new Date(grant.expires_at).toLocaleDateString('da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>
          <p className="mt-1 text-sm text-neutral-500">Anmodning om hjælper-adgang</p>
        </div>

        <div className="mt-8 rounded-md border border-neutral-200 bg-white p-6">
          <p className="text-sm text-neutral-700">
            Hej <strong>{grantorName}</strong>,
          </p>
          <p className="mt-3 text-sm text-neutral-700">
            <strong>{granteeName}</strong> har spurgt om lov til at hjælpe dig med at
            sætte din økonomi op i <strong>{householdName}</strong>.
          </p>

          <div className="mt-5 rounded-md border border-neutral-200 bg-stone-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Hvis du siger ja, kan {granteeName} tilføje:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              <li>· Dine konti (lønkonto, opsparing osv.)</li>
              <li>· Dine lønudbetalinger</li>
              <li>· Dine faste udgifter</li>
              <li>· Dine opsparingsmål</li>
            </ul>
          </div>

          <div className="mt-5 rounded-md border-l-4 border-emerald-700 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-900">
              <strong>Vigtigt:</strong> {granteeName} kan <strong>kun tilføje nyt</strong> -
              ikke se din eksisterende private data eller redigere det du allerede har
              oprettet. Adgangen udløber automatisk den{' '}
              <strong>{expiryFormatted}</strong>, og du kan til enhver tid trække den
              tilbage i Indstillinger.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <form action={rejectSetupProxy}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400"
              >
                Nej tak
              </button>
            </form>
            <form action={acceptSetupProxy}>
              <input type="hidden" name="token" value={token} />
              <SubmitButton pendingText="Aktiverer...">Ja, giv adgang</SubmitButton>
            </form>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="mt-6 block text-center text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:underline"
        >
          Til dashboard
        </Link>
      </div>
    </main>
  );
}

function InvalidLink() {
  return (
    <ErrorShell
      title="Ugyldigt link"
      body="Linket er enten forkert, allerede brugt, eller er udløbet. Bed afsenderen om at sende en ny anmodning."
    />
  );
}

function Revoked() {
  return (
    <ErrorShell
      title="Anmodningen er trukket tilbage"
      body="Den der sendte anmodningen har fortrudt eller du har allerede afvist den."
    />
  );
}

function Expired() {
  return (
    <ErrorShell
      title="Anmodningen er udløbet"
      body="Anmodninger udløber automatisk efter 7 dage. Bed afsenderen om at sende en ny."
    />
  );
}

function WrongUser() {
  return (
    <ErrorShell
      title="Forkert bruger"
      body="Du er logget ind som en anden konto end den denne anmodning er sendt til. Log ud og log ind med den rigtige konto."
    />
  );
}

function ErrorShell({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Fambud</h1>
        <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-900">{title}</h2>
          <p className="mt-2 text-sm text-amber-800">{body}</p>
        </div>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm font-medium text-neutral-900 hover:underline"
        >
          Til dashboard
        </Link>
      </div>
    </main>
  );
}
