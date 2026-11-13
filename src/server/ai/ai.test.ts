import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "../errors";
import { createOpenAiProvider } from "./openai";
import { strictJsonSchema } from "./provider";
import { BriefOutput, StoryboardOutput } from "./schemas";

const ok = (content: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ model: "gpt-test", choices: [{ message: { content: JSON.stringify(content) } }] }), { status, headers });

const req = { task: "t", schema: z.object({ a: z.string() }), system: "s", user: "u" };

describe("strict JSON schema conversion", () => {
  it("requires every property and forbids extras, recursively", () => {
    const s = strictJsonSchema(StoryboardOutput) as { required: string[]; additionalProperties: boolean; properties: { scenes: { items: { required: string[]; additionalProperties: boolean } } } };
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(["title", "format", "scenes"]);
    expect(s.properties.scenes.items.additionalProperties).toBe(false);
    expect(s.properties.scenes.items.required).toContain("on_screen_text");
    expect(JSON.stringify(strictJsonSchema(BriefOutput))).not.toContain("$schema");
  });
});

describe("OpenAI provider (mocked HTTP, no live calls)", () => {
  const base = { apiKey: "sk-test-not-real", model: "gpt-test", timeoutMs: 2000 };

  it("returns validated structured output and sends the schema", async () => {
    let sent: { response_format: { type: string; json_schema: { strict: boolean } } } | undefined;
    const p = createOpenAiProvider({ ...base, fetch: async (_u, init) => ((sent = JSON.parse(String(init?.body))), ok({ a: "x" })) });
    const r = await p.generate(req);
    expect(r.data).toEqual({ a: "x" });
    expect(sent?.response_format.type).toBe("json_schema");
    expect(sent?.response_format.json_schema.strict).toBe(true);
  });

  it("retries after a rate limit, then succeeds", async () => {
    let n = 0;
    const p = createOpenAiProvider({ ...base, fetch: async () => (++n === 1 ? new Response("{}", { status: 429, headers: { "retry-after": "0" } }) : ok({ a: "y" })) });
    expect((await p.generate(req)).data).toEqual({ a: "y" });
    expect(n).toBe(2);
  });

  it("rejects invalid model output after retries", async () => {
    const p = createOpenAiProvider({ ...base, maxRetries: 1, fetch: async () => ok({ wrong: true }) });
    await expect(p.generate(req)).rejects.toMatchObject({ code: "provider_error" });
  });

  it("maps rejected credentials to capability_unavailable without echoing the key", async () => {
    const p = createOpenAiProvider({ ...base, fetch: async () => new Response('{"error":"bad key sk-test-not-real"}', { status: 401 }) });
    const err = (await p.generate(req).catch((e) => e)) as AppError;
    expect(err.code).toBe("capability_unavailable");
    expect(err.message).not.toContain("sk-test");
  });

  it("gives up on persistent 5xx with a generic error", async () => {
    const p = createOpenAiProvider({ ...base, maxRetries: 1, fetch: async () => new Response("upstream exploded", { status: 503 }) });
    const err = (await p.generate(req).catch((e) => e)) as AppError;
    expect(err.code).toBe("provider_error");
    expect(err.message).not.toContain("exploded");
  });

  it("handles a refusal", async () => {
    const p = createOpenAiProvider({ ...base, fetch: async () => new Response(JSON.stringify({ choices: [{ message: { refusal: "no" } }] })) });
    await expect(p.generate(req)).rejects.toMatchObject({ code: "provider_error" });
  });
});
