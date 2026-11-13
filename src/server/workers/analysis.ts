import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Platform } from "../context";
import type { Sql } from "../db/types";
import { MediaDescriptionOutput } from "../ai/schemas";
import { completeJob, reportProgress, type JobRow } from "../services/jobs";
import { currentPeriod } from "../services/usage";
import { detectSceneCuts, extractFrame, measureQuality, probe } from "./ffmpeg";

/*
  Media analysis worker. Real measurements with FFmpeg:
    - technical metadata (duration, dimensions, frame rate, codecs, audio)
    - scene changes and a keyframe per scene (stored privately)
    - technical quality indicators
  AI descriptions (subjects, environment, uses, tags) run only when the workspace
  has consented to sending keyframes to the AI provider AND AI is configured.
*/
const MIN_SCENE = 0.6;

export async function runMediaAnalysis(p: Platform, job: JobRow, workDir: string) {
  const sys = <T>(fn: (sql: Sql) => Promise<T>) => p.db.system(fn);
  const [asset] = await sys((sql) =>
    sql.query<{ id: string; org_id: string; storage_key: string; title: string; description: string | null; consent: boolean }>(
      `select m.id, m.org_id, m.storage_key, m.title, m.description, o.ai_media_analysis_consent as consent
         from public.media_assets m join public.organisations o on o.id = m.org_id where m.id = $1 and m.org_id = $2`,
      [job.media_id, job.org_id],
    ),
  );
  if (!asset) throw Object.assign(new Error("Media asset no longer exists"), { retryable: false });

  const local = join(workDir, "source");
  await sys((sql) => reportProgress(sql, job.id, "downloading", 5));
  await p.storage.downloadToFile(asset.storage_key, local);

  await sys((sql) => reportProgress(sql, job.id, "reading metadata", 15));
  let meta;
  try {
    meta = await probe(p.media, local);
  } catch {
    await sys((sql) => sql.query("update public.media_assets set status = 'failed' where id = $1", [asset.id]));
    throw Object.assign(new Error("This file could not be read as video"), { retryable: false });
  }
  if (!meta.width || !meta.duration_seconds) {
    await sys((sql) => sql.query("update public.media_assets set status = 'failed' where id = $1", [asset.id]));
    throw Object.assign(new Error("No video stream found in this file"), { retryable: false });
  }

  await sys((sql) => reportProgress(sql, job.id, "detecting scenes", 35));
  const cuts = (await detectSceneCuts(p.media, local)).filter((t) => t > MIN_SCENE && t < meta.duration_seconds - MIN_SCENE);
  const bounds = [0, ...cuts, meta.duration_seconds].filter((t, i, a) => i === 0 || t - a[i - 1] >= MIN_SCENE);
  const scenes: { index: number; start: number; end: number; thumbnail_key: string; description?: string }[] = [];
  for (let i = 0; i < bounds.length - 1 && i < 40; i++) {
    const start = Math.round(bounds[i] * 100) / 100;
    const end = Math.round(bounds[i + 1] * 100) / 100;
    const frame = join(workDir, `scene-${i}.jpg`);
    await extractFrame(p.media, local, start + (end - start) / 2, frame);
    const key = `org/${asset.org_id}/media/${asset.id}/analysis/${job.id}/scene-${i}.jpg`;
    await p.storage.putFile(key, frame, "image/jpeg");
    scenes.push({ index: i, start, end, thumbnail_key: key });
  }

  await sys((sql) => reportProgress(sql, job.id, "measuring quality", 60));
  const quality = await measureQuality(p.media, local, meta);

  let ai: Record<string, unknown> | null = null;
  let aiTags: string[] = [];
  if (asset.consent && p.ai) {
    await sys((sql) => reportProgress(sql, job.id, "describing with AI", 80));
    const picks = scenes.slice(0, 4);
    const images = await Promise.all(picks.map(async (_, i) => `data:image/jpeg;base64,${(await readFile(join(workDir, `scene-${i}.jpg`))).toString("base64")}`));
    const { data, model } = await p.ai.generate({
      task: "media_description",
      schema: MediaDescriptionOutput,
      temperature: 0.2,
      system: "You describe video footage for a media library used to make tourism and hospitality marketing videos. Describe only what is visible. Tags: short lowercase nouns or phrases.",
      user: `Clip title (customer data): ${asset.title}\nKeyframes are in order, at ${picks.map((s) => `${s.start}s`).join(", ")}.`,
      images,
    });
    ai = { ...data, provider: p.ai.name, model, frames_sent: picks.length };
    aiTags = data.tags.map((t) => t.toLowerCase().slice(0, 60)).slice(0, 20);
    data.scene_descriptions.forEach((d) => {
      const s = scenes.find((x) => d.timestamp_seconds >= x.start && d.timestamp_seconds < x.end) ?? scenes[0];
      if (s && !s.description) s.description = d.description;
    });
  }

  await sys(async (sql) => {
    await sql.query(
      `insert into public.media_analysis (org_id, media_id, job_id, technical, scenes, quality, ai) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)`,
      [asset.org_id, asset.id, job.id, JSON.stringify(meta), JSON.stringify(scenes), JSON.stringify(quality), ai ? JSON.stringify(ai) : null],
    );
    await sql.query("update public.media_assets set status = 'ready', duration_seconds = $2, width = $3, height = $4, ai_tags = $5 where id = $1", [
      asset.id,
      meta.duration_seconds,
      meta.width,
      meta.height,
      aiTags,
    ]);
    await sql.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id, note) values ($1, 'analysis', 'charge', $2, $3, $4, $5)", [
      asset.org_id,
      -Math.max(1, Math.ceil(meta.duration_seconds)),
      currentPeriod(),
      job.id,
      `Analysis of ${asset.title} (seconds)`,
    ]);
    await completeJob(sql, job.id, { media_id: asset.id, duration_seconds: meta.duration_seconds, scene_count: scenes.length, quality_score: quality.score, ai_description: Boolean(ai) });
  });
}
