export function ProofPlaceholder({ className, note }: { className?: string; note?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md border border-neutral-300 bg-neutral-100 text-sm text-neutral-500 ${className ?? ""}`}
    >
      <p>Proof preview: not built in this prototype.</p>
      {note && <p className="mt-1">{note}</p>}
    </div>
  );
}
