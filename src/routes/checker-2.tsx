import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useSession } from "@/state/SessionProvider";
import { people } from "@/state/demo";
import { ProofPlaceholder } from "@/components/app/ProofPlaceholder";
import { EmptyState } from "@/components/app/EmptyState";
import { useAfterAction } from "@/components/app/useAfterAction";
import { SkippedOpenNote } from "@/components/app/SkippedOpenNote";
import { WarningsBox } from "@/components/app/WarningsBox";
import { FilesRow } from "@/components/app/FilesRow";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export const Route = createFileRoute("/checker-2")({
  head: () => ({
    meta: [
      { title: "Proof Check — Checker 2" },
      { name: "description", content: "Second pair of eyes: confirm what Checker 1 dismissed." },
      { property: "og:title", content: "Proof Check — Checker 2" },
      { property: "og:description", content: "Second pair of eyes: confirm what Checker 1 dismissed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Checker2,
});

function Checker2() {
  const s = useSession();
  const { error, run } = useAfterAction();
  const send = useAfterAction("/upload");
  const [text, setText] = useState("");
  const [addError, setAddError] = useState<string | undefined>();
  const last = s.session.rounds[s.session.rounds.length - 1];
  const req = s.session.request;

  if (!last || !last.finished || !req) return <EmptyState />;

  const lines = last.lineChecks ?? [];
  const done = lines.filter((l) => l.verdict === "done").length;
  const requestsText = lines.length ? `${done} of ${lines.length} requests are done` : "no earlier requests";

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">
          {req.product} · {req.piece}
        </h1>
        <p className="text-sm text-neutral-600">
          {req.workId} · Round {last.no} · 4-eye check
        </p>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        Upload › Automatic check › Checker 1 ({people.checker1}) ✓ › <strong>4-eye check (you)</strong> › Approval
      </p>
      <FilesRow specFile={req.specFile} proofFile={last.proofFile} />

      <div className="mt-3 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
        Checker 1 found <strong>no real errors</strong> in this round. Your job: confirm that what was dismissed is
        really fine. {last.matches} fields match, {requestsText}, {last.unrequested?.length ?? 0} unrequested changes.
      </div>

      <SkippedOpenNote codes={last.skippedOpen} />
      <WarningsBox warnings={last.warnings} />

      <div className="mt-4 grid grid-cols-2 gap-6">
        <ProofPlaceholder className="h-[24rem]" />

        <div className="rounded-md border border-neutral-300">
          <p className="border-b border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-semibold">
            Dismissed by Checker 1 ({s.dismissals.length})
          </p>
          {s.dismissals.length === 0 ? (
            <p className="px-3 py-2 text-sm text-neutral-600">Nothing was dismissed. Nothing to confirm.</p>
          ) : (
            s.dismissals.map((d) => {
              const agreed = !!s.session.checker2Agreed[d.key];
              return (
                <div key={d.key} className="border-b border-neutral-200 px-3 py-3 last:border-b-0">
                  <p className="text-sm">
                    <strong>
                      {d.code} · {d.label}
                    </strong>
                  </p>
                  <p className="text-sm text-neutral-700">{d.summary}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {people.checker1}: not an error. Reason: {d.reason}.
                    {d.round !== last.no ? ` (round ${d.round})` : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => s.checker2Agree(d.key, !agreed)}>
                      {agreed ? <span className="font-semibold text-green-700">Agreed ✓</span> : "Agree"}
                    </Button>
                    <Button size="sm" variant="outline" disabled title="Not built in this prototype">
                      Disagree: real error
                    </Button>
                  </div>
                </div>
              );
            })
          )}
          <div className="border-t border-neutral-300 px-3 py-3">
            <p className="text-sm font-semibold">Your comments for the designer ({last.sendBack.length})</p>
            <Textarea className="mt-2" value={text} onChange={(e) => setText(e.target.value)} />
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                const e = s.addManualLine(text);
                setAddError(e);
                if (!e) setText("");
              }}
            >
              Add comment
            </Button>
            {addError && <p className="mt-1 text-sm text-red-700">{addError}</p>}
            {last.sendBack.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {last.sendBack.map((l) => (
                  <li key={l.code}>
                    <strong>{l.code}</strong> {l.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-md border border-neutral-400 px-4 py-3">
        <div className="text-sm">
          <p className="font-semibold">Your decision</p>
          <p className="text-neutral-600">
            Add a comment and send back, or sign off to pass to approval.
          </p>
          {error && <p className="text-red-700">{error}</p>}
          {send.error && <p className="text-red-700">{send.error}</p>}
          {last.sendBack.length > 0 && (
            <p className="text-amber-700">
              You added {last.sendBack.length} comment{last.sendBack.length === 1 ? "" : "s"}. Signing off will not
              send them. Send back to designer to use them.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={last.sendBack.length === 0}
            title={last.sendBack.length === 0 ? "Add a comment first" : undefined}
            onClick={() => send.run(() => s.sendToDesigner())}
          >
            Send back to designer
          </Button>
          <Button onClick={() => run(() => s.checker2SignOff())}>Sign off and pass to approval</Button>
        </div>
      </div>
    </div>
  );
}
