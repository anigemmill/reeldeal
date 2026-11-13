import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

/*
  Thin, safe wrappers around ffmpeg/ffprobe. Arguments are always passed as an
  array (no shell), user text reaches drawtext only through a temp file, and every
  run has a timeout.
*/
export type MediaTools = { ffmpeg: string; ffprobe: string };

export function run(cmd: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => {
      stderr += d;
      if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), opts.timeoutMs ?? 10 * 60_000);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(Object.assign(new Error(`${cmd} exited with ${code}`), { stderr: stderr.slice(-2000) }));
    });
  });
}

const availability = new Map<string, Promise<boolean>>();
export function mediaToolsAvailable(t: MediaTools): Promise<boolean> {
  const key = `${t.ffmpeg}|${t.ffprobe}`;
  if (!availability.has(key)) {
    availability.set(
      key,
      Promise.all([run(t.ffmpeg, ["-version"], { timeoutMs: 5000 }), run(t.ffprobe, ["-version"], { timeoutMs: 5000 })]).then(
        () => true,
        () => false,
      ),
    );
  }
  return availability.get(key)!;
}

export type Probe = {
  duration_seconds: number;
  width: number | null;
  height: number | null;
  fps: number | null;
  video_codec: string | null;
  audio_codec: string | null;
  has_audio: boolean;
  bitrate_kbps: number | null;
  container: string | null;
};

export async function probe(t: MediaTools, path: string): Promise<Probe> {
  const { stdout } = await run(t.ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path], { timeoutMs: 60_000 });
  const j = JSON.parse(stdout) as { format?: { duration?: string; bit_rate?: string; format_name?: string }; streams?: { codec_type: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; duration?: string; side_data_list?: { rotation?: number }[] }[] };
  const v = j.streams?.find((s) => s.codec_type === "video");
  const a = j.streams?.find((s) => s.codec_type === "audio");
  const [n, d] = (v?.avg_frame_rate ?? "0/1").split("/").map(Number);
  const rotated = Math.abs(v?.side_data_list?.find((x) => x.rotation !== undefined)?.rotation ?? 0) === 90;
  return {
    duration_seconds: Number(j.format?.duration ?? v?.duration ?? 0),
    width: (rotated ? v?.height : v?.width) ?? null,
    height: (rotated ? v?.width : v?.height) ?? null,
    fps: d ? Math.round((n / d) * 100) / 100 : null,
    video_codec: v?.codec_name ?? null,
    audio_codec: a?.codec_name ?? null,
    has_audio: Boolean(a),
    bitrate_kbps: j.format?.bit_rate ? Math.round(Number(j.format.bit_rate) / 1000) : null,
    container: j.format?.format_name ?? null,
  };
}

/** Scene-change timestamps (seconds) using ffmpeg's scene score. */
export async function detectSceneCuts(t: MediaTools, path: string, threshold = 0.3): Promise<number[]> {
  const { stderr } = await run(t.ffmpeg, ["-hide_banner", "-nostats", "-i", path, "-filter:v", `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-"], { timeoutMs: 10 * 60_000 });
  return [...stderr.matchAll(/pts_time:([0-9.]+)/g)].map((m) => Number(m[1])).filter((x) => Number.isFinite(x));
}

/** Technical measurements: average brightness, black frames and loudness. */
export async function measureQuality(t: MediaTools, path: string, probeResult: Probe) {
  const { stderr } = await run(
    t.ffmpeg,
    ["-hide_banner", "-nostats", "-i", path, "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YAVG,blackdetect=d=0.3:pix_th=0.10", "-af", "volumedetect", "-f", "null", "-"],
    { timeoutMs: 10 * 60_000 },
  );
  const yavg = [...stderr.matchAll(/lavfi\.signalstats\.YAVG=([0-9.]+)/g)].map((m) => Number(m[1]));
  const brightness = yavg.length ? yavg.reduce((a, b) => a + b, 0) / yavg.length : null;
  const blackSeconds = [...stderr.matchAll(/black_duration:([0-9.]+)/g)].reduce((a, m) => a + Number(m[1]), 0);
  const meanVolume = stderr.match(/mean_volume: (-?[0-9.]+) dB/)?.[1];
  const shortSide = Math.min(probeResult.width ?? 0, probeResult.height ?? 0);
  const resolution = shortSide >= 1080 ? "1080p+" : shortSide >= 720 ? "720p" : shortSide >= 480 ? "480p" : "low";

  // Heuristic technical score (0–100). It measures fitness for use, not aesthetics.
  let score = { "1080p+": 40, "720p": 30, "480p": 18, low: 8 }[resolution];
  if (brightness !== null && brightness > 40 && brightness < 210) score += 20;
  else if (brightness !== null) score += 5;
  const blackShare = probeResult.duration_seconds ? blackSeconds / probeResult.duration_seconds : 0;
  score += blackShare < 0.05 ? 15 : blackShare < 0.25 ? 7 : 0;
  score += probeResult.duration_seconds >= 3 ? 10 : 4;
  score += (probeResult.fps ?? 0) >= 24 ? 15 : 5;
  return {
    score: Math.min(100, score),
    method: "technical heuristic: resolution, exposure, black frames, length, frame rate",
    resolution,
    average_brightness: brightness === null ? null : Math.round(brightness),
    exposure: brightness === null ? "unknown" : brightness < 40 ? "dark" : brightness > 210 ? "bright" : "ok",
    black_frames_seconds: Math.round(blackSeconds * 100) / 100,
    audio: probeResult.has_audio ? { mean_volume_db: meanVolume ? Number(meanVolume) : null, silent: meanVolume ? Number(meanVolume) < -60 : null } : null,
    camera_movement: "not measured",
  };
}

export async function extractFrame(t: MediaTools, path: string, atSeconds: number, out: string, width = 480) {
  await run(t.ffmpeg, ["-hide_banner", "-loglevel", "error", "-ss", String(Math.max(0, atSeconds)), "-i", path, "-frames:v", "1", "-vf", `scale=${width}:-2`, "-q:v", "4", "-y", out], { timeoutMs: 60_000 });
}

export const FONT_CANDIDATES = ["/usr/share/fonts/opentype/inter/Inter-Bold.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"];
export const defaultFont = () => FONT_CANDIDATES.find((f) => existsSync(f)) ?? null;
