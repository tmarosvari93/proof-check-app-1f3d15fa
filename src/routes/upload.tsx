import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/state/SessionProvider";
import { DropZone } from "@/components/app/DropZone";
import { EmptyState } from "@/components/app/EmptyState";
import { useAfterAction } from "@/components/app/useAfterAction";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Proof Check — Upload proof" },
      { name: "description", content: "The designer uploads the proof PDF for the current round." },
      { property: "og:title", content: "Proof Check — Upload proof" },
      { property: "og:description", content: "The designer uploads the proof PDF for the current round." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadProof,
});

function UploadProof() {
  const s = useSession();
  const { error, run } = useAfterAction("/my-tasks");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const req = s.session.request;

  if (!req) return <EmptyState />;

  const current = s.session.current;
  const round2plus = current >= 2;

  const onFile = (f: File | null) => {
    setFileError(undefined);
    setFile(f);
    if (f && !f.name.toLowerCase().endsWith(".pdf")) setFileError("This file is not a PDF");
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Upload proof</h1>
        <p className="text-sm text-neutral-600">
          {req.product} · {req.piece} · {req.workId} · due {req.dueDate}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span>Round</span>
        <select disabled className="rounded-md border border-input bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          <option>Round {current} (latest): your upload</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <div className="rounded-md border border-neutral-300">
          <p className="border-b border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-semibold">
            {round2plus
              ? `Requested changes from round ${current - 1} (${s.previousLines.length})`
              : "Requested changes"}
          </p>
          {round2plus ? (
            s.previousLines.map((l) => (
              <div key={l.code} className="flex gap-3 border-b border-neutral-200 px-3 py-2">
                <span className="font-bold">{l.n}</span>
                <div>
                  <p className="text-sm">{l.text}</p>
                  {l.where && <p className="text-sm text-neutral-500">{l.where}</p>}
                </div>
              </div>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-neutral-600">First round: nothing requested yet.</p>
          )}
          <p className="border-t border-neutral-200 px-3 py-2 text-sm text-neutral-500">
            Replying to a request is planned for the next version.
          </p>
        </div>

        <div className="space-y-4">
          {req.notes.trim() !== "" && (
            <div className="rounded-md border border-neutral-300 bg-neutral-100 p-3">
              <p className="text-sm font-semibold">Comments from the requester</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{req.notes}</p>
            </div>
          )}
          <div className="rounded-md border border-neutral-300 p-3">
            <p className="text-sm font-semibold">Materials</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                title="Not built in this prototype"
                className="cursor-not-allowed rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-400"
              >
                Spec (Excel), version {req.spec.meta.version}
              </span>
              {round2plus && (
                <span
                  title="Not built in this prototype"
                  className="cursor-not-allowed rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-400"
                >
                  Your round {current - 1} proof
                </span>
              )}
            </div>
          </div>

          <DropZone
            label="Proof PDF *"
            accept=".pdf"
            hint="Use proof_v1.pdf for round 1, proof_v2.pdf for round 2, proof_v3.pdf for round 3 (from the demo files)."
            error={fileError}
            chosenName={file?.name}
            onFile={onFile}
          />

          <div>
            <label className="text-sm font-semibold">Note for the reviewers</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional, for example: Swapped the side panels to fit the barcode."
            />
          </div>

          <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-3 text-sm text-neutral-700">
            After you submit, the file is checked automatically and opens for review.
          </div>

          <div className="flex items-center gap-2">
            <Button disabled={!file || s.busy} onClick={() => run(() => s.uploadProof(file, note))}>
              {s.busy ? "Checking…" : "Submit proof for review"}
            </Button>
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
