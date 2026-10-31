/**
 * Fixed demo values shown on the screens (all fictional, taken from the wireframes).
 * Claude owns this file.
 */
export const people = {
  requester: "Bence N.",
  projectOwner: "Nagy B.",
  checker1: "Anna K.",
  checker2: "Péter S.",
  lead: "Dr. Kovács E.",
  designer: "Studio Fiktív",
} as const;

/** The "Working as" chip on each page. */
export const workingAs = {
  requester: `Requester (${people.requester})`,
  designer: `Designer, external (${people.designer})`,
  checker1: `Checker 1 (${people.checker1})`,
  checker2: `Checker 2 (${people.checker2})`,
  lead: `Food-safety lead (${people.lead})`,
  anyone: `Checker 1 (${people.checker1})`,
} as const;

/** Everything on the New request form except the spec, which is read from the uploaded Excel. */
export const demoRequestFields = {
  workId: "WRK-0142",
  product: "Mangós instant zabkása 400 g",
  productCode: "MZL-10482",
  piece: "Box CS-20931",
  requestedBy: "Partner" as "Partner" | "Own graphics team",
  partner: "Studio Fiktív (fictional)",
  projectOwner: people.projectOwner,
  designer: "External: Studio Fiktív, design desk",
  dueDate: "2026-11-05",
  notes: "Reused artwork from the apricot variant: please check the flavour name.",
};

/** Reason chips when a checker marks an item "Not an error" (the wireframe's options). */
export const dismissReasons = ["Print sample OK", "Spec outdated", "Other"] as const;
/** Reason stored when an unrequested change is accepted. */
export const ACCEPTED_CHANGE = "Change accepted";
