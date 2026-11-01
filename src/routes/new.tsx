import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/state/SessionProvider";
import { demoRequestFields as f } from "@/state/demo";
import { DropZone } from "@/components/app/DropZone";
import { useAfterAction } from "@/components/app/useAfterAction";
import { SpecFileRow } from "@/components/app/FilesRow";

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

function StepHeading({ n, title, muted }: { n: number; title: string; muted?: boolean }) {
  return <h2 className={`text-lg font-semibold ${muted ? "text-neutral-400" : ""}`}>{n}. {title}</h2>;
}

function NewRequest() {
  const s = useSession();
  const { error, run } = useAfterAction("/upload");
  const [specError, setSpecError] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();
  const [checked, setChecked] = useState(false);
  const [comments, setComments] = useState(f.notes);
  const spec = s.session.pendingSpec;
  const alreadyOpen = !!s.session.request;
  const step3 = !!spec && checked && !alreadyOpen;

  const onSpec = async (file: File | null) => {
    setSpecError(undefined);
    setChecked(false);
    setFileName(file?.name);
    const e = await s.loadSpec(file);
    if (e) setSpecError(e);
  };

  const m = spec?.meta;
  const metaLine = m
    ? [
        m.specNumber ? `Spec ${m.specNumber}` : null,
        m.version ? `version ${m.version}` : null,
        m.validFrom ? `valid from ${m.validFrom}` : null,
        m.erpCode ? `ERP code ${m.erpCode}` : null,
        m.packagingCode ? `packaging code ${m.packagingCode}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const fixed: [string, string][] = [
    ["Product", `${f.product} (${f.productCode})`],
    ["Packaging piece", f.piece],
    ["Work ID", `${f.workId} (automatic)`],
    ["Requested by", f.requestedBy],
    ["Partner", f.partner],
    ["Project owner (relay)", f.projectOwner],
    ["Assign to designer", f.designer],
    ["Proof due", f.dueDate],
  ];

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold">New request</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Creates round 1 for the designer. Upload the spec first: the product is read from it.
      </p>

      {alreadyOpen && (
        <p className="mt-3 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
          A request is already open: {s.session.request!.workId}. Start over from Home to create a new one.
        </p>
      )}

      <fieldset disabled={alreadyOpen} className="mt-4 grid grid-cols-3 gap-6 disabled:opacity-60">
        <div className="col-span-2 space-y-8">
          <section className="space-y-2">
            <StepHeading n={1} title="Upload the spec Excel" />
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
          </section>

          <section className="space-y-3">
            <StepHeading n={2} title="Check what was read" muted={!spec} />
            {!spec ? (
              <p className="rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
                Upload the spec Excel to see its mandatory (blue) fields.
              </p>
            ) : (
              <>
                {metaLine && <p className="text-sm">{metaLine}</p>}
                <SpecFileRow file={s.session.pendingSpecFile} />
                <p className="text-sm">
                  Name on the label (from the spec): <span className="font-semibold">{spec.meta.productName}</span>
                </p>
                <div className="rounded-md border border-neutral-300">
                  <p className="border-b border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-semibold">
                    {spec.fields.length} blue fields read
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-neutral-500">
                        <th className="px-3 py-1 font-medium">Field</th>
                        <th className="px-3 py-1 font-medium">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spec.fields.map((fld) => (
                        <tr key={fld.id} className="border-t border-neutral-200 align-top">
                          <td className="px-3 py-1 font-semibold">{fld.label}</td>
                          <td className="px-3 py-1">{fld.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-neutral-500">
                  No editing and no override in this prototype: if the Excel was read wrongly, fix the Excel and upload it again.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
                  I have checked these values against the signed spec
                </label>
              </>
            )}
          </section>

          <section className="space-y-3">
            <StepHeading n={3} title="Request details" muted={!step3} />
            {!step3 ? (
              <p className="text-sm text-neutral-500">Upload and check the spec first</p>
            ) : (
              <>
                <div className="rounded-md border border-neutral-300 bg-neutral-50 p-4">
                  <p className="text-sm font-semibold">Fixed demo values</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
                    {fixed.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-neutral-600">{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <label htmlFor="comments" className="text-sm font-semibold">
                    Comments for the designer (they see these on the Upload proof page)
                  </label>
                  <Textarea id="comments" value={comments} onChange={(e) => setComments(e.target.value)} className="mt-1" />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <Button disabled={!step3} onClick={() => run(() => s.createRequest(comments))}>
                Create request
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Cancel</Link>
              </Button>
              {error && <span className="text-sm text-red-700">{error}</span>}
            </div>
          </section>
        </div>

        <div>
          <div className="rounded-md border border-dashed border-neutral-400 bg-neutral-50 p-3 text-sm text-neutral-700">
            <p className="font-semibold">What happens next</p>
            <p className="mt-1">Round 1 is created for this piece. The designer sees "Upload proof" on their board.</p>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
