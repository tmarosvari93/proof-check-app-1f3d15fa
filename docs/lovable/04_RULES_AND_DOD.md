# 04 Rules, build order and Definition of Done

## Files you may touch
- **Create and edit:** `src/routes/index.tsx`, `src/routes/new.tsx`, `src/routes/upload.tsx`, `src/routes/review.tsx`, `src/routes/send-back.tsx`, `src/routes/checker-2.tsx`, `src/routes/lead.tsx`, `src/routes/not-built.tsx`, and new files under `src/components/app/` for shared pieces (layout, proof placeholder, finding row, decision buttons).
- **Edit only to add the layout:** `src/routes/__root.tsx`. Keep `<SessionProvider>` and `<Outlet />` exactly as they are.
- **Never edit:** `src/core/`, `src/state/`, `src/mocks/`, `src/services/`, `src/components/ui/`, `tests/`, `fixtures/`, `scripts/`, `docs/`, `public/demo/`, `.github/`, `package.json`, `bun.lock`, `vitest.config.ts`. GitHub Actions runs the unit tests on every push; editing those folders breaks them.
- Routes are TanStack Start file routes in `src/routes/` (read `src/routes/README.md`). Not `src/pages/`. Use `Link` and `useNavigate` from `@tanstack/react-router`. Read `?screen=` and `?dev=` with the route's `validateSearch`.
- Do not rewrite git history.

## How it must look
- Copy the layout of the green-strip PNGs in `docs/lovable/wireframes/`: same sections, same order, same labels, same buttons, minus what `02_SCREENS.md` says to leave out.
- Greyscale like the PNGs, shadcn defaults, system font. Colour only for status chips (green, red, amber; see `02_SCREENS.md`).
- No logo, icons only where the PNG has a symbol (✓, ›), no animations, no illustrations, no dark mode work, no mobile layout work (desktop 1280 to 1440 px wide).
- If something is not covered by the PNG or `02_SCREENS.md`, take the simplest option and list it as an assumption.

## Never add
Database tables, Lovable Cloud features, authentication, file storage, edge functions, API calls, analytics, local storage, new npm packages, or any logic that decides a verdict. The only state is `useSession()`.

## Build order (check each against its `jumpTo` state before moving on)
1. Layout (top bar, menu, Demo box, `?dev=1` shortcuts) and `/not-built`.
2. Home.
3. New request (`new_request`, `new_request_spec_read`).
4. Upload proof (`r1_upload`, `r2_upload`).
5. Review round 1 (`r1_review`, then `r1_review_flat`, `r1_review_lowres`, `r1_review_failed`).
6. Review round 2+ (`r2_review`, `r3_review`).
7. Send-back list (`r1_sendback`, `r2_sendback`).
8. Checker 2 (`checker2`, `r3_review` finished), Lead (`lead`, `approved`).

## Definition of Done
The work is done only when **every** line below is true. In your final message, go through the list and mark each line ✅ or ❌ with one short note of what you saw.

**A. Pages and layout**
- [ ] A1 Eight routes exist and load without a console error: `/`, `/new`, `/upload`, `/review`, `/send-back`, `/checker-2`, `/lead`, `/not-built`.
- [ ] A2 Every built page matches its green-strip PNG in sections, order, labels and buttons, minus the items `02_SCREENS.md` says to leave out. No left-out item (Add finding, zoom, proof crop, font-size row, checker-added finding, "Run again", v1/v2 panels, Unclaimed count) appears anywhere.
- [ ] A3 Every proof viewer area is the grey "Proof preview: not built in this prototype." box.
- [ ] A4 The "Working as" chip shows the right role on each page (values from `workingAs`).
- [ ] A5 All 9 design-only entries (3 in the menu, also linked from the Home cards, and 6 under "More designed screens") open `/not-built` with the right screen name.
- [ ] A6 No name, ID, label or Hungarian line is typed into a page: they come from `useSession()`, `demo.ts`, `labels.ts` or `format.ts`.

**B. The demo story, clicked by hand without `jumpTo`** (download `/demo/demo_files.zip` from Home first)
- [ ] B1 Home → Start the demo → New request. Choose `spec_SP-2026-0417_v3.xlsx`: the panel says "Spec read: 19 blue fields", "SP-2026-0417 · version 3 · valid from …", and "Show the 19 fields" lists 19 rows. Create request → Upload proof, round 1.
- [ ] B2 Upload `proof_v1.pdf`: "Checking…" shows, then Review round 1: banner "Automatic check finished.", tabs "Undecided 6 · All 6 · Matches 14". Finish review is disabled and the footer lists the 6 codes.
- [ ] B3 Expand the Carbohydrate row: Spec 64,5 g, Proof 46,5 g, Where "Back panel, nutrition table"; the word difference shows 64,5 struck out (in the spec, not on the proof) and 46,5 in bold green (on the proof, not in the spec).
- [ ] B4 Mark all 6 rows Real error: the Undecided tab empties, the footer says "All decided.", Finish review opens the send-back list with 6 Hungarian lines, each with "From F… · real error".
- [ ] B5 On the send-back list: add " Köszönjük." to the end of line 1 and leave the field; + Add a line "Kérjük a vonalkódot ellenőrizni." (shows "Added by you"); then Remove that added line. Still 6 lines. Send to designer → Upload proof, round 2, listing the 6 lines sent (line 1 with your edit).
- [ ] B6 Upload `proof_v2.pdf` with the note "Swapped the side panels to fit the barcode.": Review round 2 shows the note in the sub line, the tab "Spec findings (2)", and on Changes: "5 done, 1 not done"; the not-done row says "Same problem as F1 in Spec findings: decide it there."; U1 (preparation 150 → 200 ml) says it is listed once under F2; U2 (new claim "Hozzáadott cukor nélkül") has Reject and Accept change; "Moved only (4)".
- [ ] B7 Footer reads "3 items undecided: 2 spec findings, 0 comments, 1 unrequested changes." Mark F1 and F2 Real error and **Accept change** on U2. Finish review shows 2 lines. Send to designer.
- [ ] B8 Upload `proof_v3.pdf`: Changes shows the 2 earlier lines DONE, no findings, "Matches 19", footer "All decided."; Finish review goes straight to Checker 2.
- [ ] B9 Checker 2 lists 1 item: U2 "New claim added", reason "Change accepted", round 2. Sign off is refused ("Agree with 1 dismissed item first") until you press Agree; then it opens Lead approval.
- [ ] B10 Lead shows 19 of 19 match, 0 open findings, both checker names with times, rounds 3, the U2 dismissal. Approve shows the green "Approved" box. Start over (with its dialog) returns to an empty Home.

**C. Errors and edge cases**
- [ ] C1 New request with a `.pdf` as spec shows "This file is not a readable .xlsx workbook"; Create request stays disabled.
- [ ] C2 Upload proof with a `.xlsx` shows "This file is not a PDF".
- [ ] C3 On a finding, Not an error without picking a reason chip saves nothing (only the chips save a dismissal); the row stays Undecided.
- [ ] C3b A hand-typed send-back line comes back in the next round as CHECK BY HAND with Real error / Not an error buttons (try with `?dev=1`: `r1_sendback`, add a line, send, upload any PDF).
- [ ] C4 Remove every send-back line: Send to designer is disabled and says "The send-back list is empty".
- [ ] C5 Open `/review`, `/send-back`, `/checker-2` and `/lead` in a fresh tab: each shows "Nothing to show here yet." with a working "Go to the current step" link. No crash.
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
