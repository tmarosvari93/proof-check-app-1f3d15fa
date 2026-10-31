/**
 * Round state machine for Proof Check.
 *
 * One pure function, `transition`, decides every status change. The UI asks `availableEvents`
 * which buttons to show; the database update repeats the same guards. No I/O, no clock, no AI.
 *
 * Rules implemented (architecture section 3, all [suggestion] until the client confirms):
 *  - New and returning rounds wait in Unclaimed (awaiting_review = REVIEW tag,
 *    awaiting_second_check = 4-EYE CHECK tag).
 *  - Checker 1 sends the round back on any confirmed real error. A clean round goes to a 4-eye check.
 *  - Checker 2 must be a different person from Checker 1 in the same round and can also send back.
 *  - The lead gives final approval and can also send back.
 *  - Cancel and Replace file are MVP; Update spec is MVP+1 (not here).
 */

export type Role =
  | "requester"
  | "designer_internal"
  | "designer_external"
  | "checker"
  | "lead"
  | "system";

export type RoundStatus =
  | "awaiting_proof"
  | "checking"
  | "awaiting_review"
  | "in_review"
  | "needs_discussion"
  | "awaiting_second_check"
  | "in_second_check"
  | "awaiting_approval"
  | "sent_back"
  | "approved"
  | "cancelled";

export interface Actor {
  id: string;
  role: Role;
}

export interface Round {
  id: string;
  requestId: string;
  roundNo: number;
  status: RoundStatus;
  /** Checker 1 of this round (set when claimed). */
  checker1Id: string | null;
  /** Checker 2 of this round (set when claimed). */
  checker2Id: string | null;
  /** Who currently holds the round; null while it sits in Unclaimed. */
  claimedBy: string | null;
  /** Previous round's checker 1, shown as a hint in Unclaimed. */
  hintCheckerId: string | null;
  previousRoundId: string | null;
  requesterId: string;
  designerId: string | null;
  /** Reason given when the lead sends back (stored for the history). */
  lastReason: string | null;
}

export type RoundEvent =
  | { type: "uploadProof" }
  | { type: "replaceFile" }
  | { type: "pipelineDone" }
  | { type: "claim" }
  | { type: "markNeedsDiscussion" }
  | { type: "resolveDiscussion" }
  | { type: "finishReview"; openFindings: number; needsDiscussion: number; realErrors: number }
  | { type: "secondCheckDisagree" }
  | { type: "secondCheckSignOff"; disagreements: number }
  | { type: "approve" }
  | { type: "leadSendBack"; reason: string }
  | { type: "cancel" };

export type EventType = RoundEvent["type"];

export type TransitionResult =
  | { ok: true; round: Round; newRound?: Round; eventLog: string }
  | { ok: false; reason: string };

export const TERMINAL: RoundStatus[] = ["approved", "cancelled"];

/** Which Unclaimed tag a round shows, or null when it is not in the pool. */
export function unclaimedTag(round: Round): "REVIEW" | "FOUR_EYE_CHECK" | null {
  if (round.claimedBy !== null) return null;
  if (round.status === "awaiting_review") return "REVIEW";
  if (round.status === "awaiting_second_check") return "FOUR_EYE_CHECK";
  return null;
}

const isDesigner = (r: Role) => r === "designer_internal" || r === "designer_external";

interface Rule {
  from: RoundStatus[];
  /** Structural check: who may fire this event on this round (no payload needed). */
  actor: (round: Round, actor: Actor) => string | null;
}

const ok = null;

const RULES: Record<EventType, Rule> = {
  uploadProof: {
    from: ["awaiting_proof", "sent_back"],
    actor: (_r, a) => (isDesigner(a.role) ? ok : "Only the designer can upload a proof"),
  },
  replaceFile: {
    from: ["awaiting_review"],
    actor: (r, a) => {
      if (!isDesigner(a.role)) return "Only the designer can replace the file";
      if (r.claimedBy !== null) return "A checker has already claimed this round";
      return ok;
    },
  },
  pipelineDone: {
    from: ["checking"],
    actor: (_r, a) => (a.role === "system" ? ok : "Only the automatic check can finish the check step"),
  },
  claim: {
    from: ["awaiting_review", "awaiting_second_check"],
    actor: (r, a) => {
      if (a.role !== "checker") return "Only a checker can claim a round";
      if (r.claimedBy !== null) return "Already claimed by someone else";
      if (r.status === "awaiting_second_check" && a.id === r.checker1Id)
        return "Checker 2 must be a different person from Checker 1";
      return ok;
    },
  },
  markNeedsDiscussion: {
    from: ["in_review"],
    actor: (r, a) => (a.role === "checker" && a.id === r.checker1Id ? ok : "Only Checker 1 of this round can do this"),
  },
  resolveDiscussion: {
    from: ["needs_discussion"],
    actor: (_r, a) => (a.role === "lead" ? ok : "Only the lead can resolve a discussion item"),
  },
  finishReview: {
    from: ["in_review"],
    actor: (r, a) => (a.role === "checker" && a.id === r.checker1Id ? ok : "Only Checker 1 of this round can finish the review"),
  },
  secondCheckDisagree: {
    from: ["in_second_check"],
    actor: (r, a) => (a.role === "checker" && a.id === r.checker2Id ? ok : "Only Checker 2 of this round can do this"),
  },
  secondCheckSignOff: {
    from: ["in_second_check"],
    actor: (r, a) => (a.role === "checker" && a.id === r.checker2Id ? ok : "Only Checker 2 of this round can sign off"),
  },
  approve: {
    from: ["awaiting_approval"],
    actor: (_r, a) => (a.role === "lead" ? ok : "Only the lead can approve"),
  },
  leadSendBack: {
    from: ["awaiting_approval"],
    actor: (_r, a) => (a.role === "lead" ? ok : "Only the lead can send back from final approval"),
  },
  cancel: {
    from: ["awaiting_proof", "checking", "awaiting_review", "in_review", "needs_discussion",
           "awaiting_second_check", "in_second_check", "awaiting_approval", "sent_back"],
    actor: (r, a) =>
      (a.role === "requester" && a.id === r.requesterId) || a.role === "lead"
        ? ok
        : "Only the requester or the lead can cancel a request",
  },
};

function structural(round: Round, event: EventType, actor: Actor): string | null {
  if (TERMINAL.includes(round.status)) return `Round is ${round.status}`;
  const rule = RULES[event];
  if (!rule.from.includes(round.status)) return `Not allowed while the round is ${round.status}`;
  return rule.actor(round, actor);
}

/** Events this actor may fire on this round right now (payload-independent). Use it to show buttons. */
export function availableEvents(round: Round, actor: Actor): EventType[] {
  return (Object.keys(RULES) as EventType[]).filter((e) => structural(round, e, actor) === null);
}

export function transition(round: Round, event: RoundEvent, actor: Actor): TransitionResult {
  const why = structural(round, event.type, actor);
  if (why) return { ok: false, reason: why };

  const next = (patch: Partial<Round>, log: string): TransitionResult => ({
    ok: true,
    round: { ...round, ...patch },
    eventLog: log,
  });

  switch (event.type) {
    case "uploadProof": {
      if (round.status === "awaiting_proof") return next({ status: "checking" }, "proof uploaded");
      // sent_back: the old round stays as history, a new round starts
      const newRound: Round = {
        ...round,
        id: `${round.id}+1`, // replaced by the database id on insert
        roundNo: round.roundNo + 1,
        status: "checking",
        checker1Id: null,
        checker2Id: null,
        claimedBy: null,
        hintCheckerId: round.checker1Id,
        previousRoundId: round.id,
        lastReason: null,
      };
      return { ok: true, round, newRound, eventLog: `round ${newRound.roundNo} started` };
    }
    case "replaceFile":
      return next({ status: "checking" }, "file replaced before claim");
    case "pipelineDone":
      return next({ status: "awaiting_review" }, "automatic check done");
    case "claim":
      if (round.status === "awaiting_review")
        return next({ status: "in_review", checker1Id: actor.id, claimedBy: actor.id }, "claimed for review");
      return next({ status: "in_second_check", checker2Id: actor.id, claimedBy: actor.id }, "claimed for 4-eye check");
    case "markNeedsDiscussion":
      return next({ status: "needs_discussion" }, "needs discussion: passed to lead");
    case "resolveDiscussion":
      return next({ status: "in_review" }, "lead resolved the discussion item");
    case "finishReview": {
      if (event.openFindings > 0) return { ok: false, reason: `${event.openFindings} finding(s) are still undecided` };
      if (event.needsDiscussion > 0)
        return { ok: false, reason: "Items marked Needs discussion must be resolved by the lead first" };
      if (event.realErrors > 0)
        return next({ status: "sent_back", claimedBy: null }, "sent back: real errors confirmed");
      return next({ status: "awaiting_second_check", claimedBy: null }, "clean round: passed to 4-eye check");
    }
    case "secondCheckDisagree":
      return next({ status: "sent_back", claimedBy: null }, "sent back by checker 2");
    case "secondCheckSignOff":
      if (event.disagreements > 0)
        return { ok: false, reason: "Checker 2 disagreed with an item: use send back instead of sign-off" };
      return next({ status: "awaiting_approval", claimedBy: null }, "4-eye check signed off");
    case "approve":
      return next({ status: "approved" }, "approved by lead");
    case "leadSendBack":
      if (!event.reason.trim()) return { ok: false, reason: "A reason is required to send back from approval" };
      return next({ status: "sent_back", lastReason: event.reason.trim() }, "sent back by lead");
    case "cancel":
      return next({ status: "cancelled", claimedBy: null }, "request cancelled");
  }
}

/** First round of a new request, waiting for the designer's proof. */
export function newRound(requestId: string, requesterId: string, designerId: string | null): Round {
  return {
    id: `${requestId}-r1`,
    requestId,
    roundNo: 1,
    status: "awaiting_proof",
    checker1Id: null,
    checker2Id: null,
    claimedBy: null,
    hintCheckerId: null,
    previousRoundId: null,
    requesterId,
    designerId,
    lastReason: null,
  };
}
