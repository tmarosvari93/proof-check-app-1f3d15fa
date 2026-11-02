# Proof Check

A prototype for a food manufacturer's quality team: it checks packaging artwork proofs (PDF) against the product spec (Excel), and from round 2 shows what changed since the last version, whether earlier comments were fixed, and what changed that nobody asked for. The software only highlights; every decision stays with a person.

Built for Adroit Group's AI Product Builder assignment, Task 02, from a real discovery call. **The client is anonymised and all product data here is fictional.**

- **Live demo:** LIVE_URL_TASK02 (no login, nothing to install)
- **Demo files:** download `demo_files.zip` from the home page, or from `public/demo/` in this repo

## Try it in five minutes

The demo product is a fictional mango instant oatmeal box (spec SP-2026-0417 v3, 19 mandatory "blue" fields).

1. **New request:** upload `spec_SP-2026-0417_v3.xlsx`.
2. **Round 1:** upload `proof_v1.pdf`. It has 6 planted errors: a flavour name left from an apricot design, carbohydrate 46,5 instead of 64,5 g, salt in mg instead of g, 10 servings instead of 8, a missing "may contain" sentence, and an allergen not in bold. Decide each finding, then send the list back.
3. **Round 2:** upload `proof_v2.pdf`. Five errors are fixed, the allergen is still not bold, the side panels are swapped (moved, not changed), and two changes nobody asked for appear: preparation 150 ml to 200 ml and a new "no added sugar" claim.
4. **Round 3:** upload `proof_v3.pdf`, which is clean. Checker 2 confirms the dismissals and the lead approves.

The `*_flat.pdf` files are the same proofs as images with no text layer. Those are read by AI; the vector PDFs are read exactly from their text layer. A banner on the review screen says which.

One person plays every role. Use the "Working as" switcher at the top to change between requester, designer, Checker 1, Checker 2 and lead.

## What is built and what is designed only

The full design has 17 screens (`docs/lovable/wireframes/`, also as one PDF). The prototype builds the 8 that prove the value: new request, upload proof, my tasks, unclaimed work, review, send-back list, Checker 2 and lead approval, plus a "Track all work" overview filled with sample rows. The rest are designed, not built.

## Run it locally

Requires [Bun](https://bun.sh) (the repo has a `bun.lock`).

```sh
git clone https://github.com/tmarosvari93/proof-check-app-1f3d15fa
cd proof-check-app-1f3d15fa
bun install
bun run dev      # local dev server
bun run test     # 229 tests
```

Vector PDFs work locally with no setup. Reading **flat (image-only) proofs** calls the Supabase edge function `supabase/functions/read-proof`, which needs the secret `ANTHROPIC_API_KEY` set in Lovable Cloud (or your own Supabase project). Use the live demo to try flat proofs.

## How it is built

- TanStack Start, React, TypeScript, Vite, Tailwind, shadcn/ui; built with Lovable and Claude.
- `src/core/`: the checking logic as plain, tested functions: read the blue spec cells (`parseSpec`), compare spec with proof (`compare`), diff two versions ignoring layout moves (`diff`, `unrequested`), build the send-back list (`sendBack`), and the review workflow (`stateMachine`).
- `src/services/`: PDF text extraction and rendering, and the call to the AI reader.
- `supabase/functions/read-proof/`: the only server code. Claude vision transcribes a flat proof page; it never gives a verdict. Plain code compares the text with the spec, and the AI reply is schema-checked in the browser.
- `fixtures/` and `fixtures/answer_key.json`: the demo files and the expected findings the tests check against.
- `docs/lovable/`: product, screens, data and rules documents, and the wireframes.

## Known limitations

- Prototype only: no login, one person plays every role, and the demo state lives in the browser tab (a reload starts over).
- The proof is shown on the review screen; Checker 2 and lead approval show a placeholder instead.
- The `read-proof` endpoint has no sign-in or rate limit. Acceptable for a demo with fictional files, not for real use.
- Out of scope, listed as next steps: font-size measurement, a legal-claim database, multilingual allergen checks, the print-file check.
- AI reading of flat proofs has been tested on the fictional proofs only, not on real client files.
