/**
 * Spec Excel reader. Finds the blue (mandatory label) rows of a product spec and returns them as fields.
 *
 * Rules (BUILD_PLAN v4, section 5):
 *  - Blue = font colour or fill colour in the blue hue range (not a fixed hex value).
 *  - Only rows below the first section header count, so the blue legend row at the top is skipped.
 *  - Colours: RGB, theme colours (with tint, from the workbook's own theme) and the blue entries of the old indexed palette.
 *  - Zero fields is an error. A file that is not an .xlsx is an error.
 *  - Anything skipped (blue row without a value, hidden row, unreadable colour) is reported in `warnings`.
 *
 * Limits [suggestion]: label in column A, value in the first filled cell of columns B to F; Hungarian metadata labels.
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
  /** Things that were skipped or guessed while reading, for the checker to see. Absent when there are none. */
  warnings?: string[];
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

/** Colours the way Excel stores them: RGB, a theme slot (with a tint), or an old indexed colour. */
interface ColorCtx {
  /** Theme slots in Excel order: lt1, dk1, lt2, dk2, accent1..6 (RRGGBB). Empty when the theme could not be read. */
  theme: string[];
  /** Colours that were in use but that we could not turn into RGB. */
  unreadable: number;
}

/** [assumption] The first entries of Excel's old indexed palette that are blue. Others are read as not blue. */
const INDEXED_BLUES: Record<number, string> = { 4: "0000FF", 12: "0000FF", 30: "0066CC", 48: "3366FF" };

function themeColors(wb: ExcelJS.Workbook): string[] {
  const themes = (wb as unknown as { _themes?: Record<string, unknown> })._themes;
  const xml = themes ? Object.values(themes).find((v) => typeof v === "string") : undefined;
  if (typeof xml !== "string") return [];
  const scheme = xml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/)?.[0];
  if (!scheme) return [];
  const get = (tag: string): string => {
    const m = scheme.match(new RegExp(`<a:${tag}>([\\s\\S]*?)</a:${tag}>`));
    return m?.[1]?.match(/(?:srgbClr val|lastClr)="([0-9A-Fa-f]{6})"/)?.[1] ?? "";
  };
  return [get("lt1"), get("dk1"), get("lt2"), get("dk2"), ...["accent1", "accent2", "accent3", "accent4", "accent5", "accent6"].map(get)];
}

function tinted(hex: string, tint: number): string {
  if (!tint) return hex;
  const c = hueOf(hex);
  if (!c) return hex;
  const l = tint < 0 ? c.l * (1 + tint) : c.l * (1 - tint) + tint;
  const a = c.s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + c.h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `${f(0)}${f(8)}${f(4)}`;
}

/** The RGB of an Excel colour, or undefined when there is none or it cannot be resolved (then ctx.unreadable counts it). */
export function resolveColor(color: Partial<ExcelJS.Color> | undefined, ctx: ColorCtx): string | undefined {
  if (!color) return undefined;
  if (color.argb) return color.argb;
  const t = color as { theme?: number; tint?: number; indexed?: number };
  if (typeof t.theme === "number") {
    const base = ctx.theme[t.theme];
    if (base) return tinted(base, t.tint ?? 0);
    ctx.unreadable++;
    return undefined;
  }
  if (typeof t.indexed === "number") {
    const hex = INDEXED_BLUES[t.indexed];
    if (hex) return hex;
    return undefined; // some other indexed colour: not blue
  }
  return undefined;
}

function cellIsBlue(cell: ExcelJS.Cell, ctx: ColorCtx): boolean {
  if (isBlue(resolveColor(cell.font?.color, ctx))) return true;
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  if (fill && fill.type === "pattern" && fill.pattern === "solid") {
    return isBlue(resolveColor(fill.fgColor, ctx), "fill");
  }
  return false;
}

function cellText(cell: ExcelJS.Cell): string {
  // cell.text is what Excel shows: it applies number formats (0,02 mg/kg), joins rich text and uses formula results.
  try {
    const shown = String(cell.text ?? "").trim();
    if (shown) return shown;
  } catch {
    /* fall through to the raw value */
  }
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

const VALUE_COLUMNS = [2, 3, 4, 5, 6];

interface SheetRead {
  metaRaw: Partial<Record<keyof SpecMeta, string>>;
  fields: SpecField[];
  warnings: string[];
}

/** Reads one sheet. requireHeader: only rows below the first section header count (skips a legend at the top). */
function readSheet(ws: ExcelJS.Worksheet, ctx: ColorCtx, requireHeader: boolean): SheetRead {
  const metaRaw: Partial<Record<keyof SpecMeta, string>> = {};
  const fields: SpecField[] = [];
  const warnings: string[] = [];
  const used = new Set<string>();
  let started = !requireHeader;

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
    if (!label) return;
    // The value is the first filled cell to the right of the label (normally column B).
    const valueCell = VALUE_COLUMNS.map((c) => row.getCell(c)).find((c) => cellText(c) !== "");
    const blueRow = cellIsBlue(a, ctx) || VALUE_COLUMNS.some((c) => cellIsBlue(row.getCell(c), ctx));
    if (!valueCell) {
      if (blueRow) warnings.push(`Row ${rowNumber} "${label}" is blue but has no value, so it was skipped.`);
      return;
    }
    if (cellIsBlue(valueCell, ctx) || cellIsBlue(a, ctx)) {
      if (row.hidden) warnings.push(`Row ${rowNumber} "${label}" is hidden in the workbook but was read.`);
      fields.push({ id: fieldId(label, used), label, value: cellText(valueCell), row: rowNumber });
    }
  });
  return { metaRaw, fields, warnings };
}

/**
 * Reads the spec workbook. The first sheet that has blue rows below a section header wins. If no sheet has a
 * section header (a filled row with text in column A only), every blue row is read and a warning says so.
 * Anything skipped on purpose comes back in `warnings`, so a skipped row is never silent.
 */
export async function parseSpecWorkbook(data: ArrayBuffer | Uint8Array): Promise<ParsedSpec> {
  const wb = new ExcelJS.Workbook();
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    // ExcelJS wants a Buffer-like; an ArrayBuffer view works in Node and the browser.
    await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    throw new SpecParseError("This file is not a readable .xlsx workbook");
  }
  if (!wb.worksheets.length) throw new SpecParseError("The workbook has no sheet");

  const ctx: ColorCtx = { theme: themeColors(wb), unreadable: 0 };
  let read: SheetRead | undefined;
  let extra: string[] = [];
  for (const ws of wb.worksheets) {
    const r = readSheet(ws, ctx, true);
    if (r.fields.length) {
      read = r;
      if (ws !== wb.worksheets[0]) extra = [`The blue rows were found on the sheet "${ws.name}", not the first sheet.`];
      break;
    }
  }
  if (!read) {
    for (const ws of wb.worksheets) {
      const r = readSheet(ws, ctx, false);
      if (r.fields.length) {
        read = r;
        extra = ["No section header row was found, so every blue row was read, including any legend row."];
        break;
      }
    }
  }
  if (!read) throw new SpecParseError("No blue (mandatory) cells found. Mandatory cells must have a blue font or a blue fill.");

  const warnings = [...extra, ...read.warnings];
  if (ctx.unreadable > 0) warnings.push(`${ctx.unreadable} cell colour${ctx.unreadable === 1 ? "" : "s"} could not be read (theme colour missing). Those cells were treated as not blue.`);
  const { metaRaw, fields } = read;
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
    ...(warnings.length ? { warnings } : {}),
  };
}
