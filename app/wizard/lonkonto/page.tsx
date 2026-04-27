import { getMyMembership } from '@/lib/dal';
import { createPersonalAccount } from './actions';

const fieldClass =
  'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';
const labelClass = 'block text-xs font-medium text-neutral-600';

export default async function WizardLonkontoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { membership } = await getMyMembership();
  const isOwner = membership?.role === 'owner';
  const totalSteps = isOwner ? 7 : 5;

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        Trin 1 af {totalSteps}
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
        Din lønkonto
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Opret den konto hvor du modtager løn. Du kan altid ændre den senere.
      </p>

      <form action={createPersonalAccount} className="mt-6 space-y-5">
        <div>
          <label htmlFor="name" className={labelClass}>
            Navn
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue="Lønkonto"
            placeholder="Lønkonto"
            className={fieldClass}
          />
        </div>

        {!isOwner && (
          <div className="rounded-md border border-neutral-200 bg-white p-4">
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
                  Også oprette og slette poster på kontoen. Praktisk hvis én i
                  familien står for indtastning. Slå fra for at låse til kun dig.
                </span>
              </span>
            </label>
          </div>
        )}

        {isOwner && (
          // Owner doesn't see the checkbox per the brief; we still send the
          // value so the form submits a stable shape.
          <input type="hidden" name="editable_by_all" value="on" />
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Næste
        </button>
      </form>
    </div>
  );
}
