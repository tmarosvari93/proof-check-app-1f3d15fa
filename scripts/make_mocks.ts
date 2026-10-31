// Generates src/mocks/real.json from the real fixtures and the real core code.
// Run: bun scripts/make_mocks.ts   (Claude runs it; Lovable does not need to)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseSpecWorkbook } from "../src/core/parseSpec";
import { compareAll, type FieldResult } from "../src/core/compare";
import { toFindings, countMatches } from "../src/core/findings";
import { loadPdfPage } from "../tests/helpers/loadPdf";

const root = join(__dirname, "..");
const spec = await parseSpecWorkbook(new Uint8Array(readFileSync(join(root, "fixtures", "spec_SP-2026-0417_v3.xlsx"))));
const out: Record<string, unknown> = { spec };
for (const v of ["v1", "v2", "v3"]) {
  const page = await loadPdfPage(`proof_${v}.pdf`);
  const results: FieldResult[] = compareAll(spec.fields, page.blocks);
  // Boxes and block ids are noise for the UI mocks.
  const slim = results.map((r) => ({ ...r, occurrences: r.occurrences.map((o) => ({ ...o, occurrence: { ...o.occurrence, box: [0, 0, 0, 0] } })) }));
  out[v] = { results: slim, findings: toFindings(results), matches: countMatches(results) };
}
writeFileSync(join(root, "src", "mocks", "real.json"), JSON.stringify(out, null, 1));
console.log("wrote src/mocks/real.json");
