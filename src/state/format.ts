/**
 * Display helpers so pages never compose wording themselves. Claude owns this file.
 */
import type { CheckFinding } from "../core/findings";
import type { FieldResult } from "../core/compare";
import { kindLabel, reasonLabel } from "./labels";

/** Upper-case badge on a finding row, as in the wireframe: MISMATCH, MISSING, NOT EMPHASISED, COULD NOT READ. */
export function badgeOf(f: CheckFinding): string {
  switch (f.kind) {
    case "spec_mismatch": return "MISMATCH";
    case "spec_missing": return "MISSING";
    case "allergen_not_emphasised": return "NOT EMPHASISED";
    case "could_not_read": return "COULD NOT READ";
    case "allergen_could_not_check": return "COULD NOT CHECK";
    default: return kindLabel[f.kind].toUpperCase();
  }
}

/** One-line summary under the field name: "46,5 g, spec says 64,5 g". */
export function summaryOf(f: CheckFinding, result?: FieldResult): string {
  switch (f.kind) {
    case "spec_mismatch": {
      const n = f.occurrences && f.occurrences > 1 ? ` (in ${f.occurrences} places)` : "";
      return `${f.foundValue ?? ""}, spec says ${f.specValue ?? ""}${n}`;
    }
    case "spec_missing": return "Not found on the proof";
    case "allergen_not_emphasised": return `${(f.words ?? []).join(", ")} not emphasised`;
    case "allergen_could_not_check": return "Could not see which words are bold";
    case "could_not_read": return result?.reason ? reasonLabel[result.reason] : "Could not read this field";
    default: return kindLabel[f.kind];
  }
}

/** The grey line under a send-back row: where the line came from. */
export function sourceOf(code: string): string {
  if (code.startsWith("F")) return `From ${code} · real error`;
  if (code.startsWith("C")) return `From ${code} · earlier comment not done`;
  if (code.startsWith("U")) return `From ${code} · change nobody asked for`;
  if (code.startsWith("M")) return "Added by you";
  return code;
}

/** "09:14" in the viewer's time zone. Empty string when missing. */
export function formatTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Whole days from `fromIso` to `toIso` (default now), never negative. */
export function daysBetween(fromIso: string, toIso: string = new Date().toISOString()): number {
  return Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000));
}

/** "Print sample OK" + optional note -> the stored reason. */
export function reasonText(chip: string, note?: string): string {
  const n = (note ?? "").trim();
  return n ? `${chip}: ${n}` : chip;
}
