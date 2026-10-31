// Step 3: the real check, round by round, on the real fixtures, against fixtures/answer_key.json.
// The flow mirrors the demo story: v1 -> checker marks everything a real error -> v2 -> v3.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpecWorkbook, type ParsedSpec } from "../src/core/parseSpec";
import { checkProof, sendLinesOf } from "../src/services/runCheck";
import { buildRoundSendBack, reviewItems } from "../src/state/roundLogic";
import type { Round } from "../src/state/types";
import { FIXTURES, loadPdfPage } from "./helpers/loadPdf";

const key = JSON.parse(readFileSync(join(FIXTURES, "answer_key.json"), "utf8"));
let spec: ParsedSpec;

async function round(no: number, file: string, previous?: Round): Promise<Round> {
  spec ??= await parseSpecWorkbook(new Uint8Array(readFileSync(join(FIXTURES, "spec_SP-2026-0417_v3.xlsx"))));
  const page = await loadPdfPage(file);
  return checkProof({ spec, page, no, fileName: file, ...(previous ? { previous } : {}) });
}

/** The checker marks every item that needs a decision as a real error and finishes: builds the send-back list. */
function finished(r: Round): Round {
  const decisions = Object.fromEntries(reviewItems(r).filter((i) => i.needsDecision).map((i) => [i.code, "real_error" as const]));
  const d = { ...r, decisions };
  return { ...d, finished: true, sendBack: buildRoundSendBack(d) };
}

const fieldOf = (r: Round, code: string) => r.findings.find((f) => f.code === code)?.fieldId;

describe("round 1: v1 against the spec (case 1)", () => {
  it("finds the 6 seeded errors, 14 matches, no false match", async () => {
    const r = await round(1, "proof_v1.pdf");
    expect(r.readMode).toBe("text_layer");
    expect(r.results).toHaveLength(19);
    const byField = Object.fromEntries(r.findings.map((f) => [f.fieldId, f.kind]));
    const expected: Record<string, string> = {};
    for (const e of key.case_1_round1_v1_vs_spec.expected_findings) {
      expected[e.field] = e.verdict === "mismatch" ? "spec_mismatch" : e.verdict === "missing" ? "spec_missing" : e.verdict;
    }
    expect(byField).toEqual(expected);
    expect(r.matches).toBe(key.case_1_round1_v1_vs_spec.expected_matches.length);
    // no false match: every seeded error field is not a match
    for (const e of key.case_1_round1_v1_vs_spec.expected_findings.filter((x: { verdict: string }) => x.verdict !== "allergen_not_emphasised")) {
      expect(r.results.find((x) => x.id === e.field)?.verdict).not.toBe("match");
    }
  });
  it("gives the name mismatch once although it is printed twice, and a panel for each placed finding", async () => {
    const r = await round(1, "proof_v1.pdf");
    expect(r.findings.filter((f) => f.fieldId === "name")).toHaveLength(1);
    expect(r.findings.find((f) => f.fieldId === "carbs")?.where).toBe("Back panel");
    expect(r.findings.find((f) => f.fieldId === "may_contain")?.where).toBeUndefined(); // missing: no place to point to
  });
  it("keeps the blocks for the next round", async () => {
    const r = await round(1, "proof_v1.pdf");
    expect(r.blocks?.length).toBeGreaterThan(10);
    expect(r.page?.width).toBeGreaterThan(0);
  });
});

describe("round 2: v2 against v1 (case 2)", () => {
  it("re-checks each line, flags the 2 unrequested changes, lists moves only as moved", async () => {
    const r1 = finished(await round(1, "proof_v1.pdf"));
    expect(r1.sendBack).toHaveLength(6);
    const r2 = await round(2, "proof_v2.pdf", r1);

    // C1..C6 are the six lines sent: only the allergen line (ingredients) is still not done
    expect(r2.lineChecks).toHaveLength(6);
    const verdictByField = Object.fromEntries(r2.lineChecks!.map((l) => [l.fieldId, l.verdict]));
    expect(verdictByField).toEqual({ name: "done", carbs: "done", salt: "done", servings: "done", may_contain: "done", ingredients: "not_done" });

    // spec findings in v2: preparation and ingredients
    expect(r2.findings.map((f) => f.fieldId).sort()).toEqual(["ingredients", "preparation"]);

    // exactly 2 unrequested: preparation (linked to its spec finding) and the new claim
    expect(r2.unrequested).toHaveLength(2);
    const prep = r2.unrequested!.find((u) => u.fieldIds?.includes("preparation"))!;
    expect(prep.change.type).toBe("modified");
    expect(fieldOf(r2, prep.linkedTo!)).toBe("preparation");
    const claim = r2.unrequested!.find((u) => u.change.after === "Hozzáadott cukor nélkül")!;
    expect(claim.change.type).toBe("added");
    expect(claim.linkedTo).toBeUndefined();

    // storage, best before, manufacturer, origin: moved only, never open
    const moved = r2.diff!.filter((d) => d.type === "moved").map((d) => d.before ?? "");
    for (const frag of ["tárolandó", "Minőségét megőrzi", "Gyártja:", "Magyarországon előállítva"]) {
      expect(moved.some((m) => m.includes(frag))).toBe(true);
    }
    const unreqText = r2.unrequested!.map((u) => `${u.change.before} ${u.change.after}`).join(" ");
    expect(unreqText).not.toMatch(/tárolandó|Gyártja|Minőségét|Magyarországon előállítva/);
    // the proof stamp (KORREKTÚRA v1 -> v2) is ignored
    expect(r2.diff!.some((d) => /KORREKT/i.test(`${d.before} ${d.after}`))).toBe(false);
  });
});

describe("round 3: v3 against v2 (case 3)", () => {
  it("everything is done, nothing unrequested, no spec findings", async () => {
    const r1 = finished(await round(1, "proof_v1.pdf"));
    const r2 = finished(await round(2, "proof_v2.pdf", r1));
    const r3 = await round(3, "proof_v3.pdf", r2);
    expect(r3.findings).toEqual([]);
    expect(r3.matches).toBe(19);
    expect(r3.unrequested).toEqual([]);
    expect(r3.lineChecks!.length).toBeGreaterThan(0);
    expect(r3.lineChecks!.every((l) => l.verdict === "done")).toBe(true);
    expect(reviewItems(r3).filter((i) => i.needsDecision)).toEqual([]);
  });
  it("the unrequested-change line is re-checked by its text: the claim must be gone", async () => {
    const r1 = finished(await round(1, "proof_v1.pdf"));
    const r2 = finished(await round(2, "proof_v2.pdf", r1));
    expect(sendLinesOf(r2).some((l) => l.about?.expect === "absent" && l.about.text === "Hozzáadott cukor nélkül")).toBe(true);
    // v2 sent again as the next proof: the claim is still there, so the line is Not done
    const again = await round(3, "proof_v2.pdf", r2);
    const claimLine = again.lineChecks!.find((l) => /Hozzáadott/.test(l.text));
    expect(claimLine?.verdict).toBe("not_done");
  });
});

describe("failure and edge cases", () => {
  it("a flat proof (no text layer) is a failed read: 19 Could not read, never a pass", async () => {
    const r = await round(1, "proof_v1_flat.pdf");
    expect(r.readMode).toBe("failed");
    expect(r.matches).toBe(0);
    expect(r.findings).toHaveLength(19);
    expect(r.findings.every((f) => f.kind === "could_not_read")).toBe(true);
    expect(r.blocks).toBeUndefined();
  });
  it("round 2 on a flat proof re-checks lines as Check by hand and finds no unrequested changes", async () => {
    const r1 = finished(await round(1, "proof_v1.pdf"));
    const r2 = await round(2, "proof_v2_flat.pdf", r1);
    expect(r2.readMode).toBe("failed");
    expect(r2.lineChecks!.every((l) => l.verdict === "check_by_hand")).toBe(true);
  });
  it("a previous round without blocks (prepared demo state) still re-checks the lines but has no diff", async () => {
    const r1 = finished(await round(1, "proof_v1.pdf"));
    const { blocks: _b, page: _p, ...noBlocks } = r1;
    void _b; void _p;
    const r2 = await round(2, "proof_v2.pdf", noBlocks as Round);
    expect(r2.diff).toBeUndefined();
    expect(r2.lineChecks).toHaveLength(6);
    expect(r2.lineChecks!.find((l) => l.fieldId === "ingredients")?.verdict).toBe("not_done");
  });
  it("a line typed by hand (M1) is Check by hand", async () => {
    const r1 = finished(await round(1, "proof_v1.pdf"));
    const withManual = { ...r1, sendBack: [...r1.sendBack, { code: "M1", text: "Kérjük a logót cserélni." }] };
    const r2 = await round(2, "proof_v2.pdf", withManual);
    expect(r2.lineChecks!.find((l) => l.code === "M1")?.verdict).toBe("check_by_hand");
  });
});
