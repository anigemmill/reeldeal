import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockProvider, type GenerateRequest } from "../ai/provider";
import { SCOPES } from "../auth/principal";
import type { Ctx } from "../context";
import { AppError } from "../errors";
import { createTestPlatform } from "../testing";
import { createWorker } from "../workers/runner";
import { createWorkspace, getProfile, listMemberships, principalForSession } from "./account";
import { createBrand, getBrand, listBrandVersions, updateBrand } from "./brands";
import { createVideoBrief, generateStoryboard } from "./creative";
import { cancelMediaUpload, completeMediaUpload, createMediaUpload, listMediaActivity, requestAnalysis, searchMedia } from "./media";
import { createProject, getProject, getStoryboard, submitStoryboard } from "./projects";
import { getUsage } from "./usage";
import { setAiMediaConsent } from "./workspace";

/*
  Services added for the customer web app (account/workspace, brand versions and
  limits, upload cancel, storyboard revision, consent). Real Postgres semantics and
  RLS (PGlite), real FFmpeg; the AI provider is a MOCK that records prompts.
*/
const prompts: GenerateRequest<unknown>[] = [];
const ai = createMockProvider((req) => {
  prompts.push(req);
  const ids = [...req.user.matchAll(/id ([0-9a-f-]{36})/g)].map((m) => m[1]);
  if (req.task === "video_brief") return { objective: "o", audience: "a", platform: "p", format: "9:16", duration_seconds: 10, tone: "t", key_message: "k", call_to_action: "c", creative_direction: "d", suggested_asset_ids: ids.slice(0, 1), from_request: [], assumptions: [], missing_information: [] };
  if (req.task === "storyboard")
    return { title: req.system.includes("REVISING") ? "Revised" : "First", format: "9:16", scenes: [{ scene_number: 1, duration_seconds: 2, purpose: "x", on_screen_text: "Hello", voiceover: null, visual_description: "v", asset_id: ids[0] ?? null, source_in_seconds: 0, transition: "cut", audio_notes: null }] };
  throw new Error("unexpected");
});

let t: Awaited<ReturnType<typeof createTestPlatform>>;
let aroha: Ctx, ben: Ctx, dev: Ctx;
const code = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as AppError | null)?.code;
const newUser = async () => {
  const id = randomUUID();
  await t.p.db.system((sql) => sql.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id.slice(0, 8)}@new.example`]));
  return id;
};

beforeAll(async () => {
  t = await createTestPlatform({ ai, clips: 2 });
  aroha = await t.ctxFor(t.demo.tokens.aroha_owner_full);
  ben = await t.ctxFor(t.demo.tokens.ben_editor_no_render);
  dev = await t.ctxFor(t.demo.tokens.dev_harbour_full);
  for (const m of t.demo.media.filter((x) => x.org === "a")) await requestAnalysis(aroha, m.id);
  const w = createWorker(t.p);
  while (await w.runOnce()) {}
}, 180_000);
afterAll(async () => t?.p.db.close());

describe("accounts and workspaces", () => {
  it("creates a workspace with an owner membership, a Free plan credit grant and a first brand", async () => {
    const user = await newUser();
    expect(await principalForSession(t.p, user)).toBeNull(); // no workspace yet → onboarding
    const w = await createWorkspace(t.p, user, { business_name: "Kauri Cabins", industry: "Accommodation", website: "kauricabins.example", display_name: "Mere" });
    const s = (await principalForSession(t.p, user))!;
    expect(s.principal).toMatchObject({ orgId: w.org_id, role: "owner", via: "session" });
    const ctx: Ctx = { ...t.p, principal: s.principal };
    const usage = await getUsage(ctx);
    expect(usage.plan.id).toBe("free");
    expect(usage.video_credits.available).toBe(2);
    expect(await getBrand(ctx, w.brand_id)).toMatchObject({ name: "Kauri Cabins", industry: "Accommodation", website: "https://kauricabins.example" });
    expect((await getProfile(t.p, user)).display_name).toBe("Mere");
    // A double submit of the same form does not create a second workspace.
    const again = await createWorkspace(t.p, user, { business_name: "Kauri Cabins", industry: "Accommodation" });
    expect(again.org_id).toBe(w.org_id);
    expect(await listMemberships(t.p, user)).toHaveLength(1);
  });

  it("validates onboarding input with field-level errors", async () => {
    const user = await newUser();
    const e = await createWorkspace(t.p, user, { business_name: "", industry: "Nope" as never, website: "not a url" }).catch((x) => x as AppError);
    expect(e).toBeInstanceOf(AppError);
    const fields = ((e as AppError).details?.issues as { field: string }[]).map((i) => i.field).sort();
    expect(fields).toEqual(["business_name", "industry", "website"]);
  });

  it("only honours a chosen workspace the user is a member of", async () => {
    const s = (await principalForSession(t.p, t.demo.ids.aroha, t.demo.ids.orgB))!;
    expect(s.principal.orgId).toBe(t.demo.ids.orgA); // orgB cookie ignored: not a member
    expect(s.principal.scopes).toEqual([...SCOPES]);
  });
});

describe("isolation of the new reads", () => {
  it("another organisation cannot read storyboards, activity or projects", async () => {
    const sb = await submitStoryboard(aroha, { project_id: t.demo.ids.projectA, title: "Iso", format: "9:16", scenes: [{ duration_seconds: 2, on_screen_text: "Hi" }] });
    expect(await code(getStoryboard(dev, t.demo.ids.projectA, sb.storyboard_id))).toBe("not_found");
    expect(await code(getProject(dev, t.demo.ids.projectA))).toBe("not_found");
    const activity = await listMediaActivity(dev, { limit: 30 });
    expect(activity.items.every((i) => !t.demo.media.some((m) => m.org === "a" && m.id === i.id))).toBe(true);
  });
});

describe("brands", () => {
  it("keeps every version and enforces the plan's brand allowance", async () => {
    const [b] = (await t.p.db.system((sql) => sql.query<{ id: string }>("select id from public.brand_profiles where org_id = $1 limit 1", [t.demo.ids.orgB])));
    await updateBrand(dev, b.id, { voice: "Friendly" });
    const v = await listBrandVersions(dev, b.id);
    expect(v.versions.map((x) => x.version).slice(0, 2)).toEqual([2, 1]);
    // Harbour Café is on Starter: 1 brand profile.
    expect(await code(createBrand(dev, { name: "Second brand" }))).toBe("conflict");
  });

  it("only accepts an image from the same workspace as the logo", async () => {
    const [b] = await t.p.db.system((sql) => sql.query<{ id: string }>("select id from public.brand_profiles where org_id = $1 limit 1", [t.demo.ids.orgA]));
    const video = t.demo.media.find((m) => m.org === "a")!.id;
    const foreign = randomUUID();
    await t.p.db.system((sql) => sql.query("insert into public.media_assets (id, org_id, title, kind, mime_type, storage_key, status) values ($1, $2, 'their logo', 'image', 'image/png', $3, 'uploaded')", [foreign, t.demo.ids.orgB, `org/${t.demo.ids.orgB}/media/${foreign}/original.png`]));
    expect(await code(updateBrand(aroha, b.id, { logo_media_id: video }))).toBe("invalid_input");
    expect(await code(updateBrand(aroha, b.id, { logo_media_id: foreign }))).toBe("not_found");
  });
});

describe("uploads", () => {
  it("cancels an unfinished upload and never touches a finished one", async () => {
    const up = await createMediaUpload(aroha, { title: "Cancel me", filename: "c.mp4", content_type: "video/mp4", size_bytes: 1000 });
    expect(await code(cancelMediaUpload(dev, up.media_id))).toBe("not_found");
    expect((await cancelMediaUpload(aroha, up.media_id)).status).toBe("failed");
    expect(await code(cancelMediaUpload(aroha, up.media_id))).toBe("conflict");
    expect(await code(completeMediaUpload(aroha, up.media_id))).toBe("conflict");
  });
});

describe("creative", () => {
  it("never offers a clip whose analysis failed (or that isn't analysed) to the AI", async () => {
    const badId = randomUUID();
    const [bad] = await t.p.db.system((sql) =>
      sql.query<{ id: string }>(
        "insert into public.media_assets (id, org_id, title, kind, mime_type, storage_key, status) values ($1, $2, 'broken clip', 'video', 'video/mp4', $3, 'failed') returning id",
        [badId, t.demo.ids.orgA, `org/${t.demo.ids.orgA}/media/${badId}/original.mp4`],
      ),
    );
    prompts.length = 0;
    await createVideoBrief(aroha, { request: "broken clip please", project_id: t.demo.ids.projectA });
    expect(prompts[0]!.user).not.toContain(bad.id);
    const ready = (await searchMedia(aroha, { kind: "video", status: "ready" })).results.map((r) => r.id);
    expect(ready.length).toBeGreaterThan(0);
    expect(ready.some((id) => prompts[0]!.user.includes(id))).toBe(true);
  });

  it("revises a storyboard as a new version and records the brand version used", async () => {
    const p = await createProject(aroha, { name: "Revise me", brand_id: (await t.p.db.system((sql) => sql.query<{ id: string }>("select id from public.brand_profiles where org_id = $1 limit 1", [t.demo.ids.orgA])))[0].id });
    const first = await generateStoryboard(aroha, { project_id: p.id });
    expect(await code(generateStoryboard(aroha, { project_id: p.id, base_storyboard_id: first.storyboard_id }))).toBe("invalid_input"); // needs direction
    const revised = await generateStoryboard(aroha, { project_id: p.id, base_storyboard_id: first.storyboard_id, direction: "Shorter" });
    expect(revised).toMatchObject({ version: first.version + 1, title: "Revised" });
    expect(prompts.at(-1)!.user).toContain("Current storyboard (JSON)");
    const [row] = await t.p.db.system((sql) => sql.query<{ brand_version: number | null }>("select brand_version from public.storyboards where id = $1", [revised.storyboard_id]));
    expect(row.brand_version).toBeGreaterThanOrEqual(1);
    // The earlier version is still there, unchanged.
    expect((await getStoryboard(aroha, p.id, first.storyboard_id)).title).toBe("First");
  });
});

describe("AI media consent", () => {
  it("only admins and owners can change it", async () => {
    expect(await code(setAiMediaConsent(ben, true))).toBe("forbidden");
    expect((await setAiMediaConsent(aroha, true)).ai_media_analysis_consent).toBe(true);
    expect((await setAiMediaConsent(aroha, false)).ai_media_analysis_consent).toBe(false);
  });
});
