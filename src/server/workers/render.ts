import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Platform } from "../context";
import type { Sql } from "../db/types";
import { assertStillOwned, completeJob, failJob, reportProgress, type JobRow } from "../services/jobs";
import type { Scene } from "../services/projects";
import { currentPeriod } from "../services/usage";
import { exportKey, ownedKey } from "../storage/types";
import { defaultFont, probe, run } from "./ffmpeg";

/*
  FFmpeg renderer (v1). Turns a storyboard into real MP4 files, one per format:
  each scene is cut from its source clip (or a brand-colour title card), cropped to
  the target aspect ratio, given its on-screen text in the brand font and colour,
  then the scenes are joined. "cut" joins directly, "fade" fades in from black,
  "dissolve" cross-fades picture and sound with the previous scene (the previous scene
  is rendered slightly longer, so every scene keeps its storyboard length).
  Sound: each clip keeps its own sound (with short fades so cuts don't click); text
  cards are silent. No music or voice-over yet. H.264 (capped at 10 Mbit/s) + AAC,
  30 fps, fast-start.

  Billing: on success the held credits become a charge; on failure the hold is
  released, so a failed render costs nothing (config/pricing.json: failed-render = 0).
*/
const SIZES: Record<string, [number, number]> = { "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080], "4:5": [1080, 1350] };

export type RenderOptions = { resolutionScale?: number; preset?: string };

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

const VIDEO_ENCODE = ["-c:v", "libx264", "-crf", "20", "-maxrate", "10M", "-bufsize", "20M", "-pix_fmt", "yuv420p", "-r", "30"];
const AUDIO_ENCODE = ["-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2"];
/** Cross-dissolve length into a scene (never more than a third of either scene). */
export const dissolveSeconds = (prev: Scene | undefined, s: Scene) => (prev && s.transition === "dissolve" ? Math.min(0.5, prev.duration_seconds / 3, s.duration_seconds / 3) : 0);

function wrap(text: string, max = 22) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > max && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines.slice(0, 4).join("\n");
}

function brandColours(colours: unknown): { box: string; text: string } {
  const list = Array.isArray(colours) ? (colours as { hex?: string; role?: string }[]) : [];
  const hex = (list.find((c) => /primary|brand/i.test(c.role ?? "")) ?? list[0])?.hex;
  const box = hex && /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.slice(1) : "1A1A1A";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(box.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { box, text: lum > 0.55 ? "1A1A1A" : "FFFFFF" };
}

/**
 * One scene as its own clip, exactly `length` seconds long (the scene's duration plus any
 * overlap the next scene dissolves over). Short clips hold their last frame.
 */
async function renderSegment(p: Platform, s: Scene, src: { path: string; hasAudio: boolean } | null, length: number, fadeFromBlack: boolean, out: string, w: number, h: number, colours: { box: string; text: string }, workDir: string, preset: string) {
  const font = defaultFont();
  const L = length.toFixed(3);
  const v: string[] = [];
  const inputs: string[] = [];
  if (src) {
    inputs.push("-ss", String(s.source_in_seconds ?? 0), "-t", L, "-i", src.path);
    v.push(`[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p,tpad=stop_mode=clone:stop_duration=${L},trim=duration=${L},setpts=PTS-STARTPTS`);
  } else {
    inputs.push("-f", "lavfi", "-t", L, "-i", `color=c=0x${colours.box}:s=${w}x${h}:r=30`);
    v.push(`[0:v]setsar=1,format=yuv420p`);
  }
  if (fadeFromBlack) v.push(`fade=t=in:st=0:d=${Math.min(0.4, s.duration_seconds / 3).toFixed(3)}`);
  if (s.on_screen_text && font) {
    const textFile = join(workDir, `text-${s.scene_number}.txt`);
    // Lower third over footage; larger, centred type on brand cards.
    await writeFile(textFile, wrap(s.on_screen_text, src ? 22 : 16));
    const size = Math.round(h * (w > h ? (src ? 0.06 : 0.085) : src ? 0.042 : 0.058));
    const y = src ? "h*0.70" : "(h-text_h)/2";
    v.push(
      `drawtext=fontfile='${font}':textfile='${textFile}':fontsize=${size}:fontcolor=0x${colours.text}:line_spacing=${Math.round(size * 0.25)}:x=(w-text_w)/2:y=${y}` +
        (src ? `:box=1:boxcolor=0x${colours.box}@0.88:boxborderw=${Math.round(size * 0.5)}` : ""),
    );
  }
  let audio: string;
  if (src?.hasAudio) {
    // The clip's own sound, padded if the clip is short, with tiny fades so cuts don't click.
    audio = `[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${L},asetpts=PTS-STARTPTS,afade=t=in:d=0.04,afade=t=out:st=${Math.max(0, length - 0.06).toFixed(3)}:d=0.06[a]`;
  } else {
    inputs.push("-f", "lavfi", "-t", L, "-i", "anullsrc=r=48000:cl=stereo");
    audio = `[1:a]atrim=duration=${L}[a]`;
  }
  await run(
    p.media.ffmpeg,
    ["-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", `${v.join(",")}[v];${audio}`, "-map", "[v]", "-map", "[a]", "-t", L, "-preset", preset, ...VIDEO_ENCODE, ...AUDIO_ENCODE, "-y", out],
    { timeoutMs: 10 * 60_000 },
  );
}

/** Join scenes: plain concatenation, or a cross-dissolve where a scene asks for one. */
async function assemble(p: Platform, segs: { path: string; length: number; dissolve: number }[], out: string, preset: string, workDir: string, tag: string) {
  if (segs.every((s) => s.dissolve === 0)) {
    const list = join(workDir, `${tag}-list.txt`);
    await writeFile(list, segs.map((s) => `file '${s.path}'`).join("\n"));
    await run(p.media.ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", "-y", out], { timeoutMs: 10 * 60_000 });
    return;
  }
  const inputs = segs.flatMap((s) => ["-i", s.path]);
  const f: string[] = [];
  let v = "[0:v]";
  let a = "[0:a]";
  let at = segs[0]!.length;
  for (let i = 1; i < segs.length; i++) {
    const d = segs[i]!.dissolve;
    if (d > 0) {
      f.push(`${v}[${i}:v]xfade=transition=fade:duration=${d.toFixed(3)}:offset=${(at - d).toFixed(3)}[v${i}]`);
      f.push(`${a}[${i}:a]acrossfade=d=${d.toFixed(3)}[a${i}]`);
      at += segs[i]!.length - d;
    } else {
      f.push(`${v}${a}[${i}:v][${i}:a]concat=n=2:v=1:a=1[v${i}][a${i}]`);
      at += segs[i]!.length;
    }
    v = `[v${i}]`;
    a = `[a${i}]`;
  }
  await run(
    p.media.ffmpeg,
    ["-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", f.join(";"), "-map", v, "-map", a, "-preset", preset, ...VIDEO_ENCODE, ...AUDIO_ENCODE, "-movflags", "+faststart", "-y", out],
    { timeoutMs: 20 * 60_000 },
  );
}

export async function runRender(p: Platform, job: JobRow, workDir: string, opts: RenderOptions = {}) {
  const sys = <T>(fn: (sql: Sql) => Promise<T>) => p.db.system(fn);
  try {
    const input = job.input as { project_id: string; storyboard_id: string; formats: string[]; credits: number };
    const [sb] = await sys((sql) =>
      sql.query<{ id: string; scenes: Scene[]; colours: unknown; project_name: string }>(
        `select s.id, s.scenes, b.colours, p.name as project_name from public.storyboards s
           join public.projects p on p.id = s.project_id left join public.brand_profiles b on b.id = p.brand_id
          where s.id = $1 and s.org_id = $2`,
        [input.storyboard_id, job.org_id],
      ),
    );
    if (!sb) throw Object.assign(new Error("The storyboard no longer exists"), { retryable: false });
    const colours = brandColours(sb.colours);

    // Download each source clip once.
    await sys((sql) => reportProgress(sql, job.id, "fetching footage", 5));
    const ids = [...new Set(sb.scenes.map((s) => s.asset_id).filter(Boolean))] as string[];
    const sources = new Map<string, { path: string; hasAudio: boolean }>();
    for (const id of ids) {
      const [a] = await sys((sql) => sql.query<{ storage_key: string; title: string }>("select storage_key, title from public.media_assets where id = $1 and org_id = $2 and status in ('uploaded', 'ready')", [id, job.org_id]));
      if (!a) throw Object.assign(new Error("Some footage in the storyboard is no longer available"), { retryable: false });
      const local = join(workDir, `src-${id}`);
      await p.storage.downloadToFile(ownedKey(a.storage_key, job.org_id), local).catch((e: unknown) => {
        // A retry can't fix footage that is gone: say what happened and how to fix it.
        throw (e as { missing?: boolean }).missing ? Object.assign(new Error(`The footage "${a.title}" is missing from storage. Replace it in Studio, then render again.`), { retryable: false }) : e;
      });
      sources.set(id, { path: local, hasAudio: (await probe(p.media, local)).has_audio });
    }

    const scale = opts.resolutionScale ?? 1;
    const preset = opts.preset ?? "veryfast";
    const outputs: { exportId: string; format: string; key: string; size: number; duration: number; width: number; height: number }[] = [];
    const steps = input.formats.length * (sb.scenes.length + 1);
    let done = 0;
    for (const format of input.formats) {
      const [bw, bh] = SIZES[format];
      const [w, h] = [even(bw * scale), even(bh * scale)];
      const tag = format.replace(":", "x");
      const segs: { path: string; length: number; dissolve: number }[] = [];
      for (const [i, s] of sb.scenes.entries()) {
        const into = dissolveSeconds(sb.scenes[i - 1], s);
        const length = s.duration_seconds + (sb.scenes[i + 1] ? dissolveSeconds(s, sb.scenes[i + 1]!) : 0);
        const fadeFromBlack = s.transition === "fade" || (i === 0 && s.transition === "dissolve");
        const out = join(workDir, `${tag}-${s.scene_number}.mp4`);
        await renderSegment(p, s, s.asset_id ? sources.get(s.asset_id)! : null, length, fadeFromBlack, out, w, h, colours, workDir, preset);
        segs.push({ path: out, length, dissolve: into });
        await sys((sql) => reportProgress(sql, job.id, `rendering ${format} · scene ${s.scene_number} of ${sb.scenes.length}`, 10 + (80 * ++done) / steps));
      }
      await sys((sql) => reportProgress(sql, job.id, `joining ${format}`, 10 + (80 * done) / steps));
      const final = join(workDir, `${tag}-final.mp4`);
      await assemble(p, segs, final, preset, workDir, tag);
      const meta = await probe(p.media, final);
      const exportId = randomUUID();
      const key = exportKey(job.org_id, exportId);
      const { size } = await p.storage.putFile(key, final, "video/mp4");
      outputs.push({ exportId, format, key, size, duration: meta.duration_seconds, width: meta.width ?? w, height: meta.height ?? h });
      done++;
    }

    await sys(async (sql) => {
      await assertStillOwned(sql, job);
      for (const o of outputs) {
        await sql.query(
          `insert into public.exports (id, org_id, project_id, job_id, storyboard_id, format, status, storage_key, mime_type, size_bytes, duration_seconds, width, height)
           values ($1, $2, $3, $4, $5, $6, 'ready', $7, 'video/mp4', $8, $9, $10, $11)`,
          [o.exportId, job.org_id, input.project_id, job.id, input.storyboard_id, o.format, o.key, o.size, o.duration, o.width, o.height],
        );
      }
      // Billing: release the hold and charge the same amount, once.
      if (job.credits_held > 0) {
        await sql.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id, note) values ($1, 'video', 'release', $2, $3, $4, 'Render succeeded: hold released')", [job.org_id, job.credits_held, currentPeriod(), job.id]);
        await sql.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id, note) values ($1, 'video', 'charge', $2, $3, $4, $5)", [job.org_id, -job.credits_held, currentPeriod(), job.id, `Render of ${sb.project_name}`]);
      }
      await sql.query("update public.projects set status = 'completed' where id = $1 and org_id = $2", [input.project_id, job.org_id]);
      await completeJob(sql, job.id, { exports: outputs.map((o) => ({ export_id: o.exportId, format: o.format, duration_seconds: o.duration, size_bytes: o.size })), credits_charged: job.credits_held });
    });
  } catch (e) {
    if ((e as { lostClaim?: boolean }).lostClaim) throw e;
    const retryable = (e as { retryable?: boolean }).retryable !== false;
    await sys(async (sql) => {
      await assertStillOwned(sql, job);
      if (job.credits_held > 0) {
        await sql.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id, note) values ($1, 'video', 'release', $2, $3, $4, 'Render failed: hold released, no charge')", [job.org_id, job.credits_held, currentPeriod(), job.id]);
      }
      await sql.query("update public.projects set status = 'ready_to_render' where id = $1 and org_id = $2 and status = 'rendering'", [job.project_id, job.org_id]);
      await failJob(sql, job.id, { message: retryable ? "The render failed on our side. You were not charged and can retry for free." : (e as Error).message, retryable, code: "render_failed" });
    });
    throw Object.assign(e as Error, { handled: true });
  }
}
