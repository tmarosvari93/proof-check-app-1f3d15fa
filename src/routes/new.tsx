import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/state/SessionProvider";
import { demoRequestFields as f } from "@/state/demo";
import { DropZone } from "@/components/app/DropZone";
import { useAfterAction } from "@/components/app/useAfterAction";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "Proof Check — New request" },
      { name: "description", content: "Start a proof check request by uploading the spec Excel." },
      { property: "og:title", content: "Proof Check — New request" },
      { property: "og:description", content: "Start a proof check request by uploading the spec Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewRequest,
});

const disabledSelect =
  "w-full rounded-md border border-input bg-neutral-100 px-3 py-2 text-sm text-neutral-700";

function NewRequest() {
  const s = useSession();
  const { error, run } = useAfterAction();
  const [specError, setSpecError] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [showFields, setShowFields] = useState(false);
  const spec = s.session.pendingSpec;
  const alreadyOpen = !!s.session.request;

  const onSpec = async (file: File | null) => {
    setSpecError(undefined);
    setFileName(file?.name);
    const e = await s.loadSpec(file);
    if (e) setSpecError(e);
  };

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold">New request</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Creates round 1 for the designer. In this prototype only the spec Excel is read for real;
        the other fields are fixed demo values.
      </p>

      {alreadyOpen && (
        <p className="mt-3 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
          A request is already open: {s.session.request!.workId}. Start over from Home to create a
          new one.
        </p>
      )}

      <fieldset disabled={alreadyOpen} className="mt-4 grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold">
                Product * <span className="font-normal text-neutral-500">(from the spec Excel)</span>
              </label>
              <select disabled className={disabledSelect}>
                <option>
                  {spec ? `Read from spec: ${f.product} (${f.productCode})` : "Upload the spec Excel first"}
                </option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Packaging piece *</label>
              <select disabled className={disabledSelect}>
                <option>{f.piece}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold">Work ID</label>
            <Input disabled value={`${f.workId} (automatic)`} className="bg-neutral-100" readOnly />
          </div>
          <div className="rounded-md border border-neutral-300 p-4">
            <p className="text-sm font-semibold">Requested by *</p>
            <div className="mt-2 flex gap-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" disabled checked={f.requestedBy === "Own graphics team"} readOnly /> Own graphics
                team
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" disabled checked={f.requestedBy === "Partner"} readOnly /> Partner
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-neutral-600">Partner</label>
                <select disabled className={disabledSelect}>
                  <option>{f.partner}</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-neutral-600">Project owner (relay)</label>
                <select disabled className={disabledSelect}>
                  <option>{f.projectOwner}</option>
                </select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold">
                Assign to designer *{" "}
                <span className="font-normal text-neutral-500">(filled from Requested by, change if needed)</span>
              </label>
              <select disabled className={disabledSelect}>
                <option>{f.designer}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold">Proof due (optional)</label>
              <Input disabled value={f.dueDate} className="bg-neutral-100" readOnly />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold">Notes for the designer</label>
            <Textarea readOnly value={f.notes} className="bg-neutral-100" />
          </div>
          <DropZone
            label="Spec Excel *"
            accept=".xlsx"
            hint="Drop the .xlsx here or browse"
            busy={s.busy}
            busyText="Reading the spec…"
            error={specError}
            chosenName={spec && fileName ? `${fileName} · uploaded` : undefined}
            onFile={(file) => void onSpec(file)}
          />
          <div className="flex items-center gap-2">
            <Button disabled={!spec} onClick={() => run(() => s.createRequest())}>
              Create request
            </Button>
            <Button variant="outline" asChild>
              <Link to="/">Cancel</Link>
            </Button>
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-neutral-300">
            <p className="border-b border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-semibold">
              {spec ? `Spec read: ${spec.fields.length} blue fields` : "Spec read: nothing yet"}
            </p>
            <div className="px-3 py-2 text-sm text-neutral-700">
              {spec ? (
                <>
                  <p>
                    {spec.meta.specNumber} · version {spec.meta.version} · valid from {spec.meta.validFrom}
                  </p>
                  <button className="mt-2 underline" onClick={() => setShowFields((v) => !v)}>
                    {showFields ? "Hide" : "Show"} the {spec.fields.length} fields
                  </button>
                  <span className="text-neutral-500"> (read-only; the check uses all of them)</span>
                  {showFields && (
                    <table className="mt-2 w-full text-xs">
                      <tbody>
                        {spec.fields.map((fld) => (
                          <tr key={fld.id} className="border-t border-neutral-200">
                            <td className="py-1 pr-2 font-semibold">{fld.label}</td>
                            <td className="py-1">{fld.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              ) : (
                <p>Upload the spec Excel to see its mandatory (blue) fields.</p>
              )}
            </div>
          </div>
          <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-3 text-sm text-neutral-700">
            <p className="font-semibold">What happens next</p>
            <p className="mt-1">
              Round 1 is created for this piece. The designer sees "Upload proof" on their board.
            </p>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
