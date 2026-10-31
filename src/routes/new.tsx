import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { DropZone } from "@/components/app/DropZone";
import { useAfterAction } from "@/components/app/useAfterAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { demoRequestFields } from "@/state/demo";
import { useSession } from "@/state/SessionProvider";

export const Route = createFileRoute("/new")({
  component: NewRequest,
  head: () => ({
    meta: [
      { title: "New request · Proof Check" },
      { name: "description", content: "Create a proof check request by uploading the spec Excel." },
      { property: "og:title", content: "New request · Proof Check" },
      { property: "og:description", content: "Create a proof check request by uploading the spec Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function NewRequest() {
  const s = useSession();
  const afterAction = useAfterAction();
  const [specFile, setSpecFile] = useState<{ name: string; error?: string } | null>(null);
  const [showFields, setShowFields] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const requestExists = !!s.session.request;
  const pending = s.session.pendingSpec;
  const disabled = requestExists;

  const onFile = async (f: File) => {
    const e = await s.loadSpec(f);
    setSpecFile({ name: f.name, ...(e ? { error: e } : {}) });
  };

  const create = () => {
    const e = s.createRequest();
    if (e) setError(e);
    else afterAction();
  };

  const meta = pending?.meta;

  return (
    <AppLayout role="requester">
      <h1 className="text-3xl font-bold">New request</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Creates round 1 for the designer. In this prototype only the spec Excel is read for real; the other fields are fixed
        demo values.
      </p>

      {requestExists && (
        <p className="mt-3 text-sm">
          A request is already open: {s.session.request!.workId}. Start over from Home to create a new one.
        </p>
      )}

      <div className="mt-4 flex gap-8 items-start">
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-bold">Product * (from the spec Excel)</p>
              <Select disabled value={pending ? "read" : "none"}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Upload the spec Excel first</SelectItem>
                  <SelectItem value="read">
                    Read from spec: {demoRequestFields.product} ({demoRequestFields.productCode})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-bold">Packaging piece *</p>
              <Select disabled value={demoRequestFields.piece}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={demoRequestFields.piece}>{demoRequestFields.piece}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-bold">Work ID</p>
            <Input disabled className="mt-1 w-72" value={`${demoRequestFields.workId} (automatic)`} />
          </div>

          <fieldset className="mt-4 border rounded p-4" disabled={disabled}>
            <legend className="px-1 text-sm font-bold">Requested by *</legend>
            <div className="flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" disabled checked={demoRequestFields.requestedBy !== "Partner"} readOnly /> Own graphics
                team
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" disabled checked={demoRequestFields.requestedBy === "Partner"} readOnly /> Partner
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <p className="text-sm">Partner</p>
                <Select disabled value={demoRequestFields.partner}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={demoRequestFields.partner}>{demoRequestFields.partner}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm">Project owner (relay)</p>
                <Select disabled value={demoRequestFields.projectOwner}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={demoRequestFields.projectOwner}>{demoRequestFields.projectOwner}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm font-bold">Assign to designer *</p>
              <Select disabled value={demoRequestFields.designer}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={demoRequestFields.designer}>{demoRequestFields.designer}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm font-bold">Proof due (optional)</p>
              <Input disabled className="mt-1" value={demoRequestFields.dueDate} />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-bold">Notes for the designer</p>
            <Textarea readOnly className="mt-1" value={demoRequestFields.notes} rows={3} />
          </div>

          <div className="mt-6">
            <DropZone
              accept=".xlsx"
              title="Spec Excel *"
              line="Drop the .xlsx here or browse"
              disabled={disabled}
              onFile={onFile}
              status={
                s.busy ? (
                  <span>Reading the spec…</span>
                ) : specFile?.error ? (
                  <span className="text-red-700">{specFile.error}</span>
                ) : specFile && pending ? (
                  <span>
                    {specFile.name} · uploaded
                  </span>
                ) : null
              }
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            {error && <p className="text-sm text-red-700">{error}</p>}
            <Button disabled={!pending || disabled} onClick={create}>
              Create request
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Cancel</Link>
            </Button>
          </div>
        </div>

        <div className="w-[380px] shrink-0 space-y-4">
          {pending && meta ? (
            <div className="border rounded">
              <div className="border-b bg-muted/40 p-3 font-bold">Spec read: {pending.fields.length} blue fields</div>
              <div className="p-3 text-sm">
                {meta.specNumber} · version {meta.version} · valid from {meta.validFrom}
              </div>
              <div className="p-3 border-t">
                <button type="button" className="underline text-sm" onClick={() => setShowFields(!showFields)}>
                  {showFields ? `Hide the ${pending.fields.length} fields` : `Show the ${pending.fields.length} fields`}
                </button>
                {showFields && (
                  <table className="mt-2 w-full text-sm border">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-1">Field</th>
                        <th className="text-left p-1">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.fields.map((f) => (
                        <tr key={f.id} className="border-b last:border-b-0">
                          <td className="p-1 align-top">{f.label}</td>
                          <td className="p-1 align-top">{f.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="border rounded">
              <div className="border-b bg-muted/40 p-3 font-bold">Spec read: nothing yet</div>
              <div className="p-3 text-sm">Upload the spec Excel to see its mandatory (blue) fields.</div>
            </div>
          )}

          <div className="border border-dashed rounded p-4">
            <h2 className="font-bold">What happens next</h2>
            <p className="text-sm mt-1">
              Round 1 is created for this piece. The designer sees {"\"Upload proof\""} on their board.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
