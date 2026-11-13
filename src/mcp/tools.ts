import { z } from "zod";
import type { Scope } from "@/server/auth/principal";
import type { Ctx, Platform } from "@/server/context";
import { createBrand, getBrand, listBrands, updateBrand, BrandInput } from "@/server/services/brands";
import { createVideoBrief, generateStoryboard, generateVideoConcepts } from "@/server/services/creative";
import { completeMediaUpload, createMediaUpload, getMediaAnalysis, getMediaDetails, requestAnalysis, searchMedia, UPLOAD_TYPES } from "@/server/services/media";
import { getPlatformStatus } from "@/server/services/platform";
import { createProject, FORMATS, getProject, listProjects, SceneInput, submitStoryboard } from "@/server/services/projects";
import { createVideo, getExport, getRenderStatus, listExports, retryRender } from "@/server/services/render";
import { getUsage } from "@/server/services/usage";
import { getMyWorkspace } from "@/server/services/workspace";

/*
  MCP tool registry. Every tool is a thin adapter over the platform service layer
  (src/server/services): validation, authorisation, organisation scoping and billing
  rules live there and are shared with the web app and workers.
  Tool descriptions are written for AI clients: what the tool does, when to use it,
  and what to do next.
*/

const id = (what: string) => z.uuid().describe(`${what} id`);
const loose = <T extends z.ZodRawShape>(shape: T) => z.looseObject(shape);

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  scope: Scope;
  input: z.ZodObject;
  output: z.ZodObject;
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  /** Only offered when this returns true (e.g. AI tools need a configured provider). */
  available?: (p: Platform) => boolean;
  /** Heavier tools (AI, rendering) get a tighter rate limit. */
  cost?: "normal" | "expensive";
  run: (ctx: Ctx, args: never, env: { workersRunning: boolean | null }) => Promise<Record<string, unknown>>;
};

const tool = <I extends z.ZodObject>(def: Omit<ToolDef, "input" | "run"> & { input: I; run: (ctx: Ctx, args: z.infer<I>, env: { workersRunning: boolean | null }) => Promise<unknown> }): ToolDef =>
  def as unknown as ToolDef;

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };

const jobOutput = loose({ job_id: z.string(), kind: z.string(), status: z.string(), stage: z.string().nullable().optional(), progress_percent: z.number().optional() });

export const TOOLS: ToolDef[] = [
  /* ---------------- A. Platform and account ---------------- */
  tool({
    name: "get_platform_status",
    title: "Platform status",
    description: "Check that the video platform is up and which capabilities are available (database, media storage, AI, analysis, rendering). Call this first if other tools report something unavailable. Never returns credentials or infrastructure details.",
    scope: "mcp:read",
    input: z.object({}),
    output: loose({ status: z.string(), server: loose({ name: z.string(), version: z.string() }), capabilities: z.record(z.string(), z.unknown()) }),
    annotations: READ,
    run: (ctx, _a, env) => getPlatformStatus(ctx, { workersRunning: env.workersRunning }),
  }),
  tool({
    name: "get_my_workspace",
    title: "My workspace",
    description: "The signed-in user's workspace: organisation, their role and what they are allowed to do, plan, video credits, and how many brands, media items and projects exist. Use it to orient yourself before working with brands, media or projects.",
    scope: "mcp:read",
    input: z.object({}),
    output: loose({ organisation: loose({ id: z.string(), name: z.string() }), permissions: z.record(z.string(), z.unknown()), plan: z.record(z.string(), z.unknown()), credits: z.record(z.string(), z.unknown()) }),
    annotations: READ,
    run: (ctx) => getMyWorkspace(ctx),
  }),
  tool({
    name: "get_usage",
    title: "Credits and usage",
    description: "Video credits (allowance, used, held for renders in progress, available), media analysis minutes, storage used, and recent credit transactions for this month. Credits are computed by the platform from the plan and ledger.",
    scope: "mcp:read",
    input: z.object({}),
    output: loose({ period: z.string(), video_credits: z.record(z.string(), z.unknown()), analysis_minutes: z.record(z.string(), z.unknown()), storage_gb: z.record(z.string(), z.unknown()) }),
    annotations: READ,
    run: (ctx) => getUsage(ctx),
  }),

  /* ---------------- B. Brand intelligence ---------------- */
  tool({
    name: "list_brands",
    title: "List brand profiles",
    description: "List the workspace's brand profiles (id, name, industry, description).",
    scope: "mcp:read",
    input: z.object({}),
    output: loose({ brands: z.array(loose({ id: z.string(), name: z.string() })) }),
    annotations: READ,
    run: (ctx) => listBrands(ctx),
  }),
  tool({
    name: "get_brand_profile",
    title: "Get brand profile",
    description: "Full brand profile and guidelines: description, voice, target audiences, colours, typography, logo, guidelines, restrictions and approved assets. Only fields that have been filled in are returned; never assume missing fields.",
    scope: "mcp:read",
    input: z.object({ brand_id: id("Brand profile") }),
    output: loose({ id: z.string(), name: z.string(), version: z.number() }),
    annotations: READ,
    run: (ctx, a) => getBrand(ctx, a.brand_id),
  }),
  tool({
    name: "create_brand_profile",
    title: "Create brand profile",
    description: "Create a brand profile from information the user has given you. Do not invent brand details: only include fields the user provided. Colours as #RRGGBB. Requires editor role.",
    scope: "mcp:write",
    input: BrandInput,
    output: loose({ id: z.string(), name: z.string(), version: z.number() }),
    annotations: WRITE,
    run: (ctx, a) => createBrand(ctx, a),
  }),
  tool({
    name: "update_brand_profile",
    title: "Update brand profile",
    description: "Update fields of an existing brand profile (only the fields you pass change). Each update increments the profile version. Requires editor role.",
    scope: "mcp:write",
    input: BrandInput.partial().extend({ brand_id: id("Brand profile") }),
    output: loose({ id: z.string(), name: z.string(), version: z.number() }),
    annotations: { ...WRITE, idempotentHint: true },
    run: (ctx, { brand_id, ...rest }) => updateBrand(ctx, brand_id, rest),
  }),

  /* ---------------- C. Media library ---------------- */
  tool({
    name: "search_media",
    title: "Search footage",
    description:
      "Search the workspace's media library. `query` matches titles, tags, AI tags and descriptions (e.g. 'geothermal steam landscape'). Filter by kind, orientation, aspect_ratio, duration, tags, brand, project or status. Sort by relevance (default with a query), best_quality (technical quality score from analysis), newest or longest. Returns ids to use with get_media_details, storyboards and projects.",
    scope: "mcp:read",
    input: z.object({
      query: z.string().max(300).optional().describe("Words describing what is in the shot"),
      kind: z.enum(["video", "image", "audio"]).optional(),
      orientation: z.enum(["landscape", "portrait", "square"]).optional(),
      aspect_ratio: z.enum(FORMATS).optional(),
      min_duration_seconds: z.number().min(0).optional(),
      max_duration_seconds: z.number().min(0).optional(),
      tags: z.array(z.string()).max(10).optional(),
      brand_id: id("Brand").optional(),
      project_id: id("Project").optional(),
      status: z.enum(["awaiting_upload", "uploaded", "analysing", "ready", "failed"]).optional(),
      sort: z.enum(["relevance", "best_quality", "newest", "longest"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      offset: z.number().int().min(0).optional(),
    }),
    output: loose({ results: z.array(loose({ id: z.string(), title: z.string() })), has_more: z.boolean() }),
    annotations: READ,
    run: (ctx, a) => searchMedia(ctx, a),
  }),
  tool({
    name: "get_media_details",
    title: "Media details",
    description: "Details of one media asset: description, tags, duration, dimensions, orientation, file type and size, status, usage rights, projects using it and an analysis summary. Set include_preview_url to get a short-lived signed link to view the file (never a permanent URL).",
    scope: "mcp:read",
    input: z.object({ media_id: id("Media asset"), include_preview_url: z.boolean().optional() }),
    output: loose({ id: z.string(), title: z.string(), status: z.string() }),
    annotations: READ,
    run: (ctx, a) => getMediaDetails(ctx, a.media_id, { includePreviewUrl: a.include_preview_url }),
  }),
  tool({
    name: "create_media_upload",
    title: "Start a media upload",
    description: `Register a new media file and get a short-lived signed upload URL. Then PUT the file bytes to that URL with the given content-type header (for example with curl -X PUT -H 'content-type: …' --data-binary @file 'URL'), and call complete_media_upload. Allowed types: ${Object.keys(UPLOAD_TYPES).join(", ")}. Requires editor role.`,
    scope: "mcp:write",
    input: z.object({
      title: z.string().min(1).max(200),
      filename: z.string().min(1).max(255),
      content_type: z.string(),
      size_bytes: z.number().int().positive(),
      description: z.string().max(2000).optional(),
      tags: z.array(z.string()).max(20).optional(),
      brand_id: id("Brand").optional(),
      usage_rights: z.string().max(500).optional(),
    }),
    output: loose({ media_id: z.string(), status: z.string(), upload: loose({ url: z.string(), expires_at: z.string() }) }),
    annotations: WRITE,
    run: (ctx, a) => createMediaUpload(ctx, a),
  }),
  tool({
    name: "complete_media_upload",
    title: "Finish a media upload",
    description: "Confirm that the file was uploaded to the signed URL. The platform checks the stored file and marks the asset uploaded. Then call analyse_media.",
    scope: "mcp:write",
    input: z.object({ media_id: id("Media asset") }),
    output: loose({ media_id: z.string(), status: z.string() }),
    annotations: { ...WRITE, idempotentHint: true },
    run: (ctx, a) => completeMediaUpload(ctx, a.media_id),
  }),
  tool({
    name: "analyse_media",
    title: "Analyse footage",
    description:
      "Queue a background analysis of a video: duration, dimensions, scene changes with keyframes, and technical quality. AI descriptions and tags are added only if the workspace has consented to AI media analysis. Uses the plan's analysis minutes. Returns a job; poll get_media_analysis or get_render_status with the job id. Asking again while one is running returns the same job.",
    scope: "mcp:write",
    input: z.object({ media_id: id("Media asset") }),
    output: jobOutput,
    annotations: { ...WRITE, idempotentHint: true },
    run: (ctx, a) => requestAnalysis(ctx, a.media_id),
  }),
  tool({
    name: "get_media_analysis",
    title: "Get media analysis",
    description: "Stored analysis results for a media asset: technical metadata, scenes with timestamps, quality indicators, and AI descriptions when available. If analysis has not finished, returns the job status instead. Never returns results that were not actually produced.",
    scope: "mcp:read",
    input: z.object({ media_id: id("Media asset"), include_thumbnail_urls: z.boolean().optional() }),
    output: loose({ media_id: z.string(), status: z.string() }),
    annotations: READ,
    run: (ctx, a) => getMediaAnalysis(ctx, a.media_id, { includeThumbnailUrls: a.include_thumbnail_urls }),
  }),

  /* ---------------- D. Projects and creative direction ---------------- */
  tool({
    name: "list_projects",
    title: "List projects",
    description: "List the workspace's video projects with status, brand, formats and counts.",
    scope: "mcp:read",
    input: z.object({ status: z.enum(["draft", "storyboarding", "ready_to_render", "rendering", "completed", "archived"]).optional(), limit: z.number().int().min(1).max(50).optional(), offset: z.number().int().min(0).optional() }),
    output: loose({ projects: z.array(loose({ id: z.string(), name: z.string(), status: z.string() })), has_more: z.boolean() }),
    annotations: READ,
    run: (ctx, a) => listProjects(ctx, a),
  }),
  tool({
    name: "get_project",
    title: "Get project",
    description: "A project's brief, brand, media, formats, target duration, latest briefs and concepts, the latest storyboard with all scenes, storyboard versions, renders and exports.",
    scope: "mcp:read",
    input: z.object({ project_id: id("Project") }),
    output: loose({ id: z.string(), name: z.string(), status: z.string() }),
    annotations: READ,
    run: (ctx, a) => getProject(ctx, a.project_id),
  }),
  tool({
    name: "create_project",
    title: "Create project",
    description: "Create a new video project. brand_id and media_ids must belong to this workspace (find them with list_brands and search_media). formats: 9:16, 1:1, 16:9, 4:5. Requires editor role.",
    scope: "mcp:write",
    input: z.object({
      name: z.string().min(1).max(160),
      brand_id: id("Brand").optional(),
      objective: z.string().max(500).optional(),
      audience: z.string().max(500).optional(),
      description: z.string().max(4000).optional(),
      platform: z.string().max(80).optional(),
      formats: z.array(z.enum(FORMATS)).min(1).max(4).optional(),
      duration_seconds: z.number().int().min(5).max(300).optional(),
      media_ids: z.array(z.uuid()).max(100).optional(),
    }),
    output: loose({ id: z.string(), name: z.string(), status: z.string() }),
    annotations: WRITE,
    run: (ctx, a) => createProject(ctx, a),
  }),
  tool({
    name: "create_video_brief",
    title: "Create a video brief (AI)",
    description:
      "Turn a natural-language request into a structured video brief (objective, audience, platform, format, duration, tone, key message, call to action, creative direction, suggested footage). The brief separates what the user said (from_request) from assumptions, and lists missing information to ask about. Uses the brand profile and footage metadata. Saved to the project if project_id is given.",
    scope: "mcp:write",
    input: z.object({ request: z.string().min(3).max(4000), project_id: id("Project").optional(), brand_id: id("Brand").optional() }),
    output: loose({ brief_id: z.string(), brief: z.record(z.string(), z.unknown()) }),
    annotations: WRITE,
    available: (p) => Boolean(p.ai),
    cost: "expensive",
    run: (ctx, a) => createVideoBrief(ctx, a),
  }),
  tool({
    name: "generate_video_concepts",
    title: "Generate video concepts (AI)",
    description: "Generate 1–5 distinct creative concepts (title, angle, hook, narrative, visual direction, suggested footage, call to action, recommended format) from a brief_id or a request, using the brand profile and real footage.",
    scope: "mcp:write",
    input: z.object({ brief_id: id("Brief").optional(), request: z.string().min(3).max(4000).optional(), project_id: id("Project").optional(), brand_id: id("Brand").optional(), count: z.number().int().min(1).max(5).optional() }),
    output: loose({ concepts_id: z.string(), concepts: z.array(z.record(z.string(), z.unknown())) }),
    annotations: WRITE,
    available: (p) => Boolean(p.ai),
    cost: "expensive",
    run: (ctx, a) => generateVideoConcepts(ctx, a),
  }),
  tool({
    name: "generate_storyboard",
    title: "Generate a storyboard (AI)",
    description:
      "Generate a shot-by-shot storyboard for a project from its brief and (optionally) a chosen concept, using the workspace's real footage with source timestamps. The result is validated against the actual clips (ids, lengths) and saved as a new storyboard version; problems are repaired and listed as warnings. Free: credits are only spent when rendering.",
    scope: "mcp:write",
    input: z.object({
      project_id: id("Project"),
      brief_id: id("Brief").optional(),
      concepts_id: id("Concepts").optional(),
      concept_index: z.number().int().min(0).max(4).optional(),
      direction: z.string().max(2000).optional().describe("Extra direction from the user"),
      format: z.enum(FORMATS).optional(),
      duration_seconds: z.number().int().min(5).max(300).optional(),
    }),
    output: loose({ storyboard_id: z.string(), version: z.number(), scenes: z.array(z.record(z.string(), z.unknown())), warnings: z.array(z.string()) }),
    annotations: WRITE,
    available: (p) => Boolean(p.ai),
    cost: "expensive",
    run: (ctx, a) => generateStoryboard(ctx, a),
  }),
  tool({
    name: "submit_storyboard",
    title: "Save a storyboard",
    description:
      "Save a storyboard you have written (for example with the user) as a new version of a project's storyboard. Each scene: duration_seconds, optional asset_id (footage from search_media) with source_in_seconds, on_screen_text (max 80 characters), voiceover, visual_description, transition (cut, dissolve, fade). Validated strictly against the real footage: unknown ids or timestamps past the end of a clip are rejected. A scene without footage becomes a brand-colour title card and needs on_screen_text.",
    scope: "mcp:write",
    input: z.object({ project_id: id("Project"), title: z.string().min(1).max(160), format: z.enum(FORMATS), scenes: z.array(SceneInput).min(1).max(30) }),
    output: loose({ storyboard_id: z.string(), version: z.number(), renderable: z.boolean() }),
    annotations: WRITE,
    run: (ctx, a) => submitStoryboard(ctx, a),
  }),

  /* ---------------- E. Video creation and rendering ---------------- */
  tool({
    name: "create_video",
    title: "Create (render) a video",
    description:
      "Render a project's storyboard into finished MP4 videos. This spends video credits, so it works in two steps: (1) call without confirm to get a quote (credits, available balance, quote_token); (2) show the cost to the user and, only after they agree, call again with confirm: true and the quote_token. Credits are held when the render starts and charged only if it succeeds. Confirming the same quote twice does not start a second render. Returns a job id: poll get_render_status. Requires editor role and the mcp:render scope.",
    scope: "mcp:write",
    input: z.object({
      project_id: id("Project"),
      storyboard_id: id("Storyboard").optional().describe("Defaults to the latest storyboard"),
      formats: z.array(z.enum(FORMATS)).min(1).max(4).optional().describe("Defaults to the project's formats; each extra format costs 1 credit"),
      confirm: z.boolean().optional().describe("Set true only after the user has agreed to the quoted cost"),
      quote_token: z.string().max(2000).optional(),
    }),
    output: loose({ status: z.enum(["confirmation_required", "queued"]), message: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    cost: "expensive",
    run: (ctx, a) => createVideo(ctx, a),
  }),
  tool({
    name: "get_render_status",
    title: "Job status",
    description: "Status of a render or analysis job: queued (with queue position), running (stage and progress), succeeded (with export ids) or failed (with whether it can be retried free of charge).",
    scope: "mcp:read",
    input: z.object({ job_id: id("Job") }),
    output: jobOutput,
    annotations: READ,
    run: (ctx, a) => getRenderStatus(ctx, a.job_id),
  }),
  tool({
    name: "list_exports",
    title: "List exports",
    description: "Finished video exports for the workspace (optionally for one project), plus recent failed renders.",
    scope: "mcp:read",
    input: z.object({ project_id: id("Project").optional(), status: z.enum(["ready", "failed"]).optional(), limit: z.number().int().min(1).max(50).optional() }),
    output: loose({ exports: z.array(loose({ export_id: z.string(), format: z.string(), status: z.string() })) }),
    annotations: READ,
    run: (ctx, a) => listExports(ctx, a),
  }),
  tool({
    name: "get_export",
    title: "Get export",
    description: "Details of an exported video, with a short-lived signed download link when it is ready (the link expires; call again for a fresh one).",
    scope: "mcp:read",
    input: z.object({ export_id: id("Export"), include_download_url: z.boolean().optional() }),
    output: loose({ export_id: z.string(), status: z.string(), format: z.string() }),
    annotations: READ,
    run: (ctx, a) => getExport(ctx, a.export_id, { includeDownloadUrl: a.include_download_url }),
  }),
  tool({
    name: "retry_render",
    title: "Retry a failed render",
    description: "Retry a render that failed on the platform's side. The failed attempt was not charged; the retry holds the same credits and charges them only if it succeeds. Calling it twice returns the same retry job. Requires the mcp:render scope.",
    scope: "mcp:write",
    input: z.object({ job_id: id("Failed render job") }),
    output: loose({ status: z.string(), message: z.string() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    cost: "expensive",
    run: (ctx, a) => retryRender(ctx, a.job_id),
  }),
];
