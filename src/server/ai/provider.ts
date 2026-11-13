import { z } from "zod";
import { AppError } from "../errors";

/*
  AI provider abstraction. OpenAI is the first implementation; others can be added
  behind the same interface. Every call returns data validated against a Zod schema,
  so model output is treated as untrusted input and never executed.
*/
export type GenerateRequest<T> = {
  /** Short name for logs and the JSON schema name. */
  task: string;
  schema: z.ZodType<T>;
  system: string;
  user: string;
  /** Data URLs of images (e.g. analysis keyframes). Only sent with customer consent. */
  images?: string[];
  temperature?: number;
};

export type GenerateResult<T> = { data: T; model: string; usage?: { input_tokens?: number; output_tokens?: number } };

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

/** JSON Schema for OpenAI strict structured outputs: every property required, no extras. */
export function strictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      // Drop keywords strict mode rejects. "format" only as a keyword (string value), never a property named "format".
      if (k === "$schema" || (k === "format" && typeof v === "string") || (k === "default" && typeof v !== "object")) continue;
      out[k] = walk(v);
    }
    if (out.type === "object" && out.properties && typeof out.properties === "object") {
      out.required = Object.keys(out.properties as object);
      out.additionalProperties = false;
    }
    return out;
  };
  return walk(json) as Record<string, unknown>;
}

/** Test double: returns canned data (or throws) and records calls. Never used outside tests. */
export function createMockProvider(handler: (req: GenerateRequest<unknown>) => unknown): AiProvider & { calls: GenerateRequest<unknown>[] } {
  const calls: GenerateRequest<unknown>[] = [];
  return {
    name: "mock",
    model: "mock-model",
    calls,
    async generate<T>(req: GenerateRequest<T>) {
      calls.push(req as GenerateRequest<unknown>);
      const raw = await handler(req as GenerateRequest<unknown>);
      const parsed = req.schema.safeParse(raw);
      if (!parsed.success) throw new AppError("provider_error", "The AI returned an unexpected format. Please try again.");
      return { data: parsed.data, model: "mock-model" };
    },
  };
}
