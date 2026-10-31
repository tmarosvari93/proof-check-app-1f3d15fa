/**
 * Reads the text layer of one pdf.js page into plain data for src/core/textLayer.ts.
 *
 * pdf.js only exposes opaque font ids on text items. The real font name (for example
 * "AAAAAA+DejaVuSans-Bold") comes from the page's operator list, and only when the document
 * was opened with `fontExtraProperties: true`. Without it bold words cannot be told apart and the
 * allergen emphasis check must report Could not read, never a pass.
 *
 * The page object is typed loosely so this file runs in Node (tests) and in the browser.
 */
import type { RawItem } from "../core/textLayer";

export interface PdfPageLike {
  getViewport(opts: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: Array<Partial<RawItem> & { str?: string }> }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  commonObjs: {
    get(id: string, cb: (font: { name?: string } | undefined) => void): void;
  };
}

export interface PageText {
  width: number;
  height: number;
  items: RawItem[];
  /** pdf.js font id to the real font name. Empty when the names could not be read. */
  fonts: Record<string, string>;
  fontNamesRead: boolean;
}

/** `setFontOp` is pdfjs.OPS.setFont. */
export async function extractPageText(page: PdfPageLike, setFontOp: number): Promise<PageText> {
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items: RawItem[] = [];
  for (const it of tc.items) {
    if (typeof it.str !== "string" || !it.transform) continue;
    items.push({
      str: it.str,
      transform: it.transform as number[],
      width: it.width ?? 0,
      height: it.height ?? 0,
      fontName: it.fontName ?? "",
    });
  }

  const fonts: Record<string, string> = {};
  let fontNamesRead = true;
  try {
    const ops = await page.getOperatorList();
    const ids = new Set<string>();
    ops.fnArray.forEach((fn, i) => {
      if (fn === setFontOp) ids.add(String(ops.argsArray[i]?.[0]));
    });
    await Promise.all(
      [...ids].map(
        (id) =>
          new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 3000);
            try {
              page.commonObjs.get(id, (f) => {
                if (f?.name) fonts[id] = f.name;
                clearTimeout(timer);
                resolve();
              });
            } catch {
              clearTimeout(timer);
              resolve();
            }
          }),
      ),
    );
    const used = new Set(items.map((i) => i.fontName).filter(Boolean));
    fontNamesRead = [...used].every((id) => id in fonts);
  } catch {
    fontNamesRead = false;
  }
  return { width: vp.width, height: vp.height, items, fonts, fontNamesRead };
}

/**
 * Width in pixels of the largest image painted on the page, or 0 when there is none.
 * A flat proof is one image over the whole page, so this gives its real resolution (effectiveDpi).
 * `ops` is pdfjs.OPS. Painted-image operator arguments: [objectId, width, height], or [{ width }] for inline images.
 */
export async function embeddedImageWidth(
  page: Pick<PdfPageLike, "getOperatorList">,
  ops: { paintImageXObject: number; paintInlineImageXObject: number; paintImageMaskXObject: number },
): Promise<number> {
  const list = await page.getOperatorList();
  let widest = 0;
  list.fnArray.forEach((fn, i) => {
    const a = list.argsArray[i] ?? [];
    if (fn === ops.paintImageXObject || fn === ops.paintImageMaskXObject) {
      if (typeof a[1] === "number") widest = Math.max(widest, a[1]);
    } else if (fn === ops.paintInlineImageXObject) {
      const w = (a[0] as { width?: number } | undefined)?.width;
      if (typeof w === "number") widest = Math.max(widest, w);
    }
  });
  return widest;
}
