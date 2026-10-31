# 01 Product: what Proof Check is

## The problem (a real client, anonymised; all data here is fictional)
A food manufacturer prints packaging (boxes, pouches, labels). For every product the quality team keeps a spec in Excel. Some cells are **blue**: the legally mandatory label texts. A graphic designer (the company's own team or a partner studio) makes a packaging artwork **proof** as a PDF. People on the quality team check the proof against the spec **by hand**, one after another (four-eyes). They look for typos, swapped numbers, wrong units (g instead of mg), leftover text from a reused design, missing legal items and allergens that are not emphasised. They send comments back; the designer sends a new version; they check again, including whether the designer changed things nobody asked for. This repeats several rounds per product and costs each checker 1 to 2 hours a day.

## What this prototype does
Two checks run automatically; every decision stays with a person.
1. **Spec vs proof:** reads the blue cells of the spec Excel, reads the proof, lists every difference.
2. **Version vs version** (round 2 and later): shows what changed in content (not position) since the last round, whether each earlier comment was fixed, and what changed that nobody asked for.

The software only highlights. Checker 1 decides each item (real error, or not an error with a reason), Checker 2 confirms the dismissals, the lead approves.

## Who uses which screen
| Person (fictional, from `src/state/demo.ts`) | Role | Screens |
|---|---|---|
| Bence N. | Requester: starts a request by uploading the spec | A5 New request |
| Studio Fiktív | Designer at a partner studio: uploads each proof version | B2.1 Upload proof |
| Anna K. | Checker 1: decides every finding, sends the list back | A3.3/A3.4 Review, A3.5 Send-back list |
| Péter S. | Checker 2: second pair of eyes (4-eye check) on what Checker 1 dismissed | A3.6 Checker 2 |
| Dr. Kovács E. | Food-safety lead: final approval | A3.7 Lead approval |

In the prototype **one person plays every role**. There is no login. The "Working as" chip at the top of each page says whose page it is.

The full design has 17 screens (`docs/lovable/wireframes/`, also as one PDF). This prototype builds the 8 that prove the value; the other 9 are designed only and open a "Designed, not built" page.

## The demo product
"Mangós instant zabkása 400 g" (mango instant oatmeal), box CS-20931, work ID WRK-0142, spec SP-2026-0417 version 3 with 19 mandatory (blue) fields.
- **Round 1** (`proof_v1.pdf`) has 6 planted errors: the flavour name left over from an apricot design (front and back), carbohydrate 46,5 instead of 64,5 g, salt in mg instead of g, 10 servings instead of 8, the may-contain sentence missing, and the allergen TELJES TEJPOR not in bold.
- **Round 2** (`proof_v2.pdf`) fixes five, leaves the allergen emphasis unfixed, swaps the two side panels (moved, not changed) and adds two changes nobody asked for: preparation 150 ml → 200 ml and a new claim "Hozzáadott cukor nélkül".
- **Round 3** (`proof_v3.pdf`) is clean.
Each proof also exists as an image-only "flat" PDF, which the full version reads with AI.

## Vocabulary
- **Spec**: the Excel file. **Blue fields**: the 19 mandatory label items read from it.
- **Proof**: the artwork PDF. **Round**: one proof version (1, 2, 3).
- **Finding** (F1, F2 …): a difference between spec and proof. Kinds: Does not match the spec, Missing on the proof, Allergen not emphasised, Could not read.
- **Match**: the proof text equals the spec. Matches never need a decision.
- **Could not read**: the system could not read this reliably. Never shown as a match.
- **Send-back list**: the numbered Hungarian lines sent to the designer, built from what the checker marked Real error. The checker can edit, remove and add lines.
- **Earlier line** (C1, C2 …): a line of the previous send-back list. In round 2+ each is re-checked: Done, Not done, or Check by hand (a line the checker typed).
- **Unrequested change** (U1, U2 …): content changed since the last round that nobody asked for. Buttons: "Reject: add to send-back list" or "Accept change".
- **Moved only**: same text in another place (side panels swapped). No action.
- **Real error**: the checker confirms it; it goes on the send-back list.
- **Not an error** (a dismissal): the checker picks a reason (Print sample OK, Spec outdated, Other). Accepting an unrequested change is a dismissal too. Checker 2 confirms every dismissal.
- **Linked item**: an earlier line still not done, or an unrequested change, that is the same problem as a spec finding in this round. It is decided once, on the spec finding, and listed once.
- **Text layer / read by AI**: a vector PDF has real text and is read exactly; an image-only PDF is read by AI. A banner on the review says which.
