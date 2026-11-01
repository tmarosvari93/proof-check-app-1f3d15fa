import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/state/SessionProvider";
import { roleOrder, roleLabel } from "@/state/demo";
import { landingOf, roleOfPath } from "@/state/tasks";
import type { Role } from "@/state/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stepPath } from "@/state/labels";
import type { Step } from "@/state/types";
import { mockNames, type MockName } from "@/mocks/mockSession";
import { Button } from "@/components/ui/button";

export type RoutePath = "/" | "/new" | "/upload" | "/review" | "/send-back" | "/checker-2" | "/lead" | "/track-all" | "/unclaimed" | "/my-tasks";
export const stepTo = (step: Step): RoutePath => stepPath[step] as RoutePath;

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

export function AppLayout({ children }: { children: ReactNode }) {
  const s = useSession();
  const { pathname } = useLocation();
  const [dev, setDev] = useState(false);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("dev") ?? "";
    setDev(raw.replaceAll('"', "") === "1");
  }, [pathname]);
  const navigate = useNavigate();
  const pendingJump = useRef(false);

  useEffect(() => {
    if (!pendingJump.current) return;
    pendingJump.current = false;
    void navigate({ to: stepTo(s.session.step), search: dev ? { dev: "1" as const } : {} });
  }, [s.session, dev, navigate]);

  useEffect(() => {
    const r = roleOfPath(pathname);
    if (r) s.setRole(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const pickRole = (role: Role) => {
    s.setRole(role);
    void navigate({ to: landingOf(s.session, role) as RoutePath, search: dev ? { dev: "1" as const } : {} });
  };

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
          <Select value={s.role} onValueChange={(v) => pickRole(v as Role)}>
            <SelectTrigger className="h-8 w-44 font-semibold text-neutral-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOrder.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>
      <div className="flex">
        <aside className="w-56 shrink-0 border-r border-neutral-200 px-4 py-4">
          <nav className="space-y-1">
            {s.menu.map((m) => {
              const active = m.to === pathname;
              return (
                <Link
                  key={m.label}
                  to={m.to as RoutePath}
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
            <Link
              to={s.session.step === "review" && !s.claimed ? "/unclaimed" : stepTo(s.session.step)}
              className="mt-1 inline-block underline"
            >
              Continue
            </Link>
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
