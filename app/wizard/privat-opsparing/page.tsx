import Link from 'next/link';
import { Shield, X } from 'lucide-react';
import { getHouseholdContext, getMyMembership } from '@/lib/dal';
import {
  createBufferSavings,
  createPrivateSavings,
  removePrivateSavings,
} from './actions';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

export default async function WizardPrivatOpsparingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';
  const totalSteps = isOwner ? 7 : 5;
  // Owner continues to fælleskonti next; partner skips straight to kredit-laan
  // (they don't add shared accounts).
  const nextHref = isOwner ? '/wizard/faelleskonti' : '/wizard/kredit-laan';

  // Show the user's existing private savings so they know they've added one.
  // Filter by created_by + kind so other members' accounts don't bleed in.
  const { supabase, user } = await getHouseholdContext();
  const { data: existing } = await supabase
    .from('accounts')
    .select('id, name, savings_purposes')
    .eq('created_by', user.id)
    .eq('kind', 'savings')
    .order('created_at', { ascending: true });

  const hasAny = (existing?.length ?? 0) > 0;
  // Buffer-anbefalingskortet skjules når brugeren allerede har en konto med
  // 'buffer'-tag — så genkender vi at de har sat det op (ad denne sti eller
  // tidligere) og holder op med at foreslå.
  const hasBuffer = (existing ?? []).some((a) =>
    a.savings_purposes?.includes('buffer')
  );

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 3 af {totalSteps}
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Privat opsparing
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Konti der er dine alene — aldersopsparing, fri opsparing osv. Tilføj
        så mange du vil, eller hop over.
      </p>

      {/* Buffer-anbefaling: den ENE opsparing vi aktivt foreslår, fordi den er
          fundamentet (jobtab, sygdom, akut reparation). En klik opretter
          kontoen med 'buffer'-tag, så dashboardet senere ikke genadvarer. */}
      {!hasBuffer && (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
              <Shield className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-emerald-900">
                Vi anbefaler at I starter med en buffer
              </h2>
              <p className="mt-1 text-xs text-emerald-900/80">
                Bufferen er nødfond til jobtab, sygdom og akut reparation —
                det er fundamentet i jeres økonomi. Tommelfingerregel: kunne
                dække 3 mdr af jeres faste udgifter som minimum.
              </p>
              <form action={createBufferSavings} className="mt-3">
                <button
                  type="submit"
                  className="rounded-md bg-emerald-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-800"
                >
                  Opret bufferkonto
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {hasAny && (
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 bg-white">
          {existing!.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between border-b border-neutral-100 px-4 py-2 text-sm last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-neutral-900">{a.name}</span>
                {a.savings_purposes?.includes('buffer') ? (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                    Buffer
                  </span>
                ) : (
                  <span className="text-xs text-neutral-500">Opsparing</span>
                )}
              </div>
              <form action={removePrivateSavings}>
                <input type="hidden" name="id" value={a.id} />
                <button
                  type="submit"
                  className="rounded p-1 text-neutral-300 transition hover:bg-red-50 hover:text-red-700"
                  title="Fjern konto"
                  aria-label={`Fjern ${a.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      {/* Reset the form on each successful add by keying off the count. The
          server action re-renders in place; without a changing key the
          uncontrolled inputs would keep the just-submitted text. */}
      <form
        key={existing?.length ?? 0}
        action={createPrivateSavings}
        className="mt-4 space-y-4 rounded-md border border-neutral-200 bg-white p-4"
      >
        <div>
          <label htmlFor="savings_name" className={labelClass}>
            Navn
          </label>
          <input
            id="savings_name"
            name="name"
            type="text"
            required
            placeholder="F.eks. Aldersopsparing eller Buffer"
            className={fieldClass}
          />
        </div>

        <label className="flex items-start gap-3 text-sm text-neutral-700 select-none">
          <input
            type="checkbox"
            name="editable_by_all"
            defaultChecked
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
          />
          <span>
            <span className="font-medium text-neutral-900">
              Alle i husstanden kan redigere
            </span>
            <span className="mt-0.5 block text-xs text-neutral-500">
              Slå fra for konti du vil holde private.
            </span>
          </span>
        </label>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-md border border-neutral-900 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-50"
        >
          Tilføj opsparing
        </button>
      </form>

      <p className="mt-3 text-xs text-neutral-500">
        Du kan tilføje så mange du vil. Klik <span className="text-neutral-700">Næste</span> når du er færdig.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          href={nextHref}
          className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Næste
        </Link>
        {!hasAny && (
          <Link
            href={nextHref}
            className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Hop over
          </Link>
        )}
      </div>
    </div>
  );
}
