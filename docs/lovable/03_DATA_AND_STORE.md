# 03 Data and the session store

You do not write any logic. Everything the pages show and do comes from one hook:

```ts
import { useSession } from "@/state/SessionProvider";   // or a relative import
const s = useSession();
```
`<SessionProvider>` is already mounted in `src/routes/__root.tsx`. State is in memory only.

## What `useSession()` returns (see `src/state/SessionProvider.tsx`)
| Name | What it is |
|---|---|
| `session` | The whole state: `request`, `rounds`, `current` (round number being worked on, 1-based), `step`, `checker2Agreed`, `checker2SignedOff`, `approved` |
| `round` | `session.rounds[session.current - 1]` or `undefined` before a proof is uploaded |
| `items` | Things the checker looks at in the current round: `{ code, kind: "finding"|"line"|"unrequested", needsDecision, linkedTo?, decision }`. `decision` is `"open"|"real_error"|"not_error"|"needs_discussion"` |
| `open` | How many items still need a decision (Finish is blocked above 0) |
| `dismissals` | `{ round, code, reason }[]` across all rounds, for Checker 2 |
| `createRequest(file)` | A5. Returns an error string or `undefined` |
| `uploadProof(file)` | B2.1. Same |
| `decide(code, decision, reason?)` | Checker's decision. Dismissing (`"not_error"`) needs a reason |
| `finishReview()` | Blocked while `open > 0` |
| `editSendBack(edits)` | `edits`: `{ code, text?, remove? }[]` |
| `addManualLine(text)` | Adds a line coded M1, M2… |
| `sendToDesigner()` | Moves to the next round's upload page |
| `checker2Agree(code, agree)`, `checker2SignOff()`, `approve()` | Clickable pages |
| `startOver()` | Clears everything |
| `jumpTo(name)` | Demo shortcut to a prepared state (see below) |

Every action that can fail returns a message string. Show it. If it returns `undefined` it worked; then navigate to `stepPath[session.step]` where the step may have changed.

## Types you will use (all in `src/state/types.ts`; read the file, it has comments)
```ts
Round {
  no, fileName, readMode: "text_layer"|"ai"|"failed", dpi?, seconds,
  results: FieldResult[],        // one per spec field (19)
  findings: CheckFinding[],      // spec findings F1.. (matches are not findings)
  matches: number,
  diff?: DiffItem[],             // round 2+: modified / added / removed / moved / unchanged
  lineChecks?: LineCheck[],      // round 2+: earlier send-back lines, Done / Not done / Check by hand
  unrequested?: UnrequestedItem[], // round 2+: U1.. with optional linkedTo
  sendBack: { code, text }[],    // Hungarian lines, built when the review is finished
  decisions: Record<code, Decision>, dismissals: Record<code, reason>, finished: boolean
}
FieldResult {                    // src/core/compare.ts
  id, label, specValue, verdict: "match"|"mismatch"|"missing"|"could_not_read",
  foundValue: string|null,
  diff: { type: "same"|"del"|"ins", text }[],   // word difference spec -> proof
  occurrences: { verdict, occurrence: { text, ... } }[],
  reason?: "low_resolution"|"read_failed"|"unreadable",
  allergen?: { status: "ok"|"not_emphasised"|"could_not_check", words: string[] }
}
CheckFinding {                   // src/core/findings.ts
  code: "F1", kind, fieldId, label, specValue, foundValue, words?, occurrences?
}
```
The item codes: spec findings are **F**, earlier lines are **C** (C1 is the first earlier line, in list order), unrequested changes are **U**. A line `Cn` is `lineChecks[n-1]`.

## Wording
Do not invent labels. Use the maps in `src/state/labels.ts`: `kindLabel`, `verdictLabel`, `lineVerdictLabel`, `diffLabel`, `readBanner`, `lowResolutionBanner`, `reasonLabel`, `stepPath`.

## Mock data you can use right now
`jumpTo(name)` loads a prepared, realistic session. The data is real output of the real logic on the demo files (round 1 and the spec) or matches the expected results (round 2 and 3). Names:

| `jumpTo` name | Where it puts you |
|---|---|
| `empty` | Home, nothing started |
| `new_request` | New request page |
| `r1_review` | Round 1 review: 6 findings, 14 matches, all open |
| `r1_review_flat` | Round 1 read by AI from an image (150 dpi) |
| `r1_review_lowres` | Same at 75 dpi: numbers and units are Could not read |
| `r1_review_failed` | Read failed: everything is Could not read |
| `r1_sendback` | Round 1 finished: 6 Hungarian lines to review |
| `r2_upload` | Upload page for round 2 (shows the lines sent) |
| `r2_review` | Round 2 review: earlier lines (5 Done, 1 Not done), changes, unrequested changes |
| `r2_sendback` | Round 2 send-back list |
| `r3_review` | Round 3 review: clean, nothing open |
| `checker2` | Checker 2 with one dismissal to agree with |
| `lead` | Lead approval page |
| `approved` | After approval |

Build each page against the matching state and check it. The real flow (uploading files and clicking through) also works end to end with the mock check: any `.xlsx` creates the demo request; any `.pdf` gives the demo result for the current round.

## Not your job
Parsing Excel, reading PDFs, comparing, diffing, calling an AI, building the Hungarian lines: all done elsewhere. Do not add any of it. If something you need is missing from the store, **do not work around it**: write it in a short "Missing from the store" list in your final message.
