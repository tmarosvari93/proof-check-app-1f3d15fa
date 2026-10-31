import { Link, useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { useSession } from "@/state/SessionProvider";
import { workingAs } from "@/state/demo";
import { stepPath } from "@/state/labels";
import type { Step } from "@/state/types";
import { mockNames, type MockName } from "@/mocks/mockSession";
import { Button } from "@/components/ui/button";

export type RoutePath = "/" | "/new" | "/upload" | "/review" | "/send-back" | "/checker-2" | "/lead" | "/not-built";
export const stepTo = (step: Step): RoutePath => stepPath[step] as RoutePath;

const roleFor = (path: string): string => {
  if (path === "/new") return workingAs.requester;
  if (path === "/upload") return workingAs.designer;
  if (path === "/review" || path === "/send-back") return workingAs.checker1;
  if (path === "/checker-2") return workingAs.checker2;
  if (path === "/lead") return workingAs.lead;
  return workingAs.anyone;
};

const stepName = (step: Step, current: number): string => {
  switch (step) {
    case "home": return "Home";
    case "new_request": return "New request";
    case "upload_proof": return `Upload proof, round ${current}`;
    case "review": return `Review, round ${current}`;
    case "send_back": return `Send-back list, round ${current}`;
    case "checker2": return "Checker 2";
    case "lead": return "Lead approval";
    case "approved": return "Approved";
  }
};

const menuItems: { label: string; to: RoutePath; screen?: string }[] = [
  { label: "Home", to: "/" },
  { label: "Unclaimed", to: "/not-built", screen: "unclaimed" },
  { label: "My tasks", to: "/not-built", screen: "tasks-checker" },
  { label: "Track all work", to: "/not-built", screen: "track-all" },
  { label: "+ New request", to: "/new" },
];

const moreScreens = [
  { screen: "process-flow", label: "Process flow" },
  { screen: "tasks-requester", label: "My tasks: requester" },
  { screen: "tasks-lead", label: "My tasks: lead" },
  { screen: "task-view", label: "Task view" },
  { screen: "designer-home", label: "Designer home" },
  { screen: "designer-tasks", label: "Designer my tasks" },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const s = useSession();
  const { pathname } = useLocation();
  const search = useSearch({ strict: false }) as { dev?: string };
  const dev = search.dev === "1";
  const navigate = useNavigate();
  const pendingJump = useRef(false);

  useEffect(() => {
    if (!pendingJump.current) return;
    pendingJump.current = false;
    void navigate({ to: stepTo(s.session.step), search: dev ? { dev: "1" as const } : {} });
  }, [s.session, dev, navigate]);

  const jump = (name: MockName) => {
    pendingJump.current = true;
    s.jumpTo(name);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <Link to="/" className="text-lg font-bold">
          Proof Check
        </Link>
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          Working as
          <span className="rounded-md border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-sm font-semibold text-neutral-800">
            {roleFor(pathname)}
          </span>
        </div>
      </header>
      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-neutral-200 px-4 py-4">
          <nav className="space-y-1">
            {menuItems.map((m) => {
              const active =
                m.to === "/" ? pathname === "/" : m.to === "/new" ? pathname === "/new" : false;
              return (
                <Link
                  key={m.label}
                  to={m.to}
                  search={m.screen ? { screen: m.screen } : {}}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    active ? "bg-neutral-900 font-semibold text-white" : "text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {m.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 rounded-md border border-neutral-300 bg-neutral-50 p-3 text-sm">
            <p className="font-semibold">Demo</p>
            <p className="mt-1 text-neutral-600">
              You are at: {stepName(s.session.step, s.session.current)}
            </p>
            <Link to={stepTo(s.session.step)} className="mt-1 inline-block underline">
              Continue
            </Link>
          </div>
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              More designed screens
            </p>
            <div className="mt-1 space-y-0.5">
              {moreScreens.map((m) => (
                <Link
                  key={m.screen}
                  to="/not-built"
                  search={{ screen: m.screen }}
                  className="block px-1 py-0.5 text-sm text-neutral-500 hover:underline"
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-6 py-5">
          {children}
          {dev && (
            <div className="mt-8 flex flex-wrap gap-1 border-t border-dashed border-neutral-300 pt-3">
              {mockNames.map((n) => (
                <Button key={n} size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => jump(n)}>
                  {n}
                </Button>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
