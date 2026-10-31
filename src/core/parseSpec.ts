/**
 * Spec Excel reader. Finds the blue (mandatory label) rows of a product spec and returns them as fields.
 *
 * Rules (BUILD_PLAN v4, section 5):
 *  - Blue = font colour or fill colour in the blue hue range (not a fixed hex value).
 *  - Only rows below the first section header count, so the blue legend row at the top is skipped.
 *  - Zero fields is an error. A file that is not an .xlsx is an error.
 *
 * Limits [suggestion]: theme colours and indexed colours are not resolved, so a template that uses
 * "Blue, Accent 1" from the theme is read as not blue. Tuned on one fictional template.
 */
import ExcelJS from "exceljs";

export interface SpecField {
  /** Stable id used by tests and findings. Known labels get the answer-key id, others a slug. */
  id: string;
  label: string;
  value: string;
  /** 1-based Excel row. */
  row: number;
}

export interface SpecMeta {
  specNumber: string;
  version: string;
  validFrom: string | null;
  erpCode: string | null;
  packagingCode: string | null;
  productName: string;
}

export interface ParsedSpec {
  meta: SpecMeta;
  fields: SpecField[];
}

export class SpecParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpecParseError";
  }
}

/** Template mapping for the demo spec: Hungarian label to the answer-key id. */
const KNOWN_LABEL_IDS: Record<string, string> = {
  "termék megnevezése": "name",
  "nettó tömeg": "net_qty",
  "adagok száma": "servings",
  "összetevők": "ingredients",
  "keresztszennyeződés": "may_contain",
  "energia": "energy",
  "zsír": "fat",
  "ebből telített zsírsavak": "saturates",
  "szénhidrát": "carbs",
  "ebből cukrok": "sugars",
  "rost": "fibre",
  "fehérje": "protein",
  "só": "salt",
  "energia adagonként (50 g)": "per_serving",
  "felhasználási javaslat": "preparation",
  "tárolás": "storage",
  "minőségmegőrzés jelölése": "best_before",
  "gyártó": "manufacturer",
  "előállítás helye": "origin",
};

export function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fieldId(label: string, used: Set<string>): string {
  const base = KNOWN_LABEL_IDS[label.trim().toLowerCase()] ?? (slugify(label) || "field");
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  used.add(id);
  return id;
}

/** Hue in degrees and saturation 0..1 for an ARGB or RGB hex string, or null if unreadable. */
export function hueOf(argb: string | undefined): { h: number; s: number; l: number } | null {
  if (!argb) return null;
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

/**
 * Blue hue range 190..260 degrees, clearly coloured (not grey). Text must be readable on white, so
 * not too light; a fill may be a pale blue, so it may be lighter. Almost white and almost black fail.
 */
export function isBlue(argb: string | undefined, kind: "font" | "fill" = "font"): boolean {
  const c = hueOf(argb);
  if (!c) return false;
  const maxL = kind === "fill" ? 0.93 : 0.8;
  return c.h >= 190 && c.h <= 260 && c.s >= 0.4 && c.l >= 0.15 && c.l <= maxL;
}

function cellIsBlue(cell: ExcelJS.Cell): boolean {
  if (isBlue(cell.font?.color?.argb)) return true;
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  if (fill && fill.type === "pattern" && fill.pattern === "solid") {
    return isBlue(fill.fgColor?.argb, "fill");
  }
  return false;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("").trim();
    if (o.result !== undefined && o.result !== null) return String(o.result).trim();
    if (typeof o.text === "string") return o.text.trim();
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return "";
  }
  return String(v).trim();
}

function isSectionHeader(a: ExcelJS.Cell, b: ExcelJS.Cell): boolean {
  const fill = a.fill as ExcelJS.FillPattern | undefined;
  const filled = !!fill && fill.type === "pattern" && fill.pattern === "solid";
  return filled && cellText(a) !== "" && cellText(b) === "";
}

const META_LABELS: Record<string, keyof SpecMeta> = {
  "specifikáció száma": "specNumber",
  "verzió": "version",
  "érvényes": "validFrom",
  "erp termékkód": "erpCode",
  "csomagolóanyag kód (doboz)": "packagingCode",
};

export async function parseSpecWorkbook(data: ArrayBuffer | Uint8Array): Promise<ParsedSpec> {
  const wb = new ExcelJS.Workbook();
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    // ExcelJS wants a Buffer-like; an ArrayBuffer view works in Node and the browser.
    await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new SpecParseError("This file is not a readable .xlsx workbook");
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new SpecParseError("The workbook has no sheet");

  const metaRaw: Partial<Record<keyof SpecMeta, string>> = {};
  const fields: SpecField[] = [];
  const used = new Set<string>();
  let started = false;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const a = row.getCell(1);
    const b = row.getCell(2);
    if (isSectionHeader(a, b)) {
      started = true;
      return;
    }
    const label = cellText(a);
    if (!started) {
      const key = META_LABELS[label.toLowerCase()];
      if (key) metaRaw[key] = cellText(b);
      return;
    }
    const value = cellText(b);
    if (!label || !value) return;
    if (cellIsBlue(b) || cellIsBlue(a)) {
      fields.push({ id: fieldId(label, used), label, value, row: rowNumber });
    }
  });

  if (fields.length === 0) {
    throw new SpecParseError("No blue (mandatory) cells found below the first section header");
  }
  const name = fields.find((f) => f.id === "name")?.value ?? "";
  return {
    meta: {
      specNumber: metaRaw.specNumber ?? "",
      version: metaRaw.version ?? "",
      validFrom: metaRaw.validFrom ?? null,
      erpCode: metaRaw.erpCode ?? null,
      packagingCode: metaRaw.packagingCode ?? null,
      productName: name,
    },
    fields,
  };
}
