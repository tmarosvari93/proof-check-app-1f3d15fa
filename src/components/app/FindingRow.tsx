import { useState } from "react";
import type { CheckFinding, Decision, FieldResult } from "@/state/types";
import { badgeOf, summaryOf } from "@/state/format";
import { Chip, DecisionChip } from "./Chip";
import { DecisionButtons } from "./DecisionButtons";

export function FindingRow({
  finding,
  result,
  decision,
  expanded,
  onToggle,
  onDecided,
  readOnly = false,
}: {
  finding: CheckFinding;
  result?: FieldResult | undefined;
  decision: Decision;
  expanded: boolean;
  onToggle: () => void;
  onDecided: () => void;
  readOnly?: boolean;
}) {
  const [changing, setChanging] = useState(false);
  const isOpen = decision === "open" || decision === "needs_discussion";
  const showButtons = !readOnly && (isOpen || changing);
  return (
    <div className={`border-b border-neutral-200 last:border-b-0 ${expanded ? "bg-neutral-50" : ""}`}>
      <div className="flex w-full items-start gap-3 px-3 py-2">
        <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={onToggle}>
          <span className="pt-0.5 text-sm font-semibold text-neutral-500">{finding.code}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{finding.label}</span>
            <span className="block text-sm text-neutral-600">{summaryOf(finding, result)}</span>
          </span>
          <Chip tone="plain">{badgeOf(finding)}</Chip>
        </button>
        {!readOnly && !isOpen ? (
          <button type="button" title="Change decision" onClick={() => setChanging((c) => !c)}>
            <DecisionChip decision={decision} />
          </button>
        ) : (
          <DecisionChip decision={decision} />
        )}
      </div>
      {expanded && (
        <div className="border-t border-neutral-100 px-3 py-3">
          <dl className="grid grid-cols-[4rem_1fr] gap-y-1 text-sm">
            <dt className="text-neutral-500">Spec</dt>
            <dd>{finding.specValue}</dd>
            <dt className="text-neutral-500">Proof</dt>
            <dd>{finding.foundValue ?? "not found"}</dd>
            {finding.where && (
              <>
                <dt className="text-neutral-500">Where</dt>
                <dd>{finding.where}</dd>
              </>
            )}
          </dl>
          {finding.kind === "spec_mismatch" && result && result.diff.length > 0 && (
            <div className="mt-2 text-sm">
              <p>
                {result.diff.map((op, i) =>
                  op.type === "same" ? (
                    <span key={i}>{op.text}</span>
                  ) : op.type === "del" ? (
                    <span key={i} className="text-red-800/60 line-through">{op.text}</span>
                  ) : (
                    <span key={i} className="font-bold text-green-700">{op.text}</span>
                  ),
                )}
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">struck: spec only · bold: proof only</p>
            </div>
          )}
          {finding.kind === "allergen_not_emphasised" && (finding.words?.length ?? 0) > 0 && (
            <p className="mt-2 text-sm">Must be bold: {finding.words!.join(", ")}</p>
          )}
        </div>
      )}
      {showButtons && (
        <div className="px-3 pb-3">
          <DecisionButtons
            code={finding.code}
            decision={decision}
            onDecided={() => {
              setChanging(false);
              onDecided();
            }}
          />
        </div>
      )}
    </div>
  );
}
