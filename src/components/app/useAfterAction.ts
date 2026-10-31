import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/state/SessionProvider";
import { stepTo } from "./AppLayout";

/**
 * Runs a session action and, when it succeeds (no error string), navigates to
 * stepPath[session.step] once the new session state has rendered.
 */
export function useAfterAction() {
  const s = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>();
  const pending = useRef(false);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    void navigate({ to: stepTo(s.session.step) });
  }, [s.session, navigate]);

  const run = (fn: () => string | undefined | Promise<string | undefined>) => {
    setError(undefined);
    pending.current = true;
    void Promise.resolve(fn()).then((e) => {
      if (e) {
        pending.current = false;
        setError(e);
      }
    });
  };

  return { error, run };
}
