import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { AutoTextarea } from "@/components/app/AutoTextarea";
import { EmptyState } from "@/components/app/EmptyState";
import { useAfterAction } from "@/components/app/useAfterAction";
import { Button } from "@/components/ui/button";
import { sourceOf } from "@/state/format";
import { useSession } from "@/state/SessionProvider";
import type { SendBackItem } from "@/state/types";

export const Route = createFileRoute("/send-back")({
  component: SendBack,
  head: () => ({
    meta: [
      { title: "Send-back list · Proof Check" },
      { name: "description", content: "Checker 1: edit and send the numbered Hungarian list to the designer." },
      { property: "og:title", content: "Send-back list · Proof Check" },
      { property: "og:description", content: "Checker 1: edit and send the numbered Hungarian list to the designer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SendBackRow({ item, n, onError }: { item: SendBackItem; n: number; onError: (e: string) => void }) {
  const s = useSession();
  const [text, setText] = useState(item.text);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(item.text);
  }, [item.text]);

  return (
    <div className="p-3 flex items-start gap-3">
      <span className="w-6 text-sm font-bold">{n}</span>
      <div className="flex-1 min-w-0">
        <AutoTextarea
          value={text}
          rows={1}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false;
            if (text !== item.text) {
              const e = s.editSendBack([{ code: item.code, text }]);
              if (e) onError(e);
            }
          }}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">{sourceOf(item.code)}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const e = s.editSendBack([{ code: item.code, remove: true }]);
          if (e) onError(e);
        }}
      >
        Remove
      </Button>
    </div>
  );
}

function SendBack() {
  const s = useSession();
  const afterAction = useAfterAction();
  const [error, setError] = useState<string | undefined>();
  const [addError, setAddError] = useState<string | undefined>();
  const [showAdd, setShowAdd] = useState(false);
  const [addText, setAddText] = useState("");

  const round = s.round;
  if (!round || !round.finished) {
    return (
      <AppLayout role="checker1">
        <EmptyState />
      </AppLayout>
    );
  }

  const request = s.session.request!;

  const add = () => {
    const e = s.addManualLine(addText);
    if (e) setAddError(e);
    else {
      setShowAdd(false);
      setAddText("");
    }
  };

  return (
    <AppLayout role="checker1">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">Send back to designer: round {round.no}</h1>
        <p className="text-sm text-muted-foreground">
          {request.product} · {request.piece} · {request.workId}
        </p>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        One numbered list in Hungarian, built from confirmed findings, comments not done and rejected changes. Edit or remove
        lines before sending. The designer sees only this list.
      </p>

      <div className="mt-4 flex gap-8 items-start">
        <div className="flex-1 min-w-0 border rounded">
          <div className="border-b bg-muted/40 p-3 flex items-center justify-between">
            <span className="font-bold">Requested changes ({round.sendBack.length})</span>
            <span className="text-sm text-muted-foreground">Language: Hungarian</span>
          </div>
          <div className="divide-y">
            {round.sendBack.map((it, i) => (
              <SendBackRow key={it.code} item={it} n={i + 1} onError={setError} />
            ))}
          </div>
          {showAdd ? (
            <div className="p-3 border-t">
              <AutoTextarea
                value={addText}
                rows={1}
                onChange={(e) => setAddText(e.target.value)}
                placeholder="Write the line in Hungarian"
              />
              {addError && <p className="text-sm text-red-700 mt-1">{addError}</p>}
              <Button size="sm" className="mt-2" onClick={add}>
                Add
              </Button>
            </div>
          ) : (
            <div className="p-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAdd(true);
                  setAddError(undefined);
                }}
              >
                + Add a line
              </Button>
            </div>
          )}
        </div>

        <div className="w-[320px] shrink-0 space-y-4">
          <div className="border rounded p-4">
            <h2 className="font-bold">Goes to</h2>
            <p className="text-sm mt-1">{request.designer}</p>
            <p className="text-sm text-muted-foreground mt-1">
              The round {round.no + 1} upload page opens with this list.
            </p>
          </div>
          <div className="border border-dashed rounded p-4 text-sm text-muted-foreground">
            Not included: automatic findings you rejected, notes, and anything marked {"\"not an error\""}.
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-end gap-1">
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {round.sendBack.length === 0 && <p className="text-sm text-red-700">The send-back list is empty</p>}
          <Button
            variant="outline"
            onClick={() => {
              const e = s.backToReview();
              if (e) setError(e);
              else afterAction();
            }}
          >
            Back to review
          </Button>
          <Button
            disabled={round.sendBack.length === 0}
            onClick={() => {
              const e = s.sendToDesigner();
              if (e) setError(e);
              else afterAction();
            }}
          >
            Send to designer
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Finishing the review again rebuilds this list.</p>
      </div>
    </AppLayout>
  );
}
