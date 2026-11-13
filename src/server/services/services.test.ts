import { describe, expect, it, beforeAll } from "vitest";
import { createMockProvider } from "../ai/provider";
import { createAccessToken, revokeAccessToken, verifyAccessToken } from "../auth/tokens";
import type { Ctx } from "../context";
import { AppError } from "../errors";
import { createTestPlatform } from "../testing";
import { createWorker } from "../workers/runner";
import { probe } from "../workers/ffmpeg";
import { createBrand, getBrand, listBrands, updateBrand } from "./brands";
import { createVideoBrief, generateStoryboard, generateVideoConcepts } from "./creative";
import { getJob } from "./jobs";
import { getMediaAnalysis, getMediaDetails, requestAnalysis, searchMedia } from "./media";
import { createProject, getProject, listProjects, submitStoryboard } from "./projects";
import { createVideo, getExport, getRenderStatus, listExports, retryRender, verifyQuoteToken } from "./render";
import { getUsage } from "./usage";
import { getMyWorkspace } from "./workspace";

/*
  Service-level tests against real Postgres semantics (embedded PGlite with the real
  migrations and RLS), real FFmpeg processing of generated footage, and a MOCK AI
  provider (no live AI calls).
*/
let t: Awaited<ReturnType<typeof createTestPlatform>>;
let aroha: Ctx, ben: Ctx, cleo: Ctx, dev: Ctx;
const code = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as AppError).code;

const mockAi = createMockProvider((req) => {
  const footage = [...req.user.matchAll(/id ([0-9a-f-]{36})/g)].map((m) => m[1]);
  if (req.task === "video_brief")
    return { objective: "Drive summer bookings", audience: "Couples", platform: "Instagram Reels", format: "9:16", duration_seconds: 15, tone: "Calm", key_message: "Slow mornings by the lake", call_to_action: "Book direct", creative_direction: "Sunrise to hot pools", suggested_asset_ids: [footage[0], "00000000-0000-4000-8000-000000000000"].filter(Boolean), from_request: ["objective", "duration_seconds"], assumptions: [{ field: "audience", assumption: "Couples, from the brand profile" }], missing_information: ["Booking link"] };
  if (req.task === "video_concepts")
    return { concepts: [1, 2, 3].map((n) => ({ title: `Concept ${n}`, creative_angle: "a", hook: "h", narrative: "n", visual_direction: "v", suggested_asset_ids: footage.slice(0, 1), call_to_action: "Book", recommended_format: "9:16" })) };
  if (req.task === "storyboard")
    return { title: "Slow summer mornings", format: "9:16", scenes: [
      { scene_number: 1, duration_seconds: 5, purpose: "hook", on_screen_text: "Wake up to this.", voiceover: null, visual_description: "lake", asset_id: footage[0] ?? null, source_in_seconds: 0, transition: "cut", audio_notes: null },
      { scene_number: 2, duration_seconds: 20, purpose: "longer than the clip on purpose", on_screen_text: null, voiceover: null, visual_description: "x", asset_id: footage[1] ?? null, source_in_seconds: 0, transition: "fade", audio_notes: null },
      { scene_number: 3, duration_seconds: 4, purpose: "cta", on_screen_text: "Book direct", voiceover: null, visual_description: "card", asset_id: "11111111-1111-4111-8111-111111111111", source_in_seconds: null, transition: "cut", audio_notes: null },
    ] };
  throw new Error("unexpected task");
});

beforeAll(async () => {
  t = await createTestPlatform({ ai: mockAi });
  aroha = await t.ctxFor(t.demo.tokens.aroha_owner_full);
  ben = await t.ctxFor(t.demo.tokens.ben_editor_no_render);
  cleo = await t.ctxFor(t.demo.tokens.cleo_viewer_read);
  dev = await t.ctxFor(t.demo.tokens.dev_harbour_full);
  // Analyse all footage with the real worker so durations and dimensions are known.
  for (const ctx of [aroha, dev]) {
    const own = t.demo.media.filter((m) => (ctx === aroha ? m.org === "a" : m.org === "b"));
    for (const m of own) await requestAnalysis(ctx, m.id);
  }
  const worker = createWorker(t.p, { render: { resolutionScale: 0.2, preset: "ultrafast" } });
  while (await worker.runOnce()) {}
}, 240_000);

describe("authentication", () => {
  it("verifies personal access tokens and binds them to one org and role", () => {
    expect(aroha.principal).toMatchObject({ orgId: t.demo.ids.orgA, role: "owner", via: "pat" });
    expect(dev.principal.orgId).toBe(t.demo.ids.orgB);
  });
  it("rejects malformed, unknown, revoked and expired tokens with one generic error", async () => {
    expect(await code(verifyAccessToken(t.p.db, "nope"))).toBe("unauthenticated");
    expect(await code(verifyAccessToken(t.p.db, "rdl_pat_" + "x".repeat(43)))).toBe("unauthenticated");
    const tok = await createAccessToken(t.p.db, { userId: t.demo.ids.ben, orgId: t.demo.ids.orgA, name: "temp" });
    await revokeAccessToken(t.p.db, tok.id);
    expect(await code(verifyAccessToken(t.p.db, tok.token))).toBe("unauthenticated");
    const old = await createAccessToken(t.p.db, { userId: t.demo.ids.ben, orgId: t.demo.ids.orgA, name: "old", expiresInDays: 1 });
    await t.p.db.system((sql) => sql.query("update public.api_tokens set expires_at = now() - interval '1 minute' where id = $1", [old.id]));
    expect(await code(verifyAccessToken(t.p.db, old.token))).toBe("unauthenticated");
  });
  it("cannot create a token for an organisation the user is not a member of", async () => {
    await expect(createAccessToken(t.p.db, { userId: t.demo.ids.dev, orgId: t.demo.ids.orgA, name: "x" })).rejects.toBeTruthy();
  });
});

describe("organisation isolation", () => {
  it("workspace shows only the caller's organisation", async () => {
    const w = await getMyWorkspace(dev);
    expect(w.organisation.name).toBe("Harbour Café");
    expect(w.other_workspaces).toEqual([]);
    expect(JSON.stringify(w)).not.toContain("Lakeside");
  });
  it("Org B cannot read Org A's brand, media, project or analysis", async () => {
    const aMedia = t.demo.media.find((m) => m.org === "a")!.id;
    expect(await code(getBrand(dev, t.demo.ids.brandA))).toBe("not_found");
    expect(await code(getMediaDetails(dev, aMedia))).toBe("not_found");
    expect(await code(getMediaAnalysis(dev, aMedia))).toBe("not_found");
    expect(await code(getProject(dev, t.demo.ids.projectA))).toBe("not_found");
    expect((await listBrands(dev)).brands.map((b) => b.name)).toEqual(["Harbour Café"]);
  });
  it("search never crosses organisations", async () => {
    const b = await searchMedia(dev, { query: "geothermal" });
    expect(b.results.map((r) => r.title)).toEqual(["Geothermal day trip (Harbour Café private)"]);
    const a = await searchMedia(aroha, { query: "geothermal" });
    expect(a.results.map((r) => r.title)).not.toContain("Geothermal day trip (Harbour Café private)");
  });
  it("Org B cannot link Org A's brand or footage into its own project", async () => {
    expect(await code(createProject(dev, { name: "x", brand_id: t.demo.ids.brandA }))).toBe("not_found");
    expect(await code(createProject(dev, { name: "x", media_ids: [t.demo.media.find((m) => m.org === "a")!.id] }))).toBe("not_found");
  });
  it("RLS blocks Org B even when a query has no org filter at all", async () => {
    const rows = await t.p.db.asUser(t.demo.ids.dev, (sql) => sql.query<{ org_id: string }>("select org_id from public.media_assets"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.org_id === t.demo.ids.orgB)).toBe(true);
    const err = await t.p.db
      .asUser(t.demo.ids.dev, (sql) => sql.query("insert into public.brand_profiles (org_id, name) values ($1, 'hijack')", [t.demo.ids.orgA]))
      .catch((e) => e);
    expect(err.code).toBe("42501");
  });
  it("users cannot write to server-only tables (ledger, jobs, exports)", async () => {
    const err = await t.p.db
      .asUser(t.demo.ids.aroha, (sql) => sql.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period) values ($1, 'video', 'grant', 999, '2026-11')", [t.demo.ids.orgA]))
      .catch((e) => e);
    expect(err.code).toBe("42501");
  });
});

describe("permissions", () => {
  it("viewers can read but not create", async () => {
    expect((await listProjects(cleo)).projects.length).toBe(1);
    expect(await code(createBrand(cleo, { name: "Nope" }))).toBe("forbidden");
  });
  it("brand create and update work for editors and bump the version", async () => {
    const b = (await createBrand(ben, { name: "Lakeside Weddings", colours: [{ name: "Ivory", hex: "#F6EFE7" }] })) as { id: string; version: number };
    const u = (await updateBrand(ben, b.id, { voice: "Romantic, restrained" })) as { version: number; brand_voice: string };
    expect(u).toMatchObject({ version: 2, brand_voice: "Romantic, restrained" });
    expect(await code(createBrand(ben, { name: "x", colours: [{ name: "bad", hex: "red" }] }))).toBe("invalid_input");
  });
});

describe("media", () => {
  it("analysis produced real measurements from the footage", async () => {
    const multi = t.demo.media.find((m) => m.title.startsWith("Lodge highlights"))!;
    const a = await getMediaAnalysis(aroha, multi.id, { includeThumbnailUrls: true });
    expect(a.status).toBe("analysed");
    const tech = a.analysis!.technical as { duration_seconds: number; width: number };
    expect(tech.duration_seconds).toBeCloseTo(9, 0);
    expect(a.analysis!.scenes.length).toBe(3); // three shots → three detected scenes
    expect((a.analysis!.scenes[0] as { thumbnail_url?: string }).thumbnail_url).toMatch(/sig=/);
    expect((a.analysis!.quality as { score: number }).score).toBeGreaterThan(0);
    expect((a.analysis!.ai as { status: string }).status).toBe("not run"); // no consent
  });
  it("search ranks by relevance and filters by orientation and duration", async () => {
    const r = await searchMedia(aroha, { query: "steam geothermal landscape" });
    expect(r.results[0].title).toBe("Geothermal valley with rising steam");
    const vertical = await searchMedia(aroha, { orientation: "portrait" });
    expect(vertical.results.map((x) => x.title).sort()).toEqual(["Forest trail ride (vertical)", "Ridge walk at dawn (vertical)"]);
    const short = await searchMedia(aroha, { max_duration_seconds: 6.5, kind: "video" });
    expect(short.results.every((x) => (x.duration_seconds ?? 0) <= 6.5)).toBe(true);
  });
  it("details never expose storage keys; previews are signed and short-lived", async () => {
    const m = t.demo.media.find((x) => x.org === "a")!;
    const d = await getMediaDetails(aroha, m.id, { includePreviewUrl: true });
    expect(JSON.stringify(d)).not.toMatch(/storage_key/);
    expect(d.preview_url?.url).toMatch(/exp=\d+&sig=/);
    expect(new Date(d.preview_url!.expires_at).getTime() - Date.now()).toBeLessThanOrEqual(301_000);
  });
  it("a repeated analysis request while one is queued returns the same job", async () => {
    const m = t.demo.media.find((x) => x.org === "a")!;
    const first = await requestAnalysis(aroha, m.id);
    const second = await requestAnalysis(aroha, m.id);
    expect(second.job_id).toBe(first.job_id);
    expect(second.duplicate).toBe(true);
    await createWorker(t.p).runOnce();
  });
});

describe("creative AI (mock provider, no live calls)", () => {
  it("brief: keeps only real asset ids and records assumptions", async () => {
    const r = await createVideoBrief(aroha, { request: "15 second reel to drive summer bookings", project_id: t.demo.ids.projectA });
    expect(r.brief.suggested_asset_ids.length).toBe(1);
    expect(r.warnings[0]).toMatch(/Ignored 1/);
    expect(r.brief.assumptions[0].field).toBe("audience");
    const concepts = await generateVideoConcepts(aroha, { brief_id: r.brief_id });
    expect(concepts.concepts).toHaveLength(3);
  });
  it("storyboard: repairs invalid AI output against real footage and warns", async () => {
    const sb = await generateStoryboard(aroha, { project_id: t.demo.ids.projectA, duration_seconds: 15 });
    expect(sb.scenes[1].duration_seconds).toBeLessThan(20); // clipped to the source length
    expect(sb.scenes[2].asset_id).toBeNull(); // unknown id dropped, text card kept
    expect(sb.warnings.join(" ")).toMatch(/not found/);
    expect(sb.renderable).toBe(true);
  });
  it("reports AI as not configured instead of faking it", async () => {
    const noAi = { ...aroha, ai: null };
    const err = (await createVideoBrief(noAi, { request: "a reel" }).catch((e) => e)) as AppError;
    expect(err.code).toBe("capability_unavailable");
  });
});

describe("storyboards, rendering, credits and exports", () => {
  let storyboardId = "";
  it("submit_storyboard rejects footage from another organisation", async () => {
    const foreign = t.demo.media.find((m) => m.org === "b")!.id;
    expect(await code(submitStoryboard(aroha, { project_id: t.demo.ids.projectA, title: "x", format: "9:16", scenes: [{ duration_seconds: 2, asset_id: foreign }] }))).toBe("invalid_input");
  });
  it("submit_storyboard saves a valid storyboard and marks the project ready", async () => {
    const lake = t.demo.media.find((m) => m.title.startsWith("Kayaker"))!.id;
    const geo = t.demo.media.find((m) => m.title.startsWith("Geothermal valley"))!.id;
    const sb = await submitStoryboard(aroha, {
      project_id: t.demo.ids.projectA, title: "Mornings at the lodge", format: "9:16",
      scenes: [
        { duration_seconds: 3, asset_id: lake, source_in_seconds: 1, on_screen_text: "Wake up to this." },
        { duration_seconds: 3, asset_id: geo, transition: "fade" },
        { duration_seconds: 2, on_screen_text: "Book direct" },
      ],
    });
    storyboardId = sb.storyboard_id;
    expect(sb.total_duration_seconds).toBe(8);
    // Regression: JSON must be stored as JSON, not as a double-encoded string (caught on real Postgres).
    const [types] = await t.p.db.system((sql) =>
      sql.query<{ scenes: string; colours: string }>("select jsonb_typeof(s.scenes) as scenes, jsonb_typeof(b.colours) as colours from public.storyboards s, public.brand_profiles b where s.id = $1 and b.id = $2", [storyboardId, t.demo.ids.brandA]),
    );
    expect(types).toEqual({ scenes: "array", colours: "array" });
    expect((await getProject(aroha, t.demo.ids.projectA)).status).toBe("ready_to_render");
  });

  let jobId = "";
  it("create_video returns a server-computed quote and does nothing without confirmation", async () => {
    const q = await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId });
    expect(q.status).toBe("confirmation_required");
    if (q.status !== "confirmation_required") return;
    expect(q.quote.credits).toBe(1);
    expect((await listExports(aroha)).exports).toHaveLength(0);
    // Tampered quote is rejected.
    const tampered = q.quote.quote_token.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    expect(await code(createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId, confirm: true, quote_token: tampered }))).toBe("invalid_input");
    // Confirmation without a token only re-quotes.
    expect((await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId, confirm: true })).status).toBe("confirmation_required");
    // A token cannot be reused for different formats.
    expect(await code(createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId, formats: ["1:1", "9:16"], confirm: true, quote_token: q.quote.quote_token }))).toBe("invalid_input");
    // Editors without the render scope cannot confirm.
    expect(await code(createVideo(ben, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId, confirm: true, quote_token: q.quote.quote_token }))).toBe("forbidden");

    const before = (await getUsage(aroha)).video_credits.available;
    const go = await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId, confirm: true, quote_token: q.quote.quote_token });
    expect(go.status).toBe("queued");
    if (go.status !== "queued") return;
    jobId = go.job.job_id;
    const again = await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId, confirm: true, quote_token: q.quote.quote_token });
    expect(again.status === "queued" && again.job.job_id).toBe(jobId); // idempotent
    const usage = await getUsage(aroha);
    expect(usage.video_credits.available).toBe(before - 1); // held once
    expect(usage.video_credits.held_for_renders_in_progress).toBe(1);
  });

  it("the worker renders a real MP4, charges once and exposes a signed download", async () => {
    const done = await createWorker(t.p, { render: { resolutionScale: 0.2, preset: "ultrafast" } }).runOnce();
    expect(done?.status).toBe("succeeded");
    const status = await getRenderStatus(aroha, jobId);
    expect(status.exports).toHaveLength(1);
    const e = await getExport(aroha, status.exports[0].export_id);
    expect(e.download?.url).toMatch(/sig=/);
    expect(e.duration_seconds).toBeCloseTo(8, 0);
    // The file is a real video of the storyboard's length.
    const key = new URL(e.download!.url).pathname.replace("/media/", "");
    const local = (t.p.storage as unknown as { pathFor(k: string): string }).pathFor(decodeURIComponent(key));
    const meta = await probe(t.p.media, local);
    expect(meta.video_codec).toBe("h264");
    expect(meta.duration_seconds).toBeCloseTo(8, 0);
    const usage = await getUsage(aroha);
    expect(usage.video_credits).toMatchObject({ used: 1, held_for_renders_in_progress: 0 });
    expect((await getProject(aroha, t.demo.ids.projectA)).status).toBe("completed");
  });

  it("Org B cannot see Org A's jobs or exports", async () => {
    const status = await getRenderStatus(aroha, jobId);
    expect(await code(getRenderStatus(dev, jobId))).toBe("not_found");
    expect(await code(getExport(dev, status.exports[0].export_id))).toBe("not_found");
    expect((await listExports(dev)).exports).toHaveLength(0);
  });

  it("a failed render is free; retry charges once, and duplicate retries return the same job", async () => {
    const q = await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId });
    if (q.status !== "confirmation_required") throw new Error("expected quote");
    const start = (await getUsage(aroha)).video_credits.available;
    const go = await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId, confirm: true, quote_token: q.quote.quote_token });
    if (go.status !== "queued") throw new Error("expected queued");
    // Simulate a platform failure: the worker's FFmpeg is broken.
    const broken = createWorker({ ...t.p, media: { ffmpeg: "/nonexistent/ffmpeg", ffprobe: "ffprobe" } });
    expect((await broken.runOnce())?.status).toBe("failed");
    const failed = await getJob(aroha, go.job.job_id);
    expect(failed.error).toMatchObject({ retryable: true });
    expect((await getUsage(aroha)).video_credits.available).toBe(start); // hold released, nothing charged

    const retry = await retryRender(aroha, go.job.job_id);
    const dup = await retryRender(aroha, go.job.job_id);
    expect(dup.job.job_id).toBe(retry.job.job_id);
    expect(retry.job.attempt).toBe(2);
    expect((await getUsage(aroha)).video_credits.available).toBe(start - 1); // held once
    expect((await createWorker(t.p, { render: { resolutionScale: 0.2, preset: "ultrafast" } }).runOnce())?.status).toBe("succeeded");
    const end = await getUsage(aroha);
    expect(end.video_credits.available).toBe(start - 1); // charged exactly once
    expect(await code(retryRender(aroha, retry.job.job_id))).toBe("conflict"); // succeeded jobs cannot be retried
  });

  it("insufficient credits blocks a render before anything is queued", async () => {
    await t.p.db.system((sql) =>
      sql.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period, note) values ($1, 'video', 'adjustment', -1000, to_char(now(), 'YYYY-MM'), 'test drain')", [t.demo.ids.orgA]),
    );
    const q = await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId });
    if (q.status !== "confirmation_required") throw new Error("expected quote");
    expect(q.quote.enough_credits).toBe(false);
    expect(await code(createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: storyboardId, confirm: true, quote_token: q.quote.quote_token }))).toBe("insufficient_credits");
    expect(verifyQuoteToken(t.p.signingSecret, q.quote.quote_token).c).toBe(1);
  });
});
