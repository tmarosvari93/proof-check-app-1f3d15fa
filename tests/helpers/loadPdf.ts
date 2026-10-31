// Test helper: opens a fixture PDF with pdf.js in Node and returns what src/core expects.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPageText, type PdfPageLike } from "../../src/services/pdfExtract";
import { buildBlocks, hasTextLayer, type Block, type RawItem } from "../../src/core/textLayer";

export const FIXTURES = join(__dirname, "..", "..", "fixtures");

export interface LoadedPage {
  width: number;
  height: number;
  items: RawItem[];
  fonts: Record<string, string>;
  fontNamesRead: boolean;
  hasText: boolean;
  blocks: Block[];
}

export async function loadPdfPage(file: string, pageNumber = 1): Promise<LoadedPage> {
  const data = new Uint8Array(readFileSync(join(FIXTURES, file)));
  const doc = await pdfjs.getDocument({ data, verbosity: 0, fontExtraProperties: true }).promise;
  const page = await doc.getPage(pageNumber);
  const t = await extractPageText(page as unknown as PdfPageLike, pdfjs.OPS.setFont);
  const blocks = buildBlocks(t.items, { number: pageNumber, width: t.width, height: t.height, fonts: t.fonts });
  return { ...t, hasText: hasTextLayer(t.items), blocks };
}
