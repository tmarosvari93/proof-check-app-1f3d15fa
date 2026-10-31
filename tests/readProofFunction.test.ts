// The read-proof edge function, run in Node with a fake Anthropic API. Proves what it sends, what it refuses,
// and that it never passes the provider's error text on.
import { describe, expect, it } from "vitest";
import { checkBody, handle, MODEL } from "../supabase/functions/read-proof/index";

const image = "QUJD".repeat(60);
const post = (body: unknown) => new Request("https://f/", { method: "POST", body: JSON.stringify(body) });
const anthropic = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const tool = (input: unknown) => ({ content: [{ type: "text", text: "ok" }, { type: "tool_use", input }], usage: { input_tokens: 11, output_tokens: 4 } });

describe("read-proof function", () => {
  it("answers CORS preflight and refuses other methods", async () => {
    expect((await handle(new Request("https://f/", { method: "OPTIONS" }), { key: "k" })).status).toBe(200);
    expect((await handle(new Request("https://f/", { method: "GET" }), { key: "k" })).status).toBe(405);
  });
  it("refuses a bad body with 400 and never calls the API", async () => {
    let called = 0;
    const f = (async () => { called++; return anthropic(200, {}); }) as unknown as typeof fetch;
    for (const bad of [{}, { mode: "fields", image }, { mode: "other", image }, { mode: "blocks", image: "x" }, { mode: "blocks", image: "not base64!!" + "A".repeat(200) }, { mode: "fields", image, fields: [{ id: 1 }] }]) {
      expect((await handle(post(bad), { key: "k" }, f)).status).toBe(400);
    }
    expect((await handle(new Request("https://f/", { method: "POST", body: "nope" }), { key: "k" }, f)).status).toBe(400);
    expect(called).toBe(0);
  });
  it("refuses an oversized image and too many fields", () => {
    expect(typeof checkBody({ mode: "blocks", image: "A".repeat(7_000_001) })).toBe("string");
    const fields = Array.from({ length: 61 }, (_, i) => ({ id: `f${i}`, label: "l", value: "v" }));
    expect(typeof checkBody({ mode: "fields", image, fields })).toBe("string");
  });
  it("is not configured without the secret (and says nothing about the key)", async () => {
    const r = await handle(post({ mode: "blocks", image }), {});
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toMatch(/key|secret|ANTHROPIC/i);
  });
  it("sends the model, the image and the field list, and returns the tool input", async () => {
    let seen: { headers: Record<string, string>; body: any } | undefined;
    const f = (async (_u: string, init: RequestInit) => { seen = { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) }; return anthropic(200, tool({ fields: [] })); }) as unknown as typeof fetch;
    const r = await handle(post({ mode: "fields", image, fields: [{ id: "carbs", label: "Szénhidrát", value: "64,5 g" }] }), { key: "sk-test" }, f);
    const out = await r.json();
    expect(out).toMatchObject({ ok: true, result: { fields: [] }, usage: { in: 11, out: 4 } });
    expect(seen!.headers["x-api-key"]).toBe("sk-test");
    expect(seen!.body.model).toBe(MODEL);
    expect(seen!.body.tools[0].name).toBe("report_fields");
    expect(seen!.body.messages[0].content[0].source.data).toBe(image);
    expect(seen!.body.messages[0].content[1].text).toContain("id=carbs | label: Szénhidrát | spec text: 64,5 g");
    expect("temperature" in seen!.body).toBe(false); // none on this model (spike)
    expect(JSON.stringify(out)).not.toContain("sk-test");
  });
  it("blocks mode uses the blocks tool", async () => {
    let name = "";
    const f = (async (_u: string, init: RequestInit) => { name = JSON.parse(String(init.body)).tools[0].name; return anthropic(200, tool({ blocks: [] })); }) as unknown as typeof fetch;
    await handle(post({ mode: "blocks", image }), { key: "k" }, f);
    expect(name).toBe("report_blocks");
  });
  it("passes no provider error text on", async () => {
    const f = (async () => anthropic(401, { error: { message: "invalid x-api-key sk-secret-123" } })) as unknown as typeof fetch;
    const r = await handle(post({ mode: "blocks", image }), { key: "sk-secret-123" }, f);
    expect(r.status).toBe(502);
    expect(JSON.stringify(await r.json())).not.toContain("sk-secret");
  });
  it("a timeout or network error is a 504, an answer without the tool call is a 502", async () => {
    const boom = (async () => { throw new Error("socket"); }) as unknown as typeof fetch;
    expect((await handle(post({ mode: "blocks", image }), { key: "k" }, boom)).status).toBe(504);
    const none = (async () => anthropic(200, { content: [{ type: "text", text: "sorry" }] })) as unknown as typeof fetch;
    expect((await handle(post({ mode: "blocks", image }), { key: "k" }, none)).status).toBe(502);
  });
});
