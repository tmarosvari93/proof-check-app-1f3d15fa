/**
 * Session actions as pure functions: (session, input) gives the next session or an error message.
 * File reading is NOT done here: the provider reads the file (mock now, real in step 3) and passes
 * the result in. Everything here is the real flow logic. Claude owns this file.
 */
import { applyEdits, type Edit } from "../core/sendBack";
import type { ParsedSpec } from "../core/parseSpec";
import { buildRoundSendBack, dismissalsOf, openCount } from "./roundLogic";
import { ACCEPTED_CHANGE, demoRequestFields } from "./demo";
import { emptySession, type Decision, type Round, type Session } from "./types";

export interface Result {
  session: Session;
  /** A message to show the user. When set, the action did not happen. */
  error?: string;
}

export interface FileLike {
  name: string;
}

const ok = (session: Session): Result => ({ session });
const fail = (session: Session, error: string): Result => ({ session, error });
const cur = (s: Session): Round | undefined => s.rounds[s.current - 1];
const withCur = (s: Session, patch: (r: Round) => Round): Session => ({
  ...s,
  rounds: s.rounds.map((r, i) => (i === s.current - 1 ? patch(r) : r)),
});

export function startOver(): Result {
  return ok({ ...emptySession });
}

/** File checks shared by the provider before it reads a file. */
export function checkSpecFile(file: FileLike | null): string | undefined {
  if (!file) return "Choose the spec Excel file first";
  if (!/\.xlsx$/i.test(file.name)) return "This file is not a readable .xlsx workbook";
  return undefined;
}
export function checkProofFile(file: FileLike | null): string | undefined {
  if (!file) return "Choose the proof PDF first";
  if (!/\.pdf$/i.test(file.name)) return "This file is not a PDF";
  return undefined;
}

/** A5: the spec was read; show its fields. The request is not created yet. */
export function setPendingSpec(s: Session, spec: ParsedSpec): Result {
  return ok({ ...s, pendingSpec: spec, step: "new_request" });
}

/** A5: Create request. Needs a spec read first. */
export function createRequest(s: Session, now: string): Result {
  if (!s.pendingSpec) return fail(s, "Upload the spec Excel first");
  return ok({
    ...s,
    request: { ...demoRequestFields, createdAt: now, spec: s.pendingSpec },
    pendingSpec: null,
    rounds: [],
    current: 1,
    step: "upload_proof",
  });
}

/** B2.1: the proof was checked; store the round and open the review. */
export function addRound(s: Session, round: Round): Result {
  if (!s.request) return fail(s, "Create a request first");
  return ok({ ...s, rounds: [...s.rounds.slice(0, s.current - 1), { ...round, no: s.current }], step: "review" });
}

/**
 * The checker's decision on one item. "Not an error" needs a reason (a chip from dismissReasons,
 * optionally with a note). Accepting an unrequested change (U codes) stores "Change accepted".
 */
export function decide(s: Session, code: string, decision: Decision, reason?: string): Result {
  if (!cur(s)) return fail(s, "No round to review");
  let why = (reason ?? "").trim();
  if (decision === "not_error" && !why && code.startsWith("U")) why = ACCEPTED_CHANGE;
  if (decision === "not_error" && !why) return fail(s, "Pick a reason to mark this as not an error");
  return ok(
    withCur(s, (r) => {
      const dismissals = { ...r.dismissals };
      if (decision === "not_error") dismissals[code] = why;
      else delete dismissals[code];
      return { ...r, decisions: { ...r.decisions, [code]: decision }, dismissals };
    }),
  );
}

/** Finish the review. Blocked while anything is open. Rebuilds the send-back list from the decisions. */
export function finishReview(s: Session, now: string): Result {
  const r = cur(s);
  if (!r) return fail(s, "No round to review");
  const open = openCount(r);
  if (open > 0) return fail(s, `${open} item${open === 1 ? "" : "s"} still need a decision`);
  const sendBack = buildRoundSendBack(r);
  const next: Session = withCur(s, (x) => ({ ...x, finished: true, finishedAt: now, sendBack }));
  // Nothing to send back: the proof is clean, so it goes to the second checker.
  return ok({ ...next, step: sendBack.length ? "send_back" : "checker2" });
}

/** Back to review from the send-back list. Finishing again rebuilds the list (edits are lost). */
export function backToReview(s: Session): Result {
  if (!cur(s)) return fail(s, "No round");
  return ok({ ...withCur(s, (r) => ({ ...r, finished: false })), step: "review" });
}

export function editSendBack(s: Session, edits: Edit[]): Result {
  if (!cur(s)) return fail(s, "No round");
  return ok(withCur(s, (r) => ({ ...r, sendBack: applyEdits(r.sendBack, edits) })));
}

/** The checker adds a line of their own (code M1, M2, ...). */
export function addManualLine(s: Session, text: string): Result {
  const r = cur(s);
  if (!r) return fail(s, "No round");
  if (!text.trim()) return fail(s, "Write the line first");
  const n = r.sendBack.filter((i) => i.code.startsWith("M")).length + 1;
  return ok(withCur(s, (x) => ({ ...x, sendBack: [...x.sendBack, { code: `M${n}`, text: text.trim() }] })));
}

/** Send to the designer: the next round's upload page opens. An empty list cannot be sent. */
export function sendToDesigner(s: Session): Result {
  const r = cur(s);
  if (!r) return fail(s, "No round");
  if (r.sendBack.length === 0) return fail(s, "The send-back list is empty");
  return ok({ ...s, current: s.current + 1, step: "upload_proof" });
}

/** key = Dismissal.key, e.g. "2:U2". */
export function checker2Agree(s: Session, key: string, agree: boolean): Result {
  return ok({ ...s, checker2Agreed: { ...s.checker2Agreed, [key]: agree } });
}

export function checker2SignOff(s: Session, now: string): Result {
  if (!s.rounds.length || !s.rounds[s.rounds.length - 1]!.finished) return fail(s, "The review is not finished");
  const missing = dismissalsOf(s.rounds).filter((d) => !s.checker2Agreed[d.key]);
  if (missing.length) return fail(s, `Agree with ${missing.length} dismissed item${missing.length === 1 ? "" : "s"} first`);
  return ok({ ...s, checker2SignedOff: true, checker2SignedAt: now, step: "lead" });
}

export function approve(s: Session, now: string): Result {
  if (!s.checker2SignedOff) return fail(s, "Checker 2 has not signed off");
  return ok({ ...s, approved: true, approvedAt: now, step: "approved" });
}
