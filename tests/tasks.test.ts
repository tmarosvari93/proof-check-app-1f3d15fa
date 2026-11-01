// @vitest-environment node
// Unclaimed, My tasks, the menus and the claim, on the prepared states and on the real actions.
import { describe, it, expect } from "vitest";
import { emptySession, type Role, type Session } from "../src/state/types";
import * as A from "../src/state/actions";
import { mockSession } from "../src/mocks/mockSession";
import { isClaimed, landingOf, menuOf, notForYouText, ownerOf, roleOfPath, tasksOf, unclaimedOf, canClaim } from "../src/state/tasks";
import { claimerName, roleLabel, roleOrder, trackAllSample } from "../src/state/demo";

const NOW = "2026-11-03T09:00:00.000Z";
const must = (r: A.Result): Session => {
  expect(r.error, r.error).toBeUndefined();
  return r.session;
};
// A proof just uploaded: the prepared review state, but not claimed yet.
const uploaded = (): Session => {
  const { claim: _c, ...s } = mockSession("r1_review");
  void _c;
  return s;
};
const actionableRoles = (s: Session): Role[] => roleOrder.filter((r) => tasksOf(s, r).some((t) => t.actionable));

describe("create request", () => {
  it("keeps the requester's comments for the designer, or the demo note when none are given", () => {
    const withSpec = must(A.setPendingSpec(emptySession, mockSession("new_request_spec_read").pendingSpec!));
    expect(must(A.createRequest(withSpec, NOW)).request!.notes).toMatch(/apricot variant/);
    expect(must(A.createRequest(withSpec, NOW, "  Please check the flavour.  ")).request!.notes).toBe("Please check the flavour.");
    expect(must(A.createRequest(withSpec, NOW, "")).request!.notes).toBe("");
  });
});

describe("claim", () => {
  it("an uploaded proof is unclaimed and listed once; claiming moves it to Checker 1's tasks", () => {
    let s = uploaded();
    expect(isClaimed(s)).toBe(false);
    expect(unclaimedOf(s)).toHaveLength(1);
    expect(unclaimedOf(s)[0]).toMatchObject({ workId: "WRK-0142", round: 1, to: "/unclaimed" });
    expect(tasksOf(s, "checker1")).toEqual([]);
    s = must(A.claimProof(s, claimerName, NOW));
    expect(isClaimed(s)).toBe(true);
    expect(s.claim).toEqual({ round: 1, by: claimerName, at: NOW });
    expect(unclaimedOf(s)).toEqual([]);
    expect(tasksOf(s, "checker1")).toMatchObject([{ title: "Review, round 1", to: "/review", actionable: true }]);
  });
  it("cannot be claimed twice, or when no proof is waiting", () => {
    const s = must(A.claimProof(uploaded(), claimerName, NOW));
    expect(A.claimProof(s, "Someone else", NOW).error).toMatch(/Already claimed by/);
    expect(A.claimProof(emptySession, claimerName, NOW).error).toMatch(/no proof waiting/);
    expect(A.claimProof(mockSession("r1_upload"), claimerName, NOW).error).toMatch(/no proof waiting/);
  });
  it("a new round is unclaimed again", () => {
    let s = mockSession("r1_review"); // claimed
    const r = s.rounds[0]!;
    // checker 1 marks everything real, finishes, sends to the designer; the designer uploads round 2
    for (const i of ["F1", "F2", "F3", "F4", "F5", "F6"]) s = must(A.decide(s, i, "real_error"));
    expect(r.findings).toHaveLength(6);
    s = must(A.finishReview(s, NOW));
    s = must(A.sendToDesigner(s));
    s = must(A.addRound(s, { ...mockSession("r2_review").rounds[1]! }));
    expect(s.step).toBe("review");
    expect(s.current).toBe(2);
    expect(isClaimed(s)).toBe(false);
    expect(unclaimedOf(s)).toHaveLength(1);
  });
  it("only Checker 1 can claim", () => {
    expect(roleOrder.filter(canClaim)).toEqual(["checker1"]);
  });
  it("start over clears the claim", () => {
    expect(must(A.startOver()).claim).toBeUndefined();
  });
});

describe("who acts when", () => {
  const cases: [string, Session, Role | null][] = [
    ["upload_proof", mockSession("r1_upload"), "designer"],
    ["unclaimed", uploaded(), null],
    ["review", mockSession("r1_review"), "checker1"],
    ["send_back", mockSession("r1_sendback"), "checker1"],
    ["checker2", mockSession("checker2"), "checker2"],
    ["lead", mockSession("lead"), "lead"],
    ["approved", mockSession("approved"), null],
  ];
  it.each(cases)("%s", (_n, s, owner) => {
    expect(ownerOf(s).role).toBe(owner);
    // exactly the owner has an actionable task, nobody else
    expect(actionableRoles(s)).toEqual(owner ? [owner] : []);
  });
  it("the requester always sees the request, with its status, and nothing to open while others are working", () => {
    const rows = tasksOf(mockSession("r2_upload"), "requester");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actionable: false, to: null, status: "Waiting for the designer to upload round 2" });
    expect(tasksOf(emptySession, "requester")).toEqual([]);
    expect(tasksOf(mockSession("approved"), "requester")[0]!.status).toBe("Approved");
  });
  it("nobody has a task before a request exists", () => {
    for (const r of roleOrder) expect(tasksOf(mockSession("new_request"), r)).toEqual([]);
  });
  it("says what is going on for a page that is not for you", () => {
    expect(notForYouText(mockSession("r1_upload"))).toBe("Nothing for you right now. Waiting for the designer to upload round 1.");
  });
});

describe("menus and landing", () => {
  it("every role has Home, My tasks and Track all work; both checkers and the lead have Unclaimed; only the requester has New request", () => {
    for (const r of roleOrder) {
      const labels = menuOf(r).map((m) => m.label);
      expect(labels).toEqual(expect.arrayContaining(["Home", "My tasks", "Track all work"]));
      expect(labels.includes("Unclaimed")).toBe(r === "checker1" || r === "checker2" || r === "lead");
      expect(labels.includes("+ New request")).toBe(r === "requester");
    }
  });
  it("a role lands on its task, on Unclaimed for Checker 1 when something waits, else on My tasks", () => {
    expect(landingOf(mockSession("r1_upload"), "designer")).toBe("/upload");
    expect(landingOf(mockSession("r1_upload"), "checker1")).toBe("/my-tasks");
    expect(landingOf(uploaded(), "checker1")).toBe("/unclaimed");
    expect(landingOf(mockSession("r1_review"), "checker1")).toBe("/review");
    expect(landingOf(mockSession("checker2"), "checker2")).toBe("/checker-2");
    expect(landingOf(mockSession("lead"), "lead")).toBe("/lead");
    expect(landingOf(mockSession("r1_review"), "lead")).toBe("/my-tasks");
    expect(landingOf(emptySession, "requester")).toBe("/");
    expect(landingOf(mockSession("new_request"), "requester")).toBe("/new");
  });
  it("flow pages switch the role, shared pages keep it", () => {
    expect(roleOfPath("/upload")).toBe("designer");
    expect(roleOfPath("/review")).toBe("checker1");
    expect(roleOfPath("/send-back")).toBe("checker1");
    expect(roleOfPath("/checker-2")).toBe("checker2");
    expect(roleOfPath("/lead")).toBe("lead");
    for (const p of ["/", "/my-tasks", "/unclaimed", "/track-all"]) expect(roleOfPath(p)).toBeUndefined();
  });
  it("the role labels are the 'Working as' texts", () => {
    expect(roleLabel.checker1).toBe("Checker 1 (Anna K.)");
    expect(roleLabel.designer).toBe("Designer, external (Studio Fiktív)");
  });
});

describe("Track all work sample", () => {
  it("has 8 fictional rows, a work ID each, and open rows have no approval date", () => {
    expect(trackAllSample).toHaveLength(8);
    expect(new Set(trackAllSample.map((r) => r.workId)).size).toBe(8);
    for (const r of trackAllSample) {
      expect(r.rounds).toBeGreaterThanOrEqual(1);
      expect(r.workId).not.toBe("WRK-0142"); // the live demo request is not in the sample
      if (r.approved) expect(r.approved >= r.received).toBe(true);
    }
  });
});
