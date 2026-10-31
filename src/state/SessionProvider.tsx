/**
 * React wrapper around the pure actions in actions.ts. Pages use useSession(); they never import
 * the actions, the services or the mocks directly. Actions return an error message or undefined.
 * loadSpec and uploadProof are async (reading files takes time in the real version): await them.
 * Claude owns this file. In memory only: a page refresh starts over (known limitation 1).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Edit } from "../core/sendBack";
import * as A from "./actions";
import { mockSession, mockRoundFor, mockSpec, type MockName } from "../mocks/mockSession";
import { decisionOf, dismissalsOf, openCount, previousLines, reviewItems, type Dismissal, type PreviousLine, type ReviewItem } from "./roundLogic";
import { emptySession, type Decision, type Round, type Session } from "./types";

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

  loadSpec(file: File | null): Promise<Err>;
  createRequest(): Err;
  uploadProof(file: File | null, designerNote?: string): Promise<Err>;
  decide(code: string, decision: Decision, reason?: string): Err;
  finishReview(): Err;
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
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(emptySession);
  const [busy, setBusy] = useState(false);
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
      // MOCK until step 3: any .xlsx gives the demo spec; step 3 calls parseSpecWorkbook.
      loadSpec: async (f) => {
        const bad = A.checkSpecFile(f);
        if (bad) return bad;
        setBusy(true);
        await pause(300);
        setBusy(false);
        return apply((s) => A.setPendingSpec(s, mockSpec));
      },
      createRequest: () => apply((s) => A.createRequest(s, now())),
      // MOCK until step 3: any .pdf gives the demo result for the current round; step 3 calls runCheck.
      uploadProof: async (f, note) => {
        const bad = A.checkProofFile(f);
        if (bad) return bad;
        setBusy(true);
        await pause(1200);
        setBusy(false);
        return apply((s) => A.addRound(s, { ...mockRoundFor(s.current, s.rounds[s.current - 2]), fileName: f!.name, designerNote: (note ?? "").trim() }));
      },
      decide: (c, d, r) => apply((s) => A.decide(s, c, d, r)),
      finishReview: () => apply((s) => A.finishReview(s, now())),
      backToReview: () => apply(A.backToReview),
      editSendBack: (e) => apply((s) => A.editSendBack(s, e)),
      addManualLine: (t) => apply((s) => A.addManualLine(s, t)),
      sendToDesigner: () => apply(A.sendToDesigner),
      checker2Agree: (k, a) => apply((s) => A.checker2Agree(s, k, a)),
      checker2SignOff: () => apply((s) => A.checker2SignOff(s, now())),
      approve: () => apply((s) => A.approve(s, now())),
      startOver: () => void apply(() => A.startOver()),
      jumpTo: (n) => void apply(() => ({ session: mockSession(n) })),
    };
  }, [session, busy, apply]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside <SessionProvider>");
  return v;
}
