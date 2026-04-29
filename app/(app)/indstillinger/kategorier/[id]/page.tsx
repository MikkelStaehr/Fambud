import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCategoryById } from '@/lib/dal';
import { updateCategory } from '../../actions';

export default async function EditKategoriPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const category = await getCategoryById(id);

  const action = updateCategory.bind(null, id);
  const fieldClass =
    'mt-1.5 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900';

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/indstillinger"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="h-3 w-3" />
        Tilbage til indstillinger
      </Link>

      <header className="mt-3 border-b border-neutral-200 pb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
          Rediger kategori
        </h1>
      </header>

      <form action={action} className="mt-6 max-w-md space-y-5">
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-neutral-600">
            Navn
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={category.name}
            className={fieldClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="kind" className="block text-xs font-medium text-neutral-600">
              Type
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue={category.kind}
              className={fieldClass}
            >
              <option value="expense">Udgift</option>
              <option value="income">Indtægt</option>
            </select>
          </div>

          <div>
            <label htmlFor="color" className="block text-xs font-medium text-neutral-600">
              Farve
            </label>
            <input
              id="color"
              name="color"
              type="color"
              defaultValue={category.color}
              className="mt-1.5 block h-10 w-full cursor-pointer rounded-md border border-neutral-300 bg-white p-1"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Gem ændringer
          </button>
          <Link
            href="/indstillinger"
            className="text-sm font-medium text-neutral-500 hover:text-neutral-900"
          >
            Annullér
          </Link>
        </div>
      </form>
    </div>
  );
}
