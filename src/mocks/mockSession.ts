/**
 * Mock sessions for building the pages before the real logic is wired (step 1B).
 * Round 1 and the spec come from the REAL core code run on the fixtures (real.json, made by
 * scripts/make_mocks.ts). Round 2 and 3 diffs and line checks are written by hand to match
 * answer_key.json. In step 3 Claude replaces these with runCheck and the session store.
 *
 * Use:  const s = mockSession("r1_review");  // returns a full Session shaped like the real store
 */
import real from "./real.json";
import { buildSendBack, type SendBackItem } from "../core/sendBack";
import { compareField, type FieldResult } from "../core/compare";
import { sendable, type CheckFinding } from "../core/findings";
import { buildRoundSendBack, reviewItems } from "../state/roundLogic";
import type { Decision, DiffItem, LineCheck, RequestInfo, Round, Session, UnrequestedItem } from "../state/types";

const spec = real.spec as unknown as RequestInfo["spec"];

export const demoRequest: RequestInfo = {
  workId: "WRK-0417",
  product: "Mezőlak Mangós instant zabkása",
  piece: "Doboz (CS-20931)",
  partner: "Studio Fiktív",
  owner: "Kovács Anna",
  designer: "Nagy Péter",
  dueDate: "2026-11-12",
  spec,
};

type Real = { results: FieldResult[]; findings: CheckFinding[]; matches: number };
const v1 = real.v1 as unknown as Real;
const v2 = real.v2 as unknown as Real;
const v3 = real.v3 as unknown as Real;

const realErrors = (f: CheckFinding[]): CheckFinding[] => f.map((x) => ({ ...x, decision: "real_error" as const }));

function round(no: number, fileName: string, r: Real, extra: Partial<Round> = {}): Round {
  return {
    no, fileName, readMode: "text_layer", seconds: 2.7, results: r.results, findings: r.findings,
    matches: r.matches, sendBack: [], decisions: {}, dismissals: {}, finished: false, ...extra,
  };
}

const sendBack1: SendBackItem[] = buildSendBack(sendable(realErrors(v1.findings))).items;

// ---- Round 2 (v2 against v1): hand-written to match answer_key case_2 ----
const lineChecks2: LineCheck[] = sendBack1.map((it) => ({
  code: it.code,
  text: it.text,
  ...(v1.findings.find((f) => f.code === it.code)?.fieldId ? { fieldId: v1.findings.find((f) => f.code === it.code)!.fieldId } : {}),
  verdict: it.code === "F3" ? "not_done" : "done", // F3 = TELJES TEJPOR emphasis, still not bold in v2
}));

const diff2: DiffItem[] = [
  { id: "X1", type: "modified", before: "Sárgabarackos instant zabkása szárított mangódarabokkal", after: "Mangós instant zabkása szárított mangódarabokkal" },
  { id: "X2", type: "modified", before: "Szénhidrát 46,5 g", after: "Szénhidrát 64,5 g" },
  { id: "X3", type: "modified", before: "Só 0,18 mg", after: "Só 0,18 g" },
  { id: "X4", type: "modified", before: "A csomag 10 adagot tartalmaz.", after: "A csomag 8 adagot tartalmaz." },
  { id: "X5", type: "added", before: null, after: "Nyomokban szóját és diófélét tartalmazhat." },
  { id: "X6", type: "modified", before: "50 g zabkásához adjon 150 ml forró tejet vagy vizet, keverje el, és hagyja állni 2 percig.", after: "50 g zabkásához adjon 200 ml forró tejet vagy vizet, keverje el, és hagyja állni 2 percig." },
  { id: "X7", type: "added", before: null, after: "Hozzáadott cukor nélkül" },
  { id: "X8", type: "moved", before: "Száraz, hűvös helyen, közvetlen napfénytől védve tárolandó. Felbontás után légmentesen zárva tartandó.", after: "(same text, other side panel)" },
  { id: "X9", type: "moved", before: "Minőségét megőrzi: a jelölt mezőben feltüntetett napig.", after: "(same text, other side panel)" },
  { id: "X10", type: "moved", before: "Gyártja: Mezőlak Élelmiszer Kft., 9999 Mintaváros, Malom utca 7.", after: "(same text, other side panel)" },
  { id: "X11", type: "moved", before: "Magyarországon előállítva.", after: "(same text, other side panel)" },
];
const unrequested2: UnrequestedItem[] = [
  { code: "U1", change: diff2[5]!, linkedTo: "F2" }, // preparation 150 -> 200 ml; same problem as spec finding F2, listed once
  { code: "U2", change: diff2[6]! },
];

void realErrors(v2.findings);

const r1 = (over: Partial<Round> = {}) => round(1, "proof_v1.pdf", v1, over);
const r1done = () => {
  const decisions: Record<string, Decision> = {};
  for (const f of v1.findings) decisions[f.code] = "real_error";
  return r1({ finished: true, sendBack: sendBack1, decisions });
};
const r2 = (over: Partial<Round> = {}) =>
  round(2, "proof_v2.pdf", v2, { seconds: 2.9, diff: diff2, lineChecks: lineChecks2, unrequested: unrequested2, ...over });
/** Every item in round 2 marked as a real error, with the real send-back builder. */
const r2done = () => {
  const open = r2();
  const decisions: Record<string, Decision> = {};
  for (const i of reviewItems(open)) decisions[i.code] = "real_error";
  const decided = { ...open, decisions };
  return { ...decided, finished: true, sendBack: buildRoundSendBack(decided) };
};
const r3 = (over: Partial<Round> = {}) =>
  round(3, "proof_v3.pdf", v3, { diff: [], lineChecks: r2done().sendBack.map((it) => ({ code: it.code, text: it.text, verdict: "done" as const })), unrequested: [], ...over });

function base(over: Partial<Session>): Session {
  return { request: demoRequest, rounds: [], current: 1, step: "home", checker2Agreed: {}, checker2SignedOff: false, approved: false, ...over };
}

/** The check result for round n, as the upload step would produce it (mock until step 3). */
export function mockRoundFor(n: number): Round {
  return n <= 1 ? r1() : n === 2 ? r2() : r3();
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
    }));
  return round(1, "proof_v1_flat.pdf", { results, findings, matches: results.filter((r) => r.verdict === "match").length }, {
    readMode: "ai", dpi, seconds: 6.4,
  });
}

export type MockName =
  | "empty" | "new_request" | "r1_review" | "r1_review_flat" | "r1_review_lowres" | "r1_review_failed"
  | "r1_sendback" | "r2_upload" | "r2_review" | "r2_sendback" | "r3_review" | "checker2" | "lead" | "approved";

export function mockSession(name: MockName): Session {
  switch (name) {
    case "empty": return base({ request: null, step: "home" });
    case "new_request": return base({ request: null, step: "new_request" });
    case "r1_review": return base({ rounds: [r1()], step: "review" });
    case "r1_review_flat": return base({ rounds: [{ ...flatRound(150) }], step: "review" });
    case "r1_review_lowres": return base({ rounds: [flatRound(75)], step: "review" });
    case "r1_review_failed":
      return base({
        rounds: [round(1, "proof_v1_flat.pdf", { results: v1.results.map((r) => ({ ...r, verdict: "could_not_read" as const, foundValue: null, occurrences: [], reason: "read_failed" as const })), findings: [], matches: 0 }, { readMode: "failed", seconds: 61 })],
        step: "review",
      });
    case "r1_sendback": return base({ rounds: [r1done()], step: "send_back" });
    case "r2_upload": return base({ rounds: [r1done()], current: 2, step: "upload_proof" });
    case "r2_review": return base({ rounds: [r1done(), r2()], current: 2, step: "review" });
    case "r2_sendback": return base({ rounds: [r1done(), r2done()], current: 2, step: "send_back" });
    case "r3_review": return base({ rounds: [r1done(), r2done(), r3()], current: 3, step: "review" });
    case "checker2":
      return base({
        rounds: [r1done(), { ...r2done(), decisions: { ...r2done().decisions, U2: "not_error" as Decision }, dismissals: { U2: "Marketing approved this claim by email" } }, r3({ finished: true })],
        current: 3, step: "checker2",
      });
    case "lead": return base({ rounds: [r1done(), r2done(), r3({ finished: true })], current: 3, step: "lead", checker2SignedOff: true });
    case "approved": return base({ rounds: [r1done(), r2done(), r3({ finished: true })], current: 3, step: "approved", checker2SignedOff: true, approved: true });
  }
}
