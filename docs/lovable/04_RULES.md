# 04 Rules, build order and when you are done

## Files
You MAY create and edit: `src/routes/*.tsx` (the 8 routes above), `src/components/*` (shared pieces, but not `src/components/ui`, which is the shadcn library: use it, do not change it), `src/styles.css` (only if you must).
You MAY edit `src/routes/__root.tsx` only to add the layout; keep `<SessionProvider>` and `<Outlet />`.
You MUST NOT edit: `src/core/`, `src/state/`, `src/mocks/`, `src/services/`, `tests/`, `fixtures/`, `scripts/`, `.github/`, `docs/`, `public/demo/`. Read them freely. GitHub Actions runs unit tests on every push; if you edit those folders the tests fail.
Do not rewrite published git history.

## How simple
- Default shadcn components, default theme, no custom fonts, no logo, no animations.
- A page is a heading, a few sections, tables or lists, and buttons. No cards inside cards, no icons unless free from the existing library, no empty-state illustrations.
- Status colour only: green (match, done, approved), red (error, not done), amber (could not read, check by hand), grey (moved, no action).
- Desktop width only. Do not spend time on mobile.
- If a choice is not in the docs, take the simplest one and list it at the end as an assumption.

## Do not add
Database, Lovable Cloud tables, authentication, file storage, edge functions, analytics, new npm packages, API calls, local storage. The only state is `useSession()`.

## Build order
1. Layout (top bar, side menu, `?dev=1` shortcuts) and Home.
2. Not built page.
3. New request, then Upload proof.
4. Review (the biggest page; build round 1 first with `jumpTo("r1_review")`, then round 2 with `jumpTo("r2_review")`, then the banners with `r1_review_flat`, `r1_review_lowres`, `r1_review_failed`).
5. Send-back list.
6. Checker 2, Lead approval.

## Demo story: this must work by clicking, with `jumpTo` not used
1. Home → **Start the demo** → New request: choose any `.xlsx`, **Create request**. The spec panel shows 19 fields.
2. Upload proof: choose any `.pdf`, **Run check**. Review round 1 shows 6 findings and 14 matches, all open. **Finish review** at this point shows "6 items still need a decision".
3. Mark all 6 as **Real error**, **Finish review**. The send-back list shows 6 Hungarian lines. Edit one, remove one, add one. **Send to designer**.
4. The upload page (round 2) shows the lines you sent. Upload a `.pdf`. Review round 2 shows 5 earlier lines Done and 1 Not done (listed under the allergen finding), the changes, and the unrequested changes (preparation 150 ml → 200 ml, shown under its finding, and the new claim "Hozzáadott cukor nélkül"). Storage, best before, manufacturer and origin appear under **Moved only**. Mark the 3 open items (F1, F2, U2), **Finish review**, **Send to designer**.
5. Upload a `.pdf` for round 3. Review round 3 shows 0 findings. **Finish review** → Checker 2 → **Sign off** → Lead → **Approve** → "Approved". **Start over** returns to Home.

## Checks you must run before you say you are done
Run these in the preview and say in your final message which you ran and what you saw:
1. The 5-step demo story above, start to end.
2. Upload a non-`.xlsx` on New request and a non-`.pdf` on Upload proof: the error text shows, nothing crashes.
3. Click **Finish review** with items open: the "still need a decision" message shows.
4. Dismiss without a reason: the reason message shows.
5. On the send-back list, remove every line and press **Send to designer**: "The send-back list is empty" shows.
6. Open every one of the 9 "Designed, not built" menu links: the page shows the right screen name.
7. **Start over** at any step returns to Home with nothing left.
8. Open `/review` directly in a fresh tab: "Nothing to show yet" with a link, no crash.
9. `bun run build` passes.

## Final message format
List: the routes you built, the 9 checks with one line each (ran / result), any assumption you made, and any "Missing from the store" items. Keep it short.
