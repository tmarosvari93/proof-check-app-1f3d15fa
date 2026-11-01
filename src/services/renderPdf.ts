/**
 * Browser: open a proof PDF with pdf.js and return what checkProof needs (text blocks and page size) plus a
 * preview image of the page for the review screen. pdf.js is loaded on demand so the server render never touches it.
 * Page 1 only [assumption: a proof for one box is one page].
 *
 * Safari: the legacy pdf.js build runs in a worker that first adds the ReadableStream async iterator Safari lacks
 * (see streamPolyfill.ts). The same polyfill is installed here for the calls pdf.js makes on the main thread.
 */
import { installStreamPolyfill } from "./streamPolyfill";
import { embeddedImageWidth, extractPageText, type PdfPageLike } from "./pdfExtract";
import { buildBlocks, effectiveDpi, hasTextLayer } from "../core/textLayer";
import type { ProofPage } from "./runCheck";

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type RenderablePage = Awaited<ReturnType<Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>["getPage"]>>;

/** Render the page to a JPEG data URL at the given resolution. */
async function renderJpeg(page: RenderablePage, dpi: number, quality: number): Promise<string> {
  const viewport = page.getViewport({ scale: dpi / 72 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, canvas, viewport }).promise;
  return canvas.toDataURL("image/jpeg", quality);
}

export async function readPdfPage(file: File): Promise<ProofPage> {
  installStreamPolyfill();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerPort) {
    const { default: PdfWorker } = await import("./pdfWorker?worker");
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
  }
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

  if (hasText) {
    // Preview for the review screen. A preview that fails to render never blocks the check.
    try {
      return { ...proof, preview: await renderJpeg(page, 110, 0.85) };
    } catch {
      return proof;
    }
  }

  // Flat proof: render the page to a JPEG for the reader. The resolution is the real one of the embedded image.
  // An image we cannot find gives dpi 0, which the resolution gate treats as too low: numbers and units become Could not read.
  const px = await embeddedImageWidth(page as unknown as PdfPageLike, pdfjs.OPS);
  const url = await renderJpeg(page, 150, 0.9);
  return {
    ...proof,
    preview: url,
    flat: { jpegBase64: url.slice(url.indexOf(",") + 1), dpi: px > 0 ? Math.round(effectiveDpi(px, t.width)) : 0 },
  };
}
