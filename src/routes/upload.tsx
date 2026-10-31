import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { DropZone } from "@/components/app/DropZone";
import { EmptyState } from "@/components/app/EmptyState";
import { useAfterAction } from "@/components/app/useAfterAction";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/state/SessionProvider";

export const Route = createFileRoute("/upload")({
  component: UploadProof,
  head: () => ({
    meta: [
      { title: "Upload proof · Proof Check" },
      { name: "description", content: "Designer: upload a proof PDF for a round." },
      { property: "og:title", content: "Upload proof · Proof Check" },
      { property: "og:description", content: "Designer: upload a proof PDF for a round." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function UploadProof() {
  const s = useSession();
  const afterAction = useAfterAction();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();

  const request = s.session.request;
  if (!request) {
    return (
      <AppLayout role="designer">
        <EmptyState />
      </AppLayout>
    );
  }

  const current = s.session.current;
  const round1 = current === 1;

  const submit = async () => {
    const e = await s.uploadProof(file, note);
    if (e) setError(e);
    else afterAction();
  };

  return (
    <AppLayout role="designer">
      <div className="flex items-start justify-between">
        <h1 className="text-3xl font-bold">Upload proof</h1>
        <p className="text-sm text-muted-foreground">
          {request.product} · {request.piece} · {request.workId} · due {request.dueDate}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span>Round</span>
        <Select disabled value="latest">
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Round {current} (latest): your upload</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 flex gap-8 items-start">
        <div className="w-[440px] shrink-0 border rounded">
          <div className="border-b bg-muted/40 p-3 font-bold">
            {round1 ? "Requested changes" : `Requested changes from round ${current - 1} (${s.previousLines.length})`}
          </div>
          {round1 ? (
            <div className="p-3 text-sm">First round: nothing requested yet.</div>
          ) : (
            <>
              <div className="divide-y">
                {s.previousLines.map((l) => (
                  <div key={l.code} className="p-3 flex gap-3">
                    <span className="w-6 text-sm font-bold">{l.n}</span>
                    <div className="min-w-0">
                      <p className="text-sm">{l.text}</p>
                      {l.where ? <p className="text-xs text-muted-foreground mt-1">{l.where}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 text-xs text-muted-foreground border-t">
                Replying to a request is planned for the next version.
              </div>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="border rounded p-4">
            <h2 className="font-bold">Materials</h2>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" size="sm" disabled title="Not built in this prototype">
                Spec (Excel), version {request.spec.meta.version}
              </Button>
              {!round1 && (
                <Button variant="outline" size="sm" disabled title="Not built in this prototype">
                  Your round {current - 1} proof
                </Button>
              )}
            </div>
          </div>

          <DropZone
            accept=".pdf"
            title="Proof PDF *"
            line="Drop the file here or browse"
            hint="Use proof_v1.pdf for round 1, proof_v2.pdf for round 2, proof_v3.pdf for round 3 (from the demo files)."
            onFile={(f) => {
              setFile(f);
              setError(undefined);
            }}
            status={file ? <span>{file.name}</span> : null}
          />

          <div>
            <p className="text-sm font-bold">Note for the reviewers</p>
            <Textarea
              className="mt-1"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional, for example: Swapped the side panels to fit the barcode."
            />
          </div>

          <div className="border bg-muted/30 rounded p-3 text-sm text-muted-foreground">
            After you submit, the file is checked automatically and opens for review.
          </div>

          <div className="flex items-center gap-3">
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button disabled={!file || s.busy} onClick={submit}>
              {s.busy ? "Checking…" : "Submit proof for review"}
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
