# 03 Data and the session store

You write no logic. Every page reads from one hook and calls its actions:

```ts
import { useSession } from "../state/SessionProvider"; // adjust the relative path, or use the @/ alias if configured
const s = useSession();
```
`<SessionProvider>` is already mounted in `src/routes/__root.tsx`. Keep it there. State lives in memory only.

## `useSession()` (source: `src/state/SessionProvider.tsx`)

| Name | Type | Meaning |
|---|---|---|
| `session` | `Session` | Everything: `pendingSpec`, `request`, `rounds`, `current`, `step`, `checker2Agreed`, `checker2SignedOff`, `checker2SignedAt`, `approved`, `approvedAt` |
| `round` | `Round \| undefined` | The round being worked on (`session.rounds[session.current - 1]`); undefined before its proof is uploaded |
| `items` | `ItemView[]` | Everything in the current round the checker looks at: `{ code, kind: "finding"\|"line"\|"unrequested", needsDecision, linkedTo?, decision }` |
| `undecided` | `ItemView[]` | Items that still need a decision. Finish review is disabled while not empty |
| `open` | `number` | `undecided.length` |
| `dismissals` | `Dismissal[]` | Every item marked not an error, all rounds: `{ key, round, code, label, summary, reason }`. `key` (like `"2:U2"`) is what `checker2Agree` takes |
| `previousLines` | `PreviousLine[]` | The previous round's send-back lines for the upload page: `{ n, code, text, where? }`. Empty in round 1 |
| `busy` | `boolean` | True while `loadSpec` or `uploadProof` runs |

| Action | Returns | Notes |
|---|---|---|
| `loadSpec(file)` | `Promise<string \| undefined>` | **await it.** Reads the spec into `session.pendingSpec`. Errors: "Choose the spec Excel file first", "This file is not a readable .xlsx workbook" |
| `createRequest()` | `string \| undefined` | Needs `pendingSpec`. Moves to `upload_proof` |
| `uploadProof(file, note?)` | `Promise<string \| undefined>` | **await it.** Runs the check, stores the round, moves to `review`. Error: "This file is not a PDF" |
| `decide(code, decision, reason?)` | `string \| undefined` | `decision`: `"real_error"` or `"not_error"`. Not an error needs a reason (use `reasonText(chip, note)`), except U codes ("Change accepted" is stored) |
| `finishReview()` | `string \| undefined` | Blocked while items are open. Builds the Hungarian send-back list. Moves to `send_back`, or to `checker2` when nothing is a real error |
| `backToReview()` | `string \| undefined` | From the send-back list. Finishing again rebuilds the list |
| `editSendBack(edits)` | `string \| undefined` | `edits`: `{ code, text?, remove? }[]` |
| `addManualLine(text)` | `string \| undefined` | Adds line M1, M2… |
| `sendToDesigner()` | `string \| undefined` | Error "The send-back list is empty". Moves to the next round's `upload_proof` |
| `checker2Agree(key, agree)` | `string \| undefined` | `key` from `dismissals` |
| `checker2SignOff()` | `string \| undefined` | Needs every dismissal agreed. Moves to `lead` |
| `approve()` | `string \| undefined` | Needs Checker 2's sign-off. Moves to `approved` |
| `startOver()` | `void` | Clears everything |
| `jumpTo(name)` | `void` | Loads a prepared state (table below) |

**After every action:** if it returned a string, show it; otherwise navigate to `stepPath[session.step]` when the step changed. Read `session` on the next render, not right after the call.

## The data (source: `src/state/types.ts`, read it, it has comments)
```ts
Session { pendingSpec: ParsedSpec|null; request: RequestInfo|null; rounds: Round[]; current: number; step: Step; ... }
RequestInfo { workId, product, productCode, piece, requestedBy, partner, projectOwner, designer, dueDate, notes, createdAt, spec }
ParsedSpec { meta: { specNumber, version, validFrom, erpCode, packagingCode, productName }, fields: { id, label, value, row }[] }
Round {
  no, fileName, designerNote, readMode: "text_layer"|"ai"|"failed", dpi?, seconds,
  results: FieldResult[],          // one per spec field (19)
  findings: CheckFinding[],        // F1.. spec findings; matches are not findings
  matches: number,
  diff?: DiffItem[],               // round 2+: { id, type: modified|added|removed|moved|unchanged, before, after }
  lineChecks?: LineCheck[],        // round 2+: { code, text, verdict: done|not_done|check_by_hand, fieldId? }
  unrequested?: UnrequestedItem[], // round 2+: { code: "U1", change: DiffItem, what, where?, linkedTo? }
  sendBack: { code, text }[],      // Hungarian lines, built by finishReview
  decisions, dismissals, finished, finishedAt?
}
FieldResult  { id, label, specValue, verdict: match|mismatch|missing|could_not_read, foundValue, diff: {type: same|del|ins, text}[], reason?, allergen? }
CheckFinding { code, kind, fieldId, label, specValue, foundValue, words?, occurrences?, where? }
```
Item codes: **F** = spec finding, **C{n}** = the n-th line of the previous send-back list (`lineChecks[n-1]`), **U** = unrequested change, **M** = a line the checker typed.

## Fixed values, wording and helpers (import, never retype)
- `src/state/demo.ts`: `people`, `workingAs`, `demoRequestFields`, `dismissReasons`.
- `src/state/labels.ts`: `kindLabel`, `verdictLabel`, `lineVerdictLabel`, `diffLabel`, `readBanner`, `lowResolutionBanner`, `reasonLabel`, `stepPath`.
- `src/state/format.ts`: `badgeOf(finding)`, `summaryOf(finding, result)`, `sourceOf(code)`, `formatTime(iso)`, `daysBetween(fromIso)`, `reasonText(chip, note)`.

## Prepared states for building and checking pages
`jumpTo(name)` (or the `?dev=1` shortcut row). Round 1 and the spec are real output of the real code on the demo files; rounds 2 and 3 match the expected results.

| Name | Page | What you see |
|---|---|---|
| `empty` | `/` | Nothing started |
| `new_request` | `/new` | Empty form |
| `new_request_spec_read` | `/new` | Spec read: 19 fields, Create request enabled |
| `r1_upload` | `/upload` | Round 1 upload, nothing requested yet |
| `r1_review` | `/review` | Round 1: 6 findings undecided, 14 matches |
| `r1_review_flat` | `/review` | Read by AI from an image at 150 dpi |
| `r1_review_lowres` | `/review` | 75 dpi: amber banner, number fields Could not read |
| `r1_review_failed` | `/review` | Read failed: red banner, 19 Could-not-read findings |
| `r1_sendback` | `/send-back` | 6 Hungarian lines |
| `r2_upload` | `/upload` | Round 2 upload with the 6 lines requested |
| `r2_review` | `/review` | Round 2: 2 spec findings, 5 comments done and 1 not done (linked to F1), 2 unrequested (U1 linked to F2), 4 moved only. 3 undecided: F1, F2, U2 |
| `r2_sendback` | `/send-back` | Round 2: 3 lines |
| `r3_review` | `/review` | Round 3: clean, 19 matches, nothing to decide |
| `checker2` | `/checker-2` | One dismissal to agree with (U2, change accepted) |
| `lead` | `/lead` | Ready to approve |
| `approved` | `/lead` | Approved |

The real flow also works end to end without `jumpTo`: any `.xlsx` gives the demo spec, any `.pdf` gives the demo result for the current round (in step 3 these become the real check; your pages do not change).

## If something is missing
Do not compute it and do not add state. Use what exists, and list what you needed under "Missing from the store" in your final message.
