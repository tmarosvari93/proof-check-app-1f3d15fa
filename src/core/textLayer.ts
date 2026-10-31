/**
 * Text layer to blocks. Takes the text items pdf.js reads from a vector proof and groups them into
 * lines and blocks, each with a box, a font size and the words that are printed bold.
 *
 * Pure: no pdf.js import, no I/O. src/services/pdfExtract.ts feeds it.
 * Coordinates are PDF points with the origin at the bottom left (y grows upwards).
 *
 * Grouping rules [suggestion], tuned on the fictional proofs:
 *  1. Items on one baseline are joined into runs (gap under 25 pt). A run wider than a third of the
 *     page (the title block at the foot) is kept apart from the panels.
 *  2. The other runs are split into columns wherever the horizontal gap between text is 25 pt or
 *     more, so side by side panels never mix.
 *  3. Inside a column, items on the same baseline form a line.
 *  4. A line joins the block above it when the baseline step is at most 1.35 times the font size,
 *     and the block above did not end with a short sentence-ending line.
 */

export interface RawItem {
  str: string;
  /** pdf.js transform: [a, b, c, d, x, y] */
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

export interface PageInfo {
  number: number;
  width: number;
  height: number;
  /** pdf.js font id to real font name. */
  fonts?: Record<string, string>;
}

export interface Word {
  text: string;
  bold: boolean;
}

export interface Line {
  text: string;
  /** [x0, y0, x1, y1] in points. */
  box: [number, number, number, number];
  fontSize: number;
  words: Word[];
}

export interface Block {
  id: string;
  page: number;
  text: string;
  box: [number, number, number, number];
  fontSize: number;
  lines: Line[];
  words: Word[];
  /** Words printed in a bold font. */
  boldWords: string[];
}

interface Item {
  text: string;
  x: number;
  y: number;
  w: number;
  size: number;
  bold: boolean;
}

const BOLD_RE = /bold|black|heavy|semibold|demi/i;
const COLUMN_GAP_PT = 25;
const WIDE_ITEM_RATIO = 0.33;
const LINE_STEP_RATIO = 1.35;

export function isBoldFont(name: string | undefined): boolean {
  return !!name && BOLD_RE.test(name);
}

/** True when the page has real text. Flattened (image only) proofs have none. */
export function hasTextLayer(items: RawItem[], minChars = 20): boolean {
  let n = 0;
  for (const it of items) {
    n += it.str.replace(/\s+/g, "").length;
    if (n >= minChars) return true;
  }
  return false;
}

/** Effective resolution of an image placed on a page: pixels per inch as printed. */
export function effectiveDpi(imageWidthPx: number, displayedWidthPt: number): number {
  if (displayedWidthPt <= 0) return 0;
  return imageWidthPx / (displayedWidthPt / 72);
}

function toItems(raw: RawItem[], fonts: Record<string, string> | undefined): Item[] {
  const out: Item[] = [];
  for (const r of raw) {
    if (r.str.trim() === "") continue;
    const [a = 0, b = 0, c = 0, d = 0, x = 0, y = 0] = r.transform;
    const size = Math.hypot(c, d) || Math.hypot(a, b) || r.height;
    out.push({
      text: r.str,
      x,
      y,
      w: r.width,
      size,
      bold: isBoldFont(fonts?.[r.fontName]),
    });
  }
  return out;
}

/** Items on one baseline, split into runs wherever the horizontal gap is a column gap or more. */
function buildRuns(items: Item[]): Item[][] {
  const rows: Item[][] = [];
  for (const it of [...items].sort((p, q) => q.y - p.y || p.x - q.x)) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0]!.y - it.y) <= 0.35 * Math.max(it.size, row[0]!.size)) row.push(it);
    else rows.push([it]);
  }
  const runs: Item[][] = [];
  for (const row of rows) {
    row.sort((p, q) => p.x - q.x);
    let run: Item[] = [];
    let end = -Infinity;
    for (const it of row) {
      if (run.length && it.x - end >= COLUMN_GAP_PT) {
        runs.push(run);
        run = [];
      }
      run.push(it);
      end = Math.max(end, it.x + it.w);
    }
    if (run.length) runs.push(run);
  }
  return runs;
}

function splitColumns(items: Item[], page: PageInfo): Item[][] {
  const wide: Item[] = [];
  const narrow: { items: Item[]; x0: number; x1: number }[] = [];
  for (const run of buildRuns(items)) {
    const x0 = Math.min(...run.map((i) => i.x));
    const x1 = Math.max(...run.map((i) => i.x + i.w));
    if (x1 - x0 > page.width * WIDE_ITEM_RATIO) wide.push(...run);
    else narrow.push({ items: run, x0, x1 });
  }
  narrow.sort((p, q) => p.x0 - q.x0);
  const columns: Item[][] = [];
  let colEnd = -Infinity;
  for (const r of narrow) {
    if (columns.length === 0 || r.x0 - colEnd >= COLUMN_GAP_PT) columns.push([]);
    columns[columns.length - 1]!.push(...r.items);
    colEnd = Math.max(colEnd, r.x1);
  }
  if (wide.length) columns.push(wide);
  return columns;
}

function buildLines(col: Item[]): Line[] {
  const byY = [...col].sort((p, q) => q.y - p.y || p.x - q.x);
  const groups: Item[][] = [];
  for (const it of byY) {
    const g = groups[groups.length - 1];
    if (g && Math.abs(g[0]!.y - it.y) <= 0.35 * Math.max(it.size, g[0]!.size)) g.push(it);
    else groups.push([it]);
  }
  return groups.map((g) => {
    g.sort((p, q) => p.x - q.x);
    let text = "";
    const words: Word[] = [];
    let prevEnd: number | null = null;
    let prevText = "";
    const size = Math.max(...g.map((i) => i.size));
    for (const it of g) {
      const needSpace =
        prevEnd !== null &&
        !prevText.endsWith(" ") &&
        !it.text.startsWith(" ") &&
        it.x - prevEnd > 0.12 * size;
      text += (needSpace ? " " : "") + it.text;
      for (const w of it.text.split(/\s+/).filter(Boolean)) words.push({ text: w, bold: it.bold });
      prevEnd = it.x + it.w;
      prevText = it.text;
    }
    const x0 = Math.min(...g.map((i) => i.x));
    const x1 = Math.max(...g.map((i) => i.x + i.w));
    const base = g[0]!.y;
    return {
      text: text.replace(/\s+/g, " ").trim(),
      box: [x0, base - 0.25 * size, x1, base + 0.8 * size] as [number, number, number, number],
      fontSize: size,
      words,
    };
  });
}

const ENDS_SENTENCE = /[.!?]$/;

function groupBlocks(lines: Line[]): Line[][] {
  const blocks: Line[][] = [];
  for (const ln of lines) {
    const cur = blocks[blocks.length - 1];
    if (cur) {
      const prev = cur[cur.length - 1]!;
      const step = prev.box[1] + 0.25 * prev.fontSize - (ln.box[1] + 0.25 * ln.fontSize);
      const sameLeft = Math.abs(prev.box[0] - ln.box[0]) <= 3;
      const maxW = Math.max(...cur.map((l) => l.box[2] - l.box[0]));
      const prevW = prev.box[2] - prev.box[0];
      const closedParagraph = ENDS_SENTENCE.test(prev.text) && prevW < 0.9 * maxW && cur.length > 1;
      if (step > 0 && step <= LINE_STEP_RATIO * prev.fontSize && sameLeft && !closedParagraph) {
        cur.push(ln);
        continue;
      }
    }
    blocks.push([ln]);
  }
  return blocks;
}

export function buildBlocks(raw: RawItem[], page: PageInfo): Block[] {
  const items = toItems(raw, page.fonts);
  const result: Block[] = [];
  let n = 0;
  for (const col of splitColumns(items, page)) {
    for (const lines of groupBlocks(buildLines(col))) {
      const words = lines.flatMap((l) => l.words);
      result.push({
        id: `p${page.number}b${++n}`,
        page: page.number,
        text: lines.map((l) => l.text).join(" "),
        box: [
          Math.min(...lines.map((l) => l.box[0])),
          Math.min(...lines.map((l) => l.box[1])),
          Math.max(...lines.map((l) => l.box[2])),
          Math.max(...lines.map((l) => l.box[3])),
        ],
        fontSize: Math.max(...lines.map((l) => l.fontSize)),
        lines,
        words,
        boldWords: words.filter((w) => w.bold).map((w) => w.text),
      });
    }
  }
  return result;
}
