import { describe, it, expect } from "vitest";
import {
  transition, availableEvents, unclaimedTag, newRound,
  type Actor, type Round, type RoundEvent,
} from "../src/core/stateMachine";

const requester: Actor = { id: "u-req", role: "requester" };
const designer: Actor = { id: "u-des", role: "designer_external" };
const anna: Actor = { id: "u-anna", role: "checker" };
const peter: Actor = { id: "u-peter", role: "checker" };
const eszter: Actor = { id: "u-eszter", role: "checker" };
const lead: Actor = { id: "u-lead", role: "lead" };
const system: Actor = { id: "system", role: "system" };

/** Apply an event and require success. */
function go(round: Round, event: RoundEvent, actor: Actor): Round {
  const r = transition(round, event, actor);
  if (!r.ok) throw new Error(`expected ok, got: ${r.reason}`);
  return r.round;
}
function fails(round: Round, event: RoundEvent, actor: Actor): string {
  const r = transition(round, event, actor);
  if (r.ok) throw new Error("expected failure");
  return r.reason;
}

const clean = { type: "finishReview", openFindings: 0, needsDiscussion: 0, realErrors: 0 } as const;
const withErrors = { type: "finishReview", openFindings: 0, needsDiscussion: 0, realErrors: 2 } as const;

function toAwaitingReview(): Round {
  let r = newRound("WRK-1", requester.id, designer.id);
  r = go(r, { type: "uploadProof" }, designer);
  r = go(r, { type: "pipelineDone" }, system);
  return r;
}

describe("happy path", () => {
  it("runs a clean round from request to approval", () => {
    let r = toAwaitingReview();
    expect(r.status).toBe("awaiting_review");
    expect(unclaimedTag(r)).toBe("REVIEW");

    r = go(r, { type: "claim" }, anna);
    expect(r.status).toBe("in_review");
    expect(r.checker1Id).toBe(anna.id);
    expect(unclaimedTag(r)).toBeNull();

    r = go(r, clean, anna);
    expect(r.status).toBe("awaiting_second_check");
    expect(unclaimedTag(r)).toBe("FOUR_EYE_CHECK");

    r = go(r, { type: "claim" }, peter);
    expect(r.status).toBe("in_second_check");
    expect(r.checker2Id).toBe(peter.id);

    r = go(r, { type: "secondCheckSignOff", disagreements: 0 }, peter);
    expect(r.status).toBe("awaiting_approval");

    r = go(r, { type: "approve" }, lead);
    expect(r.status).toBe("approved");
  });
});

describe("send back", () => {
  it("Checker 1 sends back on a confirmed real error, round returns to the pool state", () => {
    let r = go(toAwaitingReview(), { type: "claim" }, anna);
    r = go(r, withErrors, anna);
    expect(r.status).toBe("sent_back");
    expect(r.claimedBy).toBeNull();
  });

  it("designer's next upload starts round 2 in Unclaimed with the previous checker as hint", () => {
    let r = go(toAwaitingReview(), { type: "claim" }, anna);
    r = go(r, withErrors, anna);
    const res = transition(r, { type: "uploadProof" }, designer);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.newRound) throw new Error("no new round");
    expect(res.round.status).toBe("sent_back"); // old round stays as history
    expect(res.newRound.roundNo).toBe(2);
    expect(res.newRound.status).toBe("checking");
    expect(res.newRound.hintCheckerId).toBe(anna.id);
    expect(res.newRound.previousRoundId).toBe(r.id);
    expect(res.newRound.checker1Id).toBeNull();
    const pooled = go(res.newRound, { type: "pipelineDone" }, system);
    expect(unclaimedTag(pooled)).toBe("REVIEW");
  });

  it("Checker 2 can send back by disagreeing", () => {
    let r = go(toAwaitingReview(), { type: "claim" }, anna);
    r = go(r, clean, anna);
    r = go(r, { type: "claim" }, peter);
    r = go(r, { type: "secondCheckDisagree" }, peter);
    expect(r.status).toBe("sent_back");
  });

  it("the lead can send back from final approval, but only with a reason", () => {
    let r = go(toAwaitingReview(), { type: "claim" }, anna);
    r = go(r, clean, anna);
    r = go(r, { type: "claim" }, peter);
    r = go(r, { type: "secondCheckSignOff", disagreements: 0 }, peter);
    expect(fails(r, { type: "leadSendBack", reason: "   " }, lead)).toMatch(/reason/i);
    r = go(r, { type: "leadSendBack", reason: "Claim wording not allowed" }, lead);
    expect(r.status).toBe("sent_back");
    expect(r.lastReason).toBe("Claim wording not allowed");
  });
});

describe("claiming", () => {
  it("a second checker cannot claim a round that is already claimed (race)", () => {
    const r0 = toAwaitingReview();
    const r1 = go(r0, { type: "claim" }, anna);
    // Peter acts on a stale copy of the round: the database guard (claimed_by is null) must refuse it too.
    // Here the status has moved on, so the pure function refuses.
    expect(fails(r1, { type: "claim" }, peter)).toMatch(/Not allowed/);
    // Even with the status forced back, claimedBy blocks it.
    const stale: Round = { ...r1, status: "awaiting_review" };
    expect(fails(stale, { type: "claim" }, peter)).toMatch(/Already claimed/);
  });

  it("Checker 2 must differ from Checker 1 in the same round", () => {
    let r = go(toAwaitingReview(), { type: "claim" }, anna);
    r = go(r, clean, anna);
    expect(fails(r, { type: "claim" }, anna)).toMatch(/different person/);
    expect(availableEvents(r, anna)).not.toContain("claim");
    expect(availableEvents(r, peter)).toContain("claim");
  });

  it("the same person may be Checker 1 again in a later round", () => {
    let r = go(toAwaitingReview(), { type: "claim" }, anna);
    r = go(r, withErrors, anna);
    const res = transition(r, { type: "uploadProof" }, designer);
    if (!res.ok || !res.newRound) throw new Error("no new round");
    const pooled = go(res.newRound, { type: "pipelineDone" }, system);
    expect(go(pooled, { type: "claim" }, anna).checker1Id).toBe(anna.id);
  });

  it("only checkers can claim", () => {
    const r = toAwaitingReview();
    expect(fails(r, { type: "claim" }, lead)).toMatch(/Only a checker/);
    expect(fails(r, { type: "claim" }, designer)).toMatch(/Only a checker/);
  });
});

describe("finishing the review", () => {
  const inReview = () => go(toAwaitingReview(), { type: "claim" }, anna);

  it("is blocked while any finding is undecided", () => {
    const reason = fails(inReview(), { type: "finishReview", openFindings: 2, needsDiscussion: 0, realErrors: 0 }, anna);
    expect(reason).toMatch(/undecided/);
  });

  it("is blocked while items wait for the lead", () => {
    const reason = fails(inReview(), { type: "finishReview", openFindings: 0, needsDiscussion: 1, realErrors: 0 }, anna);
    expect(reason).toMatch(/Needs discussion/);
  });

  it("only Checker 1 of the round can finish it", () => {
    expect(fails(inReview(), clean, peter)).toMatch(/Only Checker 1/);
  });

  it("Needs discussion goes to the lead and returns to Checker 1", () => {
    let r = inReview();
    r = go(r, { type: "markNeedsDiscussion" }, anna);
    expect(r.status).toBe("needs_discussion");
    expect(fails(r, { type: "resolveDiscussion" }, anna)).toMatch(/Only the lead/);
    r = go(r, { type: "resolveDiscussion" }, lead);
    expect(r.status).toBe("in_review");
    expect(r.checker1Id).toBe(anna.id);
  });
});

describe("second check and approval", () => {
  function inSecond() {
    let r = go(toAwaitingReview(), { type: "claim" }, anna);
    r = go(r, clean, anna);
    return go(r, { type: "claim" }, peter);
  }

  it("sign-off is refused if Checker 2 disagreed with anything", () => {
    expect(fails(inSecond(), { type: "secondCheckSignOff", disagreements: 1 }, peter)).toMatch(/disagreed/);
  });

  it("only Checker 2 of the round can sign off or disagree", () => {
    expect(fails(inSecond(), { type: "secondCheckSignOff", disagreements: 0 }, eszter)).toMatch(/Only Checker 2/);
    expect(fails(inSecond(), { type: "secondCheckDisagree" }, anna)).toMatch(/Only Checker 2/);
  });

  it("only the lead can approve", () => {
    let r = go(inSecond(), { type: "secondCheckSignOff", disagreements: 0 }, peter);
    expect(fails(r, { type: "approve" }, peter)).toMatch(/Only the lead/);
    expect(fails(r, { type: "approve" }, requester)).toMatch(/Only the lead/);
    r = go(r, { type: "approve" }, lead);
    expect(r.status).toBe("approved");
  });
});

describe("replace file and cancel", () => {
  it("the designer can replace the file only until a checker claims it", () => {
    const r = toAwaitingReview();
    const replaced = go(r, { type: "replaceFile" }, designer);
    expect(replaced.status).toBe("checking");
    const claimed = go(r, { type: "claim" }, anna);
    expect(fails(claimed, { type: "replaceFile" }, designer)).toMatch(/Not allowed/);
  });

  it("only a designer can replace the file", () => {
    expect(fails(toAwaitingReview(), { type: "replaceFile" }, requester)).toMatch(/Only the designer/);
  });

  it("the requester or lead can cancel at any open stage; others cannot", () => {
    const r = toAwaitingReview();
    expect(go(r, { type: "cancel" }, requester).status).toBe("cancelled");
    expect(go(r, { type: "cancel" }, lead).status).toBe("cancelled");
    expect(fails(r, { type: "cancel" }, designer)).toMatch(/requester or the lead/);
    expect(fails(r, { type: "cancel" }, anna)).toMatch(/requester or the lead/);
    const otherRequester: Actor = { id: "u-other", role: "requester" };
    expect(fails(r, { type: "cancel" }, otherRequester)).toMatch(/requester or the lead/);
  });

  it("a cancelled claim is released", () => {
    const r = go(toAwaitingReview(), { type: "claim" }, anna);
    expect(go(r, { type: "cancel" }, requester).claimedBy).toBeNull();
  });

  it("approved and cancelled rounds accept nothing", () => {
    let r = go(toAwaitingReview(), { type: "cancel" }, requester);
    expect(availableEvents(r, lead)).toEqual([]);
    expect(fails(r, { type: "cancel" }, requester)).toMatch(/cancelled/);
    // approved
    let a = go(toAwaitingReview(), { type: "claim" }, anna);
    a = go(a, clean, anna);
    a = go(a, { type: "claim" }, peter);
    a = go(a, { type: "secondCheckSignOff", disagreements: 0 }, peter);
    a = go(a, { type: "approve" }, lead);
    expect(fails(a, { type: "cancel" }, requester)).toMatch(/approved/);
    expect(availableEvents(a, requester)).toEqual([]);
  });
});

describe("guards on who and when", () => {
  it("only the designer uploads a proof", () => {
    const r = newRound("WRK-2", requester.id, designer.id);
    expect(fails(r, { type: "uploadProof" }, requester)).toMatch(/Only the designer/);
    expect(fails(r, { type: "uploadProof" }, anna)).toMatch(/Only the designer/);
  });

  it("only the automatic check finishes the checking step", () => {
    let r = newRound("WRK-3", requester.id, designer.id);
    r = go(r, { type: "uploadProof" }, designer);
    expect(fails(r, { type: "pipelineDone" }, anna)).toMatch(/automatic check/);
  });

  it("events out of order are refused", () => {
    const r = newRound("WRK-4", requester.id, designer.id);
    expect(fails(r, { type: "approve" }, lead)).toMatch(/Not allowed/);
    expect(fails(r, { type: "claim" }, anna)).toMatch(/Not allowed/);
    expect(fails(r, clean, anna)).toMatch(/Not allowed/);
  });

  it("availableEvents drives the buttons: a checker in the pool sees claim, the designer sees replace", () => {
    const r = toAwaitingReview();
    expect(availableEvents(r, anna)).toEqual(["claim"]);
    expect(availableEvents(r, designer)).toContain("replaceFile");
    expect(availableEvents(r, lead)).toEqual(["cancel"]);
  });

  it("does not mutate the input round", () => {
    const r = toAwaitingReview();
    const snapshot = JSON.stringify(r);
    transition(r, { type: "claim" }, anna);
    expect(JSON.stringify(r)).toBe(snapshot);
  });
});
