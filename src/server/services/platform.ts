import type { Platform } from "../context";
import { mediaToolsAvailable } from "../workers/ffmpeg";

/*
  Platform health and capabilities. Reports what works, never how it is wired:
  no hostnames, connection strings, keys or bucket names.
*/
export async function getPlatformStatus(p: Platform, opts: { workersRunning?: boolean | null } = {}) {
  const [database, media] = await Promise.all([p.db.ping(), mediaToolsAvailable(p.media)]);
  const capability = (available: boolean, note?: string) => ({ available, ...(note ? { note } : {}) });
  return {
    status: database ? "operational" : "degraded",
    server: { name: "reeldeal-mcp", version: p.version },
    database: { available: database, kind: p.db.driver === "pglite" ? "embedded (local development)" : "postgres" },
    media_storage: { available: true, kind: p.storage.driver === "r2" ? "private cloud storage (signed URLs)" : "local development storage (signed URLs)" },
    ai: { configured: Boolean(p.ai), provider: p.ai?.name ?? null },
    capabilities: {
      workspace_and_usage: capability(database),
      brand_profiles: capability(database),
      media_search: capability(database, "Full-text search over titles, tags, AI tags and descriptions. Vector search is not enabled yet."),
      media_upload: capability(database, "Signed upload URLs; the client uploads the file directly to storage."),
      media_analysis: capability(database && media, media ? "Technical analysis with FFmpeg (duration, scenes, keyframes, quality). AI descriptions need workspace consent." : "FFmpeg is not installed on this server."),
      creative_ai: capability(Boolean(p.ai), p.ai ? undefined : "Set OPENAI_API_KEY to enable briefs, concepts and storyboards. submit_storyboard works without it."),
      storyboards: capability(database),
      rendering: capability(database && media, media ? "FFmpeg renderer: footage cuts, on-screen text, brand colour cards. Credit quote and confirmation required." : "FFmpeg is not installed on this server."),
      exports: capability(database, "Downloads use short-lived signed URLs."),
      background_workers: opts.workersRunning === undefined || opts.workersRunning === null ? { available: null, note: "Jobs are processed by the worker process (npm run worker)." } : capability(opts.workersRunning),
    },
  };
}
