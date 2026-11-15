/*
  Full workflow against real infrastructure, through the real MCP server (STDIO) with
  the official SDK client. Uses whatever the environment points at: DATABASE_URL
  (Supabase), R2_* (Cloudflare R2), OPENAI_API_KEY (with --ai). A worker must be
  running against the same database and storage (npm run worker, or the container).

    npm run integration:live -- [--footage path/to/real-clip.mp4] [--ai] [--signup]
  Supabase Auth is reached at NEXT_PUBLIC_SUPABASE_URL with the publishable key
  (override with --auth-url / --anon-key, e.g. http://localhost:9999 for infra/local).

  Needs two Supabase Auth test users (they are signed in with a password to obtain
  real session JWTs): INTEGRATION_USER_A_EMAIL / _PASSWORD and INTEGRATION_USER_B_EMAIL / _PASSWORD.
  --signup creates them through Supabase Auth if they do not exist (only for a
  development project). Workspaces "Integration A" and "Integration B" are created on
  first run and reused afterwards. Tokens issued here expire in one day and are revoked
  at the end. Nothing is deleted. --ai makes three paid OpenAI calls.
*/
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createAccessToken, revokeAccessToken } from "../src/server/auth/tokens";
import { pendingMigrations } from "../src/server/db/migrate";
import { publicEnv } from "../src/env/public";
import { createPlatform, platformEnv as env } from "../src/server/platform";
import { ensureGrant } from "../src/server/services/usage";

const { values: args } = parseArgs({
  options: { "auth-url": { type: "string" }, "anon-key": { type: "string" }, footage: { type: "string" }, ai: { type: "boolean" }, signup: { type: "boolean" }, plan: { type: "string" } },
});
const ok = (msg: string) => console.log(`✓ ${msg}`);
const fail = (msg: string): never => {
  throw new Error(msg);
};

async function authSession(email: string, password: string) {
  const base = args["auth-url"] ?? (publicEnv.NEXT_PUBLIC_SUPABASE_URL ? `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1` : fail("Set NEXT_PUBLIC_SUPABASE_URL or pass --auth-url"));
  const anonKey = args["anon-key"] ?? publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers: Record<string, string> = { "content-type": "application/json", ...(anonKey ? { apikey: anonKey } : {}) };
  const signIn = () => fetch(`${base}/token?grant_type=password`, { method: "POST", headers, body: JSON.stringify({ email, password }) });
  let res = await signIn();
  if (res.status === 400 && args.signup) {
    const up = await fetch(`${base}/signup`, { method: "POST", headers, body: JSON.stringify({ email, password }) });
    if (!up.ok) fail(`Sign-up failed for a test user (HTTP ${up.status})`);
    res = await signIn();
  }
  if (!res.ok) fail(`Sign-in failed for a test user (HTTP ${res.status}). Create the user in Supabase Auth or pass --signup.`);
  const body = (await res.json()) as { access_token: string; user: { id: string } };
  const claims = JSON.parse(Buffer.from(body.access_token.split(".")[1], "base64url").toString()) as Record<string, unknown>;
  return { userId: body.user.id, claims };
}

async function main() {
  const p = await createPlatform();
  const issued: string[] = [];
  try {
    /* ---- preflight -------------------------------------------------------- */
    if (p.db.driver !== "postgres") fail("DATABASE_URL must point at the Supabase database");
    const pending = await pendingMigrations(p.db);
    if (pending.length) fail(`Migrations pending: ${pending.join(", ")} (npm run db:migrate -- --apply)`);
    const noRls = await p.db.system((sql) => sql.query<{ relname: string }>("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity"));
    if (noRls.length) fail(`Tables without RLS: ${noRls.map((r) => r.relname).join(", ")}`);
    ok(`database: migrations up to date, RLS on every public table; storage: ${p.storage.driver}; AI: ${p.ai ? "configured" : "not configured"}`);
    if (args.ai && !p.ai) fail("--ai needs OPENAI_API_KEY");

    /* ---- real Supabase Auth users and membership resolution --------------- */
    const users = [];
    for (const who of ["A", "B"] as const) {
      const email = process.env[`INTEGRATION_USER_${who}_EMAIL`] ?? fail(`INTEGRATION_USER_${who}_EMAIL is not set`);
      const password = process.env[`INTEGRATION_USER_${who}_PASSWORD`] ?? fail(`INTEGRATION_USER_${who}_PASSWORD is not set`);
      const s = await authSession(email, password);
      const orgId = await p.db.system(async (sql) => {
        const name = `Integration ${who}`;
        const [existing] = await sql.query<{ id: string }>("select o.id from public.organisations o join public.memberships m on m.org_id = o.id where m.user_id = $1 and m.role = 'owner' and o.name = $2", [s.userId, name]);
        if (existing) return existing.id;
        const [org] = await sql.query<{ id: string }>("insert into public.organisations (name, slug, plan_id) values ($1, $2, $3) returning id", [name, `integration-${who.toLowerCase()}-${s.userId.slice(0, 8)}`, args.plan ?? "creator"]);
        await sql.query("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')", [org.id, s.userId]);
        await ensureGrant(sql, org.id);
        return org.id;
      });
      users.push({ who, ...s, orgId });
    }
    // RLS with the exact claims Supabase puts on a request (what the Data API does).
    for (const u of users) {
      const other = users.find((x) => x !== u)!;
      const [r] = await p.db.system(async (sql) => {
        await sql.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(u.claims)]);
        await sql.query("set local role authenticated");
        return sql.query<{ uid: string; own: number; other: number }>(
          "select auth.uid()::text as uid, (select count(*)::int from public.organisations where id = $1) as own, (select count(*)::int from public.organisations where id = $2) as other",
          [u.orgId, other.orgId],
        );
      });
      if (r.uid !== u.userId || r.own !== 1 || r.other !== 0) fail(`RLS check failed for user ${u.who}`);
    }
    ok("Supabase Auth: real session JWTs; auth.uid() resolves; each user sees only their own workspace under RLS");

    for (const u of users) {
      const t = await createAccessToken(p.db, { userId: u.userId, orgId: u.orgId, name: "integration test", scopes: ["mcp:read", "mcp:write", "mcp:render"], expiresInDays: 1 });
      issued.push(t.id);
      Object.assign(u, { token: t.token });
    }

    /* ---- MCP session as user A -------------------------------------------- */
    const connect = async (token: string) => {
      const client = new Client({ name: "reeldeal-integration", version: "1.0.0" });
      await client.connect(new StdioClientTransport({ command: "scripts/mcp-stdio.sh", env: { ...(process.env as Record<string, string>), REELDEAL_MCP_TOKEN: token }, stderr: "inherit" }));
      const call = async (name: string, a: Record<string, unknown> = {}) => {
        const r = await client.callTool({ name, arguments: a });
        if (r.isError) throw new Error(`${name}: ${(r.content as { text: string }[])[0]?.text}`);
        return r.structuredContent as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      };
      const raw = (name: string, a: Record<string, unknown>) => client.callTool({ name, arguments: a });
      return { client, call, raw };
    };
    const A = await connect((users[0] as unknown as { token: string }).token);
    const B = await connect((users[1] as unknown as { token: string }).token);
    const ws = await A.call("get_my_workspace");
    if (ws.organisation.id !== users[0].orgId) fail("MCP resolved the wrong workspace");
    ok(`MCP (STDIO): ${(await A.client.listTools()).tools.length} tools; get_my_workspace → ${ws.organisation.name}, role ${ws.permissions.role}`);

    const brand = await A.call("create_brand_profile", { name: `Integration brand ${new Date().toISOString().slice(0, 16)}`, industry: "Accommodation", voice: "Warm, calm, plain-spoken", colours: [{ name: "Lake", hex: "#1F4E79", role: "primary" }] });
    ok(`create_brand_profile: ${brand.id}`);

    let footage = args.footage;
    if (!footage) {
      footage = join(mkdtempSync(join(tmpdir(), "rd-int-")), "synthetic-footage.mp4");
      execFileSync(env.FFMPEG_PATH, ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=12", "-f", "lavfi", "-i", "sine=frequency=440:duration=12", "-vf", "noise=alls=40:allf=t+u", "-c:v", "libx264", "-preset", "ultrafast", "-b:v", "100M", "-maxrate", "100M", "-bufsize", "100M", "-c:a", "aac", "-shortest", "-y", footage]);
      console.log("  (no --footage given: using a generated 1080p test pattern, not real footage)");
    }
    const size = statSync(footage).size;
    const up = await A.call("create_media_upload", { title: "Integration footage", filename: footage.split("/").pop(), content_type: "video/mp4", size_bytes: size, tags: ["integration", "lake", "morning"], brand_id: brand.id });
    const bytes = readFileSync(footage);
    const parts = up.upload.method === "multipart" ? up.upload.parts : [{ url: up.upload.url, byte_start: 0, byte_end_inclusive: size - 1 }];
    for (const part of parts) {
      const res = await fetch(part.url, { method: "PUT", headers: up.upload.method === "PUT" ? up.upload.headers : {}, body: bytes.subarray(part.byte_start, part.byte_end_inclusive + 1) });
      if (!res.ok) fail(`Upload to signed URL failed (HTTP ${res.status})`);
    }
    const done = await A.call("complete_media_upload", { media_id: up.media_id });
    if (done.status !== "uploaded") fail(`Upload not complete: ${done.status}`);
    ok(`upload: ${(size / 1e6).toFixed(1)} MB via ${up.upload.method}${up.upload.method === "multipart" ? ` (${parts.length} parts)` : ""}; stored size verified`);

    await A.call("analyse_media", { media_id: up.media_id });
    let analysis: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (let i = 0; i < 300 && analysis.status !== "analysed"; i++) {
      analysis = await A.call("get_media_analysis", { media_id: up.media_id });
      if (analysis.job?.status === "failed") fail(`Analysis failed: ${analysis.job.error?.message}`);
      if (analysis.status !== "analysed") await new Promise((r) => setTimeout(r, 2000));
    }
    if (analysis.status !== "analysed") fail("Analysis did not finish in 10 minutes. Is a worker running?");
    const tech = analysis.analysis.technical;
    ok(`analyse_media: ${tech.duration_seconds}s ${tech.width}x${tech.height}, ${analysis.analysis.scenes.length} scene(s), quality ${analysis.analysis.quality.score}`);

    const found = (await A.call("search_media", { query: "integration lake morning" })).results as { id: string }[];
    if (!found.some((r) => r.id === up.media_id)) fail("search_media did not find the uploaded footage");
    ok("search_media finds the uploaded footage");

    const project = await A.call("create_project", { name: "Integration project", objective: "Summer weekend bookings", brand_id: brand.id, media_ids: [up.media_id], formats: ["9:16"], duration_seconds: 10 });
    ok(`create_project: ${project.id}`);

    let storyboardId: string;
    if (args.ai) {
      const brief = await A.call("create_video_brief", { request: "A 10 second vertical video for couples to book a summer weekend directly. Calm morning by the lake.", project_id: project.id });
      const concepts = await A.call("generate_video_concepts", { brief_id: brief.brief_id, count: 2 });
      const sb = await A.call("generate_storyboard", { project_id: project.id, brief_id: brief.brief_id, concepts_id: concepts.concepts_id, concept_index: 0 });
      if (!sb.renderable) fail(`AI storyboard not renderable: ${sb.warnings.join("; ")}`);
      storyboardId = sb.storyboard_id;
      ok(`OpenAI (live, ${brief.generated_by.model}): brief, ${concepts.concepts.length} concepts, storyboard v${sb.version} "${sb.title}" ${sb.total_duration_seconds}s`);
    } else {
      const sb = await A.call("submit_storyboard", { project_id: project.id, title: "Integration cut", format: "9:16", scenes: [{ duration_seconds: 4, asset_id: up.media_id, on_screen_text: "Slow mornings" }, { duration_seconds: 2, on_screen_text: "Book direct" }] });
      storyboardId = sb.storyboard_id;
      ok("submit_storyboard (no --ai: AI steps skipped, not simulated)");
    }

    const quote = await A.call("create_video", { project_id: project.id, storyboard_id: storyboardId });
    const go = await A.call("create_video", { project_id: project.id, storyboard_id: storyboardId, confirm: true, quote_token: quote.quote.quote_token });
    ok(`create_video: quoted ${quote.quote.credits} credit(s) of ${quote.quote.available_credits} available, confirmed → job ${go.job.job_id}`);
    let status: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (let i = 0; i < 300 && !["succeeded", "failed"].includes(status.status); i++) {
      status = await A.call("get_render_status", { job_id: go.job.job_id });
      if (!["succeeded", "failed"].includes(status.status)) await new Promise((r) => setTimeout(r, 2000));
    }
    if (status.status !== "succeeded") fail(`Render ${status.status ?? "timed out"}: ${status.error?.message ?? ""}`);
    const exp = await A.call("get_export", { export_id: status.exports[0].export_id });
    const file = await fetch(exp.download.url);
    const mp4 = Buffer.from(await file.arrayBuffer());
    if (file.status !== 200 || mp4.subarray(4, 8).toString() !== "ftyp") fail("Signed download is not an MP4");
    const forged = await fetch(exp.download.url.replace(/(X-Amz-Signature=|sig=)[^&]+/, "$1" + "0".repeat(64)));
    ok(`render: ${exp.duration_seconds}s ${exp.width}x${exp.height} MP4; signed download ${mp4.length} bytes (ftyp ok); forged link refused (HTTP ${forged.status})`);

    /* ---- isolation through MCP --------------------------------------------- */
    const leaks = [];
    for (const [tool, a] of [["get_media_details", { media_id: up.media_id }], ["get_project", { project_id: project.id }], ["get_export", { export_id: exp.export_id }], ["get_brand_profile", { brand_id: brand.id }], ["complete_media_upload", { media_id: up.media_id }]] as const) {
      const r = await B.raw(tool, a);
      if (!r.isError || !/not_found/.test((r.content as { text: string }[])[0]?.text ?? "")) leaks.push(tool);
    }
    if (leaks.length) fail(`Organisation isolation failed for: ${leaks.join(", ")}`);
    ok("isolation: user B gets not_found for every one of user A's ids");
    await A.client.close();
    await B.client.close();
    console.log("\nAll integration checks passed.");
  } finally {
    for (const id of issued) await revokeAccessToken(p.db, id).catch(() => {});
    await p.db.close();
  }
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
