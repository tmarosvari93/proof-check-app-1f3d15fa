/**
 * Findings: turns compare results into the list the checker decides on.
 * Codes: F = spec finding, C = send-back line (unrequested.ts), U = unrequested change (unrequested.ts).
 *
 * Counting (R12): matches are never open. A field is a spec finding when its value is wrong (mismatch,
 * missing) or could not be read, and the allergen rule is a second finding on a field whose value matches.
 * One field gives one finding, however many times it is printed (R6, R9).
 */
import type { Finding, FindingKind } from "./sendBack";
import type { FieldResult } from "./compare";

export type CheckKind = FindingKind | "could_not_read" | "allergen_could_not_check";

export interface CheckFinding extends Omit<Finding, "kind"> {
  kind: CheckKind;
  fieldId: string;
  /** How many times the value is printed and wrong (name: front and back = 2). */
  occurrences?: number;
}

const SENDABLE: ReadonlySet<string> = new Set<FindingKind>([
  "spec_mismatch", "spec_missing", "allergen_not_emphasised", "font_too_small",
  "comment_not_done", "unrequested_modified", "unrequested_added", "unrequested_removed", "manual",
]);

/** Spec findings in field order, coded F1, F2, ... */
export function toFindings(results: FieldResult[], firstNumber = 1): CheckFinding[] {
  const out: CheckFinding[] = [];
  let n = firstNumber;
  const add = (f: Omit<CheckFinding, "code" | "decision">) => out.push({ code: `F${n++}`, decision: "open", ...f });
  for (const r of results) {
    const base = { fieldId: r.id, label: r.label, specValue: r.specValue };
    if (r.verdict === "mismatch") {
      add({ ...base, kind: "spec_mismatch", foundValue: r.foundValue, occurrences: r.occurrences.filter((o) => o.verdict === "mismatch").length });
    } else if (r.verdict === "missing") {
      add({ ...base, kind: "spec_missing", foundValue: null });
    } else if (r.verdict === "could_not_read") {
      add({ ...base, kind: "could_not_read", foundValue: null });
    } else if (r.allergen?.status === "not_emphasised") {
      add({ ...base, kind: "allergen_not_emphasised", foundValue: r.foundValue, words: r.allergen.words });
    } else if (r.allergen?.status === "could_not_check") {
      add({ ...base, kind: "allergen_could_not_check", foundValue: r.foundValue });
    }
  }
  return out;
}

/** Every finding needs a decision. Matches are not findings, so they never reach here. */
export function needsDecision(f: CheckFinding): boolean {
  return f.decision === "open" || f.decision === "needs_discussion";
}

export function openCount(findings: CheckFinding[]): number {
  return findings.filter(needsDecision).length;
}

/** Findings that can become a Hungarian send-back line (could-not-read items need the checker's own line). */
export function sendable(findings: CheckFinding[]): Finding[] {
  return findings.filter((f): f is Finding & CheckFinding => SENDABLE.has(f.kind)) as Finding[];
}

/** Matches are counted from the value verdict only. */
export function countMatches(results: FieldResult[]): number {
  return results.filter((r) => r.verdict === "match").length;
}
