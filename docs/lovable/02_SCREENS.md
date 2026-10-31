# 02 Screens

**The wireframe PNGs in `docs/lovable/wireframes/` are the layout to copy.** Each has a strip on top: green = build it, grey = design only, do not build. This file says, for every built screen, where each element's data comes from, what each button calls, and **what in the PNG to leave out** (the wireframes were drawn for a bigger version than this prototype). When this file and a PNG disagree, this file wins.

| ID | Screen | Route | PNG | Level |
|---|---|---|---|---|
| L | Shared layout | every page | any built PNG (top bar + left menu) | build |
| A1 | Home | `/` | `A1_home.png` | build, clickable |
| A5 | New request | `/new` | `A5_new-request.png` | build, real logic |
| B2.1 | Upload proof (designer) | `/upload` | `B2.1_upload-proof.png` | build, real logic |
| A3.3 + A3.4 | Review, round 1 and round 2+ | `/review` | `A3.3_review-round-1.png`, `A3.4_review-round-2.png` | build, real logic (one route) |
| A3.5 | Send-back list | `/send-back` | `A3.5_send-back.png` | build, real logic |
| A3.6 | Checker 2 (4-eye check) | `/checker-2` | `A3.6_checker-2.png` | build, clickable |
| A3.7 | Lead approval | `/lead` | `A3.7_lead-approval.png` | build, clickable |
| N | Designed, not built | `/not-built?screen=…` | none | build (one simple page) |
| 9 others | 0, A2, A3, A3.1, A3.2, A3.8, A4, B1, B2 | none | grey-strip PNGs | **do not build** |

Everything below uses `useSession()` (see `03_DATA_AND_STORE.md`), the people and fixed values in `src/state/demo.ts`, wording in `src/state/labels.ts`, and helpers in `src/state/format.ts`. Never type a name, ID or label that exists in those files: import it.

## Rules for every page
- After an action succeeds, navigate to `stepPath[session.step]` (from `labels.ts`).
- When an action returns a string, show it in red text next to the button that caused it. No toasts, no modals.
- If the session is not ready for the page (for example `/review` with no round, `/send-back` with no finished round, `/checker-2` before a finished review), show only: "Nothing to show here yet." and a link "Go to the current step" → `stepPath[session.step]`. Never crash on missing data.
- Every **proof viewer** area in the PNGs (the grey panels with boxes, zoom buttons, v1/v2 side by side, proof crop) is replaced by one grey box with the text **"Proof preview: not built in this prototype."** Keep its size roughly as in the PNG so the layout stays the same.
- Look: copy the PNGs' greyscale style (white page, grey borders, black primary button). The only colours: status chips green (match, done, agreed, approved), red (mismatch, missing, not done), amber (could not read, check by hand). Use the shadcn components in `src/components/ui` (Button, Badge, Tabs, Textarea, Input, Select, Checkbox, Collapsible, AlertDialog).

---

## L. Shared layout
Copy the top bar and left menu from the PNGs.
- **Top bar:** "Proof Check" (link to `/`) on the left. On the right "Working as" and a grey chip with the page's role from `workingAs` in `demo.ts`: Home and the not-built page `workingAs.anyone`, `/new` `requester`, `/upload` `designer`, `/review` and `/send-back` `checker1`, `/checker-2` `checker2`, `/lead` `lead`. The chip is a label, not a dropdown.
- **Left menu**, as in the PNG: Home (`/`), Unclaimed (`/not-built?screen=unclaimed`), My tasks (`/not-built?screen=tasks-checker`), Track all work (`/not-built?screen=track-all`), + New request (`/new`). Do not show the "3" count after Unclaimed (it is not real data). Highlight the current page's item (Home or + New request); on other pages nothing is highlighted.
- **Under the menu, a "Demo" box** (not in the PNGs; needed because the flow pages are not in the menu): "You are at: {step name}" and a link **Continue** → `stepPath[session.step]`. Step names: home "Home", new_request "New request", upload_proof "Upload proof, round {current}", review "Review, round {current}", send_back "Send-back list, round {current}", checker2 "Checker 2", lead "Lead approval", approved "Approved".
- **Below that, a small "More designed screens" list** of links to `/not-built?screen=…` for: process-flow "Process flow", tasks-requester "My tasks: requester", tasks-lead "My tasks: lead", task-view "Task view", designer-home "Designer home", designer-tasks "Designer my tasks".
- **Demo shortcuts** (only when the URL has `?dev=1`): a row of small buttons at the bottom of the page, one per name in `mockNames` (import from `src/mocks/mockSession.ts`), each calling `jumpTo(name)` and then navigating to `stepPath[session.step]`. Keep `?dev=1` in the URL when navigating, so the row stays.
- One menu for every role (the designer PNG shows a designer menu: ignore that, one person plays every role here).

## A1. Home (`/`) , `A1_home.png`
Build as in the PNG with these changes:
- The four link cards: Unclaimed, My tasks and Track all work go to their `/not-built?screen=…` links; "+ New request" goes to `/new`.
- "How Proof Check works" (6 numbered cards): keep the text exactly as in the PNG.
- "Good to know" box: replace the last sentence. New text: "The app never approves anything: only people sign off. A field it cannot read is shown as "could not read", never as a pass. This prototype keeps everything in your browser tab: a page refresh starts over."
- "Try it with the demo files" box: keep the first two sentences; replace "Switch person with "Working as" at the top." with "One person plays every role; the "Working as" label shows whose page you are on." Buttons: **Download demo files (.zip)** = a link to `/demo/demo_files.zip` (with the `download` attribute). **Reset demo data** → rename to **Start over**: opens a shadcn AlertDialog "Start over? Everything you did in this demo is cleared." with Cancel and Start over; confirm calls `startOver()` and navigates to `/`. Replace the small line under the buttons with "Start over clears everything and returns here."
- Add one primary button **Start the demo** at the top, under the intro line, linking to `/new`.

## A5. New request (`/new`) , `A5_new-request.png`, for the Requester
**Real in this screen: only the spec Excel.** Every other field shows a fixed value from `demoRequestFields` (in `demo.ts`) and cannot be changed (render the selects and inputs **disabled**, with that single value).
- Intro paragraph under the title: replace with "Creates round 1 for the designer. In this prototype only the spec Excel is read for real; the other fields are fixed demo values."
- Product select: before a spec is read show "Upload the spec Excel first"; after, "Read from spec: {demoRequestFields.product} ({demoRequestFields.productCode})". Remove the "+ Create new product" option.
- Packaging piece: `demoRequestFields.piece`. Work ID: "{workId} (automatic)". Requested by: the Partner radio checked, both radios disabled. Partner, Project owner (relay), Assign to designer, Proof due: the fixed values. Notes for the designer: `demoRequestFields.notes`, read-only.
- **Spec Excel drop zone:** a real file input (`accept=".xlsx"`); clicking the zone or "browse" opens it. Drag and drop is optional. On file chosen: `await loadSpec(file)`. While `busy`, show "Reading the spec…". On success show "{file name} · uploaded" in the zone. On error show the message in red in the zone.
- **Create request** button: disabled until `session.pendingSpec` exists. Calls `createRequest()`, then navigate to `/upload`. **Cancel** links to `/`.
- **Right panel "Spec read":** before a spec: header "Spec read: nothing yet" and "Upload the spec Excel to see its mandatory (blue) fields." After `loadSpec`: header "Spec read: {fields.length} blue fields" from `session.pendingSpec`; line "{meta.specNumber} · version {meta.version} · valid from {meta.validFrom}" (leave out "file hash"); a toggle "Show the {n} fields" that expands a two-column table (Field = `label`, Value = `value`, all 19 rows).
- "What happens next" box: keep the first two sentences; delete the sentence about the spec file differing.
- If `session.request` already exists (a request was created), show at the top: "A request is already open: {workId}. Start over from Home to create a new one." and disable the form.

## B2.1. Upload proof (`/upload`) , `B2.1_upload-proof.png`, for the Designer
- Leave out the "‹ My tasks" link and the designer menu (one shared menu).
- Header: "Upload proof" and on the right "{request.product} · {request.piece} · {request.workId} · due {request.dueDate}".
- Round select: disabled, one option "Round {session.current} (latest): your upload". Delete the sentence about older rounds.
- **Left panel, round 2 and later:** title "Requested changes from round {current - 1} ({previousLines.length})". Rows from `previousLines`: number `n`, the Hungarian `text`, and `where` in grey under it when present. Leave out the proof image with numbered marks (use nothing in its place) and the sentence about marks under it; keep only the last grey sentence, shortened to: "Replying to a request is planned for the next version."
- **Left panel, round 1:** title "Requested changes" and the line "First round: nothing requested yet."
- **Materials box:** two links shown **disabled** with the title attribute "Not built in this prototype": "Spec (Excel), version {spec.meta.version}" and, from round 2, "Your round {current - 1} proof".
- **Proof PDF drop zone:** a real file input (`accept=".pdf"`). Keep the zone's text but replace the grey hint with "Use proof_v1.pdf for round 1, proof_v2.pdf for round 2, proof_v3.pdf for round 3 (from the demo files)." Show the chosen file name.
- **Note for the reviewers:** a normal textarea, empty by default (placeholder: "Optional, for example: Swapped the side panels to fit the barcode."). Passed with the upload.
- Grey info box: replace with "After you submit, the file is checked automatically and opens for review."
- **Submit proof for review**: disabled until a file is chosen. Calls `await uploadProof(file, note)`. While `busy` the button says "Checking…" and is disabled. On success navigate to `/review`; on error show it.

## A3.3 and A3.4. Review (`/review`), for Checker 1
One route. When `round.no === 1` the layout is `A3.3_review-round-1.png`; when `round.no >= 2` it is `A3.4_review-round-2.png`.

### Header (both)
- Title "{request.product} · {request.piece}". Right: "Round" and a disabled select with one option "Round {round.no} (latest)".
- Round 1 sub line: "{workId} · requested by {requestedBy} (PO {projectOwner}) · spec {spec.meta.specNumber} v{spec.meta.version}". Leave out "font limit".
- Round 2+ sub line: "Compared with round {no - 1} and its {lineChecks.length} requests · spec {specNumber} v{version}, unchanged" and, if `round.designerNote` is not empty, " · designer note: "{designerNote}"". Leave out the "Show changes from round 1" checkbox.
- Stepper line (round 1 PNG, use it on both): "Upload › Automatic check › **Checker 1 (you)** › Checker 2 › Approval".

### Check banner (both, under the stepper)
Replace the PNG's banner text with exactly one banner from `labels.ts`:
- `readMode === "text_layer"`: grey box, bold "Automatic check finished." then `readBanner.text_layer` and " ({round.seconds} s)".
- `readMode === "ai"`: grey box, bold "Automatic check finished." then `readBanner.ai` and " Resolution: {round.dpi} dpi." If `round.dpi < 100`, a second **amber** box with `lowResolutionBanner`.
- `readMode === "failed"`: **red** box with `readBanner.failed`. (The PNG's "Run again" button is not built.)

### Left column (both)
The proof viewer grey box (see "Rules for every page"). Leave out "+ Add finding", the zoom buttons, the legend text under the viewer, and on round 2 the v1/v2 panels.

### Right column, round 1: the findings panel
- Three tabs: **Undecided {n}** (the default) shows findings whose code is in `undecided`; **All {round.findings.length}**; **Matches {round.matches}**.
- A **finding row** (one per `round.findings` item, collapsed by default, click to expand): code (F1…), field `label` in bold, under it `summaryOf(finding, result)` where `result` is `round.results.find(r => r.id === finding.fieldId)`. On the right a badge `badgeOf(finding)` and a status chip: Undecided (dashed border), Real error (black), Not an error (grey).
- **Expanded row:** "Spec" `specValue`, "Proof" `foundValue` (or "not found"), "Where" `finding.where` (omit the line if empty). For a mismatch, under them the word difference from `result.diff` (spec → proof): `same` plain, `del` struck out in grey-red (in the spec, missing on the proof), `ins` bold green (on the proof, not in the spec), with a tiny legend "struck: spec only · bold: proof only". For a not-emphasised allergen: "Must be bold: {words}". Leave out the "Proof crop" box.
- **Decision buttons** in the expanded row: **Real error** → `decide(code, "real_error")`. **Not an error** → reveals the line "If not an error, pick a reason (optional note):" with the chips from `dismissReasons` (`demo.ts`) and a small note input. Clicking a chip calls `decide(code, "not_error", reasonText(chip, note))`. A decided row can be changed again. After a decision, collapse the row and expand the next undecided one.
- If `round.findings` is empty: "No findings. Every field matches the spec."
- **Matches tab:** a simple list of `round.results` with `verdict === "match"`: label in bold and `foundValue` under it. No buttons.
- Leave out the F7 (font size) and F8 (checker-added claim) rows: font size and checker-added findings are not built.

### Right column, round 2+: two tabs
- **Spec findings ({round.findings.length})**: exactly the round 1 panel above (rows, decisions, matches as a collapsed "Matches ({n})" section at the bottom).
- **Changes**, three sections, in this order:
  1. Grey header "Round {no - 1} comments: {done} done, {notDone} not done" (counts from `round.lineChecks`), then " · Done closes automatically." Rows from `round.lineChecks`: a status chip `lineVerdictLabel[verdict]` upper-cased (DONE green, NOT DONE red, CHECK BY HAND amber) and the Hungarian `text`. For a row that is not done, find its item in `items` (code `C{index+1}`): if it has `linkedTo`, show under the text "Same problem as {linkedTo} in Spec findings: decide it there." with no buttons; otherwise show Real error / Not an error with reason chips, as for findings. Leave out "reopen it as a real error".
  2. Grey header "Unrequested changes ({round.unrequested.length}) · nobody asked for these". One block per item: "{code}. {what}" in bold and " · {where}"; "Before" `change.before` (or "Not in round {no - 1}") and "Now" `change.after` in bold. If the item has `linkedTo`: "Same change as spec finding {linkedTo}: decided there, listed once." and no buttons. Otherwise two buttons: **Reject: add to send-back list** → `decide(code, "real_error")`; **Accept change** → `decide(code, "not_error")` (no reason needed). Show the current decision as a chip (Rejected / Accepted). If there are none: "No changes outside the earlier comments."
  3. "Moved only ({n}) · same text, other place, no action needed · show": `n` = `round.diff` items with `type === "moved"`. "show" toggles a list of their `before` texts. Do not list `unchanged` items.
- Round 3 (clean) uses the same layout; empty sections show their empty text.

### Footer (both)
A bordered bar as in the PNGs.
- Round 1 text: "**{open} findings undecided:** {codes of undecided, comma separated}". Round 2+: "**{open} items undecided:** {a} spec findings, {b} comments, {c} unrequested changes." (count `undecided` by `kind`: finding, line, unrequested). When `open === 0`: "**All decided.**"
- Second line: "When all are decided: any real error means Send back to designer, none means pass to Checker 2."
- **Finish review**: disabled while `open > 0` (as in the PNG). Calls `finishReview()` and navigates to `stepPath[session.step]` (that is `/send-back`, or `/checker-2` when nothing is a real error). Leave out the round 2 "Next: Build send-back list" line.

## A3.5. Send-back list (`/send-back`) , `A3.5_send-back.png`, for Checker 1
- Title "Send back to designer: round {round.no}", right "{product} · {piece} · {workId}". Keep the intro paragraph as in the PNG.
- Panel header "Requested changes ({round.sendBack.length})" and "Language: Hungarian".
- One row per `round.sendBack` item: number (position, 1-based), an auto-growing textarea with the `text`, under it `sourceOf(code)` in grey, and **Remove** → `editSendBack([{ code, remove: true }])`. Editing the textarea and leaving it (blur) → `editSendBack([{ code, text }])`; if the text is unchanged, do nothing.
- **+ Add a line** → shows a textarea and an **Add** button under it → `addManualLine(text)`; on success clear and hide it; show the error otherwise.
- Right panel "Goes to": `request.designer`, then "The round {round.no + 1} upload page opens with this list." Delete the sentence about numbered marks. Keep the dashed "Not included" box.
- **Back to review** → `backToReview()`, then `/review`. Put a small grey note under it: "Finishing the review again rebuilds this list."
- **Send to designer** → `sendToDesigner()`, then `/upload`. Disabled when the list is empty, with the red text "The send-back list is empty".

## A3.6. Checker 2 (`/checker-2`) , `A3.6_checker-2.png`, clickable
Uses the last round, `session.rounds[session.rounds.length - 1]` (call it `last`).
- Title "{product} · {piece}", right "{workId} · Round {last.no} · 4-eye check". Stepper "Upload › Automatic check › Checker 1 ({people.checker1}) ✓ › **4-eye check (you)** › Approval".
- Summary box: "Checker 1 found **no real errors** in this round. Your job: confirm that what was dismissed is really fine. {last.matches} fields match, {done} of {total} requests are done, {last.unrequested.length ?? 0} unrequested changes." (`done`/`total` from `last.lineChecks`; in round 1 write "no earlier requests" instead.)
- Proof viewer: the grey box.
- Right panel "Dismissed by Checker 1 ({dismissals.length})". One block per item in `dismissals`: code and `label` in bold; `summary`; grey line "{people.checker1}: not an error. Reason: {reason}." and, if `round !== last.no`, " (round {round})". Buttons: **Agree** → `checker2Agree(key, !agreed)` (shows "Agreed ✓" in green when `session.checker2Agreed[key]`), and **Disagree: real error** disabled with title "Not built in this prototype". Empty: "Nothing was dismissed. Nothing to confirm."
- Footer "Your decision": keep the explanation line. **Send back to designer** disabled (title "Not built in this prototype"). **Sign off and pass to approval** → `checker2SignOff()`, then `/lead`; show its error ("Agree with N dismissed items first").

## A3.7. Lead approval (`/lead`) , `A3.7_lead-approval.png`, clickable
- Title "Final approval: {product} · {piece}", sub "{workId} · Round {last.no} · both checkers signed" (only "Checker 1 signed" until `checker2SignedOff`).
- Proof viewer: the grey box; text "Final proof (v{last.no}). None open."
- **Summary:** "{last.matches} of {request.spec.fields.length} spec fields match · {last.findings.length} open findings" (leave out "font sizes OK"); "Checker 1: {people.checker1}, {formatTime(last.finishedAt)} · Checker 2: {people.checker2}, {formatTime(session.checker2SignedAt)}"; "Rounds: {session.rounds.length} · days from request to now: {daysBetween(request.createdAt)}".
- **Dismissed by the checkers ({dismissals.length})**: one line each "{code} · {label}: not an error, {reason} ({people.checker1}, agreed by {people.checker2})". Empty: "None."
- "Note (required when sending back)" textarea and **Send back with a reason**: both disabled (title "Not built in this prototype").
- **Approve** → `approve()`; show its error. When `session.approved`: replace the buttons and the grey footer text with a green box "**Approved** at {formatTime(session.approvedAt)}. Request {workId} is closed. The print file stage is planned for the next version." and a **Start over** button (same dialog as Home).

## N. Designed, not built (`/not-built`)
- Reads the `screen` search param. Title "Designed, not built in this prototype". Under it the screen's name (map: process-flow "0 Process flow", unclaimed "A2 Unclaimed", tasks-checker "A3 My tasks: checker", tasks-requester "A3.1 My tasks: requester", tasks-lead "A3.2 My tasks: lead", task-view "A3.8 Task view", track-all "A4 Track all work", designer-home "B1 Designer home", designer-tasks "B2 Designer my tasks"; unknown → show the raw value).
- Text: "This screen is part of the full design. The prototype builds only what proves the value: reading the spec, reading the proof, comparing them, and comparing two rounds." A link "Back to home" and the line "Design canvas: link to be added".
