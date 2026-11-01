// Step 4: flat (image only) proofs. The model is faked here: the fake reader returns what a perfect reader would
// read from the vector twin of each proof, so these tests prove the wiring, the gates and the failure paths,
// NOT how well the real model reads. That is the recorded manual run (README / RESULTS).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { compareAll } from "../src/core/compare";
import { parseSpecWorkbook, type ParsedSpec } from "../src/core/parseSpec";
import { blocksFromReply, type BlocksReply, type FieldsReply } from "../src/core/schemas";
import { effectiveDpi } from "../src/core/textLayer";
import { embeddedImageWidth, type PdfPageLike } from "../src/services/pdfExtract";
import { readBlocks, readFields, type ReaderConfig } from "../src/services/readProof";
import { checkProof, type AiRead, type ProofPage } from "../src/services/runCheck";
import { buildRoundSendBack, reviewItems } from "../src/state/roundLogic";
import type { Round } from "../src/state/types";
import { FIXTURES, loadPdfPage, type LoadedPage } from "./helpers/loadPdf";

let spec: ParsedSpec;
const getSpec = async () => (spec ??= await parseSpecWorkbook(new Uint8Array(readFileSync(join(FIXTURES, "spec_SP-2026-0417_v3.xlsx")))));

/** What a perfect AI reader would return for a proof, taken from its vector twin. */
async function perfectRead(twin: string, dpi = 150): Promise<{ ai: AiRead; page: ProofPage }> {
  const sp = await getSpec();
  const v: LoadedPage = await loadPdfPage(twin);
  const fields = sp.fields.map((f) => ({ id: f.id, label: f.label, value: f.value }));
  const results = compareAll(fields, v.blocks);
  const reply: FieldsReply = {
    fields: results.map((r) => ({
      id: r.id,
      status: r.verdict === "missing" ? "not_found" : "found",
      found_text: r.verdict === "missing" ? null : r.foundValue,
      emphasised_words: r.occurrences[0]?.occurrence.boldWords ?? [],
    })),
  };
  // The AI is asked for one block per separate item, so a twin panel is split where a line starts with a spec label.
  const labels = sp.fields.map((f) => f.label.toLowerCase());
  const starts = sp.fields.map((f) => f.value.toLowerCase().slice(0, 8));
  const startsItem = (t: string) => labels.some((l) => t.toLowerCase().startsWith(l)) || starts.some((v) => t.toLowerCase().startsWith(v));
  const items = v.blocks.flatMap((b) => {
    const groups: (typeof b.lines)[] = [];
    b.lines.forEach((l, i) => {
      if (i === 0 || startsItem(l.text)) groups.push([l]);
      else groups[groups.length - 1]!.push(l);
    });
    return groups.map((g) => ({
      text: g.map((l) => l.text).join(" "),
      box: [Math.min(...g.map((l) => l.box[0])), Math.min(...g.map((l) => l.box[1])), Math.max(...g.map((l) => l.box[2])), Math.max(...g.map((l) => l.box[3]))] as const,
      bold: g.flatMap((l) => l.words.filter((w) => w.bold).map((w) => w.text)),
    }));
  });
  const breply: BlocksReply = {
    blocks: items.map((b) => ({
      text: b.text,
      x_percent: ((b.box[0] + b.box[2]) / 2 / v.width) * 100,
      y_percent: (1 - (b.box[1] + b.box[3]) / 2 / v.height) * 100,
      emphasised_words: b.bold,
    })),
  };
  const page: ProofPage = { width: v.width, height: v.height, blocks: [], hasText: false, fontNamesRead: false };
  return { ai: { fields: reply, blocks: blocksFromReply(breply, v), dpi }, page };
}

async function flatRound(no: number, twin: string, previous?: Round, over: Partial<AiRead> = {}, dpi = 150): Promise<Round> {
  const sp = await getSpec();
  const { ai, page } = await perfectRead(twin, dpi);
  return checkProof({ spec: sp, page, no, fileName: twin.replace(".pdf", "_flat.pdf"), ai: { ...ai, ...over }, ...(previous ? { previous } : {}) });
}

const finished = (r: Round): Round => {
  const decisions = Object.fromEntries(reviewItems(r).filter((i) => i.needsDecision).map((i) => [i.code, "real_error" as const]));
  const d = { ...r, decisions };
  return { ...d, finished: true, sendBack: buildRoundSendBack(d) };
};

describe("flat proof, round 1", () => {
  it("is read by AI: same 6 findings and 14 matches as the text layer, dpi shown", async () => {
    const r = await flatRound(1, "proof_v1.pdf");
    expect(r.readMode).toBe("ai");
    expect(r.dpi).toBe(150);
    expect(r.findings.map((f) => f.fieldId).sort()).toEqual(["carbs", "ingredients", "may_contain", "name", "salt", "servings"]);
    expect(r.matches).toBe(14);
    expect(r.findings.find((f) => f.fieldId === "ingredients")?.kind).toBe("allergen_not_emphasised");
    expect(r.blocks?.length).toBeGreaterThan(10); // kept for the next round
  });
  it("below 100 dpi numbers and units are Could not read, text fields still compared (R7)", async () => {
    const r = await flatRound(1, "proof_v1.pdf", undefined, {}, 75);
    const byField = Object.fromEntries(r.results.map((x) => [x.id, x.verdict]));
    expect(byField["carbs"]).toBe("could_not_read");
    expect(byField["salt"]).toBe("could_not_read");
    expect(byField["servings"]).toBe("could_not_read"); // "8 adagot": has a digit
    expect(byField["name"]).toBe("mismatch"); // no digit: still compared
    expect(byField["may_contain"]).toBe("missing");
    expect(r.results.some((x) => x.verdict === "match" && /\d/.test(x.specValue))).toBe(false);
  });
  it("an unknown resolution (dpi 0) is treated as too low", async () => {
    const r = await flatRound(1, "proof_v1.pdf", undefined, {}, 0);
    expect(r.results.find((x) => x.id === "carbs")?.verdict).toBe("could_not_read");
  });
  it("a field the AI marks unreadable is Could not read, never a pass", async () => {
    const { ai, page } = await perfectRead("proof_v1.pdf");
    ai.fields!.fields = ai.fields!.fields.map((f) => (f.id === "protein" ? { ...f, status: "unreadable" as const } : f));
    const r = checkProof({ spec: await getSpec(), page, no: 1, fileName: "x_flat.pdf", ai });
    expect(r.results.find((x) => x.id === "protein")?.verdict).toBe("could_not_read");
    expect(r.findings.find((f) => f.fieldId === "protein")?.kind).toBe("could_not_read");
  });
  it("a failed fields read is a failed round: 19 Could not read, no pass (R5)", async () => {
    const r = await flatRound(1, "proof_v1.pdf", undefined, { fields: null });
    expect(r.readMode).toBe("failed");
    expect(r.matches).toBe(0);
    expect(r.findings).toHaveLength(19);
  });
  it("findings from an AI read carry no panel (no exact box)", async () => {
    const r = await flatRound(1, "proof_v1.pdf");
    expect(r.findings.every((f) => f.where === undefined)).toBe(true);
  });
});

describe("flat proof, round 2 and 3", () => {
  it("v2 against v1 gives the answer-key result from AI-read blocks", async () => {
    const r1 = finished(await flatRound(1, "proof_v1.pdf"));
    const r2 = await flatRound(2, "proof_v2.pdf", r1);
    expect(r2.diffUnavailable).toBeUndefined();
    const verdictByField = Object.fromEntries(r2.lineChecks!.map((l) => [l.fieldId, l.verdict]));
    expect(verdictByField).toEqual({ name: "done", carbs: "done", salt: "done", servings: "done", may_contain: "done", ingredients: "not_done" });
    expect(r2.unrequested).toHaveLength(2);
    expect(r2.unrequested!.some((u) => u.change.after === "Hozzáadott cukor nélkül")).toBe(true);
    expect(r2.unrequested!.find((u) => u.fieldIds?.includes("preparation"))?.linkedTo).toBeTruthy();
  });
  it("v3 against v2 is clean", async () => {
    const r1 = finished(await flatRound(1, "proof_v1.pdf"));
    const r2 = finished(await flatRound(2, "proof_v2.pdf", r1));
    const r3 = await flatRound(3, "proof_v3.pdf", r2);
    expect(r3.findings).toEqual([]);
    expect(r3.unrequested).toEqual([]);
    expect(r3.lineChecks!.every((l) => l.verdict === "done")).toBe(true);
  });
  it("blocks that could not be read: the diff is unavailable and the round says so (never 'no changes')", async () => {
    const r1 = finished(await flatRound(1, "proof_v1.pdf"));
    const r2 = await flatRound(2, "proof_v2.pdf", r1, { blocks: null });
    expect(r2.diffUnavailable).toBe("read_failed");
    expect(r2.diff).toBeUndefined();
    expect(r2.lineChecks).toHaveLength(6); // lines are still re-checked from the field read
    expect(r2.findings.length).toBeGreaterThan(0);
  });
  it("previous round without blocks (its AI block read failed): the diff is unavailable and says so", async () => {
    const r1 = finished(await flatRound(1, "proof_v1.pdf", undefined, { blocks: null }));
    expect(r1.blocks).toBeUndefined();
    const r2 = await flatRound(2, "proof_v2.pdf", r1);
    expect(r2.diffUnavailable).toBe("no_previous_blocks");
  });
});

describe("the reader client (fake backend)", () => {
  const img = "A".repeat(200);
  const fields = [{ id: "a", label: "A", value: "1 g" }];
  const good = { fields: [{ id: "a", status: "found", found_text: "1 g", emphasised_words: [] }] };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const cfg = (responses: Response[], calls: unknown[] = []): ReaderConfig => ({
    url: "https://x.supabase.co/",
    apikey: "pk",
    fetchImpl: (async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers, body: JSON.parse(String(init.body)) });
      return responses.shift() ?? reply({ ok: false }, 500);
    }) as unknown as typeof fetch,
  });

  it("returns a valid reply and sends the publishable key, never a secret", async () => {
    const calls: Array<{ url: string; headers: Record<string, string>; body: { mode: string } }> = [];
    const r = await readFields(cfg([reply({ ok: true, result: good })], calls), img, fields);
    expect(r.ok).toBe(true);
    expect(calls[0]!.url).toBe("https://x.supabase.co/functions/v1/read-proof");
    expect(calls[0]!.headers["apikey"]).toBe("pk");
    expect(calls[0]!.body.mode).toBe("fields");
  });
  it("retries once when the reply does not fit the schema", async () => {
    const calls: unknown[] = [];
    const r = await readFields(cfg([reply({ ok: true, result: { fields: [] } }), reply({ ok: true, result: good })], calls), img, fields);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(2);
  });
  it("retries once after an error, then gives up with a message", async () => {
    const calls: unknown[] = [];
    const r = await readFields(cfg([reply({ ok: false, error: "The reader returned an error (502)" }, 502), reply({ ok: false, error: "The reader returned an error (502)" }, 502)], calls), img, fields);
    expect(r).toEqual({ ok: false, error: "The reader returned an error (502)" });
    expect(calls).toHaveLength(2);
  });
  it("a reply with a missing, unknown or doubled field is an error, never accepted", async () => {
    const missing = { fields: [] };
    const unknown = { fields: [...good.fields, { id: "zzz", status: "found", found_text: "x", emphasised_words: [] }] };
    for (const bad of [missing, unknown]) {
      const r = await readFields(cfg([reply({ ok: true, result: bad }), reply({ ok: true, result: bad })]), img, fields);
      expect(r.ok).toBe(false);
    }
  });
  it("is not configured without a backend URL", async () => {
    const r = await readFields({ url: "", apikey: "" }, img, fields);
    expect(r).toEqual({ ok: false, error: "The reader is not configured" });
  });
  it("reads blocks into Blocks for the diff", async () => {
    const blocks = { blocks: [{ text: "Zsír 6,8 g", x_percent: 70, y_percent: 40, emphasised_words: [] }] };
    const r = await readBlocks(cfg([reply({ ok: true, result: blocks })]), img, { width: 1000, height: 800 });
    expect(r.ok && r.value[0]?.text).toBe("Zsír 6,8 g");
  });
});

describe("flat fixture", () => {
  it("embeddedImageWidth finds the real resolution of the flat proof", async () => {
    const data = new Uint8Array(readFileSync(join(FIXTURES, "proof_v1_flat.pdf")));
    const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
    const page = await doc.getPage(1);
    const px = await embeddedImageWidth(page as unknown as PdfPageLike, pdfjs.OPS);
    const dpi = effectiveDpi(px, page.getViewport({ scale: 1 }).width);
    expect(px).toBeGreaterThan(1000);
    expect(Math.round(dpi)).toBeGreaterThanOrEqual(140); // generated at 150 dpi
    expect(Math.round(dpi)).toBeLessThanOrEqual(160);
  });
  it("the vector proof has no embedded image: width 0 (dpi unknown is treated as low)", async () => {
    const data = new Uint8Array(readFileSync(join(FIXTURES, "proof_v1.pdf")));
    const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
    expect(await embeddedImageWidth((await doc.getPage(1)) as unknown as PdfPageLike, pdfjs.OPS)).toBe(0);
  });
});


describe("a failed AI read says why", () => {
  it("keeps the reader's error on the round, and shows every field as could not read", async () => {
    const { checkProof } = await import("../src/services/runCheck");
    const { parseSpecWorkbook } = await import("../src/core/parseSpec");
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { FIXTURES } = await import("./helpers/loadPdf");
    const spec = await parseSpecWorkbook(new Uint8Array(readFileSync(join(FIXTURES, "spec_SP-2026-0417_v3.xlsx"))));
    const page = { width: 1190, height: 842, blocks: [], hasText: false, fontNamesRead: true };
    const failed = checkProof({ spec, page, no: 1, fileName: "x_flat.pdf", ai: { fields: null, blocks: null, dpi: 150, error: "The reader is not configured" } });
    expect(failed.readMode).toBe("failed");
    expect(failed.readError).toBe("The reader is not configured");
    expect(failed.matches).toBe(0);
    expect(failed.findings.every((f) => f.kind === "could_not_read")).toBe(true);
    const fine = checkProof({ spec, page, no: 1, fileName: "x_flat.pdf" });
    expect(fine.readError).toBeUndefined();
  });
});
