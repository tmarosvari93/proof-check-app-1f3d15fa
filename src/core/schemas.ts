/**
 * What the read-proof function returns, checked before anything uses it. Shared by the edge function and
 * the tests. The AI only reads (R5 / v4): a reply that does not fit is an error, never a guess, and the
 * fields then show Could not read.
 */
import { z } from "zod";
import type { Block, Word } from "./textLayer";

export const fieldsReplySchema = z.object({
  fields: z.array(
    z.object({
      id: z.string().min(1),
      status: z.enum(["found", "not_found", "unreadable"]),
      found_text: z.string().nullable(),
      emphasised_words: z.array(z.string()),
    }),
  ),
});
export type FieldsReply = z.infer<typeof fieldsReplySchema>;

export const blocksReplySchema = z.object({
  blocks: z.array(
    z.object({
      text: z.string().min(1),
      x_percent: z.number().min(0).max(100),
      y_percent: z.number().min(0).max(100),
      emphasised_words: z.array(z.string()),
    }),
  ),
});
export type BlocksReply = z.infer<typeof blocksReplySchema>;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Mode "fields": one entry for every requested id, none twice, none unknown; "found" needs text. */
export function parseFieldsReply(raw: unknown, expectedIds: string[]): Parsed<FieldsReply> {
  const r = fieldsReplySchema.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "invalid reply" };
  const ids = r.data.fields.map((f) => f.id);
  const missing = expectedIds.filter((id) => !ids.includes(id));
  if (missing.length) return { ok: false, error: `missing fields: ${missing.join(", ")}` };
  const unknown = ids.filter((id) => !expectedIds.includes(id));
  if (unknown.length) return { ok: false, error: `unknown fields: ${unknown.join(", ")}` };
  if (new Set(ids).size !== ids.length) return { ok: false, error: "a field is reported twice" };
  const empty = r.data.fields.find((f) => f.status === "found" && !f.found_text?.trim());
  if (empty) return { ok: false, error: `field ${empty.id} is found but has no text` };
  return { ok: true, value: r.data };
}

/** Mode "blocks": at least one block. */
export function parseBlocksReply(raw: unknown): Parsed<BlocksReply> {
  const r = blocksReplySchema.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "invalid reply" };
  if (r.data.blocks.length === 0) return { ok: false, error: "no blocks read" };
  return { ok: true, value: r.data };
}

/** AI blocks as Blocks for diff.ts. The box is a small box around the reported centre (y counted from the top). */
export function blocksFromReply(reply: BlocksReply, page: { width: number; height: number }): Block[] {
  return reply.blocks.map((b, i) => {
    const cx = (b.x_percent / 100) * page.width;
    const cy = (1 - b.y_percent / 100) * page.height;
    const emph = new Set(b.emphasised_words.map((w) => w.toLowerCase()));
    const words: Word[] = b.text.split(/\s+/).filter(Boolean).map((t) => ({ text: t, bold: emph.has(t.toLowerCase()) }));
    const box: [number, number, number, number] = [cx - 5, cy - 5, cx + 5, cy + 5];
    return {
      id: `ai${i + 1}`,
      page: 1,
      text: b.text,
      box,
      fontSize: 0,
      // One line per block: locate.ts finds a field by the lines of a block (a label such as "Szénhidrát" starts a line).
      // Without it no field is found in an AI block and every change looks unrequested.
      lines: [{ text: b.text, box, fontSize: 0, words }],
      words,
      boldWords: words.filter((w) => w.bold).map((w) => w.text),
    };
  });
}
