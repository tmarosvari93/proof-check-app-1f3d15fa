# 04 Rules, build order and Definition of Done

## Files you may touch
- **Create and edit:** `src/routes/index.tsx`, `src/routes/new.tsx`, `src/routes/upload.tsx`, `src/routes/review.tsx`, `src/routes/send-back.tsx`, `src/routes/checker-2.tsx`, `src/routes/lead.tsx`, new `src/routes/unclaimed.tsx`, `src/routes/my-tasks.tsx`, `src/routes/track-all.tsx`, and new files under `src/components/app/` for shared pieces (layout, proof placeholder, finding row, decision buttons).
- **Edit only to add the layout:** `src/routes/__root.tsx`. Keep `<SessionProvider>` and `<Outlet />` exactly as they are.
- **Never edit:** `src/core/`, `src/state/`, `src/mocks/`, `src/services/`, `src/components/ui/`, `tests/`, `fixtures/`, `scripts/`, `docs/`, `public/demo/`, `.github/`, `package.json`, `bun.lock`, `vitest.config.ts`. GitHub Actions runs the unit tests on every push; editing those folders breaks them.
- Routes are TanStack Start file routes in `src/routes/` (read `src/routes/README.md`). Not `src/pages/`. Use `Link` and `useNavigate` from `@tanstack/react-router`. Read `?screen=` and `?dev=` with the route's `validateSearch`.
- **Delete** `src/routes/not-built.tsx` and every link to it; remove `screen` from the root `validateSearch` (keep `dev`). `routeTree.gen.ts` regenerates itself.
- Do not rewrite git history.

## How it must look
- Copy the layout of the green-strip PNGs in `docs/lovable/wireframes/`: same sections, same order, same labels, same buttons, minus what `02_SCREENS.md` says to leave out.
- Greyscale like the PNGs, shadcn defaults, system font. Colour only for status chips (green, red, amber; see `02_SCREENS.md`).
- No logo, icons only where the PNG has a symbol (✓, ›), no animations, no illustrations, no dark mode work, no mobile layout work (desktop 1280 to 1440 px wide).
- If something is not covered by the PNG or `02_SCREENS.md`, take the simplest option and list it as an assumption.

## Never add
Database tables, Lovable Cloud features, authentication, file storage, edge functions, API calls, analytics, local storage, new npm packages, or any logic that decides a verdict. The only state is `useSession()`.

## Build order (check each against its `jumpTo` state before moving on)
1. Layout (top bar with the role switcher, per-role menu, Demo box, `?dev=1` shortcuts). Delete `/not-built`.
2. Home, Track all work (`/track-all`).
3. New request (`new_request`, `new_request_spec_read`).
4. Upload proof (`r1_upload`, `r2_upload`), Unclaimed (`r1_unclaimed`), My tasks (every role).
5. Review round 1 (`r1_review`, then `r1_review_flat`, `r1_review_lowres`, `r1_review_failed`).
6. Review round 2+ (`r2_review`, `r3_review`).
7. Send-back list (`r1_sendback`, `r2_sendback`).
8. Checker 2 (`checker2`, `r3_review` finished), Lead (`lead`, `approved`).

## Definition of Done
The work is done only when **every** line below is true. In your final message, go through the list and mark each line ✅ or ❌ with one short note of what you saw.

**A. Pages and layout**
- [ ] A1 Ten routes exist and load without a console error: `/`, `/new`, `/upload`, `/unclaimed`, `/my-tasks`, `/track-all`, `/review`, `/send-back`, `/checker-2`, `/lead`. `/not-built` does not exist (it shows the 404 page).
- [ ] A2 Every built page matches its green-strip PNG in sections, order, labels and buttons, minus the items `02_SCREENS.md` says to leave out. No left-out item (Add finding, zoom, proof crop, font-size row, checker-added finding, "Run again", v1/v2 panels, a count after Unclaimed) appears anywhere.
- [ ] A3 Review shows the real proof image with red marks for the spec findings that have a place on the page; clicking a mark opens its finding, clicking a row highlights its mark. A flat (image only) proof shows the image and the grey line that says there are no marks. The prepared `jumpTo` states have no image and show the grey placeholder.
- [ ] A4 "Working as" is a working switcher with the 5 roles. Picking one opens that role's task page (or Unclaimed for Checker 1 when a proof waits, else My tasks). Visiting a flow page (`/upload`, `/review`, …) switches the role to the one it belongs to. Each role's menu is `menuOf(role)`: Unclaimed only for Checker 1, "+ New request" only for the Requester.
- [ ] A5 There is no "More designed screens" list and no "Designed, not built" page anywhere. Unclaimed, My tasks and Track all work in the menu and on the Home cards open their real pages. Track all work shows the 8 sample rows and the note "Sample data, not functional…".
- [ ] A6 No name, ID, label or Hungarian line is typed into a page: they come from `useSession()`, `demo.ts`, `labels.ts` or `format.ts`.

**B. The demo story, clicked by hand without `jumpTo`** (download `/demo/demo_files.zip` from Home first)
- [ ] B1 Home → Start the demo → New request. Step 1 is the spec upload. Choose `spec_SP-2026-0417_v3.xlsx`: Step 2 shows "Spec SP-2026-0417 · version 3 · valid from …", "19 blue fields read" and a table with 19 rows, open. Step 3 stays locked until the checkbox "I have checked these values…" is ticked; then type a comment for the designer and press Create request → Upload proof, round 1 (the comment shows in "Comments from the requester").
- [ ] B2 Upload `proof_v1.pdf`: "Checking…" shows, then My tasks says the proof is waiting for a checker. Switch "Working as" to Checker 1: it opens Unclaimed with one row; Claim opens Review round 1 with the proof image and red marks on F1, F2, F3, F5, F6 (F4 is missing text and has none): banner "Automatic check finished.", tabs "Undecided 6 · All 6 · Matches 14". Finish review is disabled and the footer lists the 6 codes.
- [ ] B3 Expand the Carbohydrate row: Spec 64,5 g, Proof 46,5 g, Where "Back panel, nutrition table"; the word difference shows 64,5 struck out (in the spec, not on the proof) and 46,5 in bold green (on the proof, not in the spec).
- [ ] B4 Mark all 6 rows Real error: the Undecided tab empties, the footer says "All decided.", Finish review opens the send-back list with 6 Hungarian lines, each with "From F… · real error".
- [ ] B5 On the send-back list: add " Köszönjük." to the end of line 1 and leave the field; + Add a line "Kérjük a vonalkódot ellenőrizni." (shows "Added by you"); then Remove that added line. Still 6 lines. Send to designer → Upload proof, round 2, listing the 6 lines sent (line 1 with your edit).
- [ ] B6 (After each upload: My tasks → Checker 1 → Unclaimed → Claim.) Upload `proof_v2.pdf` with the note "Swapped the side panels to fit the barcode.": Review round 2 shows the note in the sub line, the tab "Spec findings (2)", and on Changes: "5 done, 1 not done"; the not-done row says "Same problem as F1 in Spec findings: decide it there."; U1 (preparation 150 → 200 ml) says it is listed once under F2; U2 (new claim "Hozzáadott cukor nélkül") has Reject and Accept change; "Moved only (4)".
- [ ] B7 Footer reads "3 items undecided: 2 spec findings, 0 comments, 1 unrequested changes." Mark F1 and F2 Real error and **Accept change** on U2. Finish review shows 2 lines. Send to designer.
- [ ] B8 Upload `proof_v3.pdf` (then claim it the same way): Changes shows the 2 earlier lines DONE, no findings, "Matches 19", footer "All decided."; Finish review goes straight to Checker 2.
- [ ] B9 Checker 2 lists 1 item: U2 "New claim added", reason "Change accepted", round 2. Sign off is refused ("Agree with 1 dismissed item first") until you press Agree; then it opens Lead approval.
- [ ] B9b The Round select on Review lists "Round 3 (latest)", "Round 2", "Round 1"; Round 1 opens read-only without decision buttons.
- [ ] B10 Lead shows 19 of 19 match, 0 open findings, both checker names with times, rounds 3, the U2 dismissal. Approve shows the green "Approved" box. Start over (with its dialog) returns to an empty Home.

**C. Errors and edge cases**
- [ ] C1 New request with a `.pdf` as spec shows "This file is not a readable .xlsx workbook"; Create request stays disabled.
- [ ] C2 Upload proof with a `.xlsx` shows "This file is not a PDF".
- [ ] C3 On a finding, Not an error without picking a reason chip saves nothing (only the chips save a dismissal); the row stays Undecided.
- [ ] C3b A hand-typed send-back line comes back in the next round as CHECK BY HAND with Real error / Not an error buttons (try with `?dev=1`: `r1_sendback`, add a line, send, upload any PDF).
- [ ] C4 Remove every send-back line: Send to designer is disabled and says "The send-back list is empty".
- [ ] C5 Open `/review`, `/send-back`, `/checker-2` and `/lead` in a fresh tab: each shows "Nothing to show here yet." with a working "Go to the current step" link. No crash. `/review` with an unclaimed proof says "This proof is not claimed yet." with a link to Unclaimed.
- [ ] C8 Safari and Chrome: upload `proof_v1.pdf` and `proof_v2_flat.pdf` in both; neither shows "undefined is not a function". (A bug fixed in `src/services`; never touch it from the pages.)
- [ ] C6 With `?dev=1`: `r1_review_lowres` shows the amber low-resolution banner and COULD NOT READ badges on number fields; `r1_review_failed` shows the red banner and 19 COULD NOT READ rows; `r1_review_flat` says it was read by AI at 150 dpi.
- [ ] C7 Without `?dev=1` the shortcut row is not visible.

**D. Build and code**
- [ ] D1 `bun run build` passes with no type errors.
- [ ] D2 `bun run test` still passes (114 tests or more) and `git diff` shows no change in the never-edit folders.
- [ ] D3 No new dependency in `package.json`.

## Final message format
1. Routes built.
2. The Definition of Done list with ✅/❌ and a short note per line.
3. Assumptions you made.
4. "Missing from the store" (things you needed and did not have), or "none".
Keep it short.
