/**
 * Who has to do what right now: the lists behind Unclaimed and My tasks, the menu of each role, and where a role lands.
 * Pure functions over the Session. The prototype holds ONE request, so each list has at most one row.
 * Claude owns this file. Lovable must not edit it.
 */
import type { Role, Session } from "./types";

export interface Task {
  workId: string;
  product: string;
  piece: string;
  /** The round the task is about. */
  round: number;
  /** What to do, e.g. "Upload proof, round 2". */
  title: string;
  /** Where the request is, in words. */
  status: string;
  /** Page that opens the task. null: nothing to open for this role (it is waiting on someone else). */
  to: string | null;
  /** True when this role has to act now. */
  actionable: boolean;
}

/** A claim belongs to one round. A new round is unclaimed again. */
export const isClaimed = (s: Session): boolean => s.claim?.round === s.current && s.claim !== undefined;

/** Who acts now, and a sentence for everybody else. role null: nobody (done) or not yet anybody (unclaimed). */
export function ownerOf(s: Session): { role: Role | null; text: string } {
  const r = s.current;
  switch (s.step) {
    case "home":
    case "new_request":
      return { role: "requester", text: "Waiting for the requester to create the request" };
    case "upload_proof":
      return { role: "designer", text: `Waiting for the designer to upload round ${r}` };
    case "review":
      return isClaimed(s)
        ? { role: "checker1", text: `Round ${r} is in review with ${s.claim!.by}` }
        : { role: null, text: `Round ${r} is waiting for a checker to claim it` };
    case "send_back":
      return { role: "checker1", text: `Round ${r}: the send-back list is being prepared` };
    case "checker2":
      return { role: "checker2", text: "Waiting for Checker 2 (4-eye check)" };
    case "lead":
      return { role: "lead", text: "Waiting for the food-safety lead to approve" };
    case "approved":
      return { role: null, text: "Approved" };
  }
}

const TITLE: Record<Role, (s: Session) => string> = {
  requester: () => "Follow the request",
  designer: (s) => `Upload proof, round ${s.current}`,
  checker1: (s) => (s.step === "send_back" ? `Send-back list, round ${s.current}` : `Review, round ${s.current}`),
  checker2: () => "4-eye check",
  lead: () => "Approve",
};
const PAGE: Record<Role, (s: Session) => string> = {
  requester: () => "/new",
  designer: () => "/upload",
  checker1: (s) => (s.step === "send_back" ? "/send-back" : "/review"),
  checker2: () => "/checker-2",
  lead: () => "/lead",
};

function rowOf(s: Session, over: Pick<Task, "title" | "status" | "to" | "actionable">): Task | undefined {
  const req = s.request;
  if (!req) return undefined;
  return { workId: req.workId, product: req.product, piece: req.piece, round: s.current, ...over };
}

/** Unclaimed: the proof of the current round, when it is uploaded and nobody took it yet. */
export function unclaimedOf(s: Session): Task[] {
  if (s.step !== "review" || isClaimed(s)) return [];
  const row = rowOf(s, { title: `Review, round ${s.current}`, status: ownerOf(s).text, to: "/unclaimed", actionable: true });
  return row ? [row] : [];
}

/** Only Checker 1 can claim in this demo; Checker 2 acts after Checker 1 has finished. */
export const canClaim = (role: Role): boolean => role === "checker1";

/**
 * My tasks for a role. The role that has to act gets one actionable row. The requester always sees the request
 * with its status, so there is no empty page after the request is created.
 */
export function tasksOf(s: Session, role: Role): Task[] {
  if (!s.request) return [];
  const owner = ownerOf(s);
  if (owner.role === role) {
    const row = rowOf(s, { title: TITLE[role](s), status: owner.text, to: PAGE[role](s), actionable: true });
    return row ? [row] : [];
  }
  if (role === "requester") {
    const row = rowOf(s, { title: TITLE.requester(s), status: owner.text, to: null, actionable: false });
    return row ? [row] : [];
  }
  return [];
}

export interface MenuItem {
  label: string;
  to: "/" | "/unclaimed" | "/my-tasks" | "/track-all" | "/new";
}

/** The left menu for a role. Every role has Home, My tasks and Track all work. Both checkers and the lead can see Unclaimed; only Checker 1 can claim. */
export function menuOf(role: Role): MenuItem[] {
  const items: MenuItem[] = [{ label: "Home", to: "/" }];
  if (role === "checker1" || role === "checker2" || role === "lead") items.push({ label: "Unclaimed", to: "/unclaimed" });
  items.push({ label: "My tasks", to: "/my-tasks" }, { label: "Track all work", to: "/track-all" });
  if (role === "requester") items.push({ label: "+ New request", to: "/new" });
  return items;
}

/** The page a role opens when it is picked in the top bar. */
export function landingOf(s: Session, role: Role): string {
  if (role === "requester" && !s.request) return s.step === "new_request" ? "/new" : "/";
  if (role === "checker1" && unclaimedOf(s).length > 0) return "/unclaimed";
  const mine = tasksOf(s, role).find((t) => t.actionable);
  return mine?.to ?? "/my-tasks";
}

/**
 * The role that belongs to a flow page. Visiting it switches the role chip, so "Working as" is always right.
 * Pages that every role can open (Home, My tasks, Track all work, Unclaimed) keep the role as it is.
 */
export function roleOfPath(path: string): Role | undefined {
  switch (path) {
    case "/new": return "requester";
    case "/upload": return "designer";
    case "/review":
    case "/send-back": return "checker1";
    case "/checker-2": return "checker2";
    case "/lead": return "lead";
    default: return undefined;
  }
}

/** For the empty state of a page that is not for the current role: where the request is and who acts next. */
export function notForYouText(s: Session): string {
  return `Nothing for you right now. ${ownerOf(s).text}.`;
}
