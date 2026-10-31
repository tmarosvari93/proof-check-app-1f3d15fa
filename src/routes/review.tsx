import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/app/AppLayout";
import { DecisionButtons } from "@/components/app/DecisionButtons";
import { EmptyState } from "@/components/app/EmptyState";
import { FindingRow } from "@/components/app/FindingRow";
import { ProofPlaceholder } from "@/components/app/ProofPlaceholder";
import { useAfterAction } from "@/components/app/useAfterAction";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Round } from "@/state/types";
import { lowResolutionBanner, lineVerdictLabel, readBanner, stepPath } from "@/state/labels";
import { useSession } from "@/state/SessionProvider";

export const Route = createFileRoute("/review")({
  component: Review,
  head: () => ({
    meta: [
      { title: "Review · Proof Check" },
      { name: "description", content: "Checker 1: decide every finding of the current round." },
      { property: "og:title", content: "Review · Proof Check" },
      { property: "og:description", content: "Checker 1: decide every finding of the current round." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const verdictChipClass: Record<string, string> = {
  done: "bg-green-700 text-white text-xs rounded px-2 py-0.5 shrink-0",
  not_done: "bg-red-700 text-white text-xs rounded px-2 py-0.5 shrink-0",
  check_by_hand: "bg-amber-600 text-white text-xs rounded px-2 py-0.5 shrink-0",
};

function MatchesList({ round }: { round: Round }) {
  return (
    <div className="border rounded divide-y">
      {round.results
        .filter((r) => r.verdict === "match")
        .map((r) => (
          <div key={r.id} className="p-3">
            <p className="text-sm font-bold">{r.label}</p>
            <p className="text-sm text-muted-foreground">{r.foundValue}</p>
          </div>
        ))}
    </div>
  );
}

interface PanelProps {
  round: Round;
  expanded: string | null;
  setExpanded: (code: string | null) => void;
  onReal: (code: string) => void;
  onNot: (code: string, reason: string) => void;
}

function FindingRows({ round, codes, expanded, setExpanded, onReal, onNot }: PanelProps & { codes: Set<string> }) {
  const shown = round.findings.filter((f) => codes.has(f.code));
  return (
    <div className="border rounded divide-y">
      {shown.map((f) => (
        <FindingRow
          key={f.code}
          finding={f}
          result={round.results.find((r) => r.id === f.fieldId)}
          decision={round.decisions[f.code] ?? "open"}
          expanded={expanded === f.code}
          onToggle={() => setExpanded(expanded === f.code ? null : f.code)}
          onRealError={onReal}
          onNotError={onNot}
        />
      ))}
      {round.findings.length === 0 && <div className="p-3 text-sm">No findings. Every field matches the spec.</div>}
    </div>
  );
}

function Round1Panel(props: PanelProps & { undecidedCodes: Set<string> }) {
  const { round, undecidedCodes, ...rest } = props;
  return (
    <Tabs defaultValue="undecided">
      <TabsList>
        <TabsTrigger value="undecided">Undecided {undecidedCodes.size}</TabsTrigger>
        <TabsTrigger value="all">All {round.findings.length}</TabsTrigger>
        <TabsTrigger value="matches">Matches {round.matches}</TabsTrigger>
      </TabsList>
      <TabsContent value="undecided">
        <FindingRows round={round} codes={undecidedCodes} {...rest} />
      </TabsContent>
      <TabsContent value="all">
        <FindingRows round={round} codes={new Set(round.findings.map((f) => f.code))} {...rest} />
      </TabsContent>
      <TabsContent value="matches">
        <MatchesList round={round} />
      </TabsContent>
    </Tabs>
  );
}

function Round2SpecPanel(props: PanelProps) {
  const { round, ...rest } = props;
  return (
    <div>
      <FindingRows round={round} codes={new Set(round.findings.map((f) => f.code))} {...rest} />
      <div className="mt-3">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <button type="button" className="underline text-sm">
              Matches ({round.matches})
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <MatchesList round={round} />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

function ChangesSection({ round, onReal, onNot }: Omit<PanelProps, "expanded" | "setExpanded">) {
  const [showMoved, setShowMoved] = useState(false);
  const items = useSession().items;
  const lc = round.lineChecks ?? [];
  const doneCount = lc.filter((l) => l.verdict === "done").length;
  const notDone = lc.length - doneCount;
  const moved = (round.diff ?? []).filter((d) => d.type === "moved");
  const unrequested = round.unrequested ?? [];

  return (
    <div className="space-y-4">
      {lc.length > 0 && (
        <div className="border rounded">
          <div className="border-b bg-muted/40 p-3 text-sm">
            <b>
              Round {round.no - 1} comments: {doneCount} done, {notDone} not done
            </b>{" "}
            · Done closes automatically.
          </div>
          <div className="divide-y">
            {lc.map((l, i) => {
              const code = `C${i + 1}`;
              const item = items.find((it) => it.code === code);
              return (
                <div key={code} className="p-3">
                  <div className="flex items-start gap-3">
                    <span className={verdictChipClass[l.verdict]}>{lineVerdictLabel[l.verdict].toUpperCase()}</span>
                    <p className="text-sm flex-1">{l.text}</p>
                  </div>
                  {l.verdict !== "done" && item && (
                    <div className="mt-2 pl-10">
                      {item.linkedTo ? (
                        <p className="text-sm text-muted-foreground">
                          Same problem as {item.linkedTo} in Spec findings: decide it there.
                        </p>
                      ) : (
                        <DecisionButtons code={code} decision={item.decision} onRealError={onReal} onNotError={onNot} />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="border rounded">
        <div className="border-b bg-muted/40 p-3 text-sm">
          <b>Unrequested changes ({unrequested.length})</b> · nobody asked for these
        </div>
        {unrequested.length === 0 ? (
          <div className="p-3 text-sm">No changes outside the earlier comments.</div>
        ) : (
          <div className="divide-y">
            {unrequested.map((u) => {
              const decision = round.decisions[u.code] ?? "open";
              return (
                <div key={u.code} className="p-3">
                  <p className="text-sm">
                    <b>
                      {u.code}. {u.what}
                    </b>
                    {u.where ? <span className="text-muted-foreground"> · {u.where}</span> : null}
                  </p>
                  <p className="text-sm mt-1">
                    <span className="text-muted-foreground">Before</span>{" "}
                    <b>{u.change.before ?? `Not in round ${round.no - 1}`}</b>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Now</span> <b>{u.change.after}</b>
                  </p>
                  {u.linkedTo ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      Same change as spec finding {u.linkedTo}: decided there, listed once.
                    </p>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => onReal(u.code)}>
                        Reject: add to send-back list
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onNot(u.code, "Change accepted")}>
                        Accept change
                      </Button>
                      {decision === "real_error" && (
                        <span className="border rounded px-2 py-0.5 text-xs">Rejected</span>
                      )}
                      {decision === "not_error" && (
                        <span className="border bg-muted rounded px-2 py-0.5 text-xs">Accepted</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border rounded p-3">
        <p className="text-sm">
          <b>Moved only ({moved.length})</b> · same text, other place, no action needed ·{" "}
          <button type="button" className="underline" onClick={() => setShowMoved(!showMoved)}>
            {showMoved ? "hide" : "show"}
          </button>
        </p>
        {showMoved && (
          <ul className="list-disc pl-6 text-sm mt-2">
            {moved.map((m) => (
              <li key={m.id}>{m.before}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Review() {
  const s = useSession();
  const afterAction = useAfterAction();
  const [error, setError] = useState<string | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const round = s.round;

  if (!round) {
    return (
      <AppLayout role="checker1">
        <EmptyState />
      </AppLayout>
    );
  }

  const request = s.session.request!;
  const spec = request.spec;

  const onReal = (code: string) => {
    const e = s.decide(code, "real_error");
    if (e) setError(e);
    else advanceFrom(code);
  };
  const onNot = (code: string, reason: string) => {
    const e = s.decide(code, "not_error", reason);
    if (e) setError(e);
    else advanceFrom(code);
  };
  const advanceFrom = (code: string) => {
    const rest = s.undecided.filter((i) => i.code !== code);
    setExpanded(rest[0]?.code ?? null);
  };
  const finish = () => {
    const e = s.finishReview();
    if (e) setError(e);
    else afterAction();
  };

  const undecidedCodes = new Set(s.undecided.filter((i) => i.kind === "finding").map((i) => i.code));
  const a = s.undecided.filter((i) => i.kind === "finding").length;
  const b = s.undecided.filter((i) => i.kind === "line").length;
  const c = s.undecided.filter((i) => i.kind === "unrequested").length;

  const panelProps = { round, expanded, setExpanded, onReal, onNot };

  return (
    <AppLayout role="checker1">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">
          {request.product} · {request.piece}
        </h1>
        <label className="text-sm text-muted-foreground">
          Round{" "}
          <select disabled className="ml-1 border rounded px-2 py-1 text-sm text-foreground">
            <option>Round {round.no} (latest)</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {round.no === 1
          ? `${request.workId} · requested by ${request.requestedBy} (PO ${request.projectOwner}) · spec ${spec.meta.specNumber} v${spec.meta.version}`
          : `Compared with round ${round.no - 1} and its ${round.lineChecks?.length ?? 0} requests · spec ${spec.meta.specNumber} v${spec.meta.version}, unchanged${round.designerNote ? ` · designer note: "${round.designerNote}"` : ""}`}
      </p>
      <p className="text-sm mt-1">
        Upload › Automatic check › <b>Checker 1 (you)</b> › Checker 2 › Approval
      </p>

      {round.readMode === "text_layer" && (
        <div className="mt-3 border bg-muted/30 rounded p-3 text-sm">
          <b>Automatic check finished.</b> {readBanner.text_layer} ({round.seconds} s)
        </div>
      )}
      {round.readMode === "ai" && (
        <>
          <div className="mt-3 border bg-muted/30 rounded p-3 text-sm">
            <b>Automatic check finished.</b> {readBanner.ai} Resolution: {round.dpi} dpi.
          </div>
          {(round.dpi ?? 0) < 100 && (
            <div className="mt-2 border rounded p-3 text-sm bg-amber-100 text-amber-900 border-amber-300">
              {lowResolutionBanner}
            </div>
          )}
        </>
      )}
      {round.readMode === "failed" && (
        <div className="mt-3 border rounded p-3 text-sm bg-red-100 text-red-900 border-red-300">
          <b>Automatic check finished.</b> {readBanner.failed}
        </div>
      )}

      <div className="mt-4 flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          <ProofPlaceholder />
        </div>
        <div className="w-[500px] shrink-0">
          {round.no === 1 ? (
            <Round1Panel {...panelProps} undecidedCodes={undecidedCodes} />
          ) : (
            <Tabs defaultValue="findings">
              <TabsList>
                <TabsTrigger value="findings">Spec findings ({round.findings.length})</TabsTrigger>
                <TabsTrigger value="changes">Changes</TabsTrigger>
              </TabsList>
              <TabsContent value="findings">
                <Round2SpecPanel {...panelProps} />
              </TabsContent>
              <TabsContent value="changes">
                <ChangesSection round={round} onReal={onReal} onNot={onNot} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      <div className="mt-8 border rounded-lg p-4 flex items-center justify-between gap-4">
        <div>
          {s.open === 0 ? (
            <p className="text-sm font-bold">All decided.</p>
          ) : round.no === 1 ? (
            <p className="text-sm">
              <b>{s.open} findings undecided:</b> {s.undecided.map((i) => i.code).join(", ")}
            </p>
          ) : (
            <p className="text-sm">
              <b>{s.open} items undecided:</b> {a} spec findings, {b} comments, {c} unrequested changes.
            </p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            When all are decided: any real error means Send back to designer, none means pass to Checker 2.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button disabled={s.open > 0} onClick={finish}>
            Finish review
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
