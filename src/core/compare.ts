/**
 * Compare: plain code decides every verdict. The reader (text layer or AI) only supplies printed text.
 *
 * Verdicts: match, mismatch, missing, could_not_read.
 *  - R5  a failed or unsure read is Could not read, never a pass.
 *  - R6  every occurrence is checked; the worst verdict wins (mismatch, then could_not_read, then match).
 *  - R7  resolution gate: a flat proof below 100 dpi makes any field with a digit Could not read,
 *        because the model read "0,18 mg" as "0,18 g" at 75 dpi and never said it was unsure (spike).
 *  - Numbers: 64,5 equals 64.5. Units are never merged: g is not mg.
 *  - Case and spacing are ignored; every other character must be equal.
 */
import { locateAll, type LocatableField, type Occurrence } from "./locate";
import type { Block } from "./textLayer";

export type Verdict = "match" | "mismatch" | "missing" | "could_not_read";
export type CouldNotReadReason = "low_resolution" | "read_failed" | "unreadable";

export const MIN_DPI = 100;

export interface CompareOptions {
  /** Effective dpi of a flat (image) proof. Leave undefined for a vector proof. */
  dpi?: number;
  /** The whole read failed (R5). */
  readFailed?: boolean;
  /** False when the reader could not see which words are emphasised (no font names, or an AI that did not say). */
  emphasisKnown?: boolean;
}

export interface DiffOp {
  type: "same" | "del" | "ins";
  text: string;
}

export interface OccurrenceResult {
  occurrence: Occurrence;
  verdict: "match" | "mismatch" | "could_not_read";
}

export type AllergenStatus = "ok" | "not_emphasised" | "could_not_check";

export interface AllergenResult {
  status: AllergenStatus;
  /** Spec words (or phrases) that are not emphasised on the proof. */
  words: string[];
}

export interface FieldResult {
  id: string;
  label: string;
  specValue: string;
  verdict: Verdict;
  /** The printed text of the worst occurrence; null when missing. */
  foundValue: string | null;
  diff: DiffOp[];
  occurrences: OccurrenceResult[];
  reason?: CouldNotReadReason;
  allergen?: AllergenResult;
}

/** Comparison key: NFC, no non-breaking spaces, one space, lower case, 64.5 as 64,5, no space between number and unit. */
export function normalise(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[  ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(\d)\.(\d)/g, "$1,$2")
    .replace(/(\d) (?=[a-zµ%°])/g, "$1");
}

const CAPS = "A-ZÁÉÍÓÖŐÚÜŰ";
const PHRASE_RE = new RegExp(`[${CAPS}]{3,}(?: [${CAPS}]{3,})*`, "g");
const WORD_RE = new RegExp(`[${CAPS}]{3,}`, "g");
const HAS_CAPS = new RegExp(`[${CAPS}]{3,}`);

function bare(w: string): string {
  return w.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/** Every word printed in capitals in the spec must be emphasised (bold) on the proof. */
export function allergenCheck(specValue: string, boldWords: string[] | null): AllergenResult {
  const phrases = specValue.match(PHRASE_RE) ?? [];
  if (phrases.length === 0) return { status: "ok", words: [] };
  if (boldWords === null) return { status: "could_not_check", words: [] };
  const bold = new Set(boldWords.map(bare));
  const missing: string[] = [];
  for (const phrase of phrases) {
    const words = phrase.match(WORD_RE) ?? [];
    const lacking = words.filter((w) => !bold.has(bare(w)));
    if (lacking.length === 0) continue;
    missing.push(lacking.length === words.length ? phrase : lacking.join(" "));
  }
  return missing.length ? { status: "not_emphasised", words: missing } : { status: "ok", words: [] };
}

/** Word by word difference (longest common subsequence). */
export function wordDiff(before: string, after: string): DiffOp[] {
  const a = before.split(/\s+/).filter(Boolean);
  const b = after.split(/\s+/).filter(Boolean);
  const key = (w: string) => normalise(w);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] = key(a[i]!) === key(b[j]!) ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const ops: DiffOp[] = [];
  const push = (type: DiffOp["type"], text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.type === type) last.text += " " + text;
    else ops.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (key(a[i]!) === key(b[j]!)) {
      push("same", b[j]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) push("del", a[i++]!);
    else push("ins", b[j++]!);
  }
  while (i < a.length) push("del", a[i++]!);
  while (j < b.length) push("ins", b[j++]!);
  return ops;
}

const hasDigit = (s: string) => /\d/.test(s);

function result(field: LocatableField, verdict: Verdict, extra: Partial<FieldResult> = {}): FieldResult {
  return {
    id: field.id,
    label: field.label,
    specValue: field.value,
    verdict,
    foundValue: null,
    diff: [],
    occurrences: [],
    ...extra,
  };
}

export function compareField(field: LocatableField, occurrences: Occurrence[], opts: CompareOptions = {}): FieldResult {
  if (opts.readFailed) return result(field, "could_not_read", { reason: "read_failed" });
  if (opts.dpi !== undefined && opts.dpi < MIN_DPI && hasDigit(field.value)) {
    return result(field, "could_not_read", { reason: "low_resolution" });
  }
  if (occurrences.length === 0) return result(field, "missing");

  const want = normalise(field.value);
  const rows: OccurrenceResult[] = occurrences.map((o) => ({
    occurrence: o,
    verdict: o.unreadable ? "could_not_read" : normalise(o.text) === want ? "match" : "mismatch",
  }));
  const worst = rows.find((r) => r.verdict === "mismatch") ?? rows.find((r) => r.verdict === "could_not_read") ?? rows[0]!;
  const out = result(field, worst.verdict, { occurrences: rows });
  if (worst.verdict === "could_not_read") {
    out.reason = "unreadable";
    return out;
  }
  out.foundValue = worst.occurrence.text;
  if (worst.verdict === "mismatch") out.diff = wordDiff(field.value, worst.occurrence.text);

  if (worst.verdict === "match" && HAS_CAPS.test(field.value)) {
    // The emphasis rule applies to every occurrence; the worst one wins.
    let found: AllergenResult = { status: "ok", words: [] };
    for (const r of rows) {
      const a = allergenCheck(field.value, opts.emphasisKnown === false ? null : r.occurrence.boldWords);
      if (a.status === "not_emphasised") {
        found = a;
        break;
      }
      if (a.status === "could_not_check") found = a;
    }
    out.allergen = found;
  }
  return out;
}

/** Locate and compare every spec field against the blocks of one proof page. */
export function compareAll(fields: LocatableField[], blocks: Block[], opts: CompareOptions = {}): FieldResult[] {
  const located = locateAll(fields, blocks);
  return fields.map((f) => compareField(f, located[f.id] ?? [], opts));
}
