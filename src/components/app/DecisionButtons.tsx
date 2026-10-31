import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dismissReasons } from "@/state/demo";
import { reasonText } from "@/state/format";
import type { Decision } from "@/state/types";

export function StatusChip({ decision }: { decision: Decision }) {
  if (decision === "real_error") {
    return <span className="shrink-0 bg-primary text-primary-foreground text-xs rounded px-2 py-0.5">Real error</span>;
  }
  if (decision === "not_error") {
    return <span className="shrink-0 border bg-muted text-xs rounded px-2 py-0.5">Not an error</span>;
  }
  return <span className="shrink-0 border border-dashed text-xs rounded px-2 py-0.5">Undecided</span>;
}

interface DecisionButtonsProps {
  code: string;
  decision: Decision;
  onRealError: (code: string) => void;
  onNotError: (code: string, reason: string) => void;
}

/** Real error / Not an error, with the reason chips and optional note for a dismissal. */
export function DecisionButtons({ code, decision, onRealError, onNotError }: DecisionButtonsProps) {
  const [showReason, setShowReason] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onRealError(code)}>
          Real error
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowReason(true)}>
          Not an error
        </Button>
      </div>
      {showReason && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">If not an error, pick a reason (optional note):</span>
          {dismissReasons.map((chip) => (
            <button
              key={chip}
              type="button"
              className="border rounded-full px-2 py-0.5 text-xs"
              onClick={() => onNotError(code, reasonText(chip, note))}
            >
              {chip}
            </button>
          ))}
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
            className="h-7 w-44 text-xs"
          />
        </div>
      )}
    </div>
  );
}
