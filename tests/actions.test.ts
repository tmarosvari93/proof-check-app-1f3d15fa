// @vitest-environment node
import { describe, it, expect } from "vitest";
import { emptySession, type Session } from "../src/state/types";
import * as A from "../src/state/actions";
import { mockSession } from "../src/mocks/mockSession";
import { reviewItems, openCount, dismissalsOf } from "../src/state/roundLogic";

const must = (r: A.Result): Session => {
  expect(r.error, r.error).toBeUndefined();
  return r.session;
};
const xlsx = { name: "spec_SP-2026-0417_v3.xlsx" };
const pdf = (n: string) => ({ name: n });

function markAll(s: Session, d: "real_error" | "not_error", reason?: string): Session {
  const r = s.rounds[s.current - 1]!;
  let x = s;
  for (const i of reviewItems(r)) if (i.needsDecision) x = must(A.decide(x, i.code, d, reason));
  return x;
}

describe("the demo story, step by step (check results are mocked, the flow is real)", () => {
  it("runs from New request to Approved", () => {
    let s = must(A.createRequest(emptySession, xlsx));
    expect(s.step).toBe("upload_proof");
    expect(s.request!.spec.fields).toHaveLength(19);

    // Round 1
    s = must(A.uploadProof(s, pdf("proof_v1.pdf")));
    expect(s.step).toBe("review");
    expect(s.rounds[0]!.findings).toHaveLength(6);
    expect(A.finishReview(s).error).toMatch(/6 items still need a decision/);
    s = markAll(s, "real_error");
    s = must(A.finishReview(s));
    expect(s.step).toBe("send_back");
    expect(s.rounds[0]!.sendBack).toHaveLength(6);
    s = must(A.sendToDesigner(s));
    expect(s.step).toBe("upload_proof");
    expect(s.current).toBe(2);

    // Round 2: spec findings F1 (allergen) and F2 (preparation), the old allergen line and U1 follow them, U2 is new
    s = must(A.uploadProof(s, pdf("proof_v2.pdf")));
    const r2 = s.rounds[1]!;
    const items = reviewItems(r2);
    expect(items.filter((i) => i.needsDecision).map((i) => i.code)).toEqual(["F1", "F2", "U2"]);
    expect(items.find((i) => i.kind === "line")!.linkedTo).toBe("F1"); // the allergen line is still not done
    expect(items.find((i) => i.code === "U1")!.linkedTo).toBe("F2");
    s = markAll(s, "real_error");
    s = must(A.finishReview(s));
    // one line per problem: allergen (once), preparation (once), the new claim
    expect(s.rounds[1]!.sendBack).toHaveLength(3);
    s = must(A.sendToDesigner(s));

    // Round 3: clean, goes straight to Checker 2
    s = must(A.uploadProof(s, pdf("proof_v3.pdf")));
    expect(openCount(s.rounds[2]!)).toBe(0);
    s = must(A.finishReview(s));
    expect(s.step).toBe("checker2");
    s = must(A.checker2SignOff(s));
    expect(s.step).toBe("lead");
    s = must(A.approve(s));
    expect(s.approved).toBe(true);
    expect(s.step).toBe("approved");
  });
});

describe("guards", () => {
  it("a non-xlsx spec and a non-PDF proof are refused", () => {
    expect(A.createRequest(emptySession, { name: "spec.pdf" }).error).toMatch(/not a readable .xlsx/);
    expect(A.createRequest(emptySession, null).error).toBeTruthy();
    const s = mockSession("r2_upload");
    expect(A.uploadProof(s, { name: "proof.docx" }).error).toMatch(/not a PDF/);
    expect(A.uploadProof(emptySession, pdf("a.pdf")).error).toBeTruthy();
  });
  it("Finish is blocked while anything is open", () => {
    expect(A.finishReview(mockSession("r1_review")).error).toBeTruthy();
  });
  it("dismissing needs a reason, and the reason is kept", () => {
    const s = mockSession("r1_review");
    expect(A.decide(s, "F1", "not_error", "  ").error).toMatch(/reason/);
    const d = must(A.decide(s, "F1", "not_error", "Legacy name approved"));
    expect(d.rounds[0]!.dismissals.F1).toBe("Legacy name approved");
    const back = must(A.decide(d, "F1", "real_error"));
    expect(back.rounds[0]!.dismissals.F1).toBeUndefined();
  });
  it("dismissed items are left out of the send-back list; an empty list cannot be sent", () => {
    let s = markAll(mockSession("r1_review"), "not_error", "fine");
    s = must(A.finishReview(s));
    expect(s.rounds[0]!.sendBack).toEqual([]);
    expect(s.step).toBe("checker2");
    expect(A.sendToDesigner(s).error).toMatch(/empty/);
  });
  it("send-back lines can be edited, removed and added", () => {
    let s = mockSession("r1_sendback");
    const first = s.rounds[0]!.sendBack[0]!;
    s = must(A.editSendBack(s, [{ code: first.code, text: "Javított sor" }, { code: s.rounds[0]!.sendBack[1]!.code, remove: true }]));
    expect(s.rounds[0]!.sendBack).toHaveLength(5);
    expect(s.rounds[0]!.sendBack[0]!.text).toBe("Javított sor");
    s = must(A.addManualLine(s, "Kérjük a logót cserélni."));
    expect(s.rounds[0]!.sendBack.at(-1)).toEqual({ code: "M1", text: "Kérjük a logót cserélni." });
    expect(A.addManualLine(s, "  ").error).toBeTruthy();
  });
  it("Checker 2 must agree with every dismissal before signing off", () => {
    const s = mockSession("checker2");
    const d = dismissalsOf(s.rounds);
    expect(d).toEqual([{ round: 2, code: "U2", reason: "Marketing approved this claim by email" }]);
    expect(A.checker2SignOff({ ...s, checker2SignedOff: false }).error).toMatch(/1 dismissal/);
    const agreed = must(A.checker2Agree(s, "U2", true));
    expect(must(A.checker2SignOff(agreed)).step).toBe("lead");
  });
  it("the lead cannot approve before Checker 2 signed off", () => {
    expect(A.approve({ ...mockSession("lead"), checker2SignedOff: false }).error).toBeTruthy();
  });
  it("Start over clears everything", () => {
    expect(must(A.startOver())).toEqual(emptySession);
  });
});
