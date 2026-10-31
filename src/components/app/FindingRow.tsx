import { Badge } from "@/components/ui/badge";
import type { FieldResult } from "@/core/compare";
import type { CheckFinding } from "@/core/findings";
import { badgeOf, summaryOf } from "@/state/format";
import type { Decision } from "@/state/types";
import { DecisionButtons, StatusChip } from "@/components/app/DecisionButtons";
import type { DiffOp } from "@/core/compare";

function renderOp(op: DiffOp, i: number) {
  if (op.type === "del") {
    return (
      <del key={i} className="line-through text-red-800">
        {op.text}{" "}
      </del>
    );
  }
  if (op.type === "ins") {
    return (
      <ins key={i} className="no-underline font-bold text-green-800">
        {op.text}{" "}
      </ins>
    );
  }
  return <span key={i}>{op.text} </span>;
}

interface FindingRowProps {
  finding: CheckFinding;
  result: FieldResult | undefined;
  decision: Decision;
  expanded: boolean;
  onToggle: () => void;
  onRealError: (code: string) => void;
  onNotError: (code: string, reason: string) => void;
}

/** One expandable spec finding row with its decision buttons. */
export function FindingRow({ finding, result, decision, expanded, onToggle, onRealError, onNotError }: FindingRowProps) {
  return (
    <div className="p-3">
      <button type="button" onClick={onToggle} className="w-full text-left flex items-start gap-3">
        <span className="w-10 shrink-0 text-sm font-bold">{finding.code}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold">{finding.label}</span>
          <span className="block text-sm text-muted-foreground">{summaryOf(finding, result)}</span>
        </span>
        <Badge variant="outline" className="shrink-0">
          {badgeOf(finding)}
        </Badge>
        <StatusChip decision={decision} />
      </button>
      {expanded && (
        <div className="mt-3 pl-10 text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Spec</span> <b>{finding.specValue}</b>
          </p>
          <p>
            <span className="text-muted-foreground">Proof</span> <b>{finding.foundValue ?? "not found"}</b>
          </p>
          {finding.where ? (
            <p>
              <span className="text-muted-foreground">Where</span> {finding.where}
            </p>
          ) : null}
          {finding.kind === "spec_mismatch" && result && result.diff.length > 0 && (
            <div>
              <p>{result.diff.map(renderOp)}</p>
              <p className="text-xs text-muted-foreground">struck: spec only · bold: proof only</p>
            </div>
          )}
          {finding.kind === "allergen_not_emphasised" && finding.words?.length ? (
            <p>
              <span className="text-muted-foreground">Must be bold:</span> {finding.words.join(", ")}
            </p>
          ) : null}
          <div className="pt-2">
            <DecisionButtons code={finding.code} decision={decision} onRealError={onRealError} onNotError={onNotError} />
          </div>
        </div>
      )}
    </div>
  );
}
