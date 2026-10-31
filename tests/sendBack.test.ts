import { describe, it, expect } from "vitest";
import { buildSendBack, applyEdits, renderSendBack, lineFor, type Finding } from "../src/core/sendBack";

const real = (f: Omit<Finding, "decision">): Finding => ({ ...f, decision: "real_error" });

// The six seeded errors of the fictional test set (answer_key.json, case 1)
const seeded: Finding[] = [
  real({ code: "F1", kind: "spec_mismatch", label: "Termék megnevezése",
         specValue: "Mangós instant zabkása szárított mangódarabokkal",
         foundValue: "Sárgabarackos instant zabkása szárított mangódarabokkal" }),
  real({ code: "F2", kind: "spec_mismatch", label: "Szénhidrát", specValue: "64,5 g", foundValue: "46,5 g" }),
  real({ code: "F3", kind: "spec_mismatch", label: "Só", specValue: "0,18 g", foundValue: "0,18 mg" }),
  real({ code: "F4", kind: "allergen_not_emphasised", label: "Összetevők", words: ["TELJES TEJPOR"] }),
  real({ code: "F5", kind: "spec_mismatch", label: "Adagok száma", specValue: "A csomag 8 adagot tartalmaz.", foundValue: "A csomag 10 adagot tartalmaz." }),
  real({ code: "F6", kind: "spec_missing", label: "Keresztszennyeződés", specValue: "Nyomokban szóját és diófélét tartalmazhat." }),
];

describe("lineFor (Hungarian templates)", () => {
  it("spec mismatch names both values", () => {
    expect(lineFor(seeded[1]!)).toBe(
      "Szénhidrát: a specifikáció szerint „64,5 g”, a terven „46,5 g” szerepel. Kérjük javítani.",
    );
  });
  it("missing item", () => {
    expect(lineFor(seeded[5]!)).toBe(
      "Keresztszennyeződés: a specifikáció szerint „Nyomokban szóját és diófélét tartalmazhat.” kötelező, de a terven nem található. Kérjük feltüntetni.",
    );
  });
  it("allergen emphasis", () => {
    expect(lineFor(seeded[3]!)).toBe(
      "Összetevők: az allergén „TELJES TEJPOR” nincs kiemelve. Kérjük kiemelni (például félkövér betűvel).",
    );
  });
  it("font size uses decimal commas", () => {
    const f = real({ code: "F9", kind: "font_too_small", label: "Gyártó", measuredMm: 0.84, minimumMm: 0.9 });
    expect(lineFor(f)).toContain("0,84 mm");
    expect(lineFor(f)).toContain("0,90 mm");
  });
  it("unrequested change in three flavours", () => {
    expect(lineFor(real({ code: "U1", kind: "unrequested_modified", before: "150 ml", after: "200 ml" })))
      .toContain("„150 ml” helyett „200 ml”");
    expect(lineFor(real({ code: "U2", kind: "unrequested_added", after: "Hozzáadott cukor nélkül" })))
      .toContain("„Hozzáadott cukor nélkül”");
    expect(lineFor(real({ code: "U3", kind: "unrequested_removed", before: "Origin text" })))
      .toContain("„Origin text” hiányzik");
  });
  it("the checker's own finding is used as written", () => {
    expect(lineFor(real({ code: "M1", kind: "manual", text: "  A logó méretét ellenőrizni kell.  " })))
      .toBe("A logó méretét ellenőrizni kell.");
  });
});

describe("buildSendBack", () => {
  it("lists every real error once and nothing else", () => {
    const withNoise: Finding[] = [
      ...seeded,
      { code: "F7", kind: "spec_mismatch", decision: "not_error", label: "Zsír", specValue: "6,8 g", foundValue: "6.8 g" },
      { code: "F8", kind: "spec_mismatch", decision: "open", label: "Rost", specValue: "7,9 g", foundValue: "7,6 g" },
      { code: "F9", kind: "spec_mismatch", decision: "needs_discussion", label: "Fehérje", specValue: "11,2 g", foundValue: "11,3 g" },
    ];
    const { items } = buildSendBack(withNoise);
    // mismatches first, then the missing item, then the allergen
    expect(items.map((i) => i.code)).toEqual(["F1", "F2", "F3", "F5", "F6", "F4"]);
  });

  it("sorts by kind, then by code with numbers compared as numbers", () => {
    const fs: Finding[] = [
      real({ code: "F10", kind: "spec_mismatch", label: "A", specValue: "1", foundValue: "2" }),
      real({ code: "F2", kind: "spec_mismatch", label: "B", specValue: "1", foundValue: "2" }),
      real({ code: "M1", kind: "manual", text: "Saját észrevétel" }),
      real({ code: "U1", kind: "unrequested_added", after: "X" }),
    ];
    expect(buildSendBack(fs).items.map((i) => i.code)).toEqual(["F2", "F10", "U1", "M1"]);
  });

  it("counts one problem once: a spec mismatch that is also an unrequested change (R8)", () => {
    const fs: Finding[] = [
      real({ code: "F1", kind: "spec_mismatch", label: "Felhasználási javaslat",
             specValue: "…150 ml forró tejet…", foundValue: "…200 ml forró tejet…" }),
      real({ code: "U1", kind: "unrequested_modified", before: "150 ml", after: "200 ml", relatedTo: "F1" }),
    ];
    const r = buildSendBack(fs);
    expect(r.items.map((i) => i.code)).toEqual(["F1"]);
    expect(r.mergedInto).toEqual({ U1: "F1" });
  });

  it("keeps the related finding if the one it points to was not confirmed", () => {
    const fs: Finding[] = [
      { code: "F1", kind: "spec_mismatch", decision: "not_error", label: "X", specValue: "a", foundValue: "b" },
      real({ code: "U1", kind: "unrequested_modified", before: "a", after: "b", relatedTo: "F1" }),
    ];
    expect(buildSendBack(fs).items.map((i) => i.code)).toEqual(["U1"]);
  });

  it("returns an empty list when there is no real error", () => {
    expect(buildSendBack([{ ...seeded[0]!, decision: "not_error" }]).items).toEqual([]);
  });
});

describe("applyEdits", () => {
  const { items } = buildSendBack(seeded);

  it("edits a line and removes another", () => {
    const out = applyEdits(items, [
      { code: "F2", text: "Szénhidrát: kérjük 64,5 g-ra javítani." },
      { code: "F6", remove: true },
    ]);
    expect(out).toHaveLength(5);
    expect(out.find((i) => i.code === "F2")?.text).toBe("Szénhidrát: kérjük 64,5 g-ra javítani.");
    expect(out.find((i) => i.code === "F6")).toBeUndefined();
  });

  it("drops a line whose text was emptied", () => {
    expect(applyEdits(items, [{ code: "F1", text: "   " }]).find((i) => i.code === "F1")).toBeUndefined();
  });

  it("does not change the original list", () => {
    const before = JSON.stringify(items);
    applyEdits(items, [{ code: "F1", remove: true }]);
    expect(JSON.stringify(items)).toBe(before);
  });
});

describe("renderSendBack", () => {
  it("numbers lines consecutively after edits", () => {
    const { items } = buildSendBack(seeded);
    const out = renderSendBack(applyEdits(items, [{ code: "F1", remove: true }]), {
      heading: "Mezőlak Mangós zabkása 400 g, doboz", roundNo: 1,
    });
    const lines = out.split("\n");
    expect(lines[0]).toBe("Mezőlak Mangós zabkása 400 g, doboz, 1. kör – észrevételek:");
    expect(lines[2]).toMatch(/^1\. /);
    expect(lines[lines.length - 1]).toMatch(/^5\. /);
    expect(out).not.toContain("Sárgabarackos");
  });

  it("refuses to send an empty list", () => {
    expect(() => renderSendBack([])).toThrow(/empty/);
  });

  it("is deterministic", () => {
    const a = renderSendBack(buildSendBack(seeded).items);
    const b = renderSendBack(buildSendBack([...seeded].reverse()).items);
    expect(a).toBe(b);
  });
});
