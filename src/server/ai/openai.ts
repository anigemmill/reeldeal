import { AppError } from "../errors";
import { strictJsonSchema, type AiProvider, type GenerateRequest } from "./provider";

/*
  OpenAI via the Chat Completions API with strict JSON-schema structured outputs
  (also works with OpenAI-compatible gateways through baseUrl). Handles timeouts,
  rate limits (429, honouring Retry-After) and transient 5xx with bounded retries.
  Errors returned to users are generic; provider responses and keys are never echoed.
*/
export type OpenAiConfig = { apiKey: string; baseUrl?: string; model: string; timeoutMs: number; maxRetries?: number; fetch?: typeof fetch };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createOpenAiProvider(cfg: OpenAiConfig): AiProvider {
  const base = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const doFetch = cfg.fetch ?? fetch;
  const maxRetries = cfg.maxRetries ?? 2;

  return {
    name: "openai",
    model: cfg.model,
    async generate<T>(req: GenerateRequest<T>) {
      const userContent = req.images?.length
        ? [{ type: "text", text: req.user }, ...req.images.map((url) => ({ type: "image_url", image_url: { url, detail: "low" } }))]
        : req.user;
      const body = {
        model: cfg.model,
        temperature: req.temperature ?? 0.7,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_schema", json_schema: { name: req.task.replace(/[^A-Za-z0-9_-]/g, "_"), strict: true, schema: strictJsonSchema(req.schema) } },
      };

      for (let attempt = 0; ; attempt++) {
        let res: Response;
        try {
          res = await doFetch(`${base}/chat/completions`, {
            method: "POST",
            headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(cfg.timeoutMs),
          });
        } catch (e) {
          if (attempt < maxRetries) {
            await sleep(500 * 2 ** attempt);
            continue;
          }
          const timedOut = (e as Error)?.name === "TimeoutError";
          throw new AppError("provider_error", timedOut ? "The AI service took too long to respond. Please try again." : "Could not reach the AI service. Please try again.");
        }
        if (res.status === 429 || res.status >= 500) {
          if (attempt < maxRetries) {
            const retryAfter = Number(res.headers.get("retry-after"));
            await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 800 * 2 ** attempt);
            continue;
          }
          throw new AppError(res.status === 429 ? "rate_limited" : "provider_error", res.status === 429 ? "The AI service is busy. Please try again shortly." : "The AI service had a problem. Please try again.");
        }
        if (res.status === 401 || res.status === 403) throw new AppError("capability_unavailable", "AI is not available: the platform's AI credentials were rejected. An administrator needs to check them.");
        if (!res.ok) throw new AppError("provider_error", "The AI service rejected the request.");

        const json = (await res.json()) as { model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: { message?: { content?: string; refusal?: string } }[] };
        const msg = json.choices?.[0]?.message;
        if (msg?.refusal) throw new AppError("provider_error", "The AI declined this request. Try rephrasing it.");
        let raw: unknown;
        try {
          raw = JSON.parse(msg?.content ?? "");
        } catch {
          raw = undefined;
        }
        const parsed = req.schema.safeParse(raw);
        if (!parsed.success) {
          if (attempt < maxRetries) continue; // malformed output: try again
          throw new AppError("provider_error", "The AI returned an unexpected format. Please try again.");
        }
        return { data: parsed.data, model: json.model ?? cfg.model, usage: { input_tokens: json.usage?.prompt_tokens, output_tokens: json.usage?.completion_tokens } };
      }
    },
  };
}
