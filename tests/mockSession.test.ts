// @vitest-environment node
import { describe, it, expect } from "vitest";
import { mockSession, type MockName } from "../src/mocks/mockSession";

const names: MockName[] = ["empty", "new_request", "r1_review", "r1_review_flat", "r1_review_lowres", "r1_review_failed", "r1_sendback", "r2_upload", "r2_review", "r2_sendback", "r3_review", "checker2", "lead", "approved"];

describe("mock sessions", () => {
  it("every mock builds", () => {
    for (const n of names) expect(() => mockSession(n), n).not.toThrow();
  });
  it("round 1 is the real answer: 6 findings, 14 matches, 6 send-back lines", () => {
    const r = mockSession("r1_sendback").rounds[0]!;
    expect(r.findings).toHaveLength(6);
    expect(r.matches).toBe(14);
    expect(r.sendBack).toHaveLength(6);
  });
  it("round 2: C3 not done, 5 done, 2 unrequested, preparation linked", () => {
    const r = mockSession("r2_review").rounds[1]!;
    expect(r.lineChecks!.filter((l) => l.verdict === "done")).toHaveLength(5);
    expect(r.lineChecks!.filter((l) => l.verdict === "not_done")).toHaveLength(1);
    expect(r.unrequested).toHaveLength(2);
    expect(r.unrequested![0]!.linkedTo).toBe("F2");
  });
  it("low resolution makes numbers Could not read", () => {
    const r = mockSession("r1_review_lowres").rounds[0]!;
    expect(r.results.find((x) => x.id === "carbs")!.verdict).toBe("could_not_read");
    expect(r.results.find((x) => x.id === "name")!.verdict).toBe("mismatch");
  });
  it("round 3 is clean", () => {
    const r = mockSession("r3_review").rounds[2]!;
    expect(r.findings).toEqual([]);
    expect(r.matches).toBe(19);
  });
});
