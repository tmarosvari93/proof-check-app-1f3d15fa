import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { EmptyState } from "@/components/app/EmptyState";
import { ProofPlaceholder } from "@/components/app/ProofPlaceholder";
import { useAfterAction } from "@/components/app/useAfterAction";
import { Button } from "@/components/ui/button";
import { people } from "@/state/demo";
import { useSession } from "@/state/SessionProvider";

export const Route = createFileRoute("/checker-2")({
  component: Checker2,
  head: () => ({
    meta: [
      { title: "Checker 2 · Proof Check" },
      { name: "description", content: "Checker 2: confirm what Checker 1 dismissed (4-eye check)." },
      { property: "og:title", content: "Checker 2 · Proof Check" },
      { property: "og:description", content: "Checker 2: confirm what Checker 1 dismissed (4-eye check)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Checker2() {
  const s = useSession();
  const afterAction = useAfterAction();
  const [error, setError] = useState<string | undefined>();

  const last = s.session.rounds[s.session.rounds.length - 1];
  if (!last || !last.finished) {
    return (
      <AppLayout role="checker2">
        <EmptyState />
      </AppLayout>
    );
  }

  const request = s.session.request!;
  const lc = last.lineChecks;
  const requestsText = lc
    ? `${lc.filter((l) => l.verdict === "done").length} of ${lc.length} requests are done`
    : "no earlier requests";

  const signOff = () => {
    const e = s.checker2SignOff();
    if (e) setError(e);
    else afterAction();
  };

  return (
    <AppLayout role="checker2">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">
          {request.product} · {request.piece}
        </h1>
        <p className="text-sm text-muted-foreground">
          {request.workId} · Round {last.no} · 4-eye check
        </p>
      </div>
      <p className="text-sm mt-1">
        Upload › Automatic check › Checker 1 ({people.checker1}) ✓ › <b>4-eye check (you)</b> › Approval
      </p>

      <div className="mt-3 border rounded p-3 text-sm">
        Checker 1 found <b>no real errors</b> in this round. Your job: confirm that what was dismissed is really fine.{" "}
        {last.matches} fields match, {requestsText}, {last.unrequested?.length ?? 0} unrequested changes.
      </div>

      <div className="mt-4 flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <ProofPlaceholder />
        </div>
        <div className="w-[460px] shrink-0 border rounded">
          <div className="border-b bg-muted/40 p-3 font-bold">Dismissed by Checker 1 ({s.dismissals.length})</div>
          {s.dismissals.length === 0 ? (
            <div className="p-3 text-sm">Nothing was dismissed. Nothing to confirm.</div>
          ) : (
            <div className="divide-y">
              {s.dismissals.map((d) => {
                const agreed = s.session.checker2Agreed[d.key] === true;
                return (
                  <div key={d.key} className="p-3">
                    <p className="text-sm">
                      <b>{d.code}</b> <b>{d.label}</b>
                    </p>
                    <p className="text-sm">{d.summary}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {people.checker1}: not an error. Reason: {d.reason}.
                      {d.round !== last.no ? ` (round ${d.round})` : ""}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={agreed ? "text-green-800 border-green-700" : undefined}
                        onClick={() => s.checker2Agree(d.key, !agreed)}
                      >
                        {agreed ? "Agreed ✓" : "Agree"}
                      </Button>
                      <Button variant="outline" size="sm" disabled title="Not built in this prototype">
                        Disagree: real error
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 border rounded-lg p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-bold">Your decision</p>
          <p className="text-sm text-muted-foreground">
            Disagreeing with any item turns it into a real error and opens the send-back list.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button variant="outline" disabled title="Not built in this prototype">
            Send back to designer
          </Button>
          <Button onClick={signOff}>Sign off and pass to approval</Button>
        </div>
      </div>
    </AppLayout>
  );
}
