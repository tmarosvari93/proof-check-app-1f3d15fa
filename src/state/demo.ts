import type { Role } from "./types";

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

/** The role switcher in the top bar, in the order of the process. Labels are the "Working as" texts above. */
export const roleOrder: Role[] = ["requester", "designer", "checker1", "checker2", "lead"];
export const roleLabel: Record<Role, string> = {
  requester: workingAs.requester,
  designer: workingAs.designer,
  checker1: workingAs.checker1,
  checker2: workingAs.checker2,
  lead: workingAs.lead,
};

/** The name stored when Checker 1 claims a proof. */
export const claimerName = people.checker1;

/**
 * Track all work: a fixed table, nothing in it is live. The columns follow the client's own tracking sheet
 * (received date, first request, number of rounds, approval date; discovery call 40:48). All names are fictional.
 */
export const trackAllNote = "Sample data, not functional. In the full design this table follows every request.";
export interface TrackRow {
  workId: string;
  product: string;
  piece: string;
  partner: string;
  received: string; // ISO date the first proof arrived
  firstRequest: string; // ISO date of the first send-back; "" while round 1 is still in review
  rounds: number;
  approved: string; // ISO date; "" while open
}
export const trackAllSample: TrackRow[] = [
  { workId: "WRK-0141", product: "Kakaós zabkása 400 g", piece: "Box CS-20917", partner: "Studio Fiktív", received: "2026-10-26", firstRequest: "", rounds: 1, approved: "" },
  { workId: "WRK-0140", product: "Epres müzli 350 g", piece: "Pouch PO-31204", partner: "Atelier Példa", received: "2026-10-21", firstRequest: "2026-10-22", rounds: 3, approved: "" },
  { workId: "WRK-0139", product: "Vaníliás kása 400 g", piece: "Box CS-20884", partner: "Own graphics team", received: "2026-10-19", firstRequest: "2026-10-19", rounds: 2, approved: "2026-10-23" },
  { workId: "WRK-0138", product: "Erdei gyümölcs müzli 350 g", piece: "Label LB-11450", partner: "Atelier Példa", received: "2026-10-14", firstRequest: "2026-10-16", rounds: 4, approved: "2026-10-30" },
  { workId: "WRK-0137", product: "Mogyorós granola 300 g", piece: "Pouch PO-31187", partner: "Studio Fiktív", received: "2026-10-12", firstRequest: "2026-10-13", rounds: 2, approved: "2026-10-16" },
  { workId: "WRK-0136", product: "Banános zabkása 400 g", piece: "Box CS-20851", partner: "Own graphics team", received: "2026-10-08", firstRequest: "2026-10-08", rounds: 1, approved: "2026-10-09" },
  { workId: "WRK-0135", product: "Almás-fahéjas müzli 350 g", piece: "Box CS-20846", partner: "Atelier Példa", received: "2026-10-05", firstRequest: "2026-10-06", rounds: 6, approved: "2026-11-02" },
  { workId: "WRK-0134", product: "Sárgabarackos instant zabkása 400 g", piece: "Box CS-20812", partner: "Studio Fiktív", received: "2026-10-01", firstRequest: "2026-10-02", rounds: 3, approved: "2026-10-14" },
];
