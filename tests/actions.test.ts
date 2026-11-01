// @vitest-environment node
import { describe, it, expect } from "vitest";
import { emptySession, type Session } from "../src/state/types";
import * as A from "../src/state/actions";
import { mockSession, mockRoundFor, mockSpec, mockNames } from "../src/mocks/mockSession";
import { reviewItems, openCount, dismissalsOf, previousLines } from "../src/state/roundLogic";

const NOW = "2026-11-03T09:00:00.000Z";
const must = (r: A.Result): Session => {
  expect(r.error, r.error).toBeUndefined();
  return r.session;
};
function markAll(s: Session, d: "real_error" | "not_error", reason?: string): Session {
  const r = s.rounds[s.current - 1]!;
  let x = s;
  for (const i of reviewItems(r)) if (i.needsDecision) x = must(A.decide(x, i.code, d, reason));
  return x;
}
const upload = (s: Session, note = "") => must(A.addRound(s, { ...mockRoundFor(s.current, s.rounds[s.current - 2]), designerNote: note }));

describe("the demo story (check results mocked, flow real)", () => {
  it("runs from New request to Approved", () => {
    expect(A.createRequest(emptySession, NOW).error).toMatch(/spec Excel first/);
    let s = must(A.setPendingSpec(emptySession, mockSpec));
    expect(s.pendingSpec!.fields).toHaveLength(19);
    expect(s.request).toBeNull();
    s = must(A.createRequest(s, NOW));
    expect(s.step).toBe("upload_proof");
    expect(s.request!.workId).toBe("WRK-0142");
    expect(s.pendingSpec).toBeNull();

    // Round 1
    expect(previousLines(s.rounds, s.current)).toEqual([]);
    s = upload(s);
    expect(s.step).toBe("review");
    expect(s.rounds[0]!.findings).toHaveLength(6);
    expect(A.finishReview(s, NOW).error).toMatch(/6 items still need a decision/);
    s = markAll(s, "real_error");
    s = must(A.finishReview(s, NOW));
    expect(s.step).toBe("send_back");
    expect(s.rounds[0]!.sendBack).toHaveLength(6);
    expect(s.rounds[0]!.finishedAt).toBe(NOW);
    s = must(A.sendToDesigner(s));
    expect(s.step).toBe("upload_proof");
    expect(s.current).toBe(2);
    expect(previousLines(s.rounds, s.current)).toHaveLength(6);

    // Round 2: F1 (allergen), F2 (preparation) and U2 need a decision; the old allergen line and U1 follow them
    s = upload(s, "Swapped the side panels.");
    expect(s.rounds[1]!.designerNote).toBe("Swapped the side panels.");
    const items = reviewItems(s.rounds[1]!);
    expect(items.filter((i) => i.needsDecision).map((i) => i.code)).toEqual(["F1", "F2", "U2"]);
    expect(items.find((i) => i.kind === "line")!.linkedTo).toBe("F1");
    expect(items.find((i) => i.code === "U1")!.linkedTo).toBe("F2");
    s = markAll(s, "real_error");
    s = must(A.finishReview(s, NOW));
    expect(s.rounds[1]!.sendBack).toHaveLength(3); // one line per problem
    s = must(A.sendToDesigner(s));

    // Round 3: clean, straight to Checker 2
    s = upload(s);
    expect(openCount(s.rounds[2]!)).toBe(0);
    s = must(A.finishReview(s, NOW));
    expect(s.step).toBe("checker2");
    s = must(A.checker2SignOff(s, NOW));
    expect(s.step).toBe("lead");
    s = must(A.approve(s, NOW));
    expect(s).toMatchObject({ approved: true, step: "approved", approvedAt: NOW, checker2SignedAt: NOW });
  });
});

describe("guards", () => {
  it("file checks", () => {
    expect(A.checkSpecFile(null)).toMatch(/Choose/);
    expect(A.checkSpecFile({ name: "spec.pdf" })).toMatch(/not a readable .xlsx/);
    expect(A.checkSpecFile({ name: "SPEC.XLSX" })).toBeUndefined();
    expect(A.checkProofFile({ name: "proof.docx" })).toMatch(/not a PDF/);
    expect(A.checkProofFile({ name: "p.pdf" })).toBeUndefined();
    expect(A.addRound(emptySession, mockRoundFor(1)).error).toBeTruthy();
  });
  it("Finish is blocked while anything is open", () => {
    expect(A.finishReview(mockSession("r1_review"), NOW).error).toBeTruthy();
  });
  it("Not an error needs a reason; accepting a U change does not; changing back clears the reason", () => {
    const s = mockSession("r1_review");
    expect(A.decide(s, "F1", "not_error", "  ").error).toMatch(/reason/);
    const d = must(A.decide(s, "F1", "not_error", "Print sample OK"));
    expect(d.rounds[0]!.dismissals.F1).toBe("Print sample OK");
    expect(must(A.decide(d, "F1", "real_error")).rounds[0]!.dismissals.F1).toBeUndefined();
    const u = must(A.decide(mockSession("r2_review"), "U2", "not_error"));
    expect(u.rounds[1]!.dismissals.U2).toBe("Change accepted");
  });
  it("all dismissed: nothing to send back, goes to Checker 2; an empty list cannot be sent", () => {
    let s = markAll(mockSession("r1_review"), "not_error", "Spec outdated");
    s = must(A.finishReview(s, NOW));
    expect(s.rounds[0]!.sendBack).toEqual([]);
    expect(s.step).toBe("checker2");
    expect(A.sendToDesigner(s).error).toMatch(/empty/);
    expect(dismissalsOf(s.rounds)).toHaveLength(6);
  });
  it("send-back lines can be edited, removed and added; Back to review reopens", () => {
    let s = mockSession("r1_sendback");
    const [a, b] = s.rounds[0]!.sendBack;
    s = must(A.editSendBack(s, [{ code: a!.code, text: "Javított sor" }, { code: b!.code, remove: true }]));
    expect(s.rounds[0]!.sendBack).toHaveLength(5);
    expect(s.rounds[0]!.sendBack[0]!.text).toBe("Javított sor");
    s = must(A.addManualLine(s, "Kérjük a logót cserélni."));
    expect(s.rounds[0]!.sendBack.at(-1)).toEqual({ code: "M1", text: "Kérjük a logót cserélni." });
    expect(A.addManualLine(s, "  ").error).toBeTruthy();
    const back = must(A.backToReview(s));
    expect(back.step).toBe("review");
    expect(back.rounds[0]!.finished).toBe(false);
  });
  it("Checker 2 must agree with every dismissal; keys are unique per round", () => {
    const s = mockSession("checker2");
    const d = dismissalsOf(s.rounds);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ key: "2:U2", round: 2, code: "U2", label: "New claim added" });
    expect(d[0]!.reason).toMatch(/Change accepted/);
    expect(A.checker2SignOff(s, NOW).error).toMatch(/Agree with 1 dismissed item/);
    expect(must(A.checker2SignOff(must(A.checker2Agree(s, "2:U2", true)), NOW)).step).toBe("lead");
  });
  it("the lead cannot approve before Checker 2 signed off", () => {
    expect(A.approve({ ...mockSession("lead"), checker2SignedOff: false }, NOW).error).toBeTruthy();
  });
  it("Start over clears everything", () => {
    expect(must(A.startOver())).toEqual(emptySession);
  });
});

describe("mock sessions", () => {
  it("every mock builds and is self-consistent", () => {
    for (const n of mockNames) {
      const s = mockSession(n);
      if (s.step === "review" || s.step === "send_back") expect(s.rounds[s.current - 1], n).toBeTruthy();
    }
  });
  it("round 1 is the real answer: 6 findings, 14 matches, 6 lines, panels known", () => {
    const r = mockSession("r1_sendback").rounds[0]!;
    expect(r.findings).toHaveLength(6);
    expect(r.matches).toBe(14);
    expect(r.sendBack).toHaveLength(6);
    expect(r.findings.every((f) => f.where)).toBe(true);
  });
  it("round 2: 5 lines done, 1 not done, 2 unrequested, preparation linked", () => {
    const r = mockSession("r2_review").rounds[1]!;
    expect(r.lineChecks!.filter((l) => l.verdict === "done")).toHaveLength(5);
    expect(r.lineChecks!.filter((l) => l.verdict === "not_done")).toHaveLength(1);
    expect(r.unrequested!.map((u) => u.linkedTo ?? null)).toEqual(["F2", null]);
    expect(r.diff!.filter((x) => x.type === "moved")).toHaveLength(4);
  });
  it("low resolution makes numbers Could not read, text still compares", () => {
    const r = mockSession("r1_review_lowres").rounds[0]!;
    expect(r.results.find((x) => x.id === "carbs")!).toMatchObject({ verdict: "could_not_read", reason: "low_resolution" });
    expect(r.results.find((x) => x.id === "name")!.verdict).toBe("mismatch");
  });
  it("read failed: every field is a Could-not-read finding", () => {
    const r = mockSession("r1_review_failed").rounds[0]!;
    expect(r.findings).toHaveLength(19);
    expect(r.matches).toBe(0);
  });
  it("round 3 is clean", () => {
    const r = mockSession("r3_review").rounds[2]!;
    expect(r.findings).toEqual([]);
    expect(r.matches).toBe(19);
  });
});

describe("the Definition of Done story (04_RULES_AND_DOD.md, part B)", () => {
  it("gives the numbers the DoD promises", () => {
    let s = must(A.createRequest(must(A.setPendingSpec(emptySession, mockSpec)), NOW));
    s = upload(s);
    s = markAll(s, "real_error");
    s = must(A.finishReview(s, NOW));
    const first = s.rounds[0]!.sendBack[0]!;
    s = must(A.editSendBack(s, [{ code: first.code, text: first.text + " Köszönjük." }]));
    s = must(A.addManualLine(s, "Kérjük a vonalkódot ellenőrizni."));
    s = must(A.editSendBack(s, [{ code: "M1", remove: true }]));
    expect(s.rounds[0]!.sendBack).toHaveLength(6);
    s = must(A.sendToDesigner(s));
    // B6
    s = upload(s, "Swapped the side panels to fit the barcode.");
    const r2 = s.rounds[1]!;
    expect(r2.findings).toHaveLength(2);
    expect(r2.lineChecks!.filter((l) => l.verdict === "done")).toHaveLength(5);
    expect(r2.lineChecks!.filter((l) => l.verdict === "not_done")).toHaveLength(1);
    expect(r2.diff!.filter((d) => d.type === "moved")).toHaveLength(4);
    // B7: 3 undecided = 2 findings, 0 comments, 1 unrequested
    const und = reviewItems(r2).filter((i) => i.needsDecision);
    expect(und.map((i) => i.kind)).toEqual(["finding", "finding", "unrequested"]);
    s = must(A.decide(s, "F1", "real_error"));
    s = must(A.decide(s, "F2", "real_error"));
    s = must(A.decide(s, "U2", "not_error"));
    s = must(A.finishReview(s, NOW));
    expect([...s.rounds[1]!.sendBack.map((l) => l.code)].sort()).toEqual(["F1", "F2"]); // U1 merged into F2
    expect(s.rounds[1]!.sendBack).toHaveLength(2);
    s = must(A.sendToDesigner(s));
    // B8
    s = upload(s);
    expect(s.rounds[2]!.findings).toEqual([]);
    expect(s.rounds[2]!.matches).toBe(19);
    expect(s.rounds[2]!.lineChecks!.every((l) => l.verdict === "done")).toBe(true);
    s = must(A.finishReview(s, NOW));
    expect(s.step).toBe("checker2");
    // B9
    const d = dismissalsOf(s.rounds);
    expect(d.map((x) => [x.code, x.label, x.reason])).toEqual([["U2", "New claim added", "Change accepted"]]);
    expect(A.checker2SignOff(s, NOW).error).toBeTruthy();
    s = must(A.checker2SignOff(must(A.checker2Agree(s, d[0]!.key, true)), NOW));
    s = must(A.approve(s, NOW));
    expect(s.approved).toBe(true);
  });
  it("a hand-typed line comes back as Check by hand and needs a decision", () => {
    let s = mockSession("r1_sendback");
    s = must(A.addManualLine(s, "Kérjük a logót cserélni."));
    s = must(A.sendToDesigner(s));
    s = upload(s);
    const lc = s.rounds[1]!.lineChecks!;
    expect(lc.at(-1)).toMatchObject({ code: "M1", verdict: "check_by_hand" });
    expect(reviewItems(s.rounds[1]!).find((i) => i.code === `C${lc.length}`)!.needsDecision).toBe(true);
  });
});

describe("uploaded files are kept so they can be opened again", () => {
  it("the spec file travels from the pending spec into the request", async () => {
    const { emptySession } = await import("../src/state/types");
    const { setPendingSpec, createRequest } = await import("../src/state/actions");
    const { mockSession } = await import("../src/mocks/mockSession");
    const spec = mockSession("r1_review").request!.spec;
    const a = setPendingSpec(emptySession, spec, { name: "spec.xlsx", url: "blob:x" });
    const b = createRequest(a.session, "2026-11-01T10:00:00Z");
    expect(b.session.request?.specFile).toEqual({ name: "spec.xlsx", url: "blob:x" });
    expect(b.session.pendingSpecFile).toBeNull();
  });
});

describe("finish review anyway", () => {
  it("is blocked while items are open, and with anyway it passes on and remembers what was open", async () => {
    const { mockSession } = await import("../src/mocks/mockSession");
    const { finishReview } = await import("../src/state/actions");
    const s = mockSession("r2_review");
    const blocked = finishReview(s, "2026-11-01T10:00:00Z");
    expect(blocked.error).toMatch(/still need a decision/);
    const forced = finishReview(s, "2026-11-01T10:00:00Z", true);
    expect(forced.error).toBeUndefined();
    const r = forced.session.rounds[forced.session.current - 1];
    expect(r.finished).toBe(true);
    expect(r.skippedOpen?.length).toBeGreaterThan(0);
  });
});

describe("Checker 2 can send back with their own comments", () => {
  it("adds a comment on the 4-eye step, and sending back opens the next round", async () => {
    const { mockSession } = await import("../src/mocks/mockSession");
    const { addManualLine, sendToDesigner } = await import("../src/state/actions");
    const s = mockSession("checker2");
    expect(s.step).toBe("checker2");
    expect(sendToDesigner(s).error).toMatch(/empty/);
    const a = addManualLine(s, "  Please check the sugar claim  ");
    expect(a.error).toBeUndefined();
    const r = a.session.rounds[a.session.current - 1];
    expect(r.sendBack.some((i) => i.text === "Please check the sugar claim")).toBe(true);
    const b = sendToDesigner(a.session);
    expect(b.error).toBeUndefined();
    expect(b.session.step).toBe("upload_proof");
    expect(b.session.current).toBe(a.session.current + 1);
  });
  it("is refused on other steps", async () => {
    const { mockSession } = await import("../src/mocks/mockSession");
    const { addManualLine } = await import("../src/state/actions");
    expect(addManualLine(mockSession("r1_review"), "x").error).toMatch(/send-back list, the 4-eye check or the final approval/);
  });
});

describe("the lead can send back with a reason", () => {
  it("needs a note, adds it as a line, clears the sign-off and starts the next round", async () => {
    const { mockSession } = await import("../src/mocks/mockSession");
    const { leadSendBack, approve } = await import("../src/state/actions");
    const s = mockSession("lead");
    expect(leadSendBack(s, "   ").error).toMatch(/reason/);
    const r = leadSendBack(s, "Allergen line must be bolder");
    expect(r.error).toBeUndefined();
    expect(r.session.step).toBe("upload_proof");
    expect(r.session.current).toBe(s.current + 1);
    expect(r.session.checker2SignedOff).toBe(false);
    expect(r.session.rounds[s.current - 1].sendBack.some((i) => i.text === "Allergen line must be bolder")).toBe(true);
    expect(approve(r.session, "2026-11-01T10:00:00Z").error).toMatch(/not signed off/);
  });
  it("is refused when it is not the lead's turn", async () => {
    const { mockSession } = await import("../src/mocks/mockSession");
    const { leadSendBack } = await import("../src/state/actions");
    expect(leadSendBack(mockSession("checker2"), "x").error).toMatch(/nothing waiting/);
  });
});
