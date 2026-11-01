/**
 * One round of the check, from a proof page to a Round the pages can show.
 * Plain code decides every verdict; the text layer (or, in step 4, the AI) only supplies printed text.
 *
 *   checkProof  pure and synchronous: used by the app and tested in Node against answer_key.json.
 *   runCheck    browser wrapper: opens the PDF with pdf.js, times the check, calls checkProof.
 *
 * Flat (image only) proofs: the browser renders the page and the read-proof function (Claude vision) reads it
 * (src/services/readProof.ts). The AI only supplies printed text; compare and diff are the same code as for a
 * text layer. If the read fails (R5) every field shows Could not read, never a pass.
 */
import { compareAll, compareField, type FieldResult } from "../core/compare";
import type { FieldsReply } from "../core/schemas";
import { toFindings, countMatches, type CheckFinding } from "../core/findings";
import { panelOf } from "../core/diff";
import { markersOf } from "../core/markers";
import { compareRounds, recheckSendBack, type SendLine } from "../core/unrequested";
import type { ParsedSpec } from "../core/parseSpec";
import type { Block } from "../core/textLayer";
import { readBlocks, readerConfig, readFields } from "./readProof";
import type { DiffItem, LineCheck, Round, UnrequestedItem } from "../state/types";

export interface ProofPage {
  width: number;
  height: number;
  blocks: Block[];
  /** False for a flat proof: no real text on the page. */
  hasText: boolean;
  /** False when pdf.js could not give the real font names: bold words cannot be told apart. */
  fontNamesRead: boolean;
  /** Flat proofs only: the rendered page for the reader and the real resolution of the embedded image (0 = unknown). */
  flat?: { jpegBase64: string; dpi: number } | undefined;
  /** JPEG data URL of the page, shown on the review screen. Absent when it could not be rendered (and in Node tests). */
  preview?: string | undefined;
}

/** What the AI reader returned for a flat proof. A null part means that read failed. */
export interface AiRead {
  fields: FieldsReply | null;
  blocks: Block[] | null;
  /** Effective dpi of the proof image. Below 100 numbers and units become Could not read (R7). */
  dpi: number;
  /** Why a read failed (the first failure), so the review screen can say it instead of only "could not be read". */
  error?: string | undefined;
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
  /** Flat proofs: what the reader returned. Absent for a text-layer proof. */
  ai?: AiRead | undefined;
}

/** The AI's printed text for each spec field as occurrences, then the same compare as for a text layer. */
export function compareAiFields(fields: { id: string; label: string; value: string }[], reply: FieldsReply, dpi: number): FieldResult[] {
  return fields.map((f) => {
    const r = reply.fields.find((x) => x.id === f.id);
    const occ =
      !r || r.status === "not_found"
        ? []
        : [{ blockId: `ai:${f.id}`, page: 1, text: r.found_text ?? "", box: [0, 0, 0, 0] as [number, number, number, number], boldWords: r.emphasised_words, ...(r.status === "unreadable" ? { unreadable: true } : {}) }];
    // The reader does say which words are emphasised, so the allergen rule can run.
    return compareField(f, occ, { dpi, emphasisKnown: true });
  });
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
  const aiFields = !readable ? (input.ai?.fields ?? null) : null;
  const readMode: Round["readMode"] = readable ? "text_layer" : aiFields ? "ai" : "failed";
  const dpi = input.ai?.dpi ?? 0;

  const results = readable
    ? compareAll(fields, page.blocks, { emphasisKnown: page.fontNamesRead })
    : aiFields
      ? compareAiFields(fields, aiFields, dpi)
      : compareAll(fields, [], { readFailed: true });
  // The AI gives no exact box, so only a text-layer read can say which panel a finding is on.
  const findings = readable ? withWhere(toFindings(results), results, page.width) : toFindings(results);
  // Blocks of this proof, kept for the next round's diff: from the text layer, or from the AI block read.
  const blocks: Block[] | undefined = readable ? page.blocks : (input.ai?.blocks ?? undefined);
  // Marks on the preview image: only where a real text box is known (text-layer read).
  const markers = readable ? markersOf(findings, results, page) : [];

  const base: Round = {
    no: input.no,
    fileName: input.fileName,
    designerNote: input.designerNote ?? "",
    readMode,
    ...(readMode === "ai" ? { dpi } : {}),
    seconds: input.seconds ?? 0,
    results,
    findings,
    matches: countMatches(results),
    ...(input.ai?.error ? { readError: input.ai.error } : {}),
    sendBack: [],
    decisions: {},
    dismissals: {},
    finished: false,
    ...(blocks ? { blocks, page: { width: page.width, height: page.height } } : {}),
    ...(page.preview ? { preview: page.preview } : {}),
    ...(markers.length ? { markers } : {}),
  };
  if (!previous) return base;

  // Round 2 and later: was each line fixed, what else changed.
  const lines = sendLinesOf(previous);
  const pageText = blocks ? blocks.map((b) => b.text).join("\n") : undefined;
  if (blocks && previous.blocks && previous.page) {
    const aiBlocks = readMode === "ai" || previous.readMode === "ai";
    const c = compareRounds({
      previous: previous.blocks, current: blocks, page: { width: page.width, height: page.height }, fields, lines, results, findings,
      moveThreshold: aiBlocks ? 0.08 : undefined,
    });
    const unrequested: UnrequestedItem[] = c.unrequested.map((u) => ({
      code: u.code, change: slimDiff(u.change), what: u.what, ...(u.where ? { where: u.where } : {}),
      ...(u.linkedTo ? { linkedTo: u.linkedTo } : {}), fieldIds: u.fieldIds,
    }));
    return { ...base, diff: c.diff.map(slimDiff), lineChecks: c.lineChecks as LineCheck[], unrequested };
  }
  // Nothing to diff with: the lines are still re-checked, but the page must say that changes nobody asked for are not shown.
  return {
    ...base,
    lineChecks: recheckSendBack(lines, results, pageText) as LineCheck[],
    unrequested: [],
    diffUnavailable: blocks ? "no_previous_blocks" : "read_failed",
  };
}

/** Browser: read the PDF file (text layer, or the AI reader for a flat proof) and run the check. Throws an Error with a user message. */
export async function runCheck(args: Omit<CheckInput, "page" | "seconds" | "ai"> & { file: File }): Promise<Round> {
  const t0 = performance.now();
  const { readPdfPage } = await import("./renderPdf");
  const page = await readPdfPage(args.file);
  let ai: AiRead | undefined;
  if (!page.hasText && page.flat) {
    const cfg = readerConfig();
    const fields = args.spec.fields.map((f) => ({ id: f.id, label: f.label, value: f.value }));
    // Both reads run at once. The blocks are kept so the next round can be compared with this one.
    const [f, b] = await Promise.all([readFields(cfg, page.flat.jpegBase64, fields), readBlocks(cfg, page.flat.jpegBase64, page)]);
    ai = { fields: f.ok ? f.value : null, blocks: b.ok ? b.value : null, dpi: page.flat.dpi, error: !f.ok ? f.error : !b.ok ? b.error : undefined };
  }
  const { file: _file, ...rest } = args;
  void _file;
  return checkProof({ ...rest, page, ai, seconds: Math.round(((performance.now() - t0) / 1000) * 10) / 10 });
}
