/**
 * Session actions as pure functions: (session, input) gives the next session or an error message.
 * The check itself is a MOCK for now (mockRoundFor); step 3 swaps it for runCheck. Everything else
 * (decisions, finish gate, send-back list, sign-offs) is the real logic. Claude owns this file.
 */
import { applyEdits, type Edit } from "../core/sendBack";
import { demoRequest, mockRoundFor } from "../mocks/mockSession";
import { buildRoundSendBack, decisionOf, dismissalsOf, openCount } from "./roundLogic";
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

/** A5 New request. Mock: any .xlsx gives the demo spec. Step 3: parseSpecWorkbook(file). */
export function createRequest(s: Session, file: FileLike | null): Result {
  if (!file) return fail(s, "Choose the spec Excel file first");
  if (!/\.xlsx$/i.test(file.name)) return fail(s, "This file is not a readable .xlsx workbook");
  return ok({ ...s, request: demoRequest, rounds: [], current: 1, step: "upload_proof" });
}

/** B2.1 Upload proof. Mock: any .pdf gives the demo round for the current round number. */
export function uploadProof(s: Session, file: FileLike | null): Result {
  if (!s.request) return fail(s, "Create a request first");
  if (!file) return fail(s, "Choose the proof PDF first");
  if (!/\.pdf$/i.test(file.name)) return fail(s, "This file is not a PDF");
  const round = mockRoundFor(s.current);
  return ok({ ...s, rounds: [...s.rounds.slice(0, s.current - 1), round], step: "review" });
}

/** The checker's decision on one item. Dismissing needs a reason. */
export function decide(s: Session, code: string, decision: Decision, reason?: string): Result {
  if (!cur(s)) return fail(s, "No round to review");
  if (decision === "not_error" && !(reason ?? "").trim()) return fail(s, "Write a reason to dismiss this item");
  return ok(
    withCur(s, (r) => {
      const dismissals = { ...r.dismissals };
      if (decision === "not_error") dismissals[code] = reason!.trim();
      else delete dismissals[code];
      return { ...r, decisions: { ...r.decisions, [code]: decision }, dismissals };
    }),
  );
}

/** Finish the review. Blocked while anything is open. */
export function finishReview(s: Session): Result {
  const r = cur(s);
  if (!r) return fail(s, "No round to review");
  const open = openCount(r);
  if (open > 0) return fail(s, `${open} item${open === 1 ? "" : "s"} still need a decision`);
  const sendBack = buildRoundSendBack(r);
  const next: Session = withCur(s, (x) => ({ ...x, finished: true, sendBack }));
  // Nothing to send back: the proof is clean, so it goes to the second checker.
  return ok({ ...next, step: sendBack.length ? "send_back" : "checker2" });
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

export function checker2Agree(s: Session, code: string, agree: boolean): Result {
  return ok({ ...s, checker2Agreed: { ...s.checker2Agreed, [code]: agree } });
}

export function checker2SignOff(s: Session): Result {
  const missing = dismissalsOf(s.rounds).filter((d) => !s.checker2Agreed[d.code]);
  if (missing.length) return fail(s, `Agree or discuss ${missing.length} dismissal${missing.length === 1 ? "" : "s"} first`);
  return ok({ ...s, checker2SignedOff: true, step: "lead" });
}

export function approve(s: Session): Result {
  if (!s.checker2SignedOff) return fail(s, "Checker 2 has not signed off");
  return ok({ ...s, approved: true, step: "approved" });
}

export { decisionOf };
