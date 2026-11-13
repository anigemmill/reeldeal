import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockProvider } from "@/server/ai/provider";
import { createAccessToken, revokeAccessToken, verifyAccessToken } from "@/server/auth/tokens";
import { createPgliteDb } from "@/server/db/pglite";
import { migrate } from "@/server/db/migrate";
import { seedDemoData } from "@/server/seed";
import { createLocalStorage } from "@/server/storage/local";
import { silentLogger } from "@/server/log";
import { createTestPlatform } from "@/server/testing";
import { handleMcpHttp, metadataUrl, protectedResourceMetadata, type HttpConfig } from "./http";
import { createMcpServer } from "./server";
import { TOOLS } from "./tools";

/*
  MCP protocol and security tests with the official SDK client.
  In-memory transport for the protocol, the web-standard HTTP handler for remote
  auth, a real local JWKS endpoint for OAuth, and a spawned STDIO process.
  AI is a mock provider: no live AI calls.
*/
let t: Awaited<ReturnType<typeof createTestPlatform>>;
const ai = createMockProvider(() => ({}));

async function connect(token: string) {
  const server = createMcpServer(t.p, { resolvePrincipal: () => verifyAccessToken(t.p.db, token) });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test", version: "1" });
  await client.connect(b);
  return client;
}
const text = (r: unknown) => ((r as { content?: { text?: string }[] }).content ?? [])[0]?.text ?? "";

beforeAll(async () => {
  t = await createTestPlatform({ ai, clips: 3 });
}, 120_000);

describe("MCP protocol (in-memory transport, SDK client)", () => {
  it("negotiates, exposes server info and instructions, and lists every tool with schemas", async () => {
    const c = await connect(t.demo.tokens.aroha_owner_full);
    expect(c.getServerVersion()).toMatchObject({ name: "reeldeal", version: "0.1.0" });
    expect(c.getInstructions()).toMatch(/confirm: true/);
    const { tools } = await c.listTools();
    expect(tools.map((x) => x.name).sort()).toEqual(TOOLS.map((x) => x.name).sort());
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.outputSchema?.type).toBe("object");
      expect(tool.description!.length).toBeGreaterThan(40);
    }
    const ro = tools.filter((x) => x.annotations?.readOnlyHint).map((x) => x.name);
    expect(ro).toEqual(expect.arrayContaining(["search_media", "get_project", "get_export"]));
    expect(ro).not.toContain("create_video");
  });

  it("hides AI tools when no AI provider is configured", async () => {
    const server = createMcpServer({ ...t.p, ai: null }, { resolvePrincipal: () => verifyAccessToken(t.p.db, t.demo.tokens.aroha_owner_full) });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await server.connect(a);
    const c = new Client({ name: "t", version: "1" });
    await c.connect(b);
    const names = (await c.listTools()).tools.map((x) => x.name);
    expect(names).not.toContain("create_video_brief");
    expect(names).toContain("submit_storyboard");
  });

  it("returns structured content that matches the declared output schema", async () => {
    const c = await connect(t.demo.tokens.aroha_owner_full);
    const r = await c.callTool({ name: "get_my_workspace", arguments: {} });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { organisation: { name: string } }).organisation.name).toBe("Lakeside Lodge");
    expect(JSON.parse(text(r))).toEqual(r.structuredContent);
  });

  it("rejects invalid input before any service runs", async () => {
    const c = await connect(t.demo.tokens.aroha_owner_full);
    const r = await c.callTool({ name: "get_project", arguments: { project_id: "not-a-uuid" } });
    expect(r.isError).toBe(true);
    const r2 = await c.callTool({ name: "search_media", arguments: { limit: 999 } });
    expect(r2.isError).toBe(true);
  });

  it("reports unknown tools as errors", async () => {
    const c = await connect(t.demo.tokens.aroha_owner_full);
    const outcome = await c.callTool({ name: "drop_database", arguments: {} }).then(
      (r) => r.isError,
      () => true,
    );
    expect(outcome).toBe(true);
  });
});

describe("MCP security", () => {
  it("enforces token scopes and roles per tool", async () => {
    const viewer = await connect(t.demo.tokens.cleo_viewer_read);
    const r = await viewer.callTool({ name: "create_project", arguments: { name: "Nope" } });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/^forbidden/);
    expect((await viewer.callTool({ name: "list_projects", arguments: {} })).isError).toBeFalsy();
  });

  it("revoking a token stops an open session on the next call", async () => {
    const tok = await createAccessToken(t.p.db, { userId: t.demo.ids.ben, orgId: t.demo.ids.orgA, name: "revoke-me" });
    const c = await connect(tok.token);
    expect((await c.callTool({ name: "get_usage", arguments: {} })).isError).toBeFalsy();
    await revokeAccessToken(t.p.db, tok.id);
    const r = await c.callTool({ name: "get_usage", arguments: {} });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/^unauthenticated/);
  });

  it("organisation B cannot reach organisation A's data through any id-taking tool", async () => {
    const b = await connect(t.demo.tokens.dev_harbour_full);
    const aMedia = t.demo.media.find((m) => m.org === "a")!.id;
    for (const [name, args] of [
      ["get_project", { project_id: t.demo.ids.projectA }],
      ["get_brand_profile", { brand_id: t.demo.ids.brandA }],
      ["get_media_details", { media_id: aMedia, include_preview_url: true }],
      ["get_media_analysis", { media_id: aMedia }],
      ["analyse_media", { media_id: aMedia }],
      ["create_video", { project_id: t.demo.ids.projectA }],
      ["update_brand_profile", { brand_id: t.demo.ids.brandA, name: "Hijacked" }],
    ] as const) {
      const r = await b.callTool({ name, arguments: args });
      expect(r.isError, name).toBe(true);
      expect(text(r), name).toMatch(/^not_found/);
    }
  });

  it("never returns storage keys, tokens or secrets from read tools", async () => {
    const c = await connect(t.demo.tokens.aroha_owner_full);
    const m = t.demo.media.find((x) => x.org === "a")!.id;
    const outputs: string[] = [];
    for (const [name, args] of [
      ["get_platform_status", {}],
      ["get_my_workspace", {}],
      ["get_usage", {}],
      ["list_brands", {}],
      ["get_brand_profile", { brand_id: t.demo.ids.brandA }],
      ["search_media", { query: "lake" }],
      ["get_media_details", { media_id: m, include_preview_url: true }],
      ["get_media_analysis", { media_id: m }],
      ["list_projects", {}],
      ["get_project", { project_id: t.demo.ids.projectA }],
      ["list_exports", {}],
    ] as const) {
      const r = await c.callTool({ name, arguments: args });
      expect(r.isError, `${name}: ${text(r)}`).toBeFalsy();
      outputs.push(JSON.stringify(r));
    }
    const all = outputs.join("\n");
    expect(all).not.toMatch(/storage_key|token_hash|rdl_pat_|service_role|DATABASE_URL/);
    expect(all).not.toContain(t.p.signingSecret);
    for (const tok of Object.values(t.demo.tokens)) expect(all).not.toContain(tok);
  });

  it("billable work cannot start without an explicit confirmation", async () => {
    const c = await connect(t.demo.tokens.aroha_owner_full);
    const lake = t.demo.media.find((x) => x.org === "a")!.id;
    await t.p.db.system((sql) => sql.query("update public.media_assets set duration_seconds = 6, width = 320, height = 180, status = 'ready' where id = $1", [lake]));
    const sb = await c.callTool({ name: "submit_storyboard", arguments: { project_id: t.demo.ids.projectA, title: "T", format: "9:16", scenes: [{ duration_seconds: 2, asset_id: lake }] } });
    expect(sb.isError, text(sb)).toBeFalsy();
    const jobsBefore = await t.p.db.system((sql) => sql.query("select id from public.jobs where kind = 'render'"));
    for (const args of [{ project_id: t.demo.ids.projectA }, { project_id: t.demo.ids.projectA, confirm: true }, { project_id: t.demo.ids.projectA, confirm: false, quote_token: "x.y" }]) {
      const r = await c.callTool({ name: "create_video", arguments: args });
      expect(r.isError).toBeFalsy();
      expect((r.structuredContent as { status: string }).status).toBe("confirmation_required");
    }
    const forged = await c.callTool({ name: "create_video", arguments: { project_id: t.demo.ids.projectA, confirm: true, quote_token: "eyJmYWtlIjoxfQ.forged" } });
    expect(forged.isError).toBe(true);
    const jobsAfter = await t.p.db.system((sql) => sql.query("select id from public.jobs where kind = 'render'"));
    expect(jobsAfter.length).toBe(jobsBefore.length);
  });
});

describe("Streamable HTTP endpoint (web-standard handler)", () => {
  const cfg: HttpConfig = { resourceUrl: "https://mcp.example.test/mcp", allowedOrigins: ["https://app.example.test"], allowPats: true };
  const rpc = (body: unknown, headers: Record<string, string> = {}) =>
    new Request(cfg.resourceUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-11-25", ...headers },
      body: JSON.stringify(body),
    });
  const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "1" } } };

  it("challenges unauthenticated requests with RFC 9728 resource metadata", async () => {
    const res = await handleMcpHttp(t.p, cfg, rpc(init));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(`resource_metadata="${metadataUrl(cfg)}"`);
    expect(metadataUrl(cfg)).toBe("https://mcp.example.test/.well-known/oauth-protected-resource/mcp");
    expect(protectedResourceMetadata(cfg)).toMatchObject({ resource: cfg.resourceUrl, bearer_methods_supported: ["header"] });
  });

  it("rejects invalid tokens with error=invalid_token", async () => {
    const res = await handleMcpHttp(t.p, cfg, rpc(init, { authorization: "Bearer rdl_pat_" + "a".repeat(43) }));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain('error="invalid_token"');
  });

  it("rejects disallowed browser origins", async () => {
    const res = await handleMcpHttp(t.p, cfg, rpc(init, { authorization: `Bearer ${t.demo.tokens.aroha_owner_full}`, origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("serves initialize, tools/list and tools/call to an authenticated client", async () => {
    const auth = { authorization: `Bearer ${t.demo.tokens.aroha_owner_full}`, origin: "https://app.example.test" };
    const r1 = await handleMcpHttp(t.p, cfg, rpc(init, auth));
    expect(r1.status).toBe(200);
    expect(((await r1.json()) as { result: { serverInfo: { name: string } } }).result.serverInfo.name).toBe("reeldeal");
    const r2 = await handleMcpHttp(t.p, cfg, rpc({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, auth));
    expect(((await r2.json()) as { result: { tools: unknown[] } }).result.tools.length).toBe(TOOLS.length);
    const r3 = await handleMcpHttp(t.p, cfg, rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "list_projects", arguments: {} } }, auth));
    const body = (await r3.json()) as { result: { structuredContent: { projects: { name: string }[] } } };
    expect(body.result.structuredContent.projects[0].name).toBe("Summer bookings reel");
  });

  it("can be configured to refuse personal access tokens", async () => {
    const res = await handleMcpHttp(t.p, { ...cfg, allowPats: false }, rpc(init, { authorization: `Bearer ${t.demo.tokens.aroha_owner_full}` }));
    expect(res.status).toBe(401);
  });
});

describe("OAuth 2.1 bearer tokens (local JWKS endpoint, RS256)", () => {
  let jwksServer: Server;
  let jwksUrl = "";
  let sign: (claims: Record<string, unknown>, opts?: { aud?: string; iss?: string; exp?: string }) => Promise<string>;
  const issuer = "https://auth.example.test/auth/v1";
  const resource = "https://mcp.example.test/mcp";

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
    jwksServer = createServer((_q, s) => {
      s.writeHead(200, { "content-type": "application/json" });
      s.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise<void>((r) => jwksServer.listen(0, "127.0.0.1", r));
    jwksUrl = `http://127.0.0.1:${(jwksServer.address() as { port: number }).port}/jwks`;
    sign = (claims, o = {}) =>
      new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(o.iss ?? issuer).setAudience(o.aud ?? resource).setIssuedAt().setExpirationTime(o.exp ?? "5m").sign(privateKey);
  });
  afterAll(() => jwksServer?.close());

  const cfg = () => ({ resourceUrl: resource, oauth: { issuer, jwksUrl }, allowPats: true }) as HttpConfig;
  const list = (token: string, extra: Record<string, string> = {}) =>
    handleMcpHttp(t.p, cfg(), new Request(resource, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}`, ...extra },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_my_workspace", arguments: {} } }),
    }));

  it("accepts a valid token for this resource and resolves the org from memberships", async () => {
    const res = await list(await sign({ sub: t.demo.ids.dev, scope: "mcp:read" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { structuredContent: { organisation: { name: string }; permissions: { scopes: string[] } } } };
    expect(body.result.structuredContent.organisation.name).toBe("Harbour Café");
    expect(body.result.structuredContent.permissions.scopes).toEqual(["mcp:read"]);
  });

  it("rejects tokens for another audience, another issuer, or expired tokens", async () => {
    expect((await list(await sign({ sub: t.demo.ids.dev }, { aud: "https://other.example/mcp" }))).status).toBe(401);
    expect((await list(await sign({ sub: t.demo.ids.dev }, { iss: "https://evil.example" }))).status).toBe(401);
    expect((await list(await sign({ sub: t.demo.ids.dev }, { exp: "-1m" }))).status).toBe(401);
  });

  it("requires a valid org choice for users in several workspaces, verified by membership", async () => {
    await t.p.db.system((sql) => sql.query("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'viewer')", [t.demo.ids.orgB, t.demo.ids.aroha]));
    const token = await sign({ sub: t.demo.ids.aroha, scope: "mcp:read" });
    expect((await list(token)).status).toBe(403); // ambiguous
    const ok = await list(token, { "x-reeldeal-organisation": t.demo.ids.orgB });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { result: { structuredContent: { organisation: { name: string }; permissions: { role: string } } } };
    expect(body.result.structuredContent.organisation.name).toBe("Harbour Café");
    expect(body.result.structuredContent.permissions.role).toBe("viewer");
    expect((await list(await sign({ sub: t.demo.ids.dev }), { "x-reeldeal-organisation": t.demo.ids.orgA })).status).toBe(403); // not a member
  });
});

describe("STDIO server process (spawned, real SDK client)", () => {
  it("starts, authenticates with the token, lists tools and answers calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rd-stdio-"));
    const pgdir = join(dir, "pglite");
    const db = await createPgliteDb(pgdir);
    await migrate(db, (sql) => db.exec(sql));
    const storageDir = join(dir, "storage");
    const demo = await seedDemoData(
      { ...t.p, db, storage: createLocalStorage({ dir: storageDir, baseUrl: "http://localhost:3333/media", secret: "x".repeat(32) }), log: silentLogger },
      { scale: 0.25, clips: 1 },
    );
    await db.close();
    const env: Record<string, string> = { ...(process.env as Record<string, string>), PGLITE_DIR: pgdir, LOCAL_STORAGE_DIR: storageDir, REELDEAL_MCP_TOKEN: demo.tokens.dev_harbour_full, OPENAI_API_KEY: "", DATABASE_URL: "" };
    delete (env as Record<string, string | undefined>).DATABASE_URL;
    delete (env as Record<string, string | undefined>).OPENAI_API_KEY;
    const client = new Client({ name: "stdio-test", version: "1" });
    await client.connect(new StdioClientTransport({ command: "scripts/mcp-stdio.sh", env, stderr: "ignore" }));
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(20);
    const ws = await client.callTool({ name: "get_my_workspace", arguments: {} });
    expect((ws.structuredContent as { organisation: { name: string } }).organisation.name).toBe("Harbour Café");
    await client.close();

    // A bad token stops the server at start-up.
    const bad = spawn("scripts/mcp-stdio.sh", [], { env: { ...env, REELDEAL_MCP_TOKEN: "rdl_pat_" + "b".repeat(43) } as unknown as NodeJS.ProcessEnv, stdio: "ignore" });
    const exitCode = await new Promise((r) => bad.on("exit", r));
    expect(exitCode).toBe(1);
  }, 120_000);
});
