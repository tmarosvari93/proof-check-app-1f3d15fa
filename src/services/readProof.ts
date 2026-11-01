/**
 * Browser client for the read-proof edge function (supabase/functions/read-proof).
 * The function only forwards the page image to Claude vision. The reply is checked HERE with the shared
 * schemas (src/core/schemas.ts, covered by tests): a reply that does not fit is retried once, then it is an
 * error and the fields show Could not read (R5). The AI never decides a verdict.
 */
import { blocksFromReply, parseBlocksReply, parseFieldsReply, type FieldsReply } from "../core/schemas";
import type { Block } from "../core/textLayer";

export interface ReaderConfig {
  /** Base URL of the backend, e.g. https://xyz.supabase.co */
  url: string;
  /** Publishable key (public by design). */
  apikey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type ReadResult<T> = { ok: true; value: T; seconds: number } | { ok: false; error: string };

export interface FieldIn {
  id: string;
  label: string;
  value: string;
}

export function readerConfig(): ReaderConfig {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return { url: env["VITE_SUPABASE_URL"] ?? "", apikey: env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "" };
}

type Raw = { ok: true; result: unknown } | { ok: false; error: string };

async function call(cfg: ReaderConfig, body: unknown): Promise<Raw> {
  if (!cfg.url) return { ok: false, error: "The reader is not configured" };
  try {
    const resp = await (cfg.fetchImpl ?? fetch)(`${cfg.url.replace(/\/+$/, "")}/functions/v1/read-proof`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: cfg.apikey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(cfg.timeoutMs ?? 60_000),
    });
    const data = (await resp.json().catch(() => null)) as { ok?: boolean; result?: unknown; error?: string } | null;
    if (resp.ok && data?.ok && data.result !== undefined) return { ok: true, result: data.result };
    return { ok: false, error: data?.error ?? `The reader returned an error (${resp.status})` };
  } catch (e) {
    // Say what really happened. A blocked request (CORS, function not deployed, offline) is not a timeout.
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") return { ok: false, error: "The reader did not answer in time" };
    const detail = e instanceof Error && e.message ? e.message : "unknown";
    return { ok: false, error: `The reader could not be reached (${name || "Error"}: ${detail}). Check that the read-proof function is deployed` };
  }
}

/** One call, then one retry when the call failed or the reply does not fit the schema. */
async function readWithRetry<T>(cfg: ReaderConfig, body: unknown, check: (raw: unknown) => { ok: true; value: T } | { ok: false; error: string }): Promise<ReadResult<T>> {
  const t0 = performance.now();
  let error = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await call(cfg, body);
    if (raw.ok) {
      const v = check(raw.result);
      if (v.ok) return { ok: true, value: v.value, seconds: Math.round(((performance.now() - t0) / 1000) * 10) / 10 };
      error = `The reply did not fit: ${v.error}`;
    } else {
      error = raw.error;
    }
  }
  return { ok: false, error };
}

/** Mode "fields": the printed text of each spec field (round 1 and every later spec check). */
export function readFields(cfg: ReaderConfig, imageBase64: string, fields: FieldIn[]): Promise<ReadResult<FieldsReply>> {
  const ids = fields.map((f) => f.id);
  return readWithRetry(cfg, { mode: "fields", image: imageBase64, fields }, (raw) => parseFieldsReply(raw, ids));
}

/** Mode "blocks": all text blocks with rough positions, for the diff between rounds. */
export function readBlocks(cfg: ReaderConfig, imageBase64: string, page: { width: number; height: number }): Promise<ReadResult<Block[]>> {
  return readWithRetry(cfg, { mode: "blocks", image: imageBase64 }, (raw) => {
    const p = parseBlocksReply(raw);
    return p.ok ? { ok: true, value: blocksFromReply(p.value, page) } : p;
  });
}
