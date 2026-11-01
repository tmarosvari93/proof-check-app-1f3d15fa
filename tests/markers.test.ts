// @vitest-environment node
// The marks on the proof preview: one box per spec finding whose place is known, in percent from the top-left.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpecWorkbook } from "../src/core/parseSpec";
import { markersOf } from "../src/core/markers";
import { checkProof } from "../src/services/runCheck";
import { FIXTURES, loadPdfPage } from "./helpers/loadPdf";

describe("markersOf", () => {
  it("turns a PDF box (origin bottom-left) into percent from the top-left", () => {
    const m = markersOf(
      [{ code: "F1", decision: "open", kind: "spec_mismatch", fieldId: "a", label: "A", specValue: "x", foundValue: "y" }],
      [{ id: "a", label: "A", specValue: "x", verdict: "mismatch", foundValue: "y", diff: [], occurrences: [{ verdict: "mismatch", occurrence: { blockId: "b", page: 1, text: "y", box: [100, 700, 200, 720], boldWords: [] } }] }],
      { width: 1000, height: 800 },
    );
    // padded by 2 units: top = 800 - 720 - 2 = 78 -> 9.8 %; left = 98 -> 9.8 %; 24 of 800 high -> 3 %
    expect(m).toEqual([{ code: "F1", x: 9.8, y: 9.8, w: 10.4, h: 3 }]);
  });
  it("gives no mark for a missing field, an AI read (empty box) or a page with no size", () => {
    const f = { code: "F1", decision: "open" as const, kind: "spec_mismatch" as const, fieldId: "a", label: "A", specValue: "x", foundValue: "y" };
    const r = (box: [number, number, number, number]) => ({ id: "a", label: "A", specValue: "x", verdict: "mismatch" as const, foundValue: "y", diff: [], occurrences: [{ verdict: "mismatch" as const, occurrence: { blockId: "b", page: 1, text: "y", box, boldWords: [] } }] });
    expect(markersOf([f], [r([0, 0, 0, 0])], { width: 100, height: 100 })).toEqual([]);
    expect(markersOf([f], [], { width: 100, height: 100 })).toEqual([]);
    expect(markersOf([f], [r([1, 1, 5, 5])], { width: 0, height: 0 })).toEqual([]);
  });
});

describe("markers on the real v1 proof", () => {
  it("every finding with a place gets a mark inside the page, and none is on a flat proof", async () => {
    const spec = await parseSpecWorkbook(new Uint8Array(readFileSync(join(FIXTURES, "spec_SP-2026-0417_v3.xlsx"))));
    const r = await checkProof({ spec, page: await loadPdfPage("proof_v1.pdf"), no: 1, fileName: "proof_v1.pdf" });
    expect(r.findings).toHaveLength(6);
    const marks = r.markers ?? [];
    expect(marks.length).toBeGreaterThanOrEqual(4);
    for (const m of marks) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.x + m.w).toBeLessThanOrEqual(100.1);
      expect(m.y + m.h).toBeLessThanOrEqual(100.1);
      expect(m.w).toBeGreaterThan(0);
      expect(r.findings.some((f) => f.code === m.code)).toBe(true);
    }
    const flat = await checkProof({ spec, page: await loadPdfPage("proof_v1_flat.pdf"), no: 1, fileName: "proof_v1_flat.pdf" });
    expect(flat.markers).toBeUndefined();
  });
});
