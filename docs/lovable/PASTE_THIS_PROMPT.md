You are building the screens of a small prototype called **Proof Check**. You know nothing about it yet, so read the docs first. Do not start coding before you have read all of them.

Read these files in this repo, in this order:
1. `docs/lovable/01_PRODUCT.md` : what the product is, who uses it, the vocabulary
2. `docs/lovable/02_SCREENS.md` : every screen: who it is for, what it shows, what each button does
3. `docs/lovable/03_DATA_AND_STORE.md` : the data you receive and the `useSession()` hook
4. `docs/lovable/04_RULES.md` : what you may and may not touch, how simple the UI must be, when you are done

Your job in one paragraph: build the pages listed in `02_SCREENS.md` as plain, working, rudimentary screens. All the logic already exists. You do not compute verdicts, parse files or call any API. Every page reads from `useSession()` and calls its actions. The session store is already mounted in `src/routes/__root.tsx` and already holds realistic mock data, so every page can be built and clicked through right now.

Hard rules:
- Do NOT edit `src/core/`, `src/state/`, `src/mocks/`, `src/services/`, `tests/`, `fixtures/`, `scripts/` or `.github/`. Read them freely.
- Routes are TanStack Start file routes in `src/routes/` (not `src/pages/`). Use `<Link>` and `useNavigate` from `@tanstack/react-router`.
- Rudimentary UI: the default shadcn look from `src/components/ui`, no custom branding, no animations, no time spent on colour or polish. Status colours only: green = match/done, red = error, amber = could not read, grey = moved/no action.
- No database, no auth, no storage, no new packages, no API calls. Nothing is saved; a refresh starts over.
- English UI text. The Hungarian text you see (spec values, send-back lines) is data: show it as is.

Start with the shared layout (top bar, side menu with all 17 screens, "Start over") and the Home page, then the pages in the order given in `04_RULES.md`. When done, tell me which pages exist and which of the checks in `04_RULES.md` you ran.
