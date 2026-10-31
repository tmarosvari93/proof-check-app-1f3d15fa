/**
 * Version against version: what changed in CONTENT between two rounds of a proof. Pure.
 *
 * Takes the blocks of the previous and the current proof (textLayer.ts, or blocks read by AI) and returns
 * the changes. A block that only moved is "moved", never open (R12). The correction stamp in the footer and
 * the studio's guide labels are ignored (R10).
 *
 * Matching [suggestion, tuned on the fictional proofs]:
 *  1. Same text (case counts, because ZABPEHELY must stay in capitals): nearest block first, so the
 *     front and the back name pair up with their own copy. Emphasis changed -> modified; moved far -> moved.
 *  2. Leftovers pair when similar (at least 0.7) or when one is the other plus or minus a phrase.
 *     A pure phrase added to or cut from a block is reported as added / removed text.
 *  3. What is left is removed (only before) or added (only now).
 */
import type { Block } from "./textLayer";
import { similarity } from "./locate";
import { wordDiff } from "./compare";

export type DiffType = "modified" | "added" | "removed" | "moved" | "unchanged";

export interface BlockDiffItem {
  id: string; // "X1"
  type: DiffType;
  before: string | null;
  after: string | null;
  /** e.g. "emphasis changed" */
  note?: string;
  beforeIds: string[];
  afterIds: string[];
  /** Panel of the new position, e.g. "Front panel". */
  where?: string;
  /** A modified block that also changed place. */
  moved?: boolean;
}

export interface DiffOptions {
  page: { width: number; height: number };
  /** Blocks whose text matches are not part of the artwork content. Default: DEFAULT_IGNORE. */
  ignore?: RegExp[];
  /** Extra bare headings. A short all-bold block ("Tárolás") is always a heading. An unchanged heading that moved is not listed. */
  headings?: string[];
  /** A block moved when its centre shifted by more than this share of the page. */
  moveThreshold?: number;
}

/** Correction stamp, panel names, notes the studio prints but the factory does not. [assumption] tuned on one template. */
export const DEFAULT_IGNORE: RegExp[] = [
  /^KORREKTÚRA\b/i,
  /^(ELŐLAP|HÁTLAP|OLDALLAP)\b/i,
  /nem nyomtatandó/i,
  /illusztráció/i,
];
export const MOVE_THRESHOLD = 0.03;
export const PAIR_MIN = 0.7;
export const SPLIT_MIN_WORDS = 2;

const sig = (s: string) => s.normalize("NFC").replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
const lower = (s: string) => sig(s).toLowerCase();

export function isIgnored(text: string, ignore: RegExp[] = DEFAULT_IGNORE): boolean {
  const t = sig(text);
  return ignore.some((re) => re.test(t));
}

export function panelOf(box: [number, number, number, number], pageWidth: number): string {
  const cx = (box[0] + box[2]) / 2 / pageWidth;
  if (cx < 0.2) return "Side panel";
  if (cx < 0.5) return "Front panel";
  if (cx < 0.7) return "Side panel";
  return "Back panel";
}

function centre(b: Block, page: { width: number; height: number }): [number, number] {
  return [(b.box[0] + b.box[2]) / 2 / page.width, (b.box[1] + b.box[3]) / 2 / page.height];
}
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** A heading: one to three words, all bold (nothing to proofread beyond its wording, which still shows if it changes). */
function isHeading(b: Block, extra: Set<string>): boolean {
  if (extra.has(lower(b.text))) return true;
  return b.words.length > 0 && b.words.length <= 3 && b.words.every((w) => w.bold);
}

const boldSet = (b: Block) => new Set(b.boldWords.map((w) => lower(w).replace(/[^\p{L}\p{N}]/gu, "")));
function sameSet(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/** How a leftover pair relates: a phrase only added, only cut, or an edit of the words. */
function relation(a: string, b: string): { score: number; kind: "added" | "removed" | "edit"; phrase: string } {
  const ops = wordDiff(a, b);
  const ins = ops.filter((o) => o.type === "ins").map((o) => o.text);
  const del = ops.filter((o) => o.type === "del").map((o) => o.text);
  const same = ops.filter((o) => o.type === "same").length;
  const words = (xs: string[]) => xs.join(" ").split(/\s+/).filter(Boolean).length;
  if (same > 0 && del.length === 0 && ins.length > 0 && words(ins) >= SPLIT_MIN_WORDS) return { score: 0.95, kind: "added", phrase: ins.join(" ") };
  if (same > 0 && ins.length === 0 && del.length > 0 && words(del) >= SPLIT_MIN_WORDS) return { score: 0.95, kind: "removed", phrase: del.join(" ") };
  return { score: similarity(lower(a), lower(b)), kind: "edit", phrase: "" };
}

export interface DiffResult {
  /** Changes and moves, in a stable order: pairs in the order of the previous proof, then removed, then added. */
  items: BlockDiffItem[];
  unchanged: number;
}

export function diffBlocks(previous: Block[], current: Block[], opts: DiffOptions): DiffResult {
  const ignore = opts.ignore ?? DEFAULT_IGNORE;
  const thr = opts.moveThreshold ?? MOVE_THRESHOLD;
  const headings = new Set((opts.headings ?? []).map(lower));
  const prev = previous.filter((b) => !isIgnored(b.text, ignore));
  const cur = current.filter((b) => !isIgnored(b.text, ignore));
  const usedCur = new Set<number>();
  const pairOf = new Map<number, number>();
  const rows: { order: number; item: Omit<BlockDiffItem, "id"> }[] = [];
  let unchanged = 0;

  const where = (b: Block) => panelOf(b.box, opts.page.width);
  const idsOf = (b: Block) => [b.id];

  // 1. same text
  prev.forEach((a, i) => {
    let best = -1;
    let bestD = Infinity;
    cur.forEach((b, j) => {
      if (usedCur.has(j) || sig(a.text) !== sig(b.text)) return;
      const d = dist(centre(a, opts.page), centre(b, opts.page));
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    if (best < 0) return;
    usedCur.add(best);
    pairOf.set(i, best);
    const b = cur[best]!;
    const ca = centre(a, opts.page);
    const cb = centre(b, opts.page);
    const moved = Math.abs(ca[0] - cb[0]) > thr || Math.abs(ca[1] - cb[1]) > thr;
    if (!sameSet(boldSet(a), boldSet(b))) {
      rows.push({ order: i, item: { type: "modified", before: a.text, after: b.text, note: "emphasis changed", beforeIds: idsOf(a), afterIds: idsOf(b), where: where(b), moved } });
    } else if (moved && !isHeading(a, headings)) {
      rows.push({ order: i, item: { type: "moved", before: a.text, after: b.text, beforeIds: idsOf(a), afterIds: idsOf(b), where: where(b) } });
    } else unchanged++;
  });

  // 2. leftovers: best pair first, nearest first on a tie
  const left1 = prev.map((_, i) => i).filter((i) => !pairOf.has(i));
  const left2 = cur.map((_, j) => j).filter((j) => !usedCur.has(j));
  const pairs: { score: number; d: number; i: number; j: number; rel: ReturnType<typeof relation> }[] = [];
  for (const i of left1) {
    for (const j of left2) {
      const rel = relation(prev[i]!.text, cur[j]!.text);
      if (rel.score >= PAIR_MIN) pairs.push({ score: rel.score, d: dist(centre(prev[i]!, opts.page), centre(cur[j]!, opts.page)), i, j, rel });
    }
  }
  pairs.sort((x, y) => (Math.abs(y.score - x.score) > 1e-9 ? y.score - x.score : x.d - y.d));
  const done1 = new Set<number>();
  const done2 = new Set<number>();
  for (const p of pairs) {
    if (done1.has(p.i) || done2.has(p.j)) continue;
    done1.add(p.i);
    done2.add(p.j);
    const a = prev[p.i]!;
    const b = cur[p.j]!;
    const ca = centre(a, opts.page);
    const cb = centre(b, opts.page);
    const moved = Math.abs(ca[0] - cb[0]) > thr || Math.abs(ca[1] - cb[1]) > thr;
    const base = { beforeIds: idsOf(a), afterIds: idsOf(b), where: where(b) };
    if (p.rel.kind === "added") rows.push({ order: p.i, item: { type: "added", before: null, after: p.rel.phrase, ...base } });
    else if (p.rel.kind === "removed") rows.push({ order: p.i, item: { type: "removed", before: p.rel.phrase, after: null, ...base } });
    else rows.push({ order: p.i, item: { type: "modified", before: a.text, after: b.text, ...base, moved } });
  }

  rows.sort((x, y) => x.order - y.order);
  const items: Omit<BlockDiffItem, "id">[] = rows.map((r) => r.item);
  for (const i of left1) {
    if (done1.has(i)) continue;
    const a = prev[i]!;
    items.push({ type: "removed", before: a.text, after: null, beforeIds: idsOf(a), afterIds: [], where: where(a) });
  }
  for (const j of left2) {
    if (done2.has(j)) continue;
    const b = cur[j]!;
    items.push({ type: "added", before: null, after: b.text, beforeIds: [], afterIds: idsOf(b), where: where(b) });
  }
  return { items: items.map((it, n) => ({ id: `X${n + 1}`, ...it })), unchanged };
}
