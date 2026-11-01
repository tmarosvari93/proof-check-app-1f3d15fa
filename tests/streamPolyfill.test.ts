// @vitest-environment node
// Safari cannot iterate a ReadableStream with for-await, and pdf.js does exactly that (getTextContent, inflating
// compressed streams). Node can, so the test removes the method to look like Safari. Without the polyfill every PDF fails.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installStreamPolyfill } from "../src/services/streamPolyfill";
import { loadPdfPage } from "./helpers/loadPdf";

const proto = ReadableStream.prototype as unknown as Record<symbol, unknown>;
const original = proto[Symbol.asyncIterator];

describe("a browser without ReadableStream async iteration (Safari)", () => {
  beforeAll(() => {
    delete proto[Symbol.asyncIterator];
  });
  afterAll(() => {
    proto[Symbol.asyncIterator] = original;
  });

  it("pdf.js fails on a text proof and on a flat proof without the polyfill", async () => {
    await expect(loadPdfPage("proof_v1.pdf")).rejects.toThrow();
    await expect(loadPdfPage("proof_v2_flat.pdf")).rejects.toThrow();
  });

  it("does not touch a browser that already has it", () => {
    const keep = proto[Symbol.asyncIterator];
    const marker = function* () {};
    proto[Symbol.asyncIterator] = marker;
    installStreamPolyfill();
    expect(proto[Symbol.asyncIterator]).toBe(marker);
    proto[Symbol.asyncIterator] = keep;
    delete proto[Symbol.asyncIterator];
  });

  it("with the polyfill both open and give the same result as in Chrome", async () => {
    installStreamPolyfill();
    expect(Symbol.asyncIterator in proto).toBe(true);
    const text = await loadPdfPage("proof_v1.pdf");
    expect(text.hasText).toBe(true);
    expect(text.blocks.length).toBeGreaterThan(10);
    const flat = await loadPdfPage("proof_v2_flat.pdf");
    expect(flat.hasText).toBe(false);
  });
});
