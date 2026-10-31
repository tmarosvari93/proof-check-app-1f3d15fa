/**
 * Browser: open a proof PDF with pdf.js and return what checkProof needs (text blocks and page size).
 * pdf.js is loaded on demand so the server render never touches it. Page 1 only [assumption: a proof
 * for one box is one page]. Page images for flat proofs come in step 4 (read-proof).
 */
import { extractPageText, type PdfPageLike } from "./pdfExtract";
import { buildBlocks, hasTextLayer } from "../core/textLayer";
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
  return { width: t.width, height: t.height, blocks, hasText: hasTextLayer(t.items), fontNamesRead: t.fontNamesRead };
}
