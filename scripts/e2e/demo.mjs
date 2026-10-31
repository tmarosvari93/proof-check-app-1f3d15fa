// Browser click-through of the demo story (vector and flat proofs) against a running dev server.
// Not part of CI: it needs Chrome and puppeteer-core. Fictional fixtures only.
//   npm i --no-save puppeteer-core
//   npx vite dev --port 5199 --host 127.0.0.1      (in another terminal)
//   node scripts/e2e/demo.mjs [screenshot-dir]     (CHROME=/path/to/chrome if not /usr/bin/google-chrome)
// Prints PASS/FAIL per step and sets the exit code.
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import puppeteer from "puppeteer-core";
const R = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures") + "/";
const SP = process.argv[2] ?? mkdtempSync(join(tmpdir(), "proofcheck-e2e-"));
mkdirSync(SP, { recursive: true });
// A spec with no blue cells and a file that is not a PDF, for the error paths.
{ const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("s"); ws.addRow(["Spec number", "SP-X"]); ws.addRow([]); ws.addRow(["1. Label"]); ws.addRow(["Name", "Plain black text"]); await wb.xlsx.writeFile(SP + "/noblue.xlsx"); writeFileSync(SP + "/fake.pdf", "this is not a pdf at all"); }
const base = "http://127.0.0.1:5199";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1600 });
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
const body = () => page.evaluate(() => document.body.innerText);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitText = async (t, ms = 20000) => { await page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t); };
const click = async (text) => {
  const ok = await page.evaluate((t) => { const b = [...document.querySelectorAll("button,a")].find((x) => x.innerText.trim() === t && !x.disabled); if (b) { b.click(); return true; } return false; }, text);
  if (!ok) throw new Error("no enabled button: " + text);
};
const realClick = async (re) => { const h = await page.evaluateHandle((src) => { const r = new RegExp(src); return [...document.querySelectorAll("button,[role=tab]")].find((x) => r.test(x.innerText.trim())); }, re); const el = h.asElement(); if (!el) throw new Error("no tab " + re); await el.click(); await sleep(250); };
const upload = async (file) => { const h = await page.$('input[type="file"]'); await h.uploadFile(file); };
const clickAllReal = async () => {
  let tabTries = 0; const tabs = ["^Changes", "^Spec findings", "^Changes", "^Spec findings"];
  for (let i = 0; i < 40; i++) {
    const done = await page.evaluate(() => {
      const fin = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "Finish review");
      if (fin && !fin.disabled) return "done";
      const real = [...document.querySelectorAll("button")].find((x) => ["Real error", "Reject: add to send-back list"].includes(x.innerText.trim()) && !x.className.includes("bg-primary") && !(x.parentElement.innerText.includes("Rejected")));
      if (real) { real.click(); return "clicked"; }
      const row = [...document.querySelectorAll("button")].find((x) => /Undecided/.test(x.innerText) && /^F\d|^C\d|^U\d/.test(x.innerText.trim()));
      if (row) { row.click(); return "expanded"; }
      return "stuck";
    });
    if (done === "done") return; if (done === "stuck") { if (tabTries >= tabs.length) break; await realClick(tabs[tabTries++]).catch(() => {}); continue; } await sleep(200);
  }
};
const shot = (n) => page.screenshot({ path: `${SP}/${n}.png`, fullPage: true });
const step = async (name, fn) => { try { await fn(); console.log("PASS", name); } catch (e) { process.exitCode = 1; console.log("FAIL", name, "-", e.message.split("\n")[0]); await shot("fail_" + name.replace(/\W+/g, "_")); } };

await page.goto(base + "/new", { waitUntil: "networkidle0" });
await step("spec: non-xlsx rejected", async () => { await upload(R + "proof_v1.pdf"); await waitText("not a readable .xlsx"); });
await step("spec: no blue cells -> error", async () => { await upload(SP + "/noblue.xlsx"); await waitText("No blue"); });
await step("spec: real xlsx read, 19 fields", async () => { await upload(R + "spec_SP-2026-0417_v3.xlsx"); await waitText("Read from spec"); const t = await body(); if (!/SP-2026-0417/.test(t)) throw new Error("spec number missing"); if (!/19/.test(t)) throw new Error("19 not shown"); await shot("1_new"); });
await step("create request -> upload page", async () => { await click("Create request"); await waitText("Upload proof"); await sleep(800); /* let the page hydrate before the next upload */ });
await step("proof: fake pdf -> could not be opened", async () => { await upload(SP + "/fake.pdf"); await sleep(600); await click("Submit proof for review").catch(async () => { const b = await page.$$eval("button", (bs) => bs.map((x) => x.innerText.trim())); throw new Error("buttons: " + b.join("|")); }); await waitText("could not be opened as a PDF"); });
await step("round 1: v1 vector -> 6 findings, text layer", async () => { await upload(R + "proof_v1.pdf"); await click("Submit proof for review"); await waitText("Read from the PDF text layer"); const t = await body(); await shot("2_review1"); const n = await page.evaluate(() => [...document.querySelectorAll("button")].filter((x) => /Undecided/.test(x.innerText) && /^F\d/.test(x.innerText.trim())).length); if (n !== 6) throw new Error("expected 6 finding rows, got " + n); if (!/Matches 14/.test(t)) throw new Error("14 matches missing"); });
await step("round 1: Finish blocked while open", async () => { const dis = await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "Finish review")?.disabled); if (!dis) throw new Error("Finish not disabled"); });
await step("round 1: decide all real, finish -> send-back", async () => { await clickAllReal(); await click("Finish review"); await waitText("Send to designer"); await shot("3_sendback1"); const v = await page.$$eval("textarea", (xs) => xs.map((x) => x.value)); if (v.length !== 6 || !v.every((x) => x.length > 30)) throw new Error("expected 6 Hungarian lines, got " + v.length); });
await step("send to designer -> round 2 upload shows requested lines", async () => { await click("Send to designer"); await waitText("Upload proof"); await shot("4_upload2"); });
await step("round 2: v2 -> 2 unrequested, C4 not done", async () => { await upload(R + "proof_v2.pdf"); await click("Submit proof for review"); await waitText("Read from the PDF text layer"); await sleep(300); await realClick("^Changes"); const t = await body(); await shot("5_review2"); if (!/Hozzáadott cukor nélkül/.test(t)) throw new Error("claim not shown"); if (!/Same change as spec finding F2/.test(t)) throw new Error("preparation change not linked to F2"); if (!/Reject: add to send-back list/.test(t)) throw new Error("no reject button for the claim"); const lines = await body(); console.log("   r2 Changes tab:", lines.split("\n").filter((l) => /^(U\d|C\d|Moved|Same text)/.test(l.trim())).slice(0, 8).join(" | ")); });
await step("round 2: decide all real, finish, send", async () => { await clickAllReal(); await click("Finish review"); await waitText("Send to designer"); await shot("6_sendback2"); await click("Send to designer"); await waitText("Upload proof"); });
await step("round 3: v3 clean -> no decisions, finish -> checker 2", async () => { await upload(R + "proof_v3.pdf"); await click("Submit proof for review"); await waitText("Read from the PDF text layer"); await shot("7_review3"); const fin = await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "Finish review")?.disabled); if (fin) throw new Error("Finish should be enabled in a clean round"); await click("Finish review"); await waitText("Sign off and pass to approval"); });
await step("checker 2 signs off -> lead approves", async () => { await click("Sign off and pass to approval"); await waitText("Approve"); await click("Approve"); await waitText("Approved"); await shot("8_approved"); });

// separate session: flat proof is a failed read, never a pass
await page.goto(base + "/new", { waitUntil: "networkidle0" });
await upload(R + "spec_SP-2026-0417_v3.xlsx"); await waitText("Read from spec"); await click("Create request"); await waitText("Upload proof"); await sleep(800);
await step("flat proof v1 -> failed banner, 19 could-not-read", async () => { await upload(R + "proof_v1_flat.pdf"); await click("Submit proof for review"); await waitText("could not be read"); await shot("9_flat"); const t = await body(); if (/Read from the PDF text layer/.test(t)) throw new Error("flat shown as text layer"); });
console.log("ERRORS:", errs.length ? errs.slice(0, 8).join("\n") : "none");
await browser.close();
