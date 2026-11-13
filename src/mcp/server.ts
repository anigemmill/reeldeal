import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { requireScope, type Principal } from "@/server/auth/principal";
import type { Platform } from "@/server/context";
import { AppError, toAppError } from "@/server/errors";
import { TOOLS, type ToolDef } from "./tools";

/*
  Builds an MCP server over the platform. Transport-agnostic: the STDIO entry
  (src/mcp/stdio.ts) and the Streamable HTTP handler (src/mcp/http.ts) both call this.
  The principal is resolved by the transport from trusted authentication data and
  re-checked on every tool call, so a revoked token stops working immediately.
*/
export const SERVER_INFO = { name: "reeldeal", title: "Reeldeal video platform", version: "0.1.0" };

export const INSTRUCTIONS = `Reeldeal is an AI video production platform for businesses (tourism and hospitality first).
You act inside one workspace (organisation), established by the user's credentials.

Typical flow:
1. get_my_workspace → list_brands / get_brand_profile → search_media (footage) → create_project.
2. create_video_brief → generate_video_concepts → generate_storyboard (or write one with the user and save it with submit_storyboard).
3. create_video returns a credit quote. Show the cost to the user and only call create_video again with confirm: true and the quote_token after they agree.
4. Poll get_render_status, then get_export for a short-lived download link.

Rules: never invent brand facts or footage; use ids returned by the tools. Previews, briefs, concepts and storyboards are free; credits are spent only by successful renders.`;

export type ResolvePrincipal = () => Promise<Principal>;

/** Simple per-principal token buckets: protects the platform and the AI budget. */
function createLimiter() {
  const buckets = new Map<string, { tokens: number; at: number }>();
  const LIMITS = { normal: { capacity: 120, perSecond: 2 }, expensive: { capacity: 10, perSecond: 0.2 } };
  return (key: string, cost: "normal" | "expensive") => {
    const lim = LIMITS[cost];
    const k = `${key}:${cost}`;
    const now = Date.now() / 1000;
    const b = buckets.get(k) ?? { tokens: lim.capacity, at: now };
    b.tokens = Math.min(lim.capacity, b.tokens + (now - b.at) * lim.perSecond);
    b.at = now;
    if (b.tokens < 1) {
      buckets.set(k, b);
      return false;
    }
    b.tokens -= 1;
    buckets.set(k, b);
    return true;
  };
}
const limiter = createLimiter();

function errorResult(e: AppError): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: `${e.code}: ${e.message}${e.details ? `\n${JSON.stringify(e.details)}` : ""}` }],
  };
}

export function createMcpServer(p: Platform, opts: { resolvePrincipal: ResolvePrincipal; workersRunning?: boolean | null; tools?: ToolDef[] }) {
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS, capabilities: { logging: {} } });
  const log = p.log.child({ component: "mcp" });

  for (const def of opts.tools ?? TOOLS) {
    if (def.available && !def.available(p)) continue;
    server.registerTool(
      def.name,
      { title: def.title, description: def.description, inputSchema: def.input, outputSchema: def.output, annotations: def.annotations },
      async (args: unknown): Promise<CallToolResult> => {
        const started = Date.now();
        let principal: Principal | undefined;
        try {
          principal = await opts.resolvePrincipal();
          requireScope(principal, def.scope);
          if (!limiter(principal.tokenId ?? principal.userId, def.cost ?? "normal")) {
            throw new AppError("rate_limited", "Too many requests. Please wait a moment and try again.");
          }
          const result = (await def.run({ ...p, principal }, args as never, { workersRunning: opts.workersRunning ?? null })) as Record<string, unknown>;
          log.info("tool call", { tool: def.name, org_id: principal.orgId, user_id: principal.userId, ms: Date.now() - started, outcome: "ok" });
          return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
        } catch (e) {
          const err = toAppError(e);
          const level = err.code === "internal" ? "error" : "info";
          log[level]("tool call", {
            tool: def.name,
            org_id: principal?.orgId,
            user_id: principal?.userId,
            ms: Date.now() - started,
            outcome: err.code,
            ...(err.code === "internal" ? { error: (e as Error)?.message } : {}),
          });
          return errorResult(err);
        }
      },
    );
  }
  return server;
}
