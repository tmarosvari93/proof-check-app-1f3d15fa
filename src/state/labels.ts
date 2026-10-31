/** Fixed UI wording, so pages never invent labels. Claude owns this file. */
import type { CheckKind } from "../core/findings";
import type { DiffType, LineVerdict, ReadMode, Step } from "./types";
import type { Verdict } from "../core/compare";

export const kindLabel: Record<CheckKind, string> = {
  spec_mismatch: "Does not match the spec",
  spec_missing: "Missing on the proof",
  allergen_not_emphasised: "Allergen not emphasised",
  allergen_could_not_check: "Could not check emphasis",
  could_not_read: "Could not read",
  font_too_small: "Font too small",
  comment_not_done: "Earlier comment not fixed",
  unrequested_modified: "Changed, nobody asked",
  unrequested_added: "Added, nobody asked",
  unrequested_removed: "Removed, nobody asked",
  manual: "Added by the checker",
};

export const verdictLabel: Record<Verdict, string> = {
  match: "Match",
  mismatch: "Mismatch",
  missing: "Missing",
  could_not_read: "Could not read",
};

export const lineVerdictLabel: Record<LineVerdict, string> = {
  done: "Done",
  not_done: "Not done",
  check_by_hand: "Check by hand",
};

export const diffLabel: Record<DiffType, string> = {
  modified: "Modified",
  added: "Added",
  removed: "Removed",
  moved: "Moved only",
  unchanged: "Unchanged",
};

export const readBanner: Record<ReadMode, string> = {
  text_layer: "Read from the PDF text layer (exact, no AI).",
  ai: "This proof is an image. It was read by AI.",
  failed: "This proof could not be read. Every field shows Could not read.",
};

export const diffUnavailableBanner = {
  no_previous_blocks: "Not compared with the previous round: its content was not stored. Earlier requests were re-checked, but changes nobody asked for are not shown. Check this proof against the last one by hand.",
  read_failed: "Not compared with the previous round: this proof's content could not be read. Changes nobody asked for are not shown. Check this proof against the last one by hand.",
} as const;

export const lowResolutionBanner =
  "Low resolution (under 100 dpi): numbers and units are shown as Could not read, because the AI can misread them at this size.";

/** Meaning of the Could-not-read reason codes from compare.ts. */
export const reasonLabel = {
  low_resolution: "Resolution is too low to trust numbers and units",
  read_failed: "The proof could not be read",
  unreadable: "The text is there but not readable with confidence",
} as const;

/** Where each session step lives. After an action, navigate to stepPath(session.step). */
export const stepPath: Record<Step, string> = {
  home: "/",
  new_request: "/new",
  upload_proof: "/upload",
  review: "/review",
  send_back: "/send-back",
  checker2: "/checker-2",
  lead: "/lead",
  approved: "/lead",
};
