/**
 * Safari does not let you iterate a ReadableStream with `for await (const x of stream)`; Chrome and Firefox do.
 * pdf.js does exactly that in two places: getTextContent() on the main thread, and when it inflates a compressed
 * stream in its worker. In Safari every PDF then fails with "undefined is not a function (near '...x of y...')".
 *
 * installStreamPolyfill() adds the missing method and does nothing where the browser already has it.
 * It is a function that callers CALL (renderPdf.ts on the main thread, pdfWorker.ts in the worker) on purpose:
 * package.json says "sideEffects": false, so the bundler deletes a bare `import "./streamPolyfill"`.
 */
export function installStreamPolyfill(): void {
  if (typeof ReadableStream === "undefined") return;
  const proto = ReadableStream.prototype as unknown as Record<symbol, unknown>;
  if (Symbol.asyncIterator in proto) return;
  proto[Symbol.asyncIterator] = async function* (this: ReadableStream<unknown>) {
    const reader = this.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  };
}
