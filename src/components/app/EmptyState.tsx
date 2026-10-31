import { Link } from "@tanstack/react-router";
import { useSession } from "@/state/SessionProvider";
import { stepTo } from "./AppLayout";

export function EmptyState() {
  const s = useSession();
  return (
    <div className="max-w-lg rounded-md border border-neutral-300 bg-neutral-50 p-8 text-center">
      <p className="text-neutral-600">Nothing to show here yet.</p>
      <Link to={stepTo(s.session.step)} className="mt-2 inline-block text-sm underline">
        Go to the current step
      </Link>
    </div>
  );
}
