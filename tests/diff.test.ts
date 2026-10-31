// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPdfPage, FIXTURES } from "./helpers/loadPdf";
import { parseSpecWorkbook } from "../src/core/parseSpec";
import { compareAll } from "../src/core/compare";
import { toFindings } from "../src/core/findings";
import { diffBlocks, isIgnored, panelOf } from "../src/core/diff";
import { compareRounds, recheckSendBack, relatedFields, type SendLine } from "../src/core/unrequested";
import type { Block } from "../src/core/textLayer";

const key = JSON.parse(readFileSync(join(FIXTURES, "answer_key.json"), "utf-8"));
const specP = parseSpecWorkbook(new Uint8Array(readFileSync(join(FIXTURES, "spec_SP-2026-0417_v3.xlsx"))));

async function pages() {
  const [v1, v2, v3] = await Promise.all(["proof_v1.pdf", "proof_v2.pdf", "proof_v3.pdf"].map((f) => loadPdfPage(f)));
  return { v1: v1!, v2: v2!, v3: v3! };
}

describe("diffBlocks: v2 against v1", () => {
  it("finds exactly the answer-key changes and moves, and nothing else", async () => {
    const { v1, v2 } = await pages();
    const { items } = diffBlocks(v1.blocks, v2.blocks, { page: v2 });
    const count = (t: string) => items.filter((i) => i.type === t).length;
    // modified: name front + back, carbs, salt, servings block, preparation; added: may-contain sentence, new claim
    expect(count("modified")).toBe(6);
    expect(count("added")).toBe(2);
    expect(count("removed")).toBe(0);
    expect(count("moved")).toBe(4);
    expect(items).toHaveLength(12);
    const exp = key.case_2_round2_v2_vs_v1.expected_unrequested_changes as { before: string | null; after: string }[];
    for (const e of exp) expect(items.some((i) => i.after === e.after || (e.before === null && i.after === e.after))).toBe(true);
  });
  it("lists the moved texts: storage, best before, manufacturer, origin", async () => {
    const { v1, v2 } = await pages();
    const moved = diffBlocks(v1.blocks, v2.blocks, { page: v2 }).items.filter((i) => i.type === "moved");
    expect(moved).toHaveLength(4);
    const text = moved.map((m) => m.before).join(" | ");
    for (const t of ["Száraz, hűvös", "Minőségét megőrzi", "Gyártja:", "Magyarországon előállítva."]) expect(text).toContain(t);
  });
  it("ignores the correction stamp, guide labels and not-printed notes", async () => {
    const { v1, v2 } = await pages();
    const all = diffBlocks(v1.blocks, v2.blocks, { page: v2 }).items.map((i) => `${i.before} ${i.after}`).join(" ");
    expect(all).not.toContain("KORREKTÚRA");
    expect(all).not.toContain("OLDALLAP");
    expect(all).not.toContain("nem nyomtatandó");
    expect(isIgnored("KORREKTÚRA v9 | 2026-11-01")).toBe(true);
    expect(isIgnored("Szénhidrát 64,5 g")).toBe(false);
  });
  it("reports the new claim as an added phrase, not as a rewritten block", async () => {
    const { v1, v2 } = await pages();
    const claim = diffBlocks(v1.blocks, v2.blocks, { page: v2 }).items.find((i) => i.after === "Hozzáadott cukor nélkül")!;
    expect(claim.type).toBe("added");
    expect(claim.before).toBeNull();
    expect(claim.where).toBe("Front panel");
  });
  it("pairs the front and the back name with their own copy", async () => {
    const { v1, v2 } = await pages();
    const names = diffBlocks(v1.blocks, v2.blocks, { page: v2 }).items.filter((i) => i.before?.startsWith("Sárgabarackos"));
    expect(names).toHaveLength(2);
    expect(names.map((n) => n.where).sort()).toEqual(["Back panel", "Front panel"]);
  });
  it("two identical proofs have no change", async () => {
    const { v2 } = await pages();
    const r = diffBlocks(v2.blocks, v2.blocks, { page: v2 });
    expect(r.items).toHaveLength(0);
    expect(r.unchanged).toBeGreaterThan(20);
  });
});

describe("diffBlocks: edge cases", () => {
  const mk = (id: string, text: string, x: number, y: number, bold = false): Block => ({
    id, page: 1, text, box: [x, y, x + 100, y + 10], fontSize: 8,
    lines: [], words: text.split(" ").map((w) => ({ text: w, bold })), boldWords: bold ? text.split(" ") : [],
  });
  const page = { width: 1000, height: 800 };
  it("a change of capitals is a change", () => {
    const r = diffBlocks([mk("a", "teljes tejpor", 100, 100)], [mk("b", "TELJES TEJPOR", 100, 100)], { page });
    expect(r.items.map((i) => i.type)).toEqual(["modified"]);
  });
  it("same text made bold is a change, noted as emphasis", () => {
    const r = diffBlocks([mk("a", "tejpor teszt", 100, 100)], [mk("b", "tejpor teszt", 100, 100, true)], { page });
    expect(r.items[0]).toMatchObject({ type: "modified", note: "emphasis changed" });
  });
  it("a text that moved only is moved; a small shift is not", () => {
    const far = diffBlocks([mk("a", "Egy mondat itt", 100, 100)], [mk("b", "Egy mondat itt", 600, 100)], { page });
    expect(far.items.map((i) => i.type)).toEqual(["moved"]);
    const near = diffBlocks([mk("a", "Egy mondat itt", 100, 100)], [mk("b", "Egy mondat itt", 110, 105)], { page });
    expect(near.items).toHaveLength(0);
  });
  it("a short bold heading that moves is not listed, but a changed heading is", () => {
    expect(diffBlocks([mk("a", "Tárolás", 100, 100, true)], [mk("b", "Tárolás", 700, 100, true)], { page }).items).toHaveLength(0);
    const changed = diffBlocks([mk("a", "Tárolás", 100, 100, true)], [mk("b", "Tárolási", 100, 100, true)], { page }).items;
    expect(changed.length).toBeGreaterThan(0);
  });
  it("a block only in the old proof is removed; only in the new one is added", () => {
    const r = diffBlocks([mk("a", "Régi sor teljesen más", 100, 100)], [mk("b", "Valami egészen új szöveg itt", 100, 400)], { page });
    expect(r.items.map((i) => i.type).sort()).toEqual(["added", "removed"]);
  });
  it("panelOf maps the page to panels", () => {
    expect(panelOf([20, 0, 200, 1], 1190)).toBe("Side panel");
    expect(panelOf([250, 0, 550, 1], 1190)).toBe("Front panel");
    expect(panelOf([850, 0, 1170, 1], 1190)).toBe("Back panel");
  });
});

// helper for the round tests: lines as sent after round 1 (the 6 real errors, one per field)
const LINES_R1: SendLine[] = (key.case_2_round2_v2_vs_v1.comments as { id: string }[]).map((c, i) => ({
  code: ["F1", "F2", "F3", "F4", "F5", "F6"][i]!,
  text: `line ${c.id}`,
  fieldId: ["name", "carbs", "salt", "ingredients", "servings", "may_contain"][i]!,
}));

async function round(prev: "v1" | "v2", cur: "v2" | "v3", lines: SendLine[]) {
  const p = await pages();
  const spec = await specP;
  const results = compareAll(spec.fields, p[cur].blocks);
  const findings = toFindings(results);
  return { out: compareRounds({ previous: p[prev].blocks, current: p[cur].blocks, page: p[cur], fields: spec.fields, lines, results, findings }), findings };
}

describe("round 2: v2 against v1 and the 6 lines sent", () => {
  it("C1 C2 C3 C5 C6 done, C4 not done", async () => {
    const { out } = await round("v1", "v2", LINES_R1);
    const expected = key.case_2_round2_v2_vs_v1.comments as { id: string; expected: string }[];
    expect(out.lineChecks.map((l) => l.verdict)).toEqual(expected.map((e) => e.expected));
  });
  it("two unrequested changes: preparation (linked to its spec finding, listed once) and the new claim", async () => {
    const { out, findings } = await round("v1", "v2", LINES_R1);
    expect(out.unrequested).toHaveLength(2);
    const [u1, u2] = out.unrequested;
    expect(u1).toMatchObject({ code: "U1", fieldIds: ["preparation"], where: "Side panel" });
    expect(u1!.change.after).toContain("200 ml");
    expect(u1!.linkedTo).toBe(findings.find((f) => f.fieldId === "preparation")!.code);
    expect(u2).toMatchObject({ code: "U2", where: "Front panel" });
    expect(u2!.change.after).toBe("Hozzáadott cukor nélkül");
    expect(u2!.linkedTo).toBeUndefined();
  });
  it("the requested edits (name, carbs, salt, servings, may-contain) are not unrequested", async () => {
    const { out } = await round("v1", "v2", LINES_R1);
    const txt = out.unrequested.map((u) => u.change.after).join(" ");
    for (const t of ["Mangós", "64,5", "0,18 g", "8 adagot", "Nyomokban"]) expect(txt).not.toContain(t);
  });
  it("a change is only requested if a sent line points at its field (remove the carbs line: carbs change becomes unrequested)", async () => {
    const { out } = await round("v1", "v2", LINES_R1.filter((l) => l.fieldId !== "carbs"));
    expect(out.unrequested.map((u) => u.fieldIds.join())).toContain("carbs");
  });
  it("a hand-typed line is Check by hand and covers nothing", async () => {
    const { out } = await round("v1", "v2", [...LINES_R1, { code: "M1", text: "Kérjük a vonalkódot ellenőrizni." }]);
    expect(out.lineChecks.at(-1)!.verdict).toBe("check_by_hand");
    expect(out.unrequested).toHaveLength(2);
  });
});

describe("round 3: v3 against v2", () => {
  // the lines after round 2 when the checker rejected both unrequested changes
  const LINES_R2: SendLine[] = [
    { code: "F1", text: "allergen", fieldId: "ingredients" },
    { code: "F2", text: "preparation", fieldId: "preparation" },
    { code: "U2", text: "claim", about: { text: "Hozzáadott cukor nélkül", expect: "absent" } },
  ];
  it("every line done, 0 unrequested, 0 spec findings", async () => {
    const { out, findings } = await round("v2", "v3", LINES_R2);
    expect(out.lineChecks.map((l) => l.verdict)).toEqual(["done", "done", "done"]);
    expect(out.unrequested).toHaveLength(0);
    expect(findings).toHaveLength(0);
    expect(key.case_3_round3_v3_vs_v2.expected_unrequested_changes).toHaveLength(0);
  });
  it("if the claim was accepted in round 2, taking it out in v3 is flagged as unrequested", async () => {
    const { out } = await round("v2", "v3", LINES_R2.slice(0, 2));
    expect(out.unrequested).toHaveLength(1);
    expect(out.unrequested[0]!.change).toMatchObject({ type: "removed", before: "Hozzáadott cukor nélkül" });
  });
  it("a claim line is not done while the claim is still on the proof (v2 as the new proof)", async () => {
    const { out } = await round("v1", "v2", [{ code: "U2", text: "claim", about: { text: "Hozzáadott cukor nélkül", expect: "absent" } }]);
    expect(out.lineChecks[0]!.verdict).toBe("not_done");
  });
});


import type { FieldResult } from "../src/core/compare";

describe("recheckSendBack and relatedFields: guards", () => {
  const res = (over: Partial<FieldResult>): FieldResult => ({ id: "f", label: "F", specValue: "v", verdict: "match", foundValue: "v", diff: [], occurrences: [], ...over });
  const line = (fieldId?: string) => ({ code: "F1", text: "t", ...(fieldId ? { fieldId } : {}) });
  it("a field that could not be read is never Done", () => {
    expect(recheckSendBack([line("f")], [res({ verdict: "could_not_read", foundValue: null })])[0]!.verdict).toBe("check_by_hand");
    expect(recheckSendBack([line("f")], [res({ allergen: { status: "could_not_check", words: [] } })])[0]!.verdict).toBe("check_by_hand");
  });
  it("a line whose field is not in the results, or that has no field, is Check by hand", () => {
    expect(recheckSendBack([line("zzz")], [res({})])[0]!.verdict).toBe("check_by_hand");
    expect(recheckSendBack([line()], [res({})])[0]!.verdict).toBe("check_by_hand");
  });
  it("match is Done, mismatch or an allergen still not emphasised is Not done", () => {
    expect(recheckSendBack([line("f")], [res({})])[0]!.verdict).toBe("done");
    expect(recheckSendBack([line("f")], [res({ verdict: "mismatch" })])[0]!.verdict).toBe("not_done");
    expect(recheckSendBack([line("f")], [res({ allergen: { status: "not_emphasised", words: ["X"] } })])[0]!.verdict).toBe("not_done");
  });
  it("a claim line needs the page text to be judged", () => {
    const l = { code: "U2", text: "t", about: { text: "Hozzáadott cukor nélkül", expect: "absent" as const } };
    expect(recheckSendBack([l], [])[0]!.verdict).toBe("check_by_hand");
    expect(recheckSendBack([l], [], "Erősíti az immunrendszert!")[0]!.verdict).toBe("done");
    expect(recheckSendBack([l], [], "Erősíti. Hozzáadott cukor nélkül")[0]!.verdict).toBe("not_done");
  });
  it("same words in a different emphasis still touch the fields in the block", () => {
    const item = { id: "X1", type: "modified" as const, before: "a", after: "a", note: "emphasis changed", beforeIds: ["p"], afterIds: ["c"] };
    const prev = new Map([["p", { ingredients: "same text" }]]);
    const cur = new Map([["c", { ingredients: "same text" }]]);
    expect(relatedFields(item, prev, cur)).toEqual(["ingredients"]);
    expect(relatedFields({ ...item, note: undefined as unknown as string }, prev, cur)).toEqual([]);
  });
});
