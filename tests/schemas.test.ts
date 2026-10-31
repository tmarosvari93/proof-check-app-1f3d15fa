import { describe, it, expect } from "vitest";
import { parseFieldsReply, parseBlocksReply, blocksFromReply } from "../src/core/schemas";
import { diffBlocks } from "../src/core/diff";

const ok = (id: string, over = {}) => ({ id, status: "found", found_text: "x", emphasised_words: [], ...over });

describe("fields reply", () => {
  it("accepts one entry per requested id", () => {
    expect(parseFieldsReply({ fields: [ok("a"), ok("b", { status: "not_found", found_text: null })] }, ["a", "b"]).ok).toBe(true);
  });
  it("rejects a missing, unknown or doubled field, and found without text", () => {
    expect(parseFieldsReply({ fields: [ok("a")] }, ["a", "b"])).toMatchObject({ ok: false, error: "missing fields: b" });
    expect(parseFieldsReply({ fields: [ok("a"), ok("z")] }, ["a"])).toMatchObject({ ok: false, error: "unknown fields: z" });
    expect(parseFieldsReply({ fields: [ok("a"), ok("a")] }, ["a"])).toMatchObject({ ok: false, error: "a field is reported twice" });
    expect(parseFieldsReply({ fields: [ok("a", { found_text: " " })] }, ["a"]).ok).toBe(false);
  });
  it("rejects the wrong shape and an unknown status", () => {
    expect(parseFieldsReply(null, ["a"]).ok).toBe(false);
    expect(parseFieldsReply({ fields: [ok("a", { status: "maybe" })] }, ["a"]).ok).toBe(false);
  });
});

describe("blocks reply", () => {
  it("rejects an empty reply and out-of-range positions", () => {
    expect(parseBlocksReply({ blocks: [] })).toMatchObject({ ok: false, error: "no blocks read" });
    expect(parseBlocksReply({ blocks: [{ text: "a", x_percent: 120, y_percent: 5, emphasised_words: [] }] }).ok).toBe(false);
  });
  it("turns into blocks the diff can use (position from the top, bold from emphasised words)", () => {
    const page = { width: 1000, height: 800 };
    const mk = (text: string, x: number, emph: string[] = []) => {
      const p = parseBlocksReply({ blocks: [{ text, x_percent: x, y_percent: 10, emphasised_words: emph }] });
      if (!p.ok) throw new Error(p.error);
      return blocksFromReply(p.value, page);
    };
    const [b] = mk("Tárolás teszt szöveg", 50, ["teszt"]);
    expect(b!.boldWords).toEqual(["teszt"]);
    expect(b!.box[1]).toBeCloseTo(0.9 * 800 - 5);
    expect(diffBlocks(mk("Ugyanaz a szöveg", 20), mk("Ugyanaz a szöveg", 80), { page }).items.map((i) => i.type)).toEqual(["moved"]);
  });
});
