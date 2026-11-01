/**
 * Entry of the pdf.js web worker (loaded with Vite's ?worker suffix from renderPdf.ts).
 * The legacy build also carries the polyfills older Safari versions need (for example Map.getOrInsertComputed).
 * The stream polyfill is installed here, in the worker's own global scope: pdf.js only uses it later, when it
 * handles messages, so running it right after the imports is early enough.
 */
import { installStreamPolyfill } from "./streamPolyfill";
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";

installStreamPolyfill();
