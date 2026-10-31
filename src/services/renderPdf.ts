/**
 * Browser: open a proof PDF with pdf.js and return what checkProof needs (text blocks and page size).
 * pdf.js is loaded on demand so the server render never touches it. Page 1 only [assumption: a proof
 * for one box is one page]. Page images for flat proofs come in step 4 (read-proof).
 */
import { embeddedImageWidth, extractPageText, type PdfPageLike } from "./pdfExtract";
import { buildBlocks, effectiveDpi, hasTextLayer } from "../core/textLayer";
import type { ProofPage } from "./runCheck";

export async function readPdfPage(file: File): Promise<ProofPage> {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  let doc;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    // fontExtraProperties: without it the real font names (bold or not) are not available.
    doc = await pdfjs.getDocument({ data, fontExtraProperties: true, verbosity: 0 }).promise;
  } catch {
    throw new Error("This file could not be opened as a PDF");
  }
  const page = await doc.getPage(1);
  const t = await extractPageText(page as unknown as PdfPageLike, pdfjs.OPS.setFont);
  const blocks = buildBlocks(t.items, { number: 1, width: t.width, height: t.height, fonts: t.fonts });
  const hasText = hasTextLayer(t.items);
  const proof: ProofPage = { width: t.width, height: t.height, blocks, hasText, fontNamesRead: t.fontNamesRead };
  if (hasText) return proof;

  // Flat proof: render the page to a JPEG for the reader. The resolution is the real one of the embedded image.
  // An image we cannot find gives dpi 0, which the resolution gate treats as too low: numbers and units become Could not read.
  const px = await embeddedImageWidth(page as unknown as PdfPageLike, pdfjs.OPS);
  const viewport = page.getViewport({ scale: 150 / 72 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, canvas, viewport }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.9);
  return { ...proof, flat: { jpegBase64: url.slice(url.indexOf(",") + 1), dpi: px > 0 ? Math.round(effectiveDpi(px, t.width)) : 0 } };
}
