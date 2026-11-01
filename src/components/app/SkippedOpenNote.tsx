export function SkippedOpenNote({ codes }: { codes?: readonly string[] | undefined }) {
  if (!codes || codes.length === 0) return null;
  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Checker 1 left {codes.join(", ")} undecided.
    </div>
  );
}
