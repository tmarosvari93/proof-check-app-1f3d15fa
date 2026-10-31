import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/state/SessionProvider";
import { sourceOf } from "@/state/format";
import { EmptyState } from "@/components/app/EmptyState";
import { AutoTextarea } from "@/components/app/AutoTextarea";
import { useAfterAction } from "@/components/app/useAfterAction";

export const Route = createFileRoute("/send-back")({
  head: () => ({
    meta: [
      { title: "Proof Check — Send-back list" },
      { name: "description", content: "The numbered Hungarian comment list sent back to the designer." },
      { property: "og:title", content: "Proof Check — Send-back list" },
      { property: "og:description", content: "The numbered Hungarian comment list sent back to the designer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SendBack,
});

function SendBack() {
  const s = useSession();
  const { error, run } = useAfterAction();
  const [adding, setAdding] = useState(false);
  const [newLine, setNewLine] = useState("");
  const [addError, setAddError] = useState<string | undefined>();
  const round = s.round;
  const req = s.session.request;

  if (!round || !round.finished || !req) return <EmptyState />;

  const empty = round.sendBack.length === 0;

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Send back to designer: round {round.no}</h1>
        <p className="text-sm text-neutral-600">
          {req.product} · {req.piece} · {req.workId}
        </p>
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        One numbered list in Hungarian, built from confirmed findings, comments not done and rejected changes. Edit or
        remove lines before sending. The designer sees only this list.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-6">
        <div className="col-span-2 rounded-md border border-neutral-300">
          <div className="flex items-baseline justify-between border-b border-neutral-300 bg-neutral-50 px-3 py-2">
            <p className="text-sm font-semibold">Requested changes ({round.sendBack.length})</p>
            <p className="text-sm text-neutral-500">Language: Hungarian</p>
          </div>
          {round.sendBack.map((it, i) => (
            <div key={it.code} className="flex items-start gap-3 border-b border-neutral-200 px-3 py-2">
              <span className="pt-2 font-bold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <AutoTextarea value={it.text} onCommit={(text) => s.editSendBack([{ code: it.code, text }])} />
                <p className="mt-1 text-sm text-neutral-500">{sourceOf(it.code)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => s.editSendBack([{ code: it.code, remove: true }])}>
                Remove
              </Button>
            </div>
          ))}
          <div className="px-3 py-2">
            {!adding ? (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                + Add a line
              </Button>
            ) : (
              <div>
                <Textarea value={newLine} onChange={(e) => setNewLine(e.target.value)} />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    const e = s.addManualLine(newLine);
                    if (e) {
                      setAddError(e);
                    } else {
                      setAdding(false);
                      setNewLine("");
                      setAddError(undefined);
                    }
                  }}
                >
                  Add
                </Button>
                {addError && <p className="mt-1 text-sm text-red-700">{addError}</p>}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-md border border-neutral-300 p-3 text-sm">
            <p className="font-semibold">Goes to</p>
            <p className="mt-1">{req.designer}</p>
            <p className="mt-1 text-neutral-600">The round {round.no + 1} upload page opens with this list.</p>
          </div>
          <div className="mt-4 rounded-md border border-dashed border-neutral-400 p-3 text-sm text-neutral-600">
            Not included: automatic findings you rejected, notes, and anything marked "not an error".
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-start justify-end gap-3">
        <div>
          <Button variant="outline" onClick={() => run(() => s.backToReview())}>
            Back to review
          </Button>
          <p className="mt-1 text-xs text-neutral-500">Finishing the review again rebuilds this list.</p>
        </div>
        <Button disabled={empty} onClick={() => run(() => s.sendToDesigner())}>
          Send to designer
        </Button>
        {empty && <span className="pt-2 text-sm text-red-700">The send-back list is empty</span>}
        {error && <span className="pt-2 text-sm text-red-700">{error}</span>}
      </div>
    </div>
  );
}
