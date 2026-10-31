/**
 * The session store shape. This is the contract between the pages (Lovable) and the logic (Claude).
 * Pages read these types; they never compute verdicts. Nothing here is saved: it lives in memory.
 * Claude owns this file. Lovable must not edit it.
 */
import type { ParsedSpec } from "../core/parseSpec";
import type { FieldResult } from "../core/compare";
import type { CheckFinding } from "../core/findings";
import type { SendBackItem } from "../core/sendBack";

export type { ParsedSpec, FieldResult, CheckFinding, SendBackItem };

/** How the proof was read. Drives the banner on the review screens. */
export type ReadMode = "text_layer" | "ai" | "failed";

export interface RequestInfo {
  workId: string; // fixed demo value, e.g. "WRK-0417"
  product: string; // fixed dropdown value
  piece: string; // "Doboz" (box)
  partner: string;
  owner: string; // project owner
  designer: string;
  dueDate: string; // ISO date
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
  /** Code of a spec finding about the same problem, e.g. "F5". Then it is listed once. */
  linkedTo?: string;
}

export type Decision = CheckFinding["decision"];

export interface Round {
  no: number; // 1, 2, 3
  fileName: string;
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
  request: RequestInfo | null;
  rounds: Round[];
  /** The round being worked on, 1-based. */
  current: number;
  step: Step;
  checker2Agreed: Record<string, boolean>; // by finding code
  checker2SignedOff: boolean;
  approved: boolean;
}

export const emptySession: Session = {
  request: null,
  rounds: [],
  current: 1,
  step: "home",
  checker2Agreed: {},
  checker2SignedOff: false,
  approved: false,
};
