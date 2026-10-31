// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { parseSpecWorkbook, SpecParseError, isBlue } from "../src/core/parseSpec";

const FIX = join(__dirname, "..", "fixtures");
const key = JSON.parse(readFileSync(join(FIX, "answer_key.json"), "utf-8"));
const specBytes = () => new Uint8Array(readFileSync(join(FIX, "spec_SP-2026-0417_v3.xlsx")));

async function workbookBytes(build: (ws: ExcelJS.Worksheet) => void): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("S");
  build(ws);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

function header(ws: ExcelJS.Worksheet, row: number, text: string) {
  const c = ws.getCell(row, 1);
  c.value = text;
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF555555" } };
}

describe("parseSpecWorkbook on the fictional spec", () => {
  it("returns exactly the 19 blue fields with the answer-key ids, labels and values", async () => {
    const { fields } = await parseSpecWorkbook(specBytes());
    expect(fields).toHaveLength(19);
    expect(fields.map((f) => f.id)).toEqual(key.spec_blue_fields.map((f: { id: string }) => f.id));
    for (const f of key.spec_blue_fields) {
      const got = fields.find((x) => x.id === f.id)!;
      expect(got.label).toBe(f.label);
      expect(got.value).toBe(f.value);
    }
  });

  it("skips the blue legend row above the first section header", async () => {
    const { fields } = await parseSpecWorkbook(specBytes());
    expect(fields.some((f) => /Jelmagyarázat|Kék színű/.test(f.label + f.value))).toBe(false);
  });

  it("does not return the 12 black fields", async () => {
    const { fields } = await parseSpecWorkbook(specBytes());
    expect(fields.some((f) => f.label === "Termékleírás" || f.label === "Salmonella")).toBe(false);
  });

  it("reads the spec number, version and product name", async () => {
    const { meta } = await parseSpecWorkbook(specBytes());
    expect(meta.specNumber).toBe("SP-2026-0417");
    expect(meta.version).toBe("3");
    expect(meta.erpCode).toBe("MZL-10482");
    expect(meta.productName).toBe("Mangós instant zabkása szárított mangódarabokkal");
  });
});

describe("parseSpecWorkbook edge cases", () => {
  it("gives an error for a file that is not an .xlsx", async () => {
    await expect(parseSpecWorkbook(new TextEncoder().encode("not a workbook"))).rejects.toThrow(SpecParseError);
  });

  it("gives an error for a workbook with no blue cells", async () => {
    const bytes = await workbookBytes((ws) => {
      header(ws, 1, "1. Section");
      ws.getCell(2, 1).value = "Label";
      ws.getCell(2, 2).value = "Value";
    });
    await expect(parseSpecWorkbook(bytes)).rejects.toThrow(/No blue/);
  });

  it("recognises blue by fill as well as by font colour", async () => {
    const bytes = await workbookBytes((ws) => {
      header(ws, 1, "1. Section");
      ws.getCell(2, 1).value = "By font";
      ws.getCell(2, 2).value = "A";
      ws.getCell(2, 2).font = { color: { argb: "FF0070C0" } };
      ws.getCell(3, 1).value = "By fill";
      ws.getCell(3, 2).value = "B";
      ws.getCell(3, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBDD7EE" } };
      ws.getCell(4, 1).value = "Black";
      ws.getCell(4, 2).value = "C";
    });
    const { fields } = await parseSpecWorkbook(bytes);
    expect(fields.map((f) => f.label)).toEqual(["By font", "By fill"]);
  });

  it("accepts any blue shade, not only one hex value", () => {
    expect(isBlue("FF0070C0")).toBe(true);
    expect(isBlue("FF1F4E9A")).toBe(true);
    expect(isBlue("FF2E75B6")).toBe(true);
  });

  it("does not treat red, green, grey or black as blue", () => {
    expect(isBlue("FFC0392B")).toBe(false);
    expect(isBlue("FF5B8C3A")).toBe(false);
    expect(isBlue("FF555555")).toBe(false);
    expect(isBlue("FF000000")).toBe(false);
    expect(isBlue(undefined)).toBe(false);
  });

  it("ignores blue cells above the first section header (legend) and gives unknown labels a slug id", async () => {
    const bytes = await workbookBytes((ws) => {
      ws.getCell(1, 1).value = "Legend";
      ws.getCell(1, 2).value = "blue legend";
      ws.getCell(1, 2).font = { color: { argb: "FF0070C0" } };
      header(ws, 2, "1. Section");
      ws.getCell(3, 1).value = "Új mező";
      ws.getCell(3, 2).value = "X";
      ws.getCell(3, 2).font = { color: { argb: "FF0070C0" } };
    });
    const { fields } = await parseSpecWorkbook(bytes);
    expect(fields).toHaveLength(1);
    expect(fields[0]!.id).toBe("uj_mezo");
  });
});
