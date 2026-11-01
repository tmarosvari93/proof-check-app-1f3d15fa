/**
 * Where on the proof a finding is, for the marks on the preview image. Pure.
 * Only a text-layer read knows a box. The AI reader gives no exact box, so a flat proof has no marks
 * (the review screen says so instead of guessing a place).
 */
import type { FieldResult } from "./compare";
import type { CheckFinding } from "./findings";

/** A rectangle in percent of the page, measured from the top-left corner. */
export interface Marker {
  /** Finding code, F1, F2, ... */
  code: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Text boxes are in PDF units with the origin at the bottom-left (y up), as pdf.js reports them.
 * The mark is the worst occurrence of the finding's field (a mismatch, else the first one), with a little padding.
 */
export function markersOf(findings: CheckFinding[], results: FieldResult[], page: { width: number; height: number }): Marker[] {
  if (!(page.width > 0) || !(page.height > 0)) return [];
  const out: Marker[] = [];
  for (const f of findings) {
    const r = results.find((x) => x.id === f.fieldId);
    const occ = r?.occurrences.find((o) => o.verdict === "mismatch") ?? r?.occurrences[0];
    const b = occ?.occurrence.box;
    if (!b || !(b[2] > b[0]) || !(b[3] > b[1])) continue; // no real box (missing field, or an AI read)
    const padX = 2;
    const padY = 2;
    const x0 = Math.max(0, b[0] - padX);
    const x1 = Math.min(page.width, b[2] + padX);
    const yTop = Math.max(0, page.height - b[3] - padY);
    const yBottom = Math.min(page.height, page.height - b[1] + padY);
    out.push({
      code: f.code,
      x: round1((x0 / page.width) * 100),
      y: round1((yTop / page.height) * 100),
      w: round1(((x1 - x0) / page.width) * 100),
      h: round1(((yBottom - yTop) / page.height) * 100),
    });
  }
  return out;
}
