import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/state/SessionProvider";
import { diffUnavailableBanner, lineVerdictLabel, lowResolutionBanner, readBanner } from "@/state/labels";
import type { CheckFinding, Decision } from "@/state/types";
import { ProofView } from "@/components/app/ProofView";
import { decisionOf as decisionIn, reviewItems } from "@/state/roundLogic";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/app/EmptyState";
import { FindingRow } from "@/components/app/FindingRow";
import { DecisionButtons } from "@/components/app/DecisionButtons";
import { Chip } from "@/components/app/Chip";
import { useAfterAction } from "@/components/app/useAfterAction";
import { WarningsBox } from "@/components/app/WarningsBox";
import { FilesRow } from "@/components/app/FilesRow";

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
  const [pickedNo, setPickedNo] = useState<number | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rounds = s.session.rounds;
  const latest = s.round;
  const round = (pickedNo != null ? rounds[pickedNo - 1] : undefined) ?? latest;
  const req = s.session.request;
  const readOnly = !!round && !!latest && round.no !== latest.no;

  const undecided = readOnly ? [] : s.undecided;
  const openFindings = undecided.filter((i) => i.kind === "finding");
  const openChanges = undecided.filter((i) => i.kind !== "finding");
  const defaultTab = !round || round.no === 1 ? "undecided" : openFindings.length || !openChanges.length ? "findings" : "changes";
  const roundKey = round ? `${round.no}` : "";
  useEffect(() => setTab(null), [roundKey]);
  const activeTab = tab ?? defaultTab;

  if (!round || !req) return <EmptyState />;
  if (!s.claimed)
    return (
      <div className="max-w-lg rounded-md border border-neutral-300 bg-neutral-50 p-8 text-center">
        <p className="text-neutral-600">This proof is not claimed yet.</p>
        <Link to="/unclaimed" className="mt-2 inline-block text-sm underline">
          Go to Unclaimed
        </Link>
      </div>
    );

  const resultOf = (f: CheckFinding) => round.results.find((r) => r.id === f.fieldId);
  const decisionOf = (code: string): Decision => decisionIn(round, code);
  const itemsOfRound = reviewItems(round);
  const onDecided = (code: string) => {
    const rest = s.undecided.filter((i) => i.code !== code && i.kind === "finding");
    setExpanded(rest[0]?.code ?? null);
  };
  const isOpenDec = (d: Decision) => d === "open" || d === "needs_discussion";
  const plural = (n: number) => (n === 1 ? "1 item" : `${n} items`);

  const findingRow = (f: CheckFinding) => (
    <FindingRow
      key={f.code}
      finding={f}
      result={resultOf(f)}
      decision={decisionOf(f.code)}
      expanded={expanded === f.code}
      onToggle={() => setExpanded(expanded === f.code ? null : f.code)}
      onDecided={() => onDecided(f.code)}
      readOnly={readOnly}
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

  const undecidedFindings = round.findings.filter((f) => isOpenDec(decisionOf(f.code)));

  const lines = round.lineChecks ?? [];
  const done = lines.filter((l) => l.verdict === "done").length;
  const notDone = lines.length - done;
  const unreq = round.unrequested ?? [];
  const moved = (round.diff ?? []).filter((d) => d.type === "moved");

  const open = undecided.length;
  const tabName = (k: string) => (round.no === 1 ? "undecided" : k === "finding" ? "findings" : "changes");
  const tabLabel = (t: string) => (t === "undecided" ? "Undecided" : t === "findings" ? "Spec findings" : "Changes");
  const groups: { tab: string; codes: string[] }[] = [];
  for (const i of undecided) {
    const t = tabName(i.kind);
    const g = groups.find((x) => x.tab === t);
    if (g) g.codes.push(i.code);
    else groups.push({ tab: t, codes: [i.code] });
  }
  const badge = (n: number) =>
    n > 0 ? (
      <span className="ml-1.5 rounded-full bg-neutral-900 px-1.5 text-[11px] font-semibold leading-5 text-white">{n}</span>
    ) : null;
  const hint = open > 0 && (
    <p className="mx-3 mb-2 rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-neutral-700">
      Decide every item below. Real errors go back to the designer.
    </p>
  );

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">
          {req.product} · {req.piece}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <span>Round</span>
          <select
            aria-label="Round"
            value={round.no}
            onChange={(e) => {
              const no = Number(e.target.value);
              setPickedNo(latest && no === latest.no ? null : no);
              setExpanded(null);
            }}
            className="rounded-md border border-input bg-white px-3 py-2 text-sm"
          >
            {[...rounds].reverse().map((r, i) => (
              <option key={r.no} value={r.no}>
                Round {r.no}
                {i === 0 ? " (latest)" : ""}
              </option>
            ))}
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
      <FilesRow specFile={req.specFile} proofFile={round.proofFile} />

      {readOnly && (
        <div className="mt-3 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
          You are looking at round {round.no}. Decisions are only possible in the latest round.
        </div>
      )}
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
      {round.readError && round.readMode === "failed" && (
        <div className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-800">
          Reason: {round.readError}
        </div>
      )}
      {round.readError && round.readMode === "ai" && (
        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
          One AI read failed: {round.readError}. Differences between rounds may be missing.
        </div>
      )}
      <WarningsBox warnings={round.warnings} />

      <div className="mt-4 grid grid-cols-2 gap-6">
        <ProofView
          round={round}
          decisionOf={decisionOf}
          active={expanded}
          onPick={(code) => {
            setExpanded(code);
            if (round.no > 1) setTab("findings");
            else if (activeTab === "matches") setTab("all");
          }}
        />

        <div className="rounded-md border border-neutral-300">
          {round.no === 1 ? (
            <Tabs value={activeTab} onValueChange={setTab}>
              <TabsList className="m-2">
                <TabsTrigger value="undecided">
                  Undecided {undecidedFindings.length}
                  {badge(openFindings.length)}
                </TabsTrigger>
                <TabsTrigger value="all">All {round.findings.length}</TabsTrigger>
                <TabsTrigger value="matches">Matches {round.matches}</TabsTrigger>
              </TabsList>
              {hint}
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
            <Tabs value={activeTab} onValueChange={setTab}>
              <TabsList className="m-2">
                <TabsTrigger value="findings">
                  Spec findings ({round.findings.length}){badge(openFindings.length)}
                </TabsTrigger>
                <TabsTrigger value="changes">Changes{badge(openChanges.length)}</TabsTrigger>
              </TabsList>
              {hint}
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
                  {round.diffUnavailable && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {diffUnavailableBanner[round.diffUnavailable]}
                    </div>
                  )}
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
                        const item = itemsOfRound.find((it) => it.code === code);
                        const dec = decisionOf(code);
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
                                <ChangeableDecision
                                  decision={dec}
                                  readOnly={readOnly}
                                  chip={dec === "real_error" ? <Chip tone="real">Real error</Chip> : <Chip tone="not">Not an error</Chip>}
                                >
                                  {(done) => <DecisionButtons code={code} decision={dec} onDecided={done} />}
                                </ChangeableDecision>
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
                      {unreq.length === 0 && !round.diffUnavailable && (
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
                              <ChangeableDecision
                                decision={dec}
                                readOnly={readOnly}
                                chip={dec === "real_error" ? <Chip tone="real">Rejected</Chip> : <Chip tone="not">Accepted</Chip>}
                              >
                                {(done) => (
                                  <div className="mt-2 flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant={dec === "real_error" ? "default" : "outline"}
                                      onClick={() => {
                                        if (!s.decide(u.code, "real_error")) done();
                                      }}
                                    >
                                      Reject: add to send-back list
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={dec === "not_error" ? "secondary" : "outline"}
                                      onClick={() => {
                                        if (!s.decide(u.code, "not_error")) done();
                                      }}
                                    >
                                      Accept change
                                    </Button>
                                  </div>
                                )}
                              </ChangeableDecision>
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

      {!readOnly && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-md border border-neutral-400 px-4 py-3">
          <div className="text-sm">
            {open === 0 ? (
              <p>
                <strong>All decided.</strong>
              </p>
            ) : (
              <p>
                <strong>{plural(open)} undecided:</strong>{" "}
                {groups.map((g, gi) => (
                  <span key={g.tab}>
                    {gi > 0 ? ", " : ""}
                    <button type="button" className="underline underline-offset-2" onClick={() => setTab(g.tab)}>
                      {g.codes.join(", ")} on the {tabLabel(g.tab)} tab
                    </button>
                  </span>
                ))}
              </p>
            )}
            <p className="text-neutral-600">
              When all are decided: any real error means Send back to designer, none means pass to Checker 2.
            </p>
            {error && <p className="text-red-700">{error}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            {open > 0 && (
              <Button variant="outline" onClick={() => setConfirmOpen(true)}>
                Finish anyway
              </Button>
            )}
            <Button disabled={open > 0} onClick={() => run(() => s.finishReview())}>
              Finish review
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish with open items?</AlertDialogTitle>
            <AlertDialogDescription>
              {open === 1 ? "1 item is" : `${open} items are`} not decided: {undecided.map((i) => i.code).join(", ")}. They will
              NOT be sent to the designer. Checker 2 will see them marked as not decided.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel autoFocus>Go back and decide</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                run(() => s.finishReview({ anyway: true }));
              }}
            >
              Finish anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ChangeableDecision({
  decision,
  readOnly,
  chip,
  children,
}: {
  decision: Decision;
  readOnly: boolean;
  chip: ReactNode;
  children: (done: () => void) => ReactNode;
}) {
  const [changing, setChanging] = useState(false);
  const isOpen = decision === "open" || decision === "needs_discussion";
  if (readOnly) return <div className="mt-2">{isOpen ? <Chip tone="undecided">Undecided</Chip> : chip}</div>;
  return (
    <div>
      {!isOpen && (
        <button type="button" className="mt-2" title="Change decision" onClick={() => setChanging((c) => !c)}>
          {chip}
        </button>
      )}
      {(isOpen || changing) && children(() => setChanging(false))}
    </div>
  );
}
