import type { Decision, Round } from "@/state/types";
import { ProofPlaceholder } from "./ProofPlaceholder";

const colour = (d: Decision) =>
  d === "not_error" ? "border-green-600 text-green-700 bg-green-600" : d === "real_error" ? "border-neutral-700 bg-neutral-700" : "border-red-600 bg-red-600";

export function ProofView({
  round,
  decisionOf,
  active,
  onPick,
}: {
  round: Round;
  decisionOf: (code: string) => Decision;
  active: string | null;
  onPick: (code: string) => void;
}) {
  const markers = round.markers ?? [];
  return (
    <div>
      {round.preview ? (
        <div className="relative overflow-hidden rounded-md border border-neutral-300 bg-white">
          <img src={round.preview} alt="Proof page" className="block h-auto w-full object-contain" />
          {markers.map((m) => {
            const isActive = active === m.code;
            const c = colour(decisionOf(m.code));
            return (
              <button
                key={m.code}
                type="button"
                aria-label={`Show finding ${m.code}`}
                onClick={() => onPick(m.code)}
                className={`absolute bg-transparent ${c.split(" ")[0]} ${isActive ? "z-10 border-4" : "border-2 opacity-60 hover:opacity-100"}`}
                style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
              >
                <span className={`absolute left-0 top-0 px-1 text-[10px] font-bold leading-4 text-white ${c.split(" ").pop()}`}>
                  {m.code}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <ProofPlaceholder className="h-[28rem]" />
      )}
      {markers.length > 0 ? (
        <p className="mt-2 text-xs text-neutral-500">
          Marks show where the app found each finding. Findings without a mark (missing text) have no place on the proof.
        </p>
      ) : round.readMode === "ai" ? (
        <p className="mt-2 text-xs text-neutral-500">
          This proof is an image. The app reads it with AI but does not know exact positions, so there are no marks.
        </p>
      ) : null}
    </div>
  );
}
