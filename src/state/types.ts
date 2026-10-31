/**
 * The session store shape. This is the contract between the pages (Lovable) and the logic (Claude).
 * Pages read these types; they never compute verdicts. Nothing here is saved: it lives in memory.
 * Claude owns this file. Lovable must not edit it.
 */
import type { ParsedSpec } from "../core/parseSpec";
import type { FieldResult } from "../core/compare";
import type { CheckFinding } from "../core/findings";
import type { SendBackItem } from "../core/sendBack";
import type { Block } from "../core/textLayer";

export type { ParsedSpec, FieldResult, CheckFinding, SendBackItem };

/** How the proof was read. Drives the banner on the review screens. */
export type ReadMode = "text_layer" | "ai" | "failed";

export interface RequestInfo {
  workId: string; // "WRK-0142" (fixed demo value)
  product: string; // "Mangós instant zabkása 400 g"
  productCode: string; // "MZL-10482"
  piece: string; // "Box CS-20931"
  requestedBy: "Partner" | "Own graphics team";
  partner: string;
  projectOwner: string;
  designer: string; // "External: Studio Fiktív, design desk"
  dueDate: string; // ISO date
  notes: string; // notes for the designer
  createdAt: string; // ISO timestamp
  spec: ParsedSpec; // the only real input on the New request screen
}

/** Change between two rounds (diff.ts, step 2). Moves and unchanged blocks are never open. */
export type DiffType = "modified" | "added" | "removed" | "moved" | "unchanged";

export interface DiffItem {
  id: string; // "X1"
  type: DiffType;
  before: string | null;
  after: string | null;
  /** e.g. "emphasis changed" */
  note?: string;
}

/** Was a line of the previous send-back fixed? (unrequested.ts recheckSendBack, step 2) */
export type LineVerdict = "done" | "not_done" | "check_by_hand";

export interface LineCheck {
  code: string; // code of the previous send-back line, e.g. "F2"
  text: string; // the Hungarian line as sent
  verdict: LineVerdict;
  /** Spec field the line pointed to, if any. A hand-typed line has none and is check_by_hand. */
  fieldId?: string;
}

/** A change nobody asked for (unrequested.ts markUnrequested, step 2). */
export interface UnrequestedItem {
  code: string; // "U1"
  change: DiffItem;
  /** Short description, e.g. "Preparation text changed". */
  what: string;
  /** Panel, e.g. "Side panel". */
  where?: string;
  /** Code of a spec finding about the same problem, e.g. "F5". Then it is listed once. */
  linkedTo?: string;
  /** Spec fields whose printed text changed (set by unrequested.ts). */
  fieldIds?: string[];
}

export type Decision = CheckFinding["decision"];

export interface Round {
  no: number; // 1, 2, 3
  fileName: string;
  /** The designer's note typed on the upload page. */
  designerNote: string;
  readMode: ReadMode;
  /** Effective dpi of a flat proof; undefined for a vector proof. */
  dpi?: number;
  /** Seconds the check took. */
  seconds: number;
  /** One result per spec field: 19 of them. */
  results: FieldResult[];
  /** Spec findings (F codes). Matches are not findings. */
  findings: CheckFinding[];
  matches: number;
  /** Round 2 and later only. */
  diff?: DiffItem[];
  lineChecks?: LineCheck[];
  unrequested?: UnrequestedItem[];
  /** Checker's lines, built from the real errors. Empty until the checker finishes the review. */
  sendBack: SendBackItem[];
  /** The checker's decision per item code (F1, C3, U2, ...). A missing key means open. */
  decisions: Record<string, Decision>;
  /** Reason typed when an item was dismissed (decision not_error). Checker 2 reviews these. */
  dismissals: Record<string, string>;
  /** Review finished (the checker pressed Finish). */
  finished: boolean;
  /** ISO timestamp of Finish review. */
  finishedAt?: string;
  /**
   * Text blocks read from this proof and the page size. Kept only so the next round can be diffed against
   * this one. Pages never read them. Absent on the prepared (jumpTo) states: then round 2 has no diff.
   */
  blocks?: Block[];
  page?: { width: number; height: number };
  /**
   * Round 2 and later: why this round was NOT compared with the previous one. Then there is no diff and the
   * page must say so, never "no changes". no_previous_blocks: the previous round has no stored blocks (a prepared
   * demo state, or its AI block read failed). read_failed: this proof's blocks could not be read.
   */
  diffUnavailable?: "no_previous_blocks" | "read_failed";
}

export type Step =
  | "home"
  | "new_request"
  | "upload_proof"
  | "review"
  | "send_back"
  | "checker2"
  | "lead"
  | "approved";

export interface Session {
  /** Spec read on the New request page, before Create request is pressed. */
  pendingSpec: ParsedSpec | null;
  request: RequestInfo | null;
  rounds: Round[];
  /** The round being worked on, 1-based. */
  current: number;
  step: Step;
  checker2Agreed: Record<string, boolean>; // by finding code
  checker2SignedOff: boolean;
  checker2SignedAt?: string;
  approved: boolean;
  approvedAt?: string;
}

export const emptySession: Session = {
  pendingSpec: null,
  request: null,
  rounds: [],
  current: 1,
  step: "home",
  checker2Agreed: {},
  checker2SignedOff: false,
  approved: false,
};
