/**
 * Send-back list: the numbered Hungarian comment list a checker pastes into the email to the designer.
 *
 * Built from confirmed findings with fixed templates in code. The AI never writes this text, so the
 * output is reproducible and testable. The checker can edit or remove lines before sending.
 */

export type FindingKind =
  | "spec_mismatch"
  | "spec_missing"
  | "allergen_not_emphasised"
  | "font_too_small"
  | "comment_not_done"
  | "unrequested_modified"
  | "unrequested_added"
  | "unrequested_removed"
  | "manual";

export interface Finding {
  /** Short stable code shown in the UI, e.g. F3, C4, U2. */
  code: string;
  kind: FindingKind;
  /** Decision of the checker. Only real errors go on the list. */
  decision: "open" | "real_error" | "not_error" | "needs_discussion";
  /** Field label from the spec, e.g. "Szénhidrát". */
  label?: string;
  specValue?: string;
  foundValue?: string | null;
  /** Allergen words that are not emphasised. */
  words?: string[];
  measuredMm?: number;
  minimumMm?: number;
  /** Previous comment text (comment_not_done). */
  commentText?: string;
  before?: string | null;
  after?: string | null;
  /** Free text written by the checker (manual). */
  text?: string;
  /** Another finding that already reports this problem (counted once, R8). */
  relatedTo?: string;
}

export interface SendBackItem {
  /** Code of the finding the line came from. */
  code: string;
  text: string;
}

const q = (s: string) => `„${s.trim()}”`;
const mm = (n: number) => n.toFixed(2).replace(".", ",");

/** One Hungarian line for one finding. Pure and deterministic. */
export function lineFor(f: Finding): string {
  switch (f.kind) {
    case "spec_mismatch":
      return `${f.label ?? "Mező"}: a specifikáció szerint ${q(f.specValue ?? "")}, a terven ${q(f.foundValue ?? "")} szerepel. Kérjük javítani.`;
    case "spec_missing":
      return `${f.label ?? "Mező"}: a specifikáció szerint ${q(f.specValue ?? "")} kötelező, de a terven nem található. Kérjük feltüntetni.`;
    case "allergen_not_emphasised": {
      const w = (f.words ?? []).join(", ");
      return `${f.label ?? "Összetevők"}: az allergén ${q(w)} nincs kiemelve. Kérjük kiemelni (például félkövér betűvel).`;
    }
    case "font_too_small":
      return `${f.label ?? "Szöveg"}: a betűméret (x-magasság ${mm(f.measuredMm ?? 0)} mm) a megengedett minimum (${mm(f.minimumMm ?? 0)} mm) alatt van. Kérjük növelni.`;
    case "comment_not_done":
      return `Korábbi észrevételünk nem lett átvezetve: ${q(f.commentText ?? "")}. Kérjük javítani.`;
    case "unrequested_modified":
      return `Nem kért változtatás: ${q(f.before ?? "")} helyett ${q(f.after ?? "")} szerepel. Kérjük visszaállítani, vagy jelezni az okát.`;
    case "unrequested_added":
      return `Nem kért új tartalom jelent meg: ${q(f.after ?? "")}. Kérjük eltávolítani, vagy jelezni az okát.`;
    case "unrequested_removed":
      return `Nem kért törlés: ${q(f.before ?? "")} hiányzik az új verzióból. Kérjük visszaállítani, vagy jelezni az okát.`;
    case "manual":
      return (f.text ?? "").trim();
  }
}

const ORDER: FindingKind[] = [
  "spec_mismatch", "spec_missing", "allergen_not_emphasised", "font_too_small",
  "comment_not_done", "unrequested_modified", "unrequested_added", "unrequested_removed", "manual",
];

export interface BuildResult {
  items: SendBackItem[];
  /** Findings left out because another finding already reports the same problem. */
  mergedInto: Record<string, string>;
}

/**
 * Collect the lines for a round: real errors only, one line per problem, stable order
 * (spec findings, allergen, font, old comments, unrequested changes, the checker's own).
 */
export function buildSendBack(findings: Finding[]): BuildResult {
  const real = findings.filter((f) => f.decision === "real_error");
  const codes = new Set(real.map((f) => f.code));
  const mergedInto: Record<string, string> = {};
  const kept: Finding[] = [];
  for (const f of real) {
    // R8: the same change reported twice (a spec mismatch and an unrequested change) is listed once.
    if (f.relatedTo && codes.has(f.relatedTo)) {
      mergedInto[f.code] = f.relatedTo;
      continue;
    }
    kept.push(f);
  }
  kept.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.code.localeCompare(b.code, "en", { numeric: true }));
  const items = kept.map((f) => ({ code: f.code, text: lineFor(f) })).filter((i) => i.text.length > 0);
  return { items, mergedInto };
}

export interface Edit {
  code: string;
  /** Remove this line. */
  remove?: boolean;
  /** Replace this line's text. */
  text?: string;
}

/** The checker's changes before sending: edit or remove lines. (Reordering is not in the MVP.) */
export function applyEdits(items: SendBackItem[], edits: Edit[]): SendBackItem[] {
  const byCode = new Map(edits.map((e) => [e.code, e]));
  return items
    .filter((i) => !byCode.get(i.code)?.remove)
    .map((i) => {
      const e = byCode.get(i.code);
      return e?.text !== undefined ? { ...i, text: e.text.trim() } : i;
    })
    .filter((i) => i.text.length > 0);
}

export interface RenderOptions {
  /** Heading line, e.g. product and piece. */
  heading?: string;
  roundNo?: number;
}

/** Numbered plain text, ready to paste into an email. Throws if there is nothing to send. */
export function renderSendBack(items: SendBackItem[], opts: RenderOptions = {}): string {
  if (items.length === 0) throw new Error("The send-back list is empty");
  const head = opts.heading
    ? `${opts.heading}${opts.roundNo ? `, ${opts.roundNo}. kör` : ""} – észrevételek:`
    : opts.roundNo
      ? `${opts.roundNo}. kör – észrevételek:`
      : "Észrevételek:";
  const lines = items.map((i, n) => `${n + 1}. ${i.text}`);
  return [head, "", ...lines].join("\n");
}
