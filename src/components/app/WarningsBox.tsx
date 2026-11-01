/** Amber box listing plain-sentence warnings (spec read or proof read). Shows nothing when empty. */
export function WarningsBox({ warnings, title }: { warnings?: string[] | undefined; title?: string | undefined }) {
  if (!warnings?.length) return null;
  return (
    <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {title && <p className="font-semibold">{title}</p>}
      <ul className={title ? "mt-1 space-y-0.5" : "space-y-0.5"}>
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
