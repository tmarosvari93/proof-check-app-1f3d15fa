# 02 Screens

17 wireframe screens exist in the design. This prototype builds **8 pages** (5 with real logic, 3 clickable) and **1 shared "not built" page** that stands in for the other 9. All are rudimentary: forms, tables, lists, buttons. Read `03_DATA_AND_STORE.md` for `useSession()` and the data shapes used below.

| # | Screen | Route | Level | For |
|---|---|---|---|---|
| L | Shared layout | all pages | built | everyone |
| A1 | Home | `/` | clickable | everyone |
| A5 | New request | `/new` | real | Requester |
| B2.1 | Upload proof | `/upload` | real | Designer |
| A3.3 + A3.4 | Review (round 1, and round 2+) | `/review` | real | Checker 1 |
| A3.5 | Send-back list | `/send-back` | real | Checker 1 |
| A3.6 | Checker 2 | `/checker-2` | clickable | Checker 2 |
| A3.7 | Lead approval | `/lead` | clickable | Lead |
| N | Designed, not built | `/not-built?screen=<name>` | one page for 9 screens | anyone |

"Real" means the page reacts to real data and real actions from `useSession()`. "Clickable" means a simple page with a few buttons. Nothing is saved anywhere.

After any action that changes the step, navigate to `stepPath[session.step]` (from `src/state/labels.ts`). Show every error string an action returns, inline near the button (a red text line is enough, no modal).

If someone opens a page the session is not ready for (for example `/review` with no proof uploaded), show a short message "Nothing to show yet" and a link to the page of the current step. Do not crash.

---

## L. Shared layout (build first)
**Top bar:** app name "Proof Check", a text label "Prototype, fictional data", the current role label (set per page, see each page), and a **Start over** button (calls `startOver()`, then goes to `/`).
**Side menu**, three groups:
- *Built*: Home, New request, Upload proof, Review, Send-back list, Checker 2, Lead approval.
- *Designed, not built* (each links to `/not-built?screen=<name>`): Process flow, Unclaimed work, My tasks (checker), My tasks (requester), My tasks (lead), Task view, Track all work, Designer home, Designer my tasks.
- Highlight the page of the current step, so the user sees where the demo story is.
**Demo shortcuts** (only when the URL has `?dev=1`): a row of small buttons, one per name in `MockName` (see `03`), each calling `jumpTo(name)` then navigating to `stepPath[session.step]`. This is for building and testing pages without clicking the whole story.

---

## A1. Home (`/`) , clickable, for everyone
Purpose: explain the product in 10 seconds and start the demo.
Show:
- Title "Proof Check" and 3 short sentences: what it does (compares a packaging proof with the product spec, and a new version with the previous one), that software only highlights and people decide, and that this is a prototype with fictional data.
- Button **Start the demo** → `/new`.
- Link **Download demo files** → `/demo/demo_files.zip` (a static file already in `public/demo`). One line under it: "Contains the spec Excel and proofs v1 to v3, vector and image versions."
- A short list "How the demo goes" with the 5 steps from `04_RULES.md` (demo story), plain text.
- A small note: "Not saved. A page refresh starts over."
No store calls except `startOver()` on the layout button.

## A5. New request (`/new`) , REAL, for the Requester
Role label: "Working as: Requester (Kovács Anna)".
Purpose: create a work item by uploading the product spec Excel. This is the only real input on the page.
Show:
- A form. **Fixed demo fields, read-only or a disabled dropdown with one value**: Work ID (`WRK-0417`), Product, Piece (box / pouch / label dropdown, preselected "Doboz (CS-20931)"), Partner / designer studio, Project owner, Designer, Due date. Values come from `demoRequest` in `src/mocks/mockSession.ts` but you can simply hard-code the same text; do not make them editable.
- **Spec file** input (accept `.xlsx`). Show the chosen file name.
- Button **Create request**. It calls `createRequest(file)`.
  - On error show the message (examples: "Choose the spec Excel file first", "This file is not a readable .xlsx workbook").
  - On success go to `/upload`.
- **Spec panel** (shown once `session.request` exists, so after the mock create; before that show "Upload a spec to see its mandatory fields"): spec number, version and product name from `request.spec.meta`, then a table of the 19 fields from `request.spec.fields` with columns Field (label) and Value. Heading: "19 mandatory (blue) fields read from the spec" (use the real count).
Because `createRequest` moves on immediately, also show the same spec panel at the top of `/upload` so the user sees the 19 fields before uploading a proof.

## B2.1. Upload proof (`/upload`) , REAL, for the Designer
Role label: "Working as: Designer (Nagy Péter, Studio Fiktív)".
Purpose: the designer uploads the proof PDF for the current round.
Show:
- Heading "Upload proof, round {session.current}".
- Request summary (work ID, product, piece, spec number and version) and the spec panel (collapsed by default).
- **Round selector**: a read-only select showing only the current round ("Round 2").
- For round 2 and later: a box **"Changes requested in the previous round"**: the numbered Hungarian lines of the previous round's send-back list: `session.rounds[session.current - 2].sendBack`, each as `{n}. {text}`. For round 1 show "First round: nothing requested yet".
- **Proof file** input (accept `.pdf`) and button **Run check**. It calls `uploadProof(file)`.
  - Show a spinner text "Checking…" for about 1 second while it runs (cosmetic; the mock is instant).
  - On error show the message (example: "This file is not a PDF").
  - On success go to `/review`.
- A hint line: "Demo files: proof_v1.pdf for round 1, proof_v2.pdf for round 2, proof_v3.pdf for round 3. The *_flat files are image-only versions."

## A3.3 and A3.4. Review (`/review`) , REAL, for Checker 1
Role label: "Working as: Checker 1 (Tóth Gábor)". One page for both wireframes: round 1 shows sections 1 to 3, round 2 and later also show sections 4 and 5.

**Header:** product, piece, work ID, "Round {no}", file name, check time ("{seconds} s").

**Section 1. Check banner** (one banner, from `round.readMode`):
- `text_layer`: neutral banner with `readBanner.text_layer`.
- `ai`: info banner with `readBanner.ai` and the resolution "({dpi} dpi)". If `dpi < 100`, add a second amber banner with `lowResolutionBanner`.
- `failed`: red banner with `readBanner.failed`.
All wording is in `src/state/labels.ts`.

**Section 2. Summary line:** "{findings.length} findings, {matches} matches, {open} open". `open` is the `open` value from `useSession()`.

**Section 3. Spec findings** (`round.findings`, one card per finding). For each card:
- Code (F1…), field label, kind badge using `kindLabel[kind]`.
- For `spec_mismatch`: two lines, "Spec:" `specValue` and "Proof:" `foundValue`. Under them the **word difference** from the matching entry in `round.results` (find by `fieldId`): render `diff` ops: `same` plain, `del` red with strikethrough, `ins` green. If `occurrences` > 1, add "(wrong in {n} places on the proof)".
- For `spec_missing`: "Spec:" value, "Proof: not found".
- For `allergen_not_emphasised`: "These words must be emphasised (bold) and are not:" followed by `words`.
- For `could_not_read` and `allergen_could_not_check`: show the reason from the matching result: `reasonLabel[result.reason]` when present.
- **Decision control**: two buttons, **Real error** (calls `decide(code, "real_error")`) and **Dismiss** (shows a text input "Reason" and a Confirm button that calls `decide(code, "not_error", reason)`). Show the current decision as a badge (Open, Real error, Dismissed + reason). A decided card can be changed again. Show an action's returned error under the buttons.
If there are no findings write "No findings. Every field matches the spec."

**Section 4. Matches:** a collapsed section "Matches ({matches})". When opened: table of results whose `verdict === "match"`: label, value. Green check. Matches have no buttons.

**Section 5 (round 2 and later). Earlier lines:** heading "Were the earlier comments fixed?". Table from `round.lineChecks` with row code `C{index+1}`, the Hungarian line `text`, a status chip from `lineVerdictLabel[verdict]` (green Done, red Not done, amber Check by hand). For a row that needs a decision (it appears in `items` from `useSession()` with `kind === "line"`):
- if the item has `linkedTo` (same problem as a spec finding): show "Same problem as {linkedTo}. Follows that decision." and no buttons;
- else show the same Real error / Dismiss controls as findings.

**Section 6 (round 2 and later). Changes since round {no - 1}:** from `round.diff`, grouped, with `diffLabel`: Modified and Added and Removed as before/after rows; **Moved only** in a grey, collapsed group "Moved only, no action needed ({n})". Do not show `unchanged`.
Then **"Changes nobody asked for"** from `round.unrequested`: each row has code (U1…), the before → after text, and:
- if `linkedTo` is set: "Listed once, under {linkedTo}" and no buttons;
- else Real error / Dismiss controls (same as findings).
If there are none write "No changes outside the earlier comments."

**Footer: Finish review.** One big button **Finish review** calls `finishReview()`.
- If `open > 0` the action returns "N items still need a decision": show it in red next to the button (and keep the button clickable so the message appears).
- On success navigate to `stepPath[session.step]` (that is `/send-back`, or `/checker-2` if nothing needs sending back).
No highlight boxes on the proof image. There is no proof preview in this prototype; a grey placeholder box "Proof preview (not built)" is enough.

## A3.5. Send-back list (`/send-back`) , REAL, for Checker 1
Role label: "Working as: Checker 1 (Tóth Gábor)".
Purpose: the numbered Hungarian lines that go to the designer. The checker may fix wording first.
Show:
- Heading "Send-back list, round {session.current}" and a one-line help: "These lines are built from the items you marked as real errors. You can edit, remove or add lines before sending."
- The list `round.sendBack` as numbered rows. Each row: number, code badge, the Hungarian `text` in an editable textarea, and a **Remove** button. Editing a textarea and leaving the field calls `editSendBack([{ code, text }])`. Remove calls `editSendBack([{ code, remove: true }])`.
- **Add a line**: a textarea and an **Add** button calling `addManualLine(text)`; show its error ("Write the line first").
- **Copy as text** button: copies the whole list as numbered plain text (one line per row, `1. text`) to the clipboard. This is a plain client-side string; there is no render action to call.
- Button **Send to designer** calls `sendToDesigner()`. If the list is empty the action returns "The send-back list is empty": show it and keep the button enabled so the message appears. On success go to `/upload` (now the next round).
If `round.sendBack` is empty show "Nothing to send back" and a link to the current step.

## A3.6. Checker 2 (`/checker-2`) , CLICKABLE, for Checker 2
Role label: "Working as: Checker 2 (Szabó Réka)". Data comes from the earlier screens; nothing is saved.
Purpose: the second pair of eyes (four-eyes). Checker 2 looks at what Checker 1 dismissed.
Show:
- Heading "Second check" and the final round's summary (round number, file name, findings and matches of the last round).
- **Dismissals to review**: the list `dismissals` from `useSession()` (round, code, reason). For each row show round, code, the reason, and an **Agree** checkbox/button calling `checker2Agree(code, true/false)` (reflect `session.checker2Agreed[code]`). A disabled **Disagree** button with the tooltip "Designed, not built". If the list is empty write "Nothing was dismissed. Nothing to review."
- Button **Sign off** calls `checker2SignOff()`. Show its error ("Agree or discuss N dismissals first"). On success go to `/lead`.

## A3.7. Lead approval (`/lead`) , CLICKABLE, for the Lead
Role label: "Working as: Lead (Dr. Varga László)".
Purpose: final approval.
Show:
- Heading "Approval".
- A summary of the whole request from the session: product, piece, spec number/version, number of rounds, the final round's findings count (should be 0) and matches, number of dismissals, and "Checker 2 signed off: yes/no".
- Button **Approve** calls `approve()`; show its error. A disabled **Send back** button with the tooltip "Designed, not built".
- When `session.approved` is true replace the buttons with a green banner "Approved" and the line "Request WRK-0417 is approved. Print files can now be requested." plus a **Start over** button.

## N. Designed, not built (`/not-built`)
One page for the 9 menu entries. It reads the `screen` search param and shows:
- Title "Designed, not built in this prototype".
- The screen name (from the param) and 2 sentences: "This screen is part of the full design. The prototype builds only the parts that prove the value: reading the spec, reading the proof, comparing, and comparing two rounds."
- A link "Back to home" (`/`).
- A line "Design canvas: link to be added" (a placeholder; Tamas adds the link before submission).
Valid `screen` values: process-flow, unclaimed, tasks-checker, tasks-requester, tasks-lead, task-view, track-all, designer-home, designer-tasks. An unknown value still shows the page with the raw value.
