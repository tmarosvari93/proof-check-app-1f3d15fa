import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { stepPath } from "@/state/labels";
import { useSession } from "@/state/SessionProvider";

/**
 * After an action succeeded (returned no error), call this to navigate to
 * stepPath[session.step] once the session state has updated.
 */
export function useAfterAction() {
  const s = useSession();
  const navigate = useNavigate();
  const pending = useRef(false);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    void navigate({ to: stepPath[s.session.step] });
  }, [s.session, navigate]);

  return () => {
    pending.current = true;
  };
}
