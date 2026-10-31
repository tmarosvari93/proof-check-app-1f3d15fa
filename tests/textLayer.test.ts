// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPdfPage, FIXTURES } from "./helpers/loadPdf";
import { effectiveDpi, hasTextLayer, isBoldFont, buildBlocks, type RawItem } from "../src/core/textLayer";

const key = JSON.parse(readFileSync(join(FIXTURES, "answer_key.json"), "utf-8"));
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

describe("text layer on the vector proofs", () => {
  it("has a text layer on vector proofs and none on the flattened copies", async () => {
    for (const v of ["v1", "v2", "v3"]) {
      expect((await loadPdfPage(`proof_${v}.pdf`)).hasText).toBe(true);
      expect((await loadPdfPage(`proof_${v}_flat.pdf`)).hasText).toBe(false);
    }
  });

  it("reads the real font names, so bold can be told apart", async () => {
    const p = await loadPdfPage("proof_v1.pdf");
    expect(p.fontNamesRead).toBe(true);
    expect(Object.values(p.fonts).some((n) => /Bold/.test(n))).toBe(true);
    expect(Object.values(p.fonts).some((n) => /DejaVuSans$/.test(n))).toBe(true);
  });

  for (const [v, blocksKey] of [["v1", "blocks_v1"], ["v2", "blocks_v2"], ["v3", "blocks_v2"]] as const) {
    it(`every answer-key text of ${v} is found inside one built block`, async () => {
      const p = await loadPdfPage(`proof_${v}.pdf`);
      const texts = p.blocks.map((b) => norm(b.text));
      const missing: string[] = [];
      for (const kb of key[blocksKey] as { id: string; text: string }[]) {
        // v3 reverts two v2 changes (preparation back to 150 ml, claim_2 removed), so skip those two keys
        if (v === "v3" && (kb.id === "claim_2" || kb.id === "preparation")) continue;
        const want = norm(kb.text);
        if (!texts.some((t) => t.includes(want))) missing.push(`${kb.id}: ${kb.text}`);
      }
      expect(missing).toEqual([]);
    });
  }

  it("keeps panels apart: no block spans more than one panel", async () => {
    const p = await loadPdfPage("proof_v1.pdf");
    const panelWidth = 130 * 2.8346; // the widest panel, in points
    const wide = p.blocks.filter((b) => b.box[2] - b.box[0] > panelWidth);
    // only the two footer lines (title block) may be wider than a panel
    expect(wide.some((b) => b.text.startsWith("KORREKTÚRA v1"))).toBe(true);
    expect(wide.length).toBeLessThanOrEqual(2);
  });

  it("reports bold words: milk powder is plain in v1 and v2, bold in v3", async () => {
    const milk = async (f: string) => {
      const p = await loadPdfPage(f);
      const ing = p.blocks.find((b) => b.text.startsWith("Összetevők"))!;
      return { bold: ing.boldWords.map((w) => w.toLowerCase()), text: ing.text };
    };
    const v1 = await milk("proof_v1.pdf");
    const v3 = await milk("proof_v3.pdf");
    expect(v1.bold).toContain("zabpehely");
    expect(v1.bold.map((w) => w.replace(/[^\p{L}]/gu, ""))).not.toContain("tejpor");
    const clean = v3.bold.map((w) => w.replace(/[^\p{L}]/gu, ""));
    expect(clean).toEqual(expect.arrayContaining(["zabpehely", "teljes", "tejpor"]));
  });

  it("the ingredients paragraph and the may-contain sentence are separate blocks (v2)", async () => {
    const p = await loadPdfPage("proof_v2.pdf");
    const ing = p.blocks.find((b) => b.text.startsWith("Összetevők"))!;
    expect(ing.text).not.toContain("Nyomokban");
    expect(p.blocks.some((b) => b.text.startsWith("Nyomokban szóját"))).toBe(true);
  });

  it("nutrition rows are one block each, label and value on the same block", async () => {
    const p = await loadPdfPage("proof_v1.pdf");
    const carbs = p.blocks.filter((b) => norm(b.text) === "szénhidrát 46,5 g");
    expect(carbs).toHaveLength(1);
    expect(p.blocks.filter((b) => norm(b.text) === "só 0,18 mg")).toHaveLength(1);
  });

  it("side panels moved in v2: same text, different x", async () => {
    const v1 = await loadPdfPage("proof_v1.pdf");
    const v2 = await loadPdfPage("proof_v2.pdf");
    const find = (p: typeof v1) => p.blocks.find((b) => b.text.startsWith("Száraz, hűvös helyen"))!;
    expect(find(v1).text).toBe(find(v2).text);
    expect(Math.abs(find(v1).box[0] - find(v2).box[0])).toBeGreaterThan(300);
  });

  it("boxes are inside the page and have a positive size", async () => {
    const p = await loadPdfPage("proof_v1.pdf");
    for (const b of p.blocks) {
      expect(b.box[2]).toBeGreaterThan(b.box[0]);
      expect(b.box[3]).toBeGreaterThan(b.box[1]);
      expect(b.box[0]).toBeGreaterThanOrEqual(0);
      expect(b.box[2]).toBeLessThanOrEqual(p.width + 1);
      expect(b.box[3]).toBeLessThanOrEqual(p.height + 1);
    }
  });
});

describe("helpers", () => {
  it("effectiveDpi: a 2480 px wide image over an A3 landscape page is about 150 dpi", () => {
    expect(Math.round(effectiveDpi(2480, 1190.55))).toBe(150);
    expect(Math.round(effectiveDpi(800, 1190.55))).toBe(48);
    expect(effectiveDpi(100, 0)).toBe(0);
  });

  it("hasTextLayer needs real characters, not blank items", () => {
    const blank: RawItem = { str: "   ", transform: [10, 0, 0, 10, 0, 0], width: 5, height: 10, fontName: "f" };
    expect(hasTextLayer([blank, blank])).toBe(false);
    expect(hasTextLayer([])).toBe(false);
  });

  it("isBoldFont reads font names", () => {
    expect(isBoldFont("AAAAAA+DejaVuSans-Bold")).toBe(true);
    expect(isBoldFont("Arial-BoldMT")).toBe(true);
    expect(isBoldFont("AAAAAA+DejaVuSans")).toBe(false);
    expect(isBoldFont(undefined)).toBe(false);
  });

  it("without font names nothing is reported as bold", () => {
    const it: RawItem = { str: "ZABPEHELY", transform: [8, 0, 0, 8, 10, 100], width: 50, height: 8, fontName: "g_d0_f2" };
    const [b] = buildBlocks([it], { number: 1, width: 600, height: 800 });
    expect(b!.boldWords).toEqual([]);
  });
});
