import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Platform } from "../context";
import type { Sql } from "../db/types";
import { completeJob, failJob, reportProgress, type JobRow } from "../services/jobs";
import type { Scene } from "../services/projects";
import { currentPeriod } from "../services/usage";
import { exportKey } from "../storage/types";
import { defaultFont, probe, run } from "./ffmpeg";

/*
  FFmpeg renderer (v1). Turns a storyboard into real MP4 files, one per format:
  each scene is cut from its source clip (or a brand-colour title card), cropped to
  the target aspect ratio, given its on-screen text in the brand font and colour,
  then the scenes are joined. H.264 + AAC (a silent track until music licensing is in
  place), 30 fps, fast-start. Remotion can replace this for richer motion design later.

  Billing: on success the held credits become a charge; on failure the hold is
  released, so a failed render costs nothing (config/pricing.json: failed-render = 0).
*/
const SIZES: Record<string, [number, number]> = { "9:16": [1080, 1920], "1:1": [1080, 1080], "16:9": [1920, 1080], "4:5": [1080, 1350] };

export type RenderOptions = { resolutionScale?: number; preset?: string };

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

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
  return lines.slice(0, 3).join("\n");
}

function brandColours(colours: unknown): { box: string; text: string } {
  const list = Array.isArray(colours) ? (colours as { hex?: string; role?: string }[]) : [];
  const hex = (list.find((c) => /primary|brand/i.test(c.role ?? "")) ?? list[0])?.hex;
  const box = hex && /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex.slice(1) : "1A1A1A";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(box.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { box, text: lum > 0.55 ? "1A1A1A" : "FFFFFF" };
}

async function renderSegment(p: Platform, s: Scene, src: string | null, out: string, w: number, h: number, colours: { box: string; text: string }, workDir: string, preset: string) {
  const font = defaultFont();
  const filters: string[] = [];
  const inputs: string[] = [];
  if (src) {
    inputs.push("-ss", String(s.source_in_seconds ?? 0), "-t", String(s.duration_seconds), "-i", src);
    filters.push(`[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p`);
  } else {
    inputs.push("-f", "lavfi", "-t", String(s.duration_seconds), "-i", `color=c=0x${colours.box}:s=${w}x${h}:r=30`);
    filters.push(`[0:v]setsar=1,format=yuv420p`);
  }
  inputs.push("-f", "lavfi", "-t", String(s.duration_seconds), "-i", "anullsrc=r=48000:cl=stereo");
  if (s.transition !== "cut") filters.push(`fade=t=in:st=0:d=${Math.min(0.4, s.duration_seconds / 3)}`);
  if (s.on_screen_text && font) {
    const textFile = join(workDir, `text-${s.scene_number}.txt`);
    await writeFile(textFile, wrap(s.on_screen_text));
    const size = Math.round(h * (w > h ? 0.06 : 0.042));
    const y = src ? "h*0.70" : "(h-text_h)/2";
    filters.push(
      `drawtext=fontfile='${font}':textfile='${textFile}':fontsize=${size}:fontcolor=0x${src ? colours.text : colours.text}:line_spacing=${Math.round(size * 0.25)}:x=(w-text_w)/2:y=${y}` +
        (src ? `:box=1:boxcolor=0x${colours.box}@0.88:boxborderw=${Math.round(size * 0.5)}` : ""),
    );
  }
  await run(
    p.media.ffmpeg,
    ["-hide_banner", "-loglevel", "error", ...inputs, "-filter_complex", `${filters.join(",")}[v]`, "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", preset, "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", "-y", out],
    { timeoutMs: 10 * 60_000 },
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
    const sources = new Map<string, string>();
    for (const id of ids) {
      const [a] = await sys((sql) => sql.query<{ storage_key: string }>("select storage_key from public.media_assets where id = $1 and org_id = $2 and status in ('uploaded', 'ready')", [id, job.org_id]));
      if (!a) throw Object.assign(new Error("Some footage in the storyboard is no longer available"), { retryable: false });
      const local = join(workDir, `src-${id}`);
      await p.storage.downloadToFile(a.storage_key, local);
      sources.set(id, local);
    }

    const scale = opts.resolutionScale ?? 1;
    const preset = opts.preset ?? "veryfast";
    const outputs: { exportId: string; format: string; key: string; size: number; duration: number; width: number; height: number }[] = [];
    const steps = input.formats.length * (sb.scenes.length + 1);
    let done = 0;
    for (const format of input.formats) {
      const [bw, bh] = SIZES[format];
      const [w, h] = [even(bw * scale), even(bh * scale)];
      const segs: string[] = [];
      for (const s of sb.scenes) {
        const out = join(workDir, `${format.replace(":", "x")}-${s.scene_number}.mp4`);
        await renderSegment(p, s, s.asset_id ? sources.get(s.asset_id)! : null, out, w, h, colours, workDir, preset);
        segs.push(out);
        await sys((sql) => reportProgress(sql, job.id, `rendering ${format} · scene ${s.scene_number} of ${sb.scenes.length}`, 10 + (80 * ++done) / steps));
      }
      const list = join(workDir, `${format.replace(":", "x")}-list.txt`);
      await writeFile(list, segs.map((f) => `file '${f}'`).join("\n"));
      const final = join(workDir, `${format.replace(":", "x")}-final.mp4`);
      await run(p.media.ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", "-y", final], { timeoutMs: 10 * 60_000 });
      const meta = await probe(p.media, final);
      const exportId = randomUUID();
      const key = exportKey(job.org_id, exportId);
      const { size } = await p.storage.putFile(key, final, "video/mp4");
      outputs.push({ exportId, format, key, size, duration: meta.duration_seconds, width: meta.width ?? w, height: meta.height ?? h });
      done++;
    }

    await sys(async (sql) => {
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
    const retryable = (e as { retryable?: boolean }).retryable !== false;
    await sys(async (sql) => {
      if (job.credits_held > 0) {
        await sql.query("insert into public.credit_transactions (org_id, wallet, kind, amount, period, job_id, note) values ($1, 'video', 'release', $2, $3, $4, 'Render failed: hold released, no charge')", [job.org_id, job.credits_held, currentPeriod(), job.id]);
      }
      await sql.query("update public.projects set status = 'ready_to_render' where id = $1 and org_id = $2 and status = 'rendering'", [job.project_id, job.org_id]);
      await failJob(sql, job.id, { message: retryable ? "The render failed on our side. You were not charged and can retry for free." : (e as Error).message, retryable, code: "render_failed" });
    });
    throw Object.assign(e as Error, { handled: true });
  }
}
