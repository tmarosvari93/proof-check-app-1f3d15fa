/**
 * Finds where each blue spec field is printed on the proof. Pure: takes spec fields and the blocks
 * from textLayer.ts, returns every occurrence. It never decides a verdict (compare.ts does).
 *
 * Two ways to locate a field [suggestion, tuned on one fictional template]:
 *  1. Labelled: a line that starts with the field's label and has text after it
 *     ("Szénhidrát 46,5 g", "Összetevők: ZABPEHELY ..."). The text after the label is the printed value.
 *     The longest matching label owns the line, so "Energia adagonként (50 g)" is not read as "Energia".
 *     A bare heading ("Tárolás") has nothing after the label and is not an occurrence.
 *     Only a long value (over 40 characters) continues onto the following lines of the block.
 *  2. Fuzzy: for fields whose label is not printed, the best matching window of 1 to 6 lines in each
 *     block (similarity at least 0.6; at least 0.8 for values under 12 characters, so "400 g" cannot
 *     match "Só 0,18 g"). Lines already owned by a labelled field are never candidates.
 *
 * Every block that holds the value gives one occurrence (rule R6: front and back name are both checked).
 */
import type { Block, Line } from "./textLayer";

export interface LocatableField {
  id: string;
  label: string;
  value: string;
}

export interface Occurrence {
  blockId: string;
  page: number;
  /** The printed value, without the printed label. */
  text: string;
  box: [number, number, number, number];
  /** Words printed bold inside this occurrence. */
  boldWords: string[];
  /** Set by the AI reader when it saw the text but could not read it with confidence. */
  unreadable?: boolean;
}

export const FUZZY_MIN = 0.6;
export const FUZZY_MIN_SHORT = 0.8;
export const SHORT_VALUE_CHARS = 12;
export const MULTILINE_VALUE_CHARS = 40;
const MAX_WINDOW_LINES = 6;

/** Lower case, one space between words, no non-breaking spaces. */
export function squash(s: string): string {
  return s.normalize("NFC").replace(/[  ]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Similarity 0..1 from the longest common subsequence: 2 * LCS / (length a + length b). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, cur[j - 1]!);
    }
    prev = cur;
  }
  return (2 * prev[b.length]!) / (a.length + b.length);
}

interface OwnedLine {
  fieldId: string;
  rest: string;
  block: Block;
  index: number;
}

/** If the line starts with a field label followed by text, returns [field, text after the label]. */
function ownerOf(line: Line, labels: { id: string; label: string }[]): { id: string; rest: string } | null {
  const text = squash(line.text);
  let best: { id: string; len: number; rest: string } | null = null;
  for (const l of labels) {
    const lab = squash(l.label);
    if (!lab || !text.startsWith(lab)) continue;
    const next = text[lab.length];
    if (next !== undefined && next !== " " && next !== ":") continue;
    const rest = line.text.replace(/\s+/g, " ").trim().slice(lab.length).replace(/^\s*:?\s*/, "");
    if (!rest) continue; // a bare heading is not a printed value
    if (!best || lab.length > best.len) best = { id: l.id, len: lab.length, rest };
  }
  return best ? { id: best.id, rest: best.rest } : null;
}

function unionBox(lines: Line[]): [number, number, number, number] {
  return [
    Math.min(...lines.map((l) => l.box[0])),
    Math.min(...lines.map((l) => l.box[1])),
    Math.max(...lines.map((l) => l.box[2])),
    Math.max(...lines.map((l) => l.box[3])),
  ];
}

function boldIn(lines: Line[]): string[] {
  return lines.flatMap((l) => l.words.filter((w) => w.bold).map((w) => w.text));
}

function ownedLines(blocks: Block[], labels: { id: string; label: string }[]): Map<string, OwnedLine[]> {
  const out = new Map<string, OwnedLine[]>();
  for (const block of blocks) {
    block.lines.forEach((line, index) => {
      const o = ownerOf(line, labels);
      if (!o) return;
      const list = out.get(o.id) ?? [];
      list.push({ fieldId: o.id, rest: o.rest, block, index });
      out.set(o.id, list);
    });
  }
  return out;
}

function labelledOccurrences(field: LocatableField, owned: OwnedLine[], labels: { id: string; label: string }[]): Occurrence[] {
  const multiline = field.value.length > MULTILINE_VALUE_CHARS;
  return owned.map(({ block, index, rest }) => {
    const lines = [block.lines[index]!];
    let text = rest;
    if (multiline) {
      for (let k = index + 1; k < block.lines.length; k++) {
        const next = block.lines[k]!;
        if (ownerOf(next, labels)) break;
        lines.push(next);
        text += " " + next.text;
      }
    }
    return {
      blockId: block.id,
      page: block.page,
      text: text.replace(/\s+/g, " ").trim(),
      box: unionBox(lines),
      boldWords: boldIn(lines),
    };
  });
}

function fuzzyOccurrences(field: LocatableField, blocks: Block[], labels: { id: string; label: string }[]): Occurrence[] {
  const target = squash(field.value);
  const min = field.value.length < SHORT_VALUE_CHARS ? FUZZY_MIN_SHORT : FUZZY_MIN;
  const out: Occurrence[] = [];
  for (const block of blocks) {
    const free = block.lines.map((l) => !ownerOf(l, labels));
    let best: { score: number; i: number; n: number } | null = null;
    for (let i = 0; i < block.lines.length; i++) {
      if (!free[i]) continue;
      for (let n = 1; n <= MAX_WINDOW_LINES && i + n <= block.lines.length; n++) {
        if (!free[i + n - 1]) break;
        const text = squash(block.lines.slice(i, i + n).map((l) => l.text).join(" "));
        const score = similarity(text, target);
        if (!best || score > best.score + 1e-9) best = { score, i, n };
      }
    }
    if (best && best.score >= min) {
      const lines = block.lines.slice(best.i, best.i + best.n);
      out.push({
        blockId: block.id,
        page: block.page,
        text: lines.map((l) => l.text).join(" ").replace(/\s+/g, " ").trim(),
        box: unionBox(lines),
        boldWords: boldIn(lines),
      });
    }
  }
  return out;
}

/** Every occurrence of the field on the proof. Empty means the field was not found. */
export function locateField(field: LocatableField, blocks: Block[], allFields: LocatableField[] = [field]): Occurrence[] {
  const labels = allFields.map((f) => ({ id: f.id, label: f.label }));
  const owned = ownedLines(blocks, labels).get(field.id);
  if (owned && owned.length) return labelledOccurrences(field, owned, labels);
  return fuzzyOccurrences(field, blocks, labels);
}

/** Locates all fields at once (the label ownership is computed once). */
export function locateAll(fields: LocatableField[], blocks: Block[]): Record<string, Occurrence[]> {
  const labels = fields.map((f) => ({ id: f.id, label: f.label }));
  const owned = ownedLines(blocks, labels);
  const out: Record<string, Occurrence[]> = {};
  for (const f of fields) {
    const o = owned.get(f.id);
    out[f.id] = o && o.length ? labelledOccurrences(f, o, labels) : fuzzyOccurrences(f, blocks, labels);
  }
  return out;
}
