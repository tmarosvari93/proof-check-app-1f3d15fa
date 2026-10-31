/**
 * One round of the check, from a proof page to a Round the pages can show.
 * Plain code decides every verdict; the text layer (or, in step 4, the AI) only supplies printed text.
 *
 *   checkProof  pure and synchronous: used by the app and tested in Node against answer_key.json.
 *   runCheck    browser wrapper: opens the PDF with pdf.js, times the check, calls checkProof.
 *
 * Flat (image only) proofs: until step 4 (read-proof) they are a failed read (R5): every field shows
 * Could not read, never a pass.
 */
import { compareAll, type FieldResult } from "../core/compare";
import { toFindings, countMatches, type CheckFinding } from "../core/findings";
import { panelOf } from "../core/diff";
import { compareRounds, recheckSendBack, type SendLine } from "../core/unrequested";
import type { ParsedSpec } from "../core/parseSpec";
import type { Block } from "../core/textLayer";
import type { DiffItem, LineCheck, Round, UnrequestedItem } from "../state/types";

export interface ProofPage {
  width: number;
  height: number;
  blocks: Block[];
  /** False for a flat proof: no real text on the page. */
  hasText: boolean;
  /** False when pdf.js could not give the real font names: bold words cannot be told apart. */
  fontNamesRead: boolean;
}

export interface CheckInput {
  spec: ParsedSpec;
  page: ProofPage;
  /** Round number, 1-based. */
  no: number;
  fileName: string;
  designerNote?: string;
  /** The previous round, with its send-back list as actually sent. */
  previous?: Round | undefined;
  seconds?: number;
}

/** The lines of the previous send-back list, with what each one points to (spec field or text). */
export function sendLinesOf(prev: Round): SendLine[] {
  return prev.sendBack.map((it): SendLine => {
    const text = it.text;
    const n = Number(it.code.slice(1));
    if (it.code.startsWith("F")) {
      const fieldId = prev.findings.find((f) => f.code === it.code)?.fieldId;
      return { code: it.code, text, ...(fieldId ? { fieldId } : {}) };
    }
    if (it.code.startsWith("C")) {
      const fieldId = prev.lineChecks?.[n - 1]?.fieldId;
      return { code: it.code, text, ...(fieldId ? { fieldId } : {}) };
    }
    if (it.code.startsWith("U")) {
      const u = prev.unrequested?.find((x) => x.code === it.code);
      if (u?.change.type === "removed" && u.change.before) return { code: it.code, text, about: { text: u.change.before, expect: "present" } };
      if (u?.change.after) return { code: it.code, text, about: { text: u.change.after, expect: "absent" } };
    }
    // M lines (typed by hand) and anything unknown: the checker looks.
    return { code: it.code, text };
  });
}

const slimDiff = (d: { id: string; type: DiffItem["type"]; before: string | null; after: string | null; note?: string }): DiffItem => ({
  id: d.id, type: d.type, before: d.before, after: d.after, ...(d.note ? { note: d.note } : {}),
});

/** Panel of the worst occurrence of each finding's field. Missing fields have no place on the proof. */
function withWhere(findings: CheckFinding[], results: FieldResult[], pageWidth: number): CheckFinding[] {
  return findings.map((f) => {
    const r = results.find((x) => x.id === f.fieldId);
    const occ = r?.occurrences.find((o) => o.verdict === "mismatch") ?? r?.occurrences[0];
    return occ ? { ...f, where: panelOf(occ.occurrence.box, pageWidth) } : f;
  });
}

export function checkProof(input: CheckInput): Round {
  const { spec, page, previous } = input;
  const fields = spec.fields.map((f) => ({ id: f.id, label: f.label, value: f.value }));
  const readable = page.hasText;

  const results = compareAll(fields, readable ? page.blocks : [], readable ? { emphasisKnown: page.fontNamesRead } : { readFailed: true });
  const findings = withWhere(toFindings(results), results, page.width);

  const base: Round = {
    no: input.no,
    fileName: input.fileName,
    designerNote: input.designerNote ?? "",
    readMode: readable ? "text_layer" : "failed",
    seconds: input.seconds ?? 0,
    results,
    findings,
    matches: countMatches(results),
    sendBack: [],
    decisions: {},
    dismissals: {},
    finished: false,
    ...(readable ? { blocks: page.blocks, page: { width: page.width, height: page.height } } : {}),
  };
  if (!previous) return base;

  // Round 2 and later: was each line fixed, what else changed.
  const lines = sendLinesOf(previous);
  const pageText = readable ? page.blocks.map((b) => b.text).join("\n") : undefined;
  if (readable && previous.blocks && previous.page) {
    const c = compareRounds({ previous: previous.blocks, current: page.blocks, page: { width: page.width, height: page.height }, fields, lines, results, findings });
    const unrequested: UnrequestedItem[] = c.unrequested.map((u) => ({
      code: u.code, change: slimDiff(u.change), what: u.what, ...(u.where ? { where: u.where } : {}),
      ...(u.linkedTo ? { linkedTo: u.linkedTo } : {}), fieldIds: u.fieldIds,
    }));
    return { ...base, diff: c.diff.map(slimDiff), lineChecks: c.lineChecks as LineCheck[], unrequested };
  }
  // No readable text or no previous blocks (a prepared demo state): the lines are still re-checked, but nothing is diffed.
  return { ...base, lineChecks: recheckSendBack(lines, results, pageText) as LineCheck[], unrequested: [] };
}

/** Browser: read the PDF file and run the check. Throws an Error with a message for the user. */
export async function runCheck(args: Omit<CheckInput, "page" | "seconds"> & { file: File }): Promise<Round> {
  const t0 = performance.now();
  const { readPdfPage } = await import("./renderPdf");
  const page = await readPdfPage(args.file);
  const { file: _file, ...rest } = args;
  void _file;
  return checkProof({ ...rest, page, seconds: Math.round(((performance.now() - t0) / 1000) * 10) / 10 });
}
