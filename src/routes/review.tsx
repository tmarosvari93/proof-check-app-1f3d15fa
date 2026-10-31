import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/state/SessionProvider";
import { lineVerdictLabel, lowResolutionBanner, readBanner } from "@/state/labels";
import type { CheckFinding } from "@/state/types";
import { ProofPlaceholder } from "@/components/app/ProofPlaceholder";
import { EmptyState } from "@/components/app/EmptyState";
import { FindingRow } from "@/components/app/FindingRow";
import { DecisionButtons } from "@/components/app/DecisionButtons";
import { Chip } from "@/components/app/Chip";
import { useAfterAction } from "@/components/app/useAfterAction";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Proof Check — Review" },
      { name: "description", content: "Checker 1 decides every finding of the automatic check." },
      { property: "og:title", content: "Proof Check — Review" },
      { property: "og:description", content: "Checker 1 decides every finding of the automatic check." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Review,
});

function Review() {
  const s = useSession();
  const { error, run } = useAfterAction();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showMoved, setShowMoved] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const round = s.round;
  const req = s.session.request;

  if (!round || !req) return <EmptyState />;

  const resultOf = (f: CheckFinding) => round.results.find((r) => r.id === f.fieldId);
  const decisionOf = (code: string) => s.items.find((i) => i.code === code)?.decision ?? "open";
  const onDecided = (code: string) => {
    const rest = s.undecided.filter((i) => i.code !== code);
    setExpanded(rest[0]?.code ?? null);
  };

  const findingRow = (f: CheckFinding) => (
    <FindingRow
      key={f.code}
      finding={f}
      result={resultOf(f)}
      decision={decisionOf(f.code)}
      expanded={expanded === f.code}
      onToggle={() => setExpanded(expanded === f.code ? null : f.code)}
      onDecided={() => onDecided(f.code)}
    />
  );

  const matches = round.results.filter((r) => r.verdict === "match");
  const matchesList = (
    <div className="divide-y divide-neutral-200">
      {matches.map((m) => (
        <div key={m.id} className="px-3 py-2">
          <p className="text-sm font-bold">{m.label}</p>
          <p className="text-sm text-neutral-600">{m.foundValue}</p>
        </div>
      ))}
    </div>
  );

  const undecidedFindings = round.findings.filter((f) => s.undecided.some((i) => i.code === f.code));

  const lines = round.lineChecks ?? [];
  const done = lines.filter((l) => l.verdict === "done").length;
  const notDone = lines.length - done;
  const unreq = round.unrequested ?? [];
  const moved = (round.diff ?? []).filter((d) => d.type === "moved");

  const open = s.open;
  const byKind = (k: string) => s.undecided.filter((i) => i.kind === k).length;

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">
          {req.product} · {req.piece}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <span>Round</span>
          <select disabled className="rounded-md border border-input bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
            <option>Round {round.no} (latest)</option>
          </select>
        </div>
      </div>

      {round.no === 1 ? (
        <p className="mt-1 text-sm text-neutral-600">
          {req.workId} · requested by {req.requestedBy} (PO {req.projectOwner}) · spec {req.spec.meta.specNumber} v
          {req.spec.meta.version}
        </p>
      ) : (
        <p className="mt-1 text-sm text-neutral-600">
          Compared with round {round.no - 1} and its {lines.length} requests · spec {req.spec.meta.specNumber} v
          {req.spec.meta.version}, unchanged
          {round.designerNote ? ` · designer note: "${round.designerNote}"` : ""}
        </p>
      )}
      <p className="mt-1 text-sm text-neutral-600">
        Upload › Automatic check › <strong>Checker 1 (you)</strong> › Checker 2 › Approval
      </p>

      {round.readMode === "text_layer" && (
        <div className="mt-3 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
          <strong>Automatic check finished.</strong> {readBanner.text_layer} ({round.seconds} s)
        </div>
      )}
      {round.readMode === "ai" && (
        <>
          <div className="mt-3 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm">
            <strong>Automatic check finished.</strong> {readBanner.ai} Resolution: {round.dpi} dpi.
          </div>
          {(round.dpi ?? 100) < 100 && (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {lowResolutionBanner}
            </div>
          )}
        </>
      )}
      {round.readMode === "failed" && (
        <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {readBanner.failed}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-6">
        <ProofPlaceholder className="h-[28rem]" />

        <div className="rounded-md border border-neutral-300">
          {round.no === 1 ? (
            <Tabs defaultValue="undecided">
              <TabsList className="m-2">
                <TabsTrigger value="undecided">Undecided {s.undecided.length}</TabsTrigger>
                <TabsTrigger value="all">All {round.findings.length}</TabsTrigger>
                <TabsTrigger value="matches">Matches {round.matches}</TabsTrigger>
              </TabsList>
              <TabsContent value="undecided">
                {undecidedFindings.length ? (
                  undecidedFindings.map(findingRow)
                ) : (
                  <p className="px-3 py-2 text-sm text-neutral-600">No undecided findings.</p>
                )}
              </TabsContent>
              <TabsContent value="all">
                {round.findings.length ? (
                  round.findings.map(findingRow)
                ) : (
                  <p className="px-3 py-2 text-sm text-neutral-600">No findings. Every field matches the spec.</p>
                )}
              </TabsContent>
              <TabsContent value="matches">{matchesList}</TabsContent>
            </Tabs>
          ) : (
            <Tabs defaultValue="findings">
              <TabsList className="m-2">
                <TabsTrigger value="findings">Spec findings ({round.findings.length})</TabsTrigger>
                <TabsTrigger value="changes">Changes</TabsTrigger>
              </TabsList>
              <TabsContent value="findings">
                {round.findings.length ? (
                  round.findings.map(findingRow)
                ) : (
                  <p className="px-3 py-2 text-sm text-neutral-600">No findings. Every field matches the spec.</p>
                )}
                <div className="border-t border-neutral-200 px-3 py-2">
                  <button className="text-sm underline" onClick={() => setShowMatches((v) => !v)}>
                    Matches ({round.matches})
                  </button>
                  {showMatches && matchesList}
                </div>
              </TabsContent>
              <TabsContent value="changes">
                <div className="space-y-4 p-2">
                  <div>
                    <p className="rounded-t-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm">
                      <strong>
                        Round {round.no - 1} comments: {done} done, {notDone} not done
                      </strong>{" "}
                      · Done closes automatically.
                    </p>
                    <div className="divide-y divide-neutral-200 rounded-b-md border border-t-0 border-neutral-300">
                      {lines.map((l, i) => {
                        const code = `C${i + 1}`;
                        const item = s.items.find((it) => it.code === code);
                        return (
                          <div key={code} className="px-3 py-2">
                            <div className="flex items-start gap-2">
                              <Chip tone={l.verdict === "done" ? "green" : l.verdict === "not_done" ? "red" : "amber"}>
                                {lineVerdictLabel[l.verdict].toUpperCase()}
                              </Chip>
                              <p className="text-sm">
                                {i + 1}. {l.text}
                              </p>
                            </div>
                            {l.verdict !== "done" &&
                              (item?.linkedTo ? (
                                <p className="mt-1 text-sm text-neutral-500">
                                  Same problem as {item.linkedTo} in Spec findings: decide it there.
                                </p>
                              ) : (
                                <DecisionButtons
                                  code={code}
                                  decision={item?.decision ?? "open"}
                                  onDecided={() => onDecided(code)}
                                />
                              ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="rounded-t-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm">
                      <strong>Unrequested changes ({unreq.length})</strong> · nobody asked for these
                    </p>
                    <div className="divide-y divide-neutral-200 rounded-b-md border border-t-0 border-neutral-300">
                      {unreq.length === 0 && (
                        <p className="px-3 py-2 text-sm text-neutral-600">No changes outside the earlier comments.</p>
                      )}
                      {unreq.map((u) => {
                        const dec = decisionOf(u.code);
                        return (
                          <div key={u.code} className="px-3 py-2">
                            <p className="text-sm">
                              <strong>
                                {u.code}. {u.what}
                              </strong>
                              {u.where ? ` · ${u.where}` : ""}
                            </p>
                            <p className="mt-1 text-sm text-neutral-600">
                              Before: {u.change.before ?? `Not in round ${round.no - 1}`}
                            </p>
                            <p className="text-sm">
                              <strong>Now: {u.change.after}</strong>
                            </p>
                            {u.linkedTo ? (
                              <p className="mt-1 text-sm text-neutral-500">
                                Same change as spec finding {u.linkedTo}: decided there, listed once.
                              </p>
                            ) : (
                              <div className="mt-2 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    s.decide(u.code, "real_error");
                                    onDecided(u.code);
                                  }}
                                >
                                  Reject: add to send-back list
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    s.decide(u.code, "not_error");
                                    onDecided(u.code);
                                  }}
                                >
                                  Accept change
                                </Button>
                                {dec === "real_error" && <Chip tone="red">Rejected</Chip>}
                                {dec === "not_error" && <Chip tone="green">Accepted</Chip>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-sm text-neutral-600">
                    <strong>Moved only ({moved.length})</strong> · same text, other place, no action needed ·{" "}
                    <button className="underline" onClick={() => setShowMoved((v) => !v)}>
                      {showMoved ? "hide" : "show"}
                    </button>
                  </p>
                  {showMoved && (
                    <ul className="list-disc pl-5 text-sm text-neutral-600">
                      {moved.map((m) => (
                        <li key={m.id}>{m.before}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between rounded-md border border-neutral-400 px-4 py-3">
        <div className="text-sm">
          {open === 0 ? (
            <p>
              <strong>All decided.</strong>
            </p>
          ) : round.no === 1 ? (
            <p>
              <strong>{open} findings undecided:</strong> {s.undecided.map((i) => i.code).join(", ")}
            </p>
          ) : (
            <p>
              <strong>{open} items undecided:</strong> {byKind("finding")} spec findings, {byKind("line")} comments,{" "}
              {byKind("unrequested")} unrequested changes.
            </p>
          )}
          <p className="text-neutral-600">
            When all are decided: any real error means Send back to designer, none means pass to Checker 2.
          </p>
          {error && <p className="text-red-700">{error}</p>}
        </div>
        <Button disabled={open > 0} onClick={() => run(() => s.finishReview())}>
          Finish review
        </Button>
      </div>
    </div>
  );
}
