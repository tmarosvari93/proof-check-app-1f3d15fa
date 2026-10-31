/**
 * React wrapper around the pure actions in actions.ts. Pages use useSession(); they never import
 * the actions or the mocks directly. Every action returns an error message (string) or undefined.
 * Claude owns this file. In memory only: a page refresh starts over (known limitation 1).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { Edit } from "../core/sendBack";
import * as A from "./actions";
import { mockSession, type MockName } from "../mocks/mockSession";
import { decisionOf, dismissalsOf, openCount, reviewItems, type ReviewItem } from "./roundLogic";
import { emptySession, type Decision, type Round, type Session } from "./types";

type Err = string | undefined;

export interface SessionApi {
  session: Session;
  /** The round being worked on, if its proof is uploaded. */
  round: Round | undefined;
  /** Items in the current round the checker has to look at, with their decisions. */
  items: (ReviewItem & { decision: Decision })[];
  /** Items still open in the current round. Finish is blocked while this is above 0. */
  open: number;
  /** Dismissals across all rounds, for Checker 2. */
  dismissals: { round: number; code: string; reason: string }[];

  createRequest(file: File | null): Err;
  uploadProof(file: File | null): Err;
  decide(code: string, decision: Decision, reason?: string): Err;
  finishReview(): Err;
  editSendBack(edits: Edit[]): Err;
  addManualLine(text: string): Err;
  sendToDesigner(): Err;
  checker2Agree(code: string, agree: boolean): Err;
  checker2SignOff(): Err;
  approve(): Err;
  startOver(): void;
  /** Demo shortcut for building pages: jump straight to a prepared state. */
  jumpTo(name: MockName): void;
}

const Ctx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(emptySession);
  const latest = useRef(session);

  const apply = useCallback((fn: (s: Session) => A.Result): Err => {
    const r = fn(latest.current);
    latest.current = r.session;
    setSession(r.session);
    return r.error;
  }, []);

  const api = useMemo<SessionApi>(() => {
    const round = session.rounds[session.current - 1];
    return {
      session,
      round,
      items: round ? reviewItems(round).map((i) => ({ ...i, decision: decisionOf(round, i.code) })) : [],
      open: round ? openCount(round) : 0,
      dismissals: dismissalsOf(session.rounds),
      createRequest: (f) => apply((s) => A.createRequest(s, f)),
      uploadProof: (f) => apply((s) => A.uploadProof(s, f)),
      decide: (c, d, r) => apply((s) => A.decide(s, c, d, r)),
      finishReview: () => apply(A.finishReview),
      editSendBack: (e) => apply((s) => A.editSendBack(s, e)),
      addManualLine: (t) => apply((s) => A.addManualLine(s, t)),
      sendToDesigner: () => apply(A.sendToDesigner),
      checker2Agree: (c, a) => apply((s) => A.checker2Agree(s, c, a)),
      checker2SignOff: () => apply(A.checker2SignOff),
      approve: () => apply(A.approve),
      startOver: () => void apply(() => A.startOver()),
      jumpTo: (n) => void apply(() => ({ session: mockSession(n) })),
    };
  }, [session, apply]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSession(): SessionApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside <SessionProvider>");
  return v;
}
