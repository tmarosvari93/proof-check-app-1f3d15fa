You are building the screens of a small, working prototype called **Proof Check**: it compares a food-packaging artwork proof (PDF) with the product spec (Excel), and a new proof version with the previous one, and lets people decide what is wrong. The logic is already written and tested. **Your job is only the screens**, rudimentary and faithful to the wireframes.

**Read before you write any code, in this order:**
1. `docs/lovable/01_PRODUCT.md`: what it is, who uses it, the words used.
2. `docs/lovable/wireframes/`: the PNGs. Green strip = build it, grey strip = do not build. (`all_17_wireframes.pdf` has all of them.) I also attached the 8 green ones to this message.
3. `docs/lovable/02_SCREENS.md`: per screen, where each element's data comes from, what each button calls, and what in the PNG to **leave out**. When it disagrees with a PNG, it wins.
4. `docs/lovable/03_DATA_AND_STORE.md`: the `useSession()` hook, its data and actions, and the `jumpTo` states.
5. `docs/lovable/04_RULES_AND_DOD.md`: which files you may touch, the look, the build order, and the **Definition of Done**.
Then open `src/state/types.ts`, `src/state/SessionProvider.tsx`, `src/state/demo.ts`, `src/state/labels.ts` and `src/state/format.ts`; you will import from them.

**Non-negotiable:**
- Never edit `src/core/`, `src/state/`, `src/mocks/`, `src/services/`, `src/components/ui/`, `tests/`, `fixtures/`, `scripts/`, `docs/`, `public/demo/`, `.github/`, `package.json`. Tests run on every push.
- Pages only read `useSession()` and call its actions. No verdict logic, no file parsing, no API calls, no database, no auth, no storage, no new packages.
- Routes are TanStack Start file routes in `src/routes/` (see `src/routes/README.md`), not `src/pages/`.
- Greyscale like the wireframes, shadcn defaults; colour only on status chips. No time on polish, branding, icons or mobile.
- English UI. Hungarian texts (spec values, send-back lines) are data: show them as they are.
- Names, IDs and labels come from `demo.ts`, `labels.ts` and `format.ts`: never retype them.

**How to work:** follow the build order in `04_RULES_AND_DOD.md`. Check each page against its `jumpTo` state (open any page with `?dev=1` for the shortcut row) before the next one. Before you say you are done, run every Definition of Done check yourself in the preview, including the full demo story clicked by hand with the demo files from `/demo/demo_files.zip`.

**Reply at the end with:** the routes built, the Definition of Done list marked ✅/❌ with a short note per line, your assumptions, and "Missing from the store" (or "none"). If something blocks you, stop and tell me instead of working around it.

First step now: reply with a 5-line plan and the list of files you will create. Do not write code until I say go.
