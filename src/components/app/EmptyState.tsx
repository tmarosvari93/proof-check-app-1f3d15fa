import { useNavigate } from "@tanstack/react-router";
import { stepPath } from "@/state/labels";
import { useSession } from "@/state/SessionProvider";

/** Shown when the session is not ready for the page. */
export function EmptyState() {
  const s = useSession();
  const navigate = useNavigate();
  return (
    <div className="py-16 text-center">
      <p>Nothing to show here yet.</p>
      <button
        type="button"
        className="underline text-sm mt-2"
        onClick={() => navigate({ to: stepPath[s.session.step] })}
      >
        Go to the current step
      </button>
    </div>
  );
}
