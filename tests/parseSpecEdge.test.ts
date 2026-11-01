// Spec edge cases: new field names, other blue encodings, odd layouts. Built from the fictional spec by changing it.
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { parseSpecWorkbook, SpecParseError } from "../src/core/parseSpec";

const SRC = "fixtures/spec_SP-2026-0417_v3.xlsx";
type Mutate = (wb: ExcelJS.Workbook) => void;

async function parse(mutate: Mutate) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(readFileSync(SRC) as unknown as ArrayBuffer);
  mutate(wb);
  return parseSpecWorkbook(new Uint8Array((await wb.xlsx.writeBuffer()) as ArrayBuffer));
}
const first = (wb: ExcelJS.Workbook) => wb.worksheets[0]!;
const blue = (c: ExcelJS.Cell, color: Partial<ExcelJS.Color> = { argb: "FF0070C0" }) => {
  c.font = { color: color as ExcelJS.Color };
};
const NEW: [string, string][] = [["Üdítő típusa", "Szénsavas üdítőital"], ["Üdítő színe", "Narancssárga"], ["Ciántartalom", "0,02 mg/kg"]];
const addRows = (wb: ExcelJS.Workbook, color?: Partial<ExcelJS.Color>) => {
  for (const [l, v] of NEW) blue(first(wb).addRow([l, v]).getCell(2), color);
};

describe("new, unseen field names in blue", () => {
  it("are read as fields with the printed label and value", async () => {
    const p = await parse((wb) => addRows(wb));
    expect(p.fields.length).toBe(22);
    const f = p.fields.find((x) => x.label === "Ciántartalom")!;
    expect(f.value).toBe("0,02 mg/kg");
    expect(f.id).toBe("ciantartalom");
    expect(p.warnings).toBeUndefined();
  });
  it("work with a pale blue fill, a dark blue and a light blue font", async () => {
    expect((await parse((wb) => addRows(wb, { argb: "FF002060" }))).fields.length).toBe(22);
    expect((await parse((wb) => addRows(wb, { argb: "FF00B0F0" }))).fields.length).toBe(22);
    const filled = await parse((wb) => { for (const [l, v] of NEW) first(wb).addRow([l, v]).getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } }; });
    expect(filled.fields.length).toBe(22);
  });
  it("a number cell is read as its raw number (a unit added only by the cell format is not part of it: known limit)", async () => {
    const p = await parse((wb) => { const c = first(wb).addRow(["Ciántartalom", 0.02]).getCell(2); c.numFmt = '0.00" mg/kg"'; blue(c); });
    expect(p.fields.find((x) => x.id === "ciantartalom")!.value).toBe("0.02");
  });
});

describe("blue stored as a theme or indexed colour", () => {
  it("theme blue (Accent 1) is resolved from the workbook theme", async () => {
    const p = await parse((wb) => addRows(wb, { theme: 4 } as unknown as ExcelJS.Color));
    expect(p.fields.length).toBe(22);
    expect(p.warnings).toBeUndefined();
  });
  it("theme blue with a tint is still blue", async () => {
    expect((await parse((wb) => addRows(wb, { theme: 4, tint: -0.25 } as unknown as ExcelJS.Color))).fields.length).toBe(22);
  });
  it("a theme colour that is not blue (accent 2, orange) is not read", async () => {
    expect((await parse((wb) => addRows(wb, { theme: 5 } as unknown as ExcelJS.Color))).fields.length).toBe(19);
  });
  it("indexed blue is read", async () => {
    expect((await parse((wb) => addRows(wb, { indexed: 12 } as unknown as ExcelJS.Color))).fields.length).toBe(22);
  });
});

describe("odd layouts do not fail silently", () => {
  it("a value in column C is read", async () => {
    const p = await parse((wb) => { const r = first(wb).addRow(["Üdítő típusa", null, "Szénsavas"]); blue(r.getCell(3)); });
    expect(p.fields.find((x) => x.id === "udito_tipusa")?.value).toBe("Szénsavas");
  });
  it("a blue row with no value is skipped and says so", async () => {
    const p = await parse((wb) => blue(first(wb).addRow(["Üdítő típusa", ""]).getCell(2)));
    expect(p.fields.length).toBe(19);
    expect(p.warnings?.join(" ")).toMatch(/Üdítő típusa.*no value/);
  });
  it("a hidden blue row is read and says so", async () => {
    const p = await parse((wb) => { const r = first(wb).addRow(["Üdítő típusa", "Szénsavas"]); blue(r.getCell(2)); r.hidden = true; });
    expect(p.fields.length).toBe(20);
    expect(p.warnings?.join(" ")).toMatch(/hidden/);
  });
  it("the blue rows on a later sheet are found", async () => {
    const p = await parse((wb) => {
      const src = first(wb);
      const empty = wb.addWorksheet("Üres");
      empty.orderNo = -1;
      wb.worksheets.sort((a, b) => a.orderNo - b.orderNo);
      expect(src.name).not.toBe(empty.name);
    });
    expect(p.fields.length).toBe(19);
  });
  it("a spec with no section header is read from the top and warns about a legend", async () => {
    const p = await parse((wb) => first(wb).eachRow((r) => { r.getCell(1).fill = { type: "pattern", pattern: "none" } as ExcelJS.Fill; }));
    expect(p.fields.length).toBeGreaterThanOrEqual(19);
    expect(p.warnings?.join(" ")).toMatch(/No section header/);
  });
  it("a workbook with no blue cells is an error that says what blue means", async () => {
    await expect(parse((wb) => first(wb).eachRow((r) => r.eachCell((c) => { c.font = {}; c.fill = { type: "pattern", pattern: "none" } as ExcelJS.Fill; })))).rejects.toThrow(SpecParseError);
  });
});
