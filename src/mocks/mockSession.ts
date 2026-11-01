/**
 * Mock sessions for building the pages before the real check is wired (step 1B).
 * The spec and round 1 come from the REAL core code run on the fixtures (real.json, made by
 * scripts/make_mocks.ts). Round 2 and 3 diffs and line checks are written by hand to match
 * answer_key.json. "where" (panel) values are hand-set here; step 3 computes them from the
 * box layout. In step 3 the provider stops calling mockSpec / mockRoundFor.
 *
 * Use:  jumpTo("r1_review") from useSession(), or mockSession("r1_review") in tests.
 */
import real from "./real.json";
import { buildSendBack, type SendBackItem } from "../core/sendBack";
import { compareField, type FieldResult } from "../core/compare";
import { sendable, type CheckFinding } from "../core/findings";
import { buildRoundSendBack, reviewItems } from "../state/roundLogic";
import { demoRequestFields, people } from "../state/demo";
import type { Decision, DiffItem, LineCheck, RequestInfo, Round, Session, UnrequestedItem } from "../state/types";

export const mockSpec = real.spec as unknown as RequestInfo["spec"];

const T0 = "2026-10-27T08:30:00.000Z";
export const demoRequest: RequestInfo = { ...demoRequestFields, createdAt: T0, spec: mockSpec };

const WHERE: Record<string, string> = {
  name: "Front and back panel, product name",
  servings: "Back panel, servings",
  ingredients: "Back panel, ingredients",
  may_contain: "Back panel, after ingredients",
  carbs: "Back panel, nutrition table",
  salt: "Back panel, nutrition table",
  preparation: "Side panel, preparation",
};

type Real = { results: FieldResult[]; findings: CheckFinding[]; matches: number };
const withWhere = (r: Real): Real => ({
  ...r,
  findings: r.findings.map((f) => (WHERE[f.fieldId] ? { ...f, where: WHERE[f.fieldId]! } : f)),
});
const v1 = withWhere(real.v1 as unknown as Real);
const v2 = withWhere(real.v2 as unknown as Real);
const v3 = real.v3 as unknown as Real;

function round(no: number, fileName: string, r: Real, extra: Partial<Round> = {}): Round {
  return {
    no, fileName, designerNote: "", readMode: "text_layer", seconds: 2.7, results: r.results, findings: r.findings,
    matches: r.matches, sendBack: [], decisions: {}, dismissals: {}, finished: false, ...extra,
  };
}

function allReal(r: Round): Record<string, Decision> {
  const d: Record<string, Decision> = {};
  for (const i of reviewItems(r)) if (i.needsDecision) d[i.code] = "real_error";
  return d;
}
function finish(r: Round, at: string): Round {
  const decided = { ...r, decisions: allReal(r) };
  return { ...decided, finished: true, finishedAt: at, sendBack: buildRoundSendBack(decided) };
}

// ---- Round 1 ----
const r1 = (over: Partial<Round> = {}) => round(1, "proof_v1.pdf", v1, over);
const r1done = () => finish(r1(), "2026-10-28T09:14:00.000Z");
const sendBack1: SendBackItem[] = buildSendBack(sendable(v1.findings.map((f) => ({ ...f, decision: "real_error" as const })))).items;

// ---- Round 2 (v2 against v1): hand-written to match answer_key case_2 ----
const lineChecks2: LineCheck[] = sendBack1.map((it) => {
  const fieldId = v1.findings.find((f) => f.code === it.code)?.fieldId;
  // the allergen line (TELJES TEJPOR emphasis) is still not done in v2
  return { code: it.code, text: it.text, verdict: fieldId === "ingredients" ? "not_done" : "done", ...(fieldId ? { fieldId } : {}) };
});

const MOVED = "(same text, other side panel)";
const diff2: DiffItem[] = [
  { id: "X1", type: "modified", before: "Sárgabarackos instant zabkása szárított mangódarabokkal", after: "Mangós instant zabkása szárított mangódarabokkal" },
  { id: "X2", type: "modified", before: "Szénhidrát 46,5 g", after: "Szénhidrát 64,5 g" },
  { id: "X3", type: "modified", before: "Só 0,18 mg", after: "Só 0,18 g" },
  { id: "X4", type: "modified", before: "A csomag 10 adagot tartalmaz.", after: "A csomag 8 adagot tartalmaz." },
  { id: "X5", type: "added", before: null, after: "Nyomokban szóját és diófélét tartalmazhat." },
  { id: "X6", type: "modified", before: "50 g zabkásához adjon 150 ml forró tejet vagy vizet, keverje el, és hagyja állni 2 percig.", after: "50 g zabkásához adjon 200 ml forró tejet vagy vizet, keverje el, és hagyja állni 2 percig." },
  { id: "X7", type: "added", before: null, after: "Hozzáadott cukor nélkül" },
  { id: "X8", type: "moved", before: "Száraz, hűvös helyen, közvetlen napfénytől védve tárolandó. Felbontás után légmentesen zárva tartandó.", after: MOVED },
  { id: "X9", type: "moved", before: "Minőségét megőrzi: a jelölt mezőben feltüntetett napig.", after: MOVED },
  { id: "X10", type: "moved", before: "Gyártja: Mezőlak Élelmiszer Kft., 9999 Mintaváros, Malom utca 7.", after: MOVED },
  { id: "X11", type: "moved", before: "Magyarországon előállítva.", after: MOVED },
];
const unrequested2: UnrequestedItem[] = [
  // preparation 150 -> 200 ml: the same problem as spec finding F2 in round 2, so it is listed once
  { code: "U1", change: diff2[5]!, what: "Preparation text changed", where: "Side panel", linkedTo: "F2" },
  { code: "U2", change: diff2[6]!, what: "New claim added", where: "Front panel" },
];
const NOTE2 = "Swapped the side panels to fit the barcode.";
const r2 = (over: Partial<Round> = {}) =>
  round(2, "proof_v2.pdf", v2, { seconds: 2.9, designerNote: NOTE2, diff: diff2, lineChecks: lineChecks2, unrequested: unrequested2, ...over });
const r2done = () => finish(r2(), "2026-10-31T10:05:00.000Z");

// ---- Round 3: clean ----
const r3 = (over: Partial<Round> = {}) =>
  round(3, "proof_v3.pdf", v3, {
    designerNote: "All requested changes made.",
    diff: [],
    lineChecks: r2done().sendBack.map((it) => ({ code: it.code, text: it.text, verdict: "done" as const })),
    unrequested: [],
    ...over,
  });
const r3done = () => finish(r3(), "2026-11-03T09:14:00.000Z");

/**
 * Re-check the lines that were actually sent last round, like recheckSendBack will in step 3:
 * a line from a spec finding is Done unless that field is still wrong in this round's proof
 * (in the demo: the allergen emphasis stays wrong in v2); a line typed by hand is Check by hand;
 * earlier-comment and unrequested-change lines are Done (v3 reverts the unrequested changes).
 */
function recheckMock(prev: Round, now: Real): LineCheck[] {
  return prev.sendBack.map((it) => {
    const fieldId = prev.findings.find((f) => f.code === it.code)?.fieldId;
    if (it.code.startsWith("M")) return { code: it.code, text: it.text, verdict: "check_by_hand" as const };
    const stillWrong = !!fieldId && now.findings.some((f) => f.fieldId === fieldId);
    return { code: it.code, text: it.text, verdict: stillWrong ? ("not_done" as const) : ("done" as const), ...(fieldId ? { fieldId } : {}) };
  });
}

/**
 * The check result for round n, as the upload step produces it (mock until step 3).
 * Pass the previous round so the earlier lines are the ones actually sent.
 */
export function mockRoundFor(n: number, prev?: Round): Round {
  if (n <= 1) return r1();
  const r = n === 2 ? r2() : r3();
  if (!prev) return r;
  const lineChecks = recheckMock(prev, n === 2 ? v2 : v3);
  return { ...r, lineChecks };
}

/** Flat proof read by AI at the given dpi. Below 100 dpi, fields with a digit are Could not read. */
function flatRound(dpi: number): Round {
  const results = v1.results.map((r) =>
    compareField({ id: r.id, label: r.label, value: r.specValue }, r.occurrences.map((o) => o.occurrence), { dpi }),
  );
  const findings = results
    .filter((r) => r.verdict !== "match" || r.allergen?.status === "not_emphasised")
    .map((r, i): CheckFinding => ({
      code: `F${i + 1}`, decision: "open", fieldId: r.id, label: r.label, specValue: r.specValue, foundValue: r.foundValue,
      kind: r.verdict === "mismatch" ? "spec_mismatch" : r.verdict === "missing" ? "spec_missing" : r.verdict === "could_not_read" ? "could_not_read" : "allergen_not_emphasised",
      ...(r.allergen?.words?.length ? { words: r.allergen.words } : {}),
      ...(WHERE[r.id] ? { where: WHERE[r.id]! } : {}),
    }));
  return round(1, "proof_v1_flat.pdf", { results, findings, matches: results.filter((r) => r.verdict === "match").length }, {
    readMode: "ai", dpi, seconds: 6.4,
  });
}

function base(over: Partial<Session>): Session {
  const s: Session = {
    pendingSpec: null, request: demoRequest, rounds: [], current: 1, step: "home",
    checker2Agreed: {}, checker2SignedOff: false, approved: false, ...over,
  };
  // A proof in review has been claimed (otherwise the review page sends you to Unclaimed first).
  return s.step === "review" ? { ...s, claim: { round: s.current, by: people.checker1, at: T0 } } : s;
}

export type MockName =
  | "empty" | "new_request" | "new_request_spec_read" | "r1_upload" | "r1_unclaimed" | "r1_review" | "r1_review_flat" | "r1_review_lowres"
  | "r1_review_failed" | "r1_sendback" | "r2_upload" | "r2_review" | "r2_sendback" | "r3_review" | "checker2" | "lead" | "approved";

export const mockNames: MockName[] = [
  "empty", "new_request", "new_request_spec_read", "r1_upload", "r1_unclaimed", "r1_review", "r1_review_flat", "r1_review_lowres",
  "r1_review_failed", "r1_sendback", "r2_upload", "r2_review", "r2_sendback", "r3_review", "checker2", "lead", "approved",
];

export function mockSession(name: MockName): Session {
  switch (name) {
    case "empty": return base({ request: null, step: "home" });
    case "new_request": return base({ request: null, step: "new_request" });
    case "new_request_spec_read": return base({ request: null, pendingSpec: mockSpec, step: "new_request" });
    case "r1_upload": return base({ step: "upload_proof" });
    case "r1_unclaimed": {
      // Uploaded, nobody has claimed it yet: it shows in Unclaimed.
      const { claim: _claim, ...unclaimed } = base({ rounds: [r1()], step: "review" });
      void _claim;
      return unclaimed;
    }
    case "r1_review": return base({ rounds: [r1()], step: "review" });
    case "r1_review_flat": return base({ rounds: [flatRound(150)], step: "review" });
    case "r1_review_lowres": return base({ rounds: [flatRound(75)], step: "review" });
    case "r1_review_failed":
      return base({
        rounds: [round(1, "proof_v1_flat.pdf", {
          results: v1.results.map((r) => ({ ...r, verdict: "could_not_read" as const, foundValue: null, diff: [], occurrences: [], reason: "read_failed" as const })),
          findings: v1.results.map((r, i): CheckFinding => ({ code: `F${i + 1}`, decision: "open", kind: "could_not_read", fieldId: r.id, label: r.label, specValue: r.specValue, foundValue: null })),
          matches: 0,
        }, { readMode: "failed", seconds: 61 })],
        step: "review",
      });
    case "r1_sendback": return base({ rounds: [r1done()], step: "send_back" });
    case "r2_upload": return base({ rounds: [r1done()], current: 2, step: "upload_proof" });
    case "r2_review": return base({ rounds: [r1done(), r2()], current: 2, step: "review" });
    case "r2_sendback": return base({ rounds: [r1done(), r2done()], current: 2, step: "send_back" });
    case "r3_review": return base({ rounds: [r1done(), r2done(), r3()], current: 3, step: "review" });
    case "checker2": {
      const r2x = r2done();
      // one dismissal for Checker 2 to look at: the new claim was accepted
      const r2d = { ...r2x, decisions: { ...r2x.decisions, U2: "not_error" as Decision }, dismissals: { U2: "Change accepted: marketing approved the claim by email" } };
      return base({ rounds: [r1done(), { ...r2d, sendBack: buildRoundSendBack(r2d) }, r3done()], current: 3, step: "checker2" });
    }
    case "lead":
      return base({ rounds: [r1done(), r2done(), r3done()], current: 3, step: "lead", checker2SignedOff: true, checker2SignedAt: "2026-11-03T09:41:00.000Z" });
    case "approved":
      return base({
        rounds: [r1done(), r2done(), r3done()], current: 3, step: "approved",
        checker2SignedOff: true, checker2SignedAt: "2026-11-03T09:41:00.000Z", approved: true, approvedAt: "2026-11-03T10:02:00.000Z",
      });
  }
}
