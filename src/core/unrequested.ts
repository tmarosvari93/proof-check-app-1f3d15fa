/**
 * Round 2 and later, on top of diff.ts. Pure; no AI judges anything here.
 *
 *  - recheckSendBack: was each line of the previous send-back list fixed? Plain code re-reads the spec
 *    field the line points to. Done / Not done / Check by hand (a hand-typed line, or a field that
 *    could not be read).
 *  - markUnrequested: every content change that no send-back line asked for.
 *  - linkRelated: an unrequested change that is the same problem as a spec finding is listed once (R9).
 *  - compareRounds: all of the above in one call (what runCheck uses for rounds 2+).
 */
import type { Block } from "./textLayer";
import type { FieldResult } from "./compare";
import type { CheckFinding } from "./findings";
import { locateAll, squash, type LocatableField } from "./locate";
import { diffBlocks, type BlockDiffItem, type DiffOptions } from "./diff";

export type LineVerdict = "done" | "not_done" | "check_by_hand";

/** A line of the previous send-back list, with what it points to. */
export interface SendLine {
  /** Code of the finding the line came from, e.g. "F2". Hand-typed lines are "M1". */
  code: string;
  text: string;
  /** Spec field the line is about. A hand-typed line has none. */
  fieldId?: string;
  /** For a line that rejects an unrequested change: the text to be gone (or back). */
  about?: { text: string; expect: "absent" | "present" };
}

export interface LineCheckResult {
  code: string;
  text: string;
  verdict: LineVerdict;
  fieldId?: string;
}

export function recheckSendBack(lines: SendLine[], results: FieldResult[], pageText?: string): LineCheckResult[] {
  const page = pageText === undefined ? undefined : squash(pageText);
  return lines.map((line) => {
    const base = { code: line.code, text: line.text, ...(line.fieldId ? { fieldId: line.fieldId } : {}) };
    if (line.fieldId) {
      const r = results.find((x) => x.id === line.fieldId);
      if (!r || r.verdict === "could_not_read" || r.allergen?.status === "could_not_check") return { ...base, verdict: "check_by_hand" as const };
      const ok = r.verdict === "match" && (r.allergen?.status ?? "ok") === "ok";
      return { ...base, verdict: ok ? ("done" as const) : ("not_done" as const) };
    }
    if (line.about && page !== undefined) {
      const present = page.includes(squash(line.about.text));
      return { ...base, verdict: present === (line.about.expect === "present") ? ("done" as const) : ("not_done" as const) };
    }
    return { ...base, verdict: "check_by_hand" as const };
  });
}

/** For each block id: field id -> the printed text of that field in that block. */
export type FieldMap = Map<string, Record<string, string>>;

export function fieldMap(fields: LocatableField[], blocks: Block[]): FieldMap {
  const map: FieldMap = new Map();
  const found = locateAll(fields, blocks);
  for (const [fieldId, occs] of Object.entries(found)) {
    for (const o of occs) {
      const row = map.get(o.blockId) ?? {};
      row[fieldId] = ((row[fieldId] ?? "") + " " + o.text).replace(/\s+/g, " ").trim(); // case counts
      map.set(o.blockId, row);
    }
  }
  return map;
}

/** Fields whose printed text changed inside the blocks of this change. */
export function relatedFields(item: BlockDiffItem, previous: FieldMap, current: FieldMap): string[] {
  const before: Record<string, string> = {};
  const after: Record<string, string> = {};
  for (const id of item.beforeIds) Object.assign(before, previous.get(id) ?? {});
  for (const id of item.afterIds) Object.assign(after, current.get(id) ?? {});
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  // Same words, other emphasis: every field printed in the block is touched.
  if (item.note === "emphasis changed") return [...ids];
  return [...ids].filter((id) => before[id] !== after[id]);
}

export interface UnrequestedChange {
  code: string; // "U1"
  change: BlockDiffItem;
  what: string;
  where?: string;
  linkedTo?: string;
  fieldIds: string[];
}

const REAL: ReadonlySet<string> = new Set(["modified", "added", "removed"]);

/** Changes that no send-back line asked for. Moved-only and unchanged blocks are never returned. */
export function markUnrequested(
  items: BlockDiffItem[],
  lines: SendLine[],
  previous: FieldMap,
  current: FieldMap,
  labels: Record<string, string> = {},
): UnrequestedChange[] {
  const asked = new Set(lines.map((l) => l.fieldId).filter((x): x is string => !!x));
  const aboutTexts = lines.map((l) => (l.about ? squash(l.about.text) : "")).filter(Boolean);
  const out: UnrequestedChange[] = [];
  for (const item of items) {
    if (!REAL.has(item.type)) continue;
    const fields = relatedFields(item, previous, current);
    if (fields.some((f) => asked.has(f))) continue;
    const text = squash(`${item.before ?? ""} ${item.after ?? ""}`);
    if (aboutTexts.some((t) => text.includes(t))) continue;
    const kind = item.type === "added" ? "new text added" : item.type === "removed" ? "text removed" : "text changed";
    const what = fields.length ? `${labels[fields[0]!] ?? fields[0]}: ${kind}` : kind.charAt(0).toUpperCase() + kind.slice(1);
    out.push({ code: `U${out.length + 1}`, change: item, what, ...(item.where ? { where: item.where } : {}), fieldIds: fields });
  }
  return out;
}

/** An unrequested change that is the same problem as a spec finding is linked to it and listed once. */
export function linkRelated(unrequested: UnrequestedChange[], findings: Pick<CheckFinding, "code" | "fieldId">[]): UnrequestedChange[] {
  return unrequested.map((u) => {
    const hit = findings.find((f) => u.fieldIds.includes(f.fieldId));
    return hit ? { ...u, linkedTo: hit.code } : u;
  });
}

export interface RoundInput {
  previous: Block[];
  current: Block[];
  page: DiffOptions["page"];
  fields: LocatableField[];
  /** Lines actually sent after round N-1 (edited, with hand-typed ones). */
  lines: SendLine[];
  /** This round's spec comparison (compareAll) and its findings (toFindings). */
  results: FieldResult[];
  findings: Pick<CheckFinding, "code" | "fieldId">[];
  /** Share of the page a block must shift to count as moved. AI-read blocks report rough centres: use more (0.08, spike). */
  moveThreshold?: number | undefined;
}

export function compareRounds(input: RoundInput) {
  const headings = input.fields.map((f) => f.label);
  const { items, unchanged } = diffBlocks(input.previous, input.current, {
    page: input.page,
    headings,
    ...(input.moveThreshold !== undefined ? { moveThreshold: input.moveThreshold } : {}),
  });
  const prevMap = fieldMap(input.fields, input.previous);
  const curMap = fieldMap(input.fields, input.current);
  const labels = Object.fromEntries(input.fields.map((f) => [f.id, f.label]));
  const lineChecks = recheckSendBack(input.lines, input.results, input.current.map((b) => b.text).join("\n"));
  const unrequested = linkRelated(markUnrequested(items, input.lines, prevMap, curMap, labels), input.findings);
  return { diff: items, unchanged, lineChecks, unrequested };
}
