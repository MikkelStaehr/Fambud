// Used by the not-yet-built sidebar destinations (konti, poster, overførsler,
// indstillinger). Replaced as each page gets real content in the next prompt.
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="px-8 py-6">
      <h1 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        {title}
      </h1>
      <div className="mt-8 rounded-md border border-dashed border-neutral-300 bg-white px-4 py-16 text-center text-sm text-neutral-500">
        Kommer snart
      </div>
    </div>
  );
}
