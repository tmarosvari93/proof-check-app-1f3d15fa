import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { mockNames, mockSession } from "@/mocks/mockSession";
import { workingAs } from "@/state/demo";
import { stepPath } from "@/state/labels";
import { useSession } from "@/state/SessionProvider";
import type { Step } from "@/state/types";

const STEP_NAMES: Record<Step, (current: number) => string> = {
  home: () => "Home",
  new_request: () => "New request",
  upload_proof: (c) => `Upload proof, round ${c}`,
  review: (c) => `Review, round ${c}`,
  send_back: (c) => `Send-back list, round ${c}`,
  checker2: () => "Checker 2",
  lead: () => "Lead approval",
  approved: () => "Approved",
};

const MORE_SCREENS: [string, string][] = [
  ["process-flow", "Process flow"],
  ["tasks-requester", "My tasks: requester"],
  ["tasks-lead", "My tasks: lead"],
  ["task-view", "Task view"],
  ["designer-home", "Designer home"],
  ["designer-tasks", "Designer my tasks"],
];

/** Shared top bar, left menu, Demo box and (with ?dev=1) the demo shortcut row. */
export function AppLayout({ role, children }: { role: keyof typeof workingAs; children: ReactNode }) {
  const s = useSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const dev = useRouterState({
    select: (st) => (st.location.search as Record<string, unknown>)["dev"] === "1",
  });

  const devSearch: Record<string, string> = dev ? { dev: "1" } : {};
  const nav = (to: string) => navigate({ to, search: devSearch });

  const itemClass = (active: boolean) =>
    `block w-full text-left px-3 py-2 rounded text-sm ${active ? "bg-primary text-primary-foreground" : ""}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="flex h-14 items-center justify-between px-6">
          <Link to="/" className="font-bold">
            Proof Check
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Working as</span>
            <span className="border rounded px-3 py-1 text-sm">{workingAs[role]}</span>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="w-60 shrink-0 border-r p-4 flex flex-col gap-4 min-h-[calc(100vh-3.5rem)]">
          <nav className="flex flex-col gap-1">
            <Link to="/" className={itemClass(pathname === "/")}>
              Home
            </Link>
            <Link to="/not-built" search={{ screen: "unclaimed" }} className={itemClass(false)}>
              Unclaimed
            </Link>
            <Link to="/not-built" search={{ screen: "tasks-checker" }} className={itemClass(false)}>
              My tasks
            </Link>
            <Link to="/not-built" search={{ screen: "track-all" }} className={itemClass(false)}>
              Track all work
            </Link>
            <Link to="/new" className={itemClass(pathname === "/new")}>
              + New request
            </Link>
          </nav>
          <div className="border rounded p-3 text-sm">
            <p>You are at: {STEP_NAMES[s.session.step](s.session.current)}</p>
            <button type="button" className="underline" onClick={() => nav(stepPath[s.session.step])}>
              Continue
            </button>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">More designed screens</p>
            <ul className="mt-1 space-y-1">
              {MORE_SCREENS.map(([key, label]) => (
                <li key={key}>
                  <Link to="/not-built" search={{ screen: key }} className="underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <main className="flex-1 px-8 py-6 min-w-0">
          {children}
          {dev && (
            <div className="mt-10 flex flex-wrap gap-1">
              {mockNames.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="border rounded px-2 py-0.5 text-xs"
                  onClick={() => {
                    s.jumpTo(n);
                    nav(stepPath[mockSession(n).step]);
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
