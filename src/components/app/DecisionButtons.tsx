import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/state/SessionProvider";
import { dismissReasons } from "@/state/demo";
import { reasonText } from "@/state/format";
import type { Decision } from "@/state/types";

export function DecisionButtons({
  code,
  decision,
  onDecided,
}: {
  code: string;
  decision: Decision;
  onDecided?: () => void;
}) {
  const s = useSession();
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();

  const doDecide = (d: "real_error" | "not_error", reason?: string) => {
    const e = s.decide(code, d, reason);
    if (e) {
      setError(e);
      return;
    }
    setError(undefined);
    setPicking(false);
    onDecided?.();
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <Button size="sm" variant={decision === "real_error" ? "default" : "outline"} onClick={() => doDecide("real_error")}>
          Real error
        </Button>
        <Button size="sm" variant={decision === "not_error" ? "secondary" : "outline"} onClick={() => setPicking((p) => !p)}>
          Not an error
        </Button>
      </div>
      {picking && (
        <div className="text-sm text-neutral-600">
          If not an error, pick a reason (optional note):
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {dismissReasons.map((r) => (
              <button
                key={r}
                className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs hover:bg-neutral-100"
                onClick={() => doDecide("not_error", reasonText(r, note))}
              >
                {r}
              </button>
            ))}
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="optional note"
              className="h-7 w-40 text-xs"
            />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
