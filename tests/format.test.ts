// @vitest-environment node
import { describe, it, expect } from "vitest";
import { badgeOf, summaryOf, sourceOf, daysBetween, reasonText } from "../src/state/format";
import { mockSession } from "../src/mocks/mockSession";

describe("format helpers", () => {
  const r = mockSession("r1_review").rounds[0]!;
  const by = (id: string) => r.findings.find((f) => f.fieldId === id)!;
  it("badges and summaries read like the wireframe", () => {
    expect(badgeOf(by("carbs"))).toBe("MISMATCH");
    expect(summaryOf(by("carbs"))).toBe("46,5 g, spec says 64,5 g");
    expect(summaryOf(by("name"))).toMatch(/^Sárgabarackos .* \(in 2 places\)$/);
    expect(summaryOf(by("may_contain"))).toBe("Not found on the proof");
    expect(summaryOf(by("ingredients"))).toBe("TELJES TEJPOR not emphasised");
    expect(badgeOf(by("ingredients"))).toBe("NOT EMPHASISED");
  });
  it("could-not-read summary uses the reason", () => {
    const lr = mockSession("r1_review_lowres").rounds[0]!;
    const f = lr.findings.find((x) => x.fieldId === "carbs")!;
    expect(summaryOf(f, lr.results.find((x) => x.id === "carbs"))).toMatch(/Resolution is too low/);
  });
  it("sources, days, reasons", () => {
    expect(sourceOf("F2")).toBe("From F2 · real error");
    expect(sourceOf("M1")).toBe("Added by you");
    expect(daysBetween("2026-10-27T08:30:00Z", "2026-11-05T08:00:00Z")).toBe(8);
    expect(daysBetween("2026-11-05T08:00:00Z", "2026-10-27T08:30:00Z")).toBe(0);
    expect(reasonText("Other", "  checked by hand ")).toBe("Other: checked by hand");
    expect(reasonText("Print sample OK")).toBe("Print sample OK");
  });
});
