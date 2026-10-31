/** The grey stand-in for every proof viewer area in the wireframes. */
export function ProofPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={`border rounded bg-muted/30 p-6 text-sm text-muted-foreground flex items-center justify-center ${
        className ?? "min-h-[420px]"
      }`}
    >
      Proof preview: not built in this prototype.
    </div>
  );
}
