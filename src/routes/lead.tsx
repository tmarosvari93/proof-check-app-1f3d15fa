import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/state/SessionProvider";
import { people } from "@/state/demo";
import { daysBetween, formatTime } from "@/state/format";
import { ProofPlaceholder } from "@/components/app/ProofPlaceholder";
import { EmptyState } from "@/components/app/EmptyState";
import { StartOver } from "@/components/app/StartOver";
import { useAfterAction } from "@/components/app/useAfterAction";

export const Route = createFileRoute("/lead")({
  head: () => ({
    meta: [
      { title: "Proof Check — Lead approval" },
      { name: "description", content: "The food-safety lead gives the final approval." },
      { property: "og:title", content: "Proof Check — Lead approval" },
      { property: "og:description", content: "The food-safety lead gives the final approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lead,
});

function Lead() {
  const s = useSession();
  const { error, run } = useAfterAction();
  const last = s.session.rounds[s.session.rounds.length - 1];
  const req = s.session.request;

  if (!last || !last.finished || !req) return <EmptyState />;

  const approved = s.session.approved;

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">
          Final approval: {req.product} · {req.piece}
        </h1>
        <p className="text-sm text-neutral-600">
          {req.workId} · Round {last.no} · {s.session.checker2SignedOff ? "both checkers signed" : "Checker 1 signed"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <ProofPlaceholder className="h-[24rem]" note={`Final proof (v${last.no}). None open.`} />

        <div className="space-y-4">
          <div className="rounded-md border border-neutral-300">
            <p className="border-b border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-semibold">Summary</p>
            <div className="space-y-1 px-3 py-2 text-sm">
              <p>
                {last.matches} of {req.spec.fields.length} spec fields match · {last.findings.length} open findings
              </p>
              <p>
                Checker 1: {people.checker1}, {formatTime(last.finishedAt)} · Checker 2: {people.checker2},{" "}
                {formatTime(s.session.checker2SignedAt)}
              </p>
              <p>
                Rounds: {s.session.rounds.length} · days from request to now: {daysBetween(req.createdAt)}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-neutral-300">
            <p className="border-b border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-semibold">
              Dismissed by the checkers ({s.dismissals.length})
            </p>
            <div className="px-3 py-2 text-sm">
              {s.dismissals.length === 0 ? (
                <p>None.</p>
              ) : (
                s.dismissals.map((d) => (
                  <p key={d.key} className="py-0.5">
                    <strong>
                      {d.code} · {d.label}
                    </strong>
                    : not an error, {d.reason} ({people.checker1}, agreed by {people.checker2})
                  </p>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {approved ? (
        <div className="mt-6 rounded-md border border-green-300 bg-green-50 px-4 py-3">
          <p className="text-sm">
            <strong>Approved</strong> at {formatTime(s.session.approvedAt)}. Request {req.workId} is closed. The print
            file stage is planned for the next version.
          </p>
          <div className="mt-3">
            <StartOver />
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4">
            <label className="text-sm font-semibold">Note (required when sending back)</label>
            <Textarea disabled title="Not built in this prototype" />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" disabled title="Not built in this prototype">
              Send back with a reason
            </Button>
            <Button onClick={() => run(() => s.approve())}>Approve</Button>
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
          <p className="mt-4 text-sm text-neutral-500">
            Approving closes the request. The requester sees it as approved in My tasks, with the approved proof to
            download. The print file stage is planned for the next version.
          </p>
        </>
      )}
    </div>
  );
}
