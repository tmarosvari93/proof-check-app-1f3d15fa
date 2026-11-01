import type { Decision, Marker } from "@/state/types";

/** Proof preview image with one rectangle per finding mark (positions in percent of the page). */
export function ProofView({
  preview,
  markers,
  readMode,
  expanded,
  decisionOf,
  onMark,
}: {
  preview: string;
  markers: Marker[];
  readMode: string;
  expanded: string | null;
  decisionOf: (code: string) => Decision;
  onMark: (code: string) => void;
}) {
  const colour = (code: string) => {
    const d = decisionOf(code);
    if (d === "not_error") return { border: "border-green-600", label: "bg-green-600" };
    if (d === "real_error") return { border: "border-neutral-700", label: "bg-neutral-700" };
    return { border: "border-red-600", label: "bg-red-600" };
  };
  return (
    <div>
      <div className="relative overflow-hidden rounded-md border border-neutral-300">
        <img src={preview} alt="Proof preview" className="block h-auto w-full" />
        {markers.map((m) => {
          const c = colour(m.code);
          const active = expanded === m.code;
          const dim = expanded !== null && !active;
          return (
            <button
              key={m.code}
              type="button"
              aria-label={`Mark ${m.code}`}
              onClick={() => onMark(m.code)}
              className={`absolute bg-transparent ${c.border} ${active ? "z-10 border-4" : "border-2"} ${dim ? "opacity-40" : ""}`}
              style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
            >
              <span className={`absolute left-0 top-0 -translate-y-full px-1 text-[10px] font-bold leading-tight text-white ${c.label}`}>
                {m.code}
              </span>
            </button>
          );
        })}
      </div>
      {readMode === "ai" ? (
        <p className="mt-2 text-sm text-neutral-500">
          This proof is an image. The app reads it with AI but does not know exact positions, so there are no marks.
        </p>
      ) : markers.length > 0 ? (
        <p className="mt-2 text-sm text-neutral-500">
          Marks show where the app found each finding. Findings without a mark (missing text) have no place on the proof.
        </p>
      ) : null}
    </div>
  );
}
