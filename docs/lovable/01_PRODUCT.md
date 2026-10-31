# 01 Product: what Proof Check is

## The problem (a real client, anonymised)
A food manufacturer prints packaging (boxes, pouches, labels). For every product the quality team keeps a spec in Excel. Some cells are coloured **blue**: these are the legally mandatory label texts. A graphic designer (the company's own team or a partner studio) makes a packaging artwork **proof** as a PDF. People on the quality team then check the proof against the spec **by hand**, one person after another (four-eyes). They look for typos, swapped numbers, wrong units (g instead of mg), leftover text from a reused design, and missing legal items. They send comments back as PDF notes. The designer sends a new version. The team checks again, including whether the designer also changed things nobody asked for. This repeats several rounds per product and costs each checker 1 to 2 hours a day.

## What this prototype does
Proof Check does two checks automatically and leaves every decision to a human:
1. **Spec vs proof**: reads the blue cells of the spec Excel, reads the proof, and lists every difference.
2. **Version vs version**: for round 2 and later, shows what changed in content (not position) since the last round, whether each earlier comment was fixed, and what changed that nobody asked for.

The software only highlights. Humans decide: the checker marks each finding as a real error or dismisses it with a reason; a second checker agrees; a lead approves.

## Who uses which screen
| Person | In the demo | Screens |
|---|---|---|
| Requester / project owner (Kovács Anna) | Starts the request by uploading the spec | New request |
| Designer (Nagy Péter, partner Studio Fiktív) | Uploads proof versions | Upload proof |
| Checker 1 (Tóth Gábor) | Reviews findings, decides, sends the list back | Review, Send-back |
| Checker 2 (Szabó Réka) | Second pair of eyes: agrees with the dismissals, signs off | Checker 2 |
| Lead (Dr. Varga László) | Final approval | Lead approval |

In the prototype **one person plays every role**. There is no login. A small label on each page says which role the page is for ("Working as: Checker 1"). All names are fictional.

## The demo product (fictional)
"Mezőlak Mangós instant zabkása" (mango instant oatmeal), box piece CS-20931, spec SP-2026-0417 version 3, 19 mandatory (blue) fields. Proof round 1 has 6 deliberately planted errors. Round 2 fixes five of them but adds two changes nobody asked for. Round 3 is clean.

## Vocabulary
- **Spec**: the Excel file. **Blue fields**: the 19 mandatory label items read from it.
- **Proof**: the artwork PDF. **Round**: one version of the proof (1, 2, 3). 
- **Finding** (code F1, F2 ...): a difference between spec and proof. Kinds: Does not match the spec, Missing on the proof, Allergen not emphasised, Could not read.
- **Match**: a field whose proof text equals the spec. Matches are never "open".
- **Could not read**: the system could not read this field reliably. It is never shown as a match.
- **Send-back list**: the numbered Hungarian lines the checker sends to the designer. Built from the findings the checker marked as real errors.
- **Earlier line** (code C1, C2 ...): a line of the previous send-back list. In round 2 the system re-checks each: Done, Not done, or Check by hand.
- **Unrequested change** (code U1, U2 ...): content that changed since the last round and was not asked for.
- **Moved only**: the same text in a different place (for example side panels swapped). Needs no action.
- **Dismiss**: the checker says a finding is not an error and must type a reason. Checker 2 reviews dismissals.
- **Real error**: the checker confirms the finding; it goes on the send-back list.
- **Text layer / read by AI**: a vector PDF has real text and is read exactly. An image-only ("flat") PDF is read by AI. Both are shown in a banner.
