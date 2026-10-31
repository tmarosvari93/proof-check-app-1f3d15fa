import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { EmptyState } from "@/components/app/EmptyState";
import { ProofPlaceholder } from "@/components/app/ProofPlaceholder";
import { StartOver } from "@/components/app/StartOver";
import { useAfterAction } from "@/components/app/useAfterAction";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { people } from "@/state/demo";
import { daysBetween, formatTime } from "@/state/format";
import { useSession } from "@/state/SessionProvider";

export const Route = createFileRoute("/lead")({
  component: Lead,
  head: () => ({
    meta: [
      { title: "Lead approval · Proof Check" },
      { name: "description", content: "Food-safety lead: final approval of the request." },
      { property: "og:title", content: "Lead approval · Proof Check" },
      { property: "og:description", content: "Food-safety lead: final approval of the request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Lead() {
  const s = useSession();
  const afterAction = useAfterAction();
  const [error, setError] = useState<string | undefined>();

  const last = s.session.rounds[s.session.rounds.length - 1];
  if (!last || !last.finished) {
    return (
      <AppLayout role="lead">
        <EmptyState />
      </AppLayout>
    );
  }

  const request = s.session.request!;

  const approve = () => {
    const e = s.approve();
    if (e) setError(e);
    else afterAction();
  };

  if (s.session.approved) {
    return (
      <AppLayout role="lead">
        <h1 className="text-2xl font-bold">
          Final approval: {request.product} · {request.piece}
        </h1>
        <div className="mt-6 border rounded p-4 bg-green-100 text-green-900 border-green-300 text-sm">
          <p>
            <b>Approved</b> at {formatTime(s.session.approvedAt)}. Request {request.workId} is closed. The print file stage is
            planned for the next version.
          </p>
          <div className="mt-3">
            <StartOver />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout role="lead">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">
          Final approval: {request.product} · {request.piece}
        </h1>
        <p className="text-sm text-muted-foreground">
          {request.workId} · Round {last.no} ·{" "}
          {s.session.checker2SignedOff ? "both checkers signed" : "Checker 1 signed"}
        </p>
      </div>

      <div className="mt-4 flex gap-8 items-start">
        <div className="flex-1 min-w-0">
          <p className="text-sm mb-1">
            Final proof (v{last.no}). None open.
          </p>
          <ProofPlaceholder />
        </div>
        <div className="w-[420px] shrink-0 space-y-4">
          <div className="border rounded">
            <div className="border-b bg-muted/40 p-3 font-bold">Summary</div>
            <div className="p-3 text-sm space-y-1">
              <p>
                {last.matches} of {request.spec.fields.length} spec fields match · {last.findings.length} open findings
              </p>
              <p>
                Checker 1: {people.checker1}, {formatTime(last.finishedAt)} · Checker 2: {people.checker2},{" "}
                {formatTime(s.session.checker2SignedAt)}
              </p>
              <p>
                Rounds: {s.session.rounds.length} · days from request to now: {daysBetween(request.createdAt)}
              </p>
            </div>
          </div>

          <div className="border rounded">
            <div className="border-b bg-muted/40 p-3 font-bold">Dismissed by the checkers ({s.dismissals.length})</div>
            <div className="p-3 text-sm">
              {s.dismissals.length === 0 ? (
                <p>None.</p>
              ) : (
                <div className="space-y-2">
                  {s.dismissals.map((d) => (
                    <p key={d.key}>
                      <b>
                        {d.code} · {d.label}
                      </b>
                      : not an error, {d.reason} ({people.checker1}, agreed by {people.checker2})
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold">Note (required when sending back)</p>
            <Textarea disabled title="Not built in this prototype" className="mt-1" rows={3} />
          </div>

          <div className="flex items-center justify-end gap-3">
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button variant="outline" disabled title="Not built in this prototype">
              Send back with a reason
            </Button>
            <Button onClick={approve}>Approve</Button>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Approving closes the request. The requester sees it as approved in My tasks, with the approved proof to download. The
        print file stage is MVP+1. Rule to confirm with the client: lead approval mandatory, or optional.
      </p>
    </AppLayout>
  );
}
