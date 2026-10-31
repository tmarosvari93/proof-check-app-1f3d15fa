// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPdfPage, FIXTURES } from "./helpers/loadPdf";
import { parseSpecWorkbook } from "../src/core/parseSpec";
import { compareAll, compareField, allergenCheck, normalise, wordDiff, MIN_DPI } from "../src/core/compare";
import { locateField, similarity } from "../src/core/locate";
import { toFindings, countMatches, openCount, sendable } from "../src/core/findings";
import { buildSendBack } from "../src/core/sendBack";
import type { Occurrence } from "../src/core/locate";

const key = JSON.parse(readFileSync(join(FIXTURES, "answer_key.json"), "utf-8"));
const specPromise = parseSpecWorkbook(new Uint8Array(readFileSync(join(FIXTURES, "spec_SP-2026-0417_v3.xlsx"))));

const occ = (text: string, boldWords: string[] = []): Occurrence => ({ blockId: "b", page: 1, text, box: [0, 0, 1, 1], boldWords });
const f = (value: string, id = "x", label = "X") => ({ id, label, value });

async function run(proof: string, opts = {}) {
  const spec = await specPromise;
  const page = await loadPdfPage(proof);
  return compareAll(spec.fields, page.blocks, opts);
}

describe("v1 (vector) against the spec: the answer key", () => {
  it("gives the 6 expected findings and 14 matches, 0 false matches", async () => {
    const results = await run("proof_v1.pdf");
    const findings = toFindings(results);
    const expected = key.case_1_round1_v1_vs_spec.expected_findings as { field: string; verdict: string; word?: string; proof?: string | null }[];
    expect(findings).toHaveLength(expected.length);
    for (const e of expected) {
      const got = findings.find((x) => x.fieldId === e.field)!;
      expect(got, e.field).toBeTruthy();
      const kind = e.verdict === "mismatch" ? "spec_mismatch" : e.verdict === "missing" ? "spec_missing" : "allergen_not_emphasised";
      expect(got.kind, e.field).toBe(kind);
      if (e.verdict === "mismatch") expect(got.foundValue).toBe(e.proof!.replace(/^Sárgabarackos/, "Sárgabarackos"));
      if (e.verdict === "missing") expect(got.foundValue).toBeNull();
      if (e.word) expect(got.words!.join(" ")).toBe(e.word);
    }
    expect(countMatches(results)).toBe(14);
    for (const id of key.case_1_round1_v1_vs_spec.expected_matches as string[]) {
      expect(results.find((r) => r.id === id)!.verdict, id).toBe("match");
    }
    expect(openCount(findings)).toBe(6);
  });

  it("the name is wrong on the front and on the back but reported once", async () => {
    const results = await run("proof_v1.pdf");
    const name = results.find((r) => r.id === "name")!;
    expect(name.occurrences).toHaveLength(2);
    expect(name.occurrences.every((o) => o.verdict === "mismatch")).toBe(true);
    const findings = toFindings(results).filter((x) => x.fieldId === "name");
    expect(findings).toHaveLength(1);
    expect(findings[0]!.occurrences).toBe(2);
  });

  it("the findings build Hungarian send-back lines with no merge", async () => {
    const findings = toFindings(await run("proof_v1.pdf")).map((x) => ({ ...x, decision: "real_error" as const }));
    const built = buildSendBack(sendable(findings));
    expect(built.items).toHaveLength(6);
  });
});

describe("v2 and v3 against the spec", () => {
  it("v3 is clean: no findings, 19 matches", async () => {
    const results = await run("proof_v3.pdf");
    expect(toFindings(results)).toEqual([]);
    expect(countMatches(results)).toBe(19);
  });

  it("v2 still has the unfixed allergen emphasis and the 200 ml preparation", async () => {
    const findings = toFindings(await run("proof_v2.pdf"));
    expect(findings.map((x) => x.fieldId).sort()).toEqual(["ingredients", "preparation"]);
  });
});

describe("flat proofs", () => {
  it("a flat proof has no blocks: every field is missing from code, so the app must send it to the AI reader", async () => {
    const results = await run("proof_v1_flat.pdf");
    expect(results.every((r) => r.verdict === "missing")).toBe(true);
  });
});

describe("compareField edge cases", () => {
  it("64,5 equals 64.5", () => {
    expect(compareField(f("64,5 g"), [occ("64.5 g")]).verdict).toBe("match");
  });
  it("g is not mg", () => {
    expect(compareField(f("0,18 g"), [occ("0,18 mg")]).verdict).toBe("mismatch");
  });
  it("case and spacing are ignored, 400g equals 400 g", () => {
    expect(compareField(f("400 g"), [occ("400g")]).verdict).toBe("match");
    expect(compareField(f("Teljes tejpor"), [occ("  TELJES   tejpor ")]).verdict).toBe("match");
  });
  it("digit swaps and other single characters are mismatches", () => {
    expect(compareField(f("64,5 g"), [occ("46,5 g")]).verdict).toBe("mismatch");
    expect(compareField(f("Mangós"), [occ("Mangos")]).verdict).toBe("mismatch");
  });
  it("a name correct on the front but wrong on the back is a mismatch (worst wins)", () => {
    const r = compareField(f("Mangós"), [occ("Mangós"), occ("Barackos")]);
    expect(r.verdict).toBe("mismatch");
    expect(r.foundValue).toBe("Barackos");
  });
  it("Could not read never counts as a match, and beats a match", () => {
    const bad = { ...occ("Mangós"), unreadable: true };
    expect(compareField(f("Mangós"), [bad]).verdict).toBe("could_not_read");
    expect(compareField(f("Mangós"), [occ("Mangós"), bad]).verdict).toBe("could_not_read");
    expect(compareField(f("Mangós"), [bad, occ("Barackos")]).verdict).toBe("mismatch");
  });
  it("a failed read is Could not read for every field (R5)", () => {
    expect(compareField(f("Mangós"), [occ("Mangós")], { readFailed: true })).toMatchObject({ verdict: "could_not_read", reason: "read_failed" });
  });
  it("no occurrence is missing", () => {
    expect(compareField(f("Mangós"), []).verdict).toBe("missing");
  });
  it("resolution gate: below 100 dpi a field with a digit is Could not read, text fields still compare", () => {
    expect(compareField(f("0,18 g"), [occ("0,18 g")], { dpi: MIN_DPI - 1 })).toMatchObject({ verdict: "could_not_read", reason: "low_resolution" });
    expect(compareField(f("0,18 g"), [occ("0,18 g")], { dpi: MIN_DPI }).verdict).toBe("match");
    expect(compareField(f("Mangós"), [occ("Mangós")], { dpi: 60 }).verdict).toBe("match");
    expect(compareField(f("0,18 g"), [occ("0,18 g")]).verdict).toBe("match"); // vector: no dpi
  });
  it("the word diff shows what changed", () => {
    expect(wordDiff("A csomag 8 adagot", "A csomag 10 adagot")).toEqual([
      { type: "same", text: "A csomag" },
      { type: "del", text: "8" },
      { type: "ins", text: "10" },
      { type: "same", text: "adagot" },
    ]);
  });
  it("normalise keeps different units apart", () => {
    expect(normalise("0,18 mg")).not.toBe(normalise("0,18 g"));
  });
});

describe("allergenCheck", () => {
  const spec = "ZABPEHELY (68%), cukor, TELJES TEJPOR, só.";
  it("all capitalised words bold is ok", () => {
    expect(allergenCheck(spec, ["ZABPEHELY", "TELJES", "TEJPOR,"])).toEqual({ status: "ok", words: [] });
  });
  it("a missing phrase is reported as one phrase", () => {
    expect(allergenCheck(spec, ["ZABPEHELY"])).toEqual({ status: "not_emphasised", words: ["TELJES TEJPOR"] });
  });
  it("one missing word of a phrase is reported alone", () => {
    expect(allergenCheck(spec, ["ZABPEHELY", "TELJES"]).words).toEqual(["TEJPOR"]);
  });
  it("unknown emphasis is Could not check, never ok", () => {
    expect(allergenCheck(spec, null).status).toBe("could_not_check");
  });
  it("a spec with no capitalised words has nothing to check", () => {
    expect(allergenCheck("cukor, só", [])).toEqual({ status: "ok", words: [] });
  });
});

describe("locate", () => {
  it("a bare heading is not an occurrence, so Tárolás finds the storage text", async () => {
    const spec = await specPromise;
    const page = await loadPdfPage("proof_v1.pdf");
    const storage = spec.fields.find((x) => x.id === "storage")!;
    const o = locateField(storage, page.blocks, spec.fields);
    expect(o).toHaveLength(1);
    expect(o[0]!.text).toBe(storage.value);
  });
  it("Energia and Energia adagonként are not mixed up", async () => {
    const spec = await specPromise;
    const page = await loadPdfPage("proof_v1.pdf");
    const energy = locateField(spec.fields.find((x) => x.id === "energy")!, page.blocks, spec.fields);
    const per = locateField(spec.fields.find((x) => x.id === "per_serving")!, page.blocks, spec.fields);
    expect(energy.map((x) => x.text)).toEqual(["1602 kJ / 380 kcal"]);
    expect(per.map((x) => x.text)).toEqual(["801 kJ / 190 kcal"]);
  });
  it("a short value cannot fuzzy-match a similar-looking but different text", () => {
    const line = { text: "1,40 g", box: [0, 0, 10, 10] as [number, number, number, number], fontSize: 8, words: [{ text: "1,40", bold: false }, { text: "g", bold: false }] };
    const block = { id: "p1b1", page: 1, text: line.text, box: line.box, fontSize: 8, lines: [line], words: line.words, boldWords: [] };
    expect(similarity("400 g", "1,40 g")).toBeGreaterThan(0.6);
    expect(locateField(f("400 g", "net_qty", "Nettó tömeg"), [block])).toEqual([]);
    expect(locateField(f("1,40 g", "net_qty", "Nettó tömeg"), [block])).toHaveLength(1);
  });
});
