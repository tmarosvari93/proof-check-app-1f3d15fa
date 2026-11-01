/**
 * React wrapper around the pure actions in actions.ts. Pages use useSession(); they never import
 * the actions, the services or the mocks directly. Actions return an error message or undefined.
 * loadSpec and uploadProof are async (reading files takes time in the real version): await them.
 * Claude owns this file. Step 3: loadSpec and uploadProof are real (parseSpecWorkbook, runCheck); jumpTo still uses the prepared mock states. In memory only: a page refresh starts over (known limitation 1).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Edit } from "../core/sendBack";
import * as A from "./actions";
import { mockSession, type MockName } from "../mocks/mockSession";
import { decisionOf, dismissalsOf, openCount, previousLines, reviewItems, type Dismissal, type PreviousLine, type ReviewItem } from "./roundLogic";
import { emptySession, type Decision, type Role, type Round, type Session } from "./types";
import { canClaim, isClaimed, landingOf, menuOf, tasksOf, unclaimedOf, type MenuItem, type Task } from "./tasks";
import { claimerName } from "./demo";

type Err = string | undefined;
export type ItemView = ReviewItem & { decision: Decision };

export interface SessionApi {
  session: Session;
  /** The round being worked on, if its proof is uploaded. */
  round: Round | undefined;
  /** Items in the current round the checker looks at, with their decisions. */
  items: ItemView[];
  /** Items that still need a decision. Finish review is blocked while this is not empty. */
  undecided: ItemView[];
  /** undecided.length */
  open: number;
  /** Dismissed items across all rounds, for Checker 2 and the lead. */
  dismissals: Dismissal[];
  /** The previous round's send-back lines, for the designer's upload page. Empty in round 1. */
  previousLines: PreviousLine[];
  /** True while loadSpec or uploadProof runs. */
  busy: boolean;

  /** The role picked in the top bar ("Working as"). Pages that belong to one role switch it themselves. */
  role: Role;
  setRole(role: Role): void;
  /** The left menu of the current role. */
  menu: MenuItem[];
  /** Where the current role lands when picked: its task, or My tasks. */
  landing: string;
  /** Unclaimed list: proofs uploaded and not yet taken by a checker. */
  unclaimed: Task[];
  /** My tasks for the current role. */
  tasks: Task[];
  /** The proof of the current round was claimed. /review needs this. */
  claimed: boolean;
  /** Only Checker 1 can claim in this demo. */
  canClaim: boolean;

  loadSpec(file: File | null): Promise<Err>;
  /** notes: the requester's comments for the designer (optional; the demo note is used when left out). */
  createRequest(notes?: string): Err;
  uploadProof(file: File | null, designerNote?: string): Promise<Err>;
  claimProof(): Err;
  decide(code: string, decision: Decision, reason?: string): Err;
  /** anyway: finish with items still open. They are not sent to the designer and Checker 2 sees them (round.skippedOpen). */
  /** The lead sends the proof back with a required note; it becomes a line for the designer and round {n+1} starts. */
  leadSendBack(note: string): Err;
  finishReview(opts?: { anyway?: boolean }): Err;
  backToReview(): Err;
  editSendBack(edits: Edit[]): Err;
  addManualLine(text: string): Err;
  sendToDesigner(): Err;
  checker2Agree(key: string, agree: boolean): Err;
  checker2SignOff(): Err;
  approve(): Err;
  startOver(): void;
  /** Demo shortcut: jump straight to a prepared state (for building and testing pages). */
  jumpTo(name: MockName): void;
}

const Ctx = createContext<SessionApi | null>(null);
const now = () => new Date().toISOString();

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(emptySession);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Role>("requester");
  const latest = useRef(session);

  const apply = useCallback((fn: (s: Session) => A.Result): Err => {
    const r = fn(latest.current);
    latest.current = r.session;
    setSession(r.session);
    return r.error;
  }, []);

  const api = useMemo<SessionApi>(() => {
    const round = session.rounds[session.current - 1];
    const items: ItemView[] = round ? reviewItems(round).map((i) => ({ ...i, decision: decisionOf(round, i.code) })) : [];
    const undecided = items.filter((i) => i.needsDecision && (i.decision === "open" || i.decision === "needs_discussion"));
    return {
      session,
      round,
      items,
      undecided,
      open: round ? openCount(round) : 0,
      dismissals: dismissalsOf(session.rounds),
      previousLines: previousLines(session.rounds, session.current),
      busy,
      role,
      setRole,
      menu: menuOf(role),
      landing: landingOf(session, role),
      unclaimed: unclaimedOf(session),
      tasks: tasksOf(session, role),
      claimed: isClaimed(session),
      canClaim: canClaim(role),
      // Real: the spec workbook is parsed in the browser (blue cells). exceljs is loaded on demand.
      loadSpec: async (f) => {
        const bad = A.checkSpecFile(f);
        if (bad) return bad;
        setBusy(true);
        try {
          const { parseSpecWorkbook } = await import("../core/parseSpec");
          const spec = await parseSpecWorkbook(new Uint8Array(await f!.arrayBuffer()));
          return apply((s) => A.setPendingSpec(s, spec, { name: f!.name, url: URL.createObjectURL(f!) }));
        } catch (e) {
          return e instanceof Error && e.name === "SpecParseError" ? e.message : "This file is not a readable .xlsx workbook";
        } finally {
          setBusy(false);
        }
      },
      createRequest: (notes) => apply((s) => A.createRequest(s, now(), notes)),
      // Real: runCheck reads the PDF and runs compare, diff and the send-back re-check (src/services/runCheck.ts).
      uploadProof: async (f, note) => {
        const bad = A.checkProofFile(f);
        if (bad) return bad;
        const s0 = latest.current;
        if (!s0.request) return "Create a request first";
        setBusy(true);
        try {
          const { runCheck } = await import("../services/runCheck");
          const round = await runCheck({
            file: f!, spec: s0.request.spec, no: s0.current, fileName: f!.name,
            designerNote: (note ?? "").trim(), previous: s0.rounds[s0.current - 2],
          });
          const withFile = { ...round, proofFile: { name: f!.name, url: URL.createObjectURL(f!) } };
          return apply((s) => A.addRound(s, withFile));
        } catch (e) {
          return e instanceof Error ? e.message : "This file could not be checked";
        } finally {
          setBusy(false);
        }
      },
      claimProof: () => apply((s) => A.claimProof(s, claimerName, now())),
      decide: (c, d, r) => apply((s) => A.decide(s, c, d, r)),
      finishReview: (opts) => apply((s) => A.finishReview(s, now(), opts?.anyway === true)),
      backToReview: () => apply(A.backToReview),
      editSendBack: (e) => apply((s) => A.editSendBack(s, e)),
      addManualLine: (t) => apply((s) => A.addManualLine(s, t)),
      sendToDesigner: () => apply(A.sendToDesigner),
      checker2Agree: (k, a) => apply((s) => A.checker2Agree(s, k, a)),
      checker2SignOff: () => apply((s) => A.checker2SignOff(s, now())),
      leadSendBack: (note) => apply((s) => A.leadSendBack(s, note)),
      approve: () => apply((s) => A.approve(s, now())),
      startOver: () => void apply(() => A.startOver()),
      jumpTo: (n) => void apply(() => ({ session: mockSession(n) })),
    };
  }, [session, busy, role, apply]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside <SessionProvider>");
  return v;
}
