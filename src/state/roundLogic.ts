/**
 * What the checker has to decide in a round, and the send-back list built from the decisions.
 * Pure. Real logic (not mocked): uses sendBack.ts. Claude owns this file.
 */
import { buildSendBack, type Finding, type SendBackItem } from "../core/sendBack";
import { sendable, type CheckFinding } from "../core/findings";
import type { Decision, LineCheck, Round, UnrequestedItem } from "./types";
import { kindLabel } from "./labels";

export type ItemKind = "finding" | "line" | "unrequested";

export interface ReviewItem {
  code: string; // F1, C3, U2
  kind: ItemKind;
  /** False for an unrequested change already listed under a spec finding (linkedTo): it follows that finding. */
  needsDecision: boolean;
  /** Code of the spec finding that already reports the same problem. The item follows that finding. */
  linkedTo?: string;
}

/** C codes follow the order of the previous send-back lines: C1, C2, ... */
export const lineCode = (index: number) => `C${index + 1}`;

/** A previous line that is still not done, and whose field has a spec finding now, is the same problem (R8/R9). */
export function findingForLine(round: Round, l: LineCheck): string | undefined {
  if (!l.fieldId) return undefined;
  return round.findings.find((f) => f.fieldId === l.fieldId)?.code;
}

export function reviewItems(round: Round): ReviewItem[] {
  const out: ReviewItem[] = round.findings.map((f) => ({ code: f.code, kind: "finding" as const, needsDecision: true }));
  (round.lineChecks ?? []).forEach((l, i) => {
    // Done lines need nothing. Not done and Check by hand need the checker.
    if (l.verdict === "done") return;
    const linked = findingForLine(round, l);
    out.push({ code: lineCode(i), kind: "line", needsDecision: !linked, ...(linked ? { linkedTo: linked } : {}) });
  });
  for (const u of round.unrequested ?? []) {
    out.push({ code: u.code, kind: "unrequested", needsDecision: !u.linkedTo, ...(u.linkedTo ? { linkedTo: u.linkedTo } : {}) });
  }
  return out;
}

export const decisionOf = (round: Round, code: string): Decision => round.decisions[code] ?? "open";

export function openCount(round: Round): number {
  return reviewItems(round).filter((i) => i.needsDecision && ["open", "needs_discussion"].includes(decisionOf(round, i.code))).length;
}

const unrequestedKind = (u: UnrequestedItem) =>
  u.change.type === "added" ? "unrequested_added" : u.change.type === "removed" ? "unrequested_removed" : "unrequested_modified";

/** The send-back list for a round: the lines for the items the checker marked as real errors. */
export function buildRoundSendBack(round: Round): SendBackItem[] {
  const real = (code: string) => decisionOf(round, code) === "real_error";
  const list: Finding[] = [];
  for (const f of round.findings as CheckFinding[]) {
    list.push({ ...f, decision: real(f.code) ? "real_error" : "not_error" } as CheckFinding as unknown as Finding);
  }
  (round.lineChecks ?? []).forEach((l, i) => {
    const code = lineCode(i);
    if (l.verdict === "done") return;
    const linked = findingForLine(round, l);
    list.push({
      code,
      kind: "comment_not_done",
      decision: (linked ? real(linked) : real(code)) ? "real_error" : "not_error",
      commentText: l.text,
      ...(linked ? { relatedTo: linked } : {}),
    });
  });
  for (const u of round.unrequested ?? []) {
    list.push({
      code: u.code,
      kind: unrequestedKind(u),
      // A linked change follows its spec finding: it is real exactly when that finding is.
      decision: (u.linkedTo ? real(u.linkedTo) : real(u.code)) ? "real_error" : "not_error",
      before: u.change.before,
      after: u.change.after,
      ...(u.linkedTo ? { relatedTo: u.linkedTo } : {}),
    });
  }
  return buildSendBack(sendable(list as unknown as CheckFinding[])).items;
}

export interface Dismissal {
  /** Unique across rounds: "2:U2". Key for checker2Agreed. */
  key: string;
  round: number;
  code: string;
  /** What the item is about, e.g. "Allergen emphasis" or "New claim added". */
  label: string;
  /** What the check said, e.g. "Allergen not emphasised: TELJES TEJPOR". */
  summary: string;
  reason: string;
}

function describe(round: Round, code: string): { label: string; summary: string } {
  const f = round.findings.find((x) => x.code === code);
  if (f) {
    const what = kindLabel[f.kind];
    const detail = f.words?.length ? `: ${f.words.join(", ")}` : f.foundValue ? `: ${f.foundValue}` : "";
    return { label: f.label ?? f.fieldId, summary: what + detail };
  }
  const u = (round.unrequested ?? []).find((x) => x.code === code);
  if (u) return { label: u.what, summary: `${u.change.before ?? "(nothing)"} → ${u.change.after ?? "(removed)"}` };
  const i = (round.lineChecks ?? []).findIndex((_, n) => lineCode(n) === code);
  if (i >= 0) return { label: "Earlier comment", summary: round.lineChecks![i]!.text };
  return { label: code, summary: "" };
}

/** All dismissals (decision not_error) across rounds, for Checker 2 and the lead. */
export function dismissalsOf(rounds: Round[]): Dismissal[] {
  return rounds.flatMap((r) =>
    Object.entries(r.decisions)
      .filter(([, d]) => d === "not_error")
      .map(([code]) => ({ key: `${r.no}:${code}`, round: r.no, code, reason: r.dismissals[code] ?? "", ...describe(r, code) })),
  );
}

export interface PreviousLine {
  n: number;
  code: string;
  text: string;
  /** Panel of the finding the line came from, when known. */
  where?: string;
}

/** The lines sent back in the previous round, as the designer sees them on the upload page. */
export function previousLines(rounds: Round[], current: number): PreviousLine[] {
  const prev = rounds[current - 2];
  if (!prev) return [];
  return prev.sendBack.map((it, i) => {
    const where = prev.findings.find((f) => f.code === it.code)?.where ?? prev.unrequested?.find((u) => u.code === it.code)?.where;
    return { n: i + 1, code: it.code, text: it.text, ...(where ? { where } : {}) };
  });
}
