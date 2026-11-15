import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Ctx } from "../context";
import { requestAnalysis } from "../services/media";
import { submitStoryboard } from "../services/projects";
import { createVideo, getExport } from "../services/render";
import { mediaKey } from "../storage/types";
import { createTestPlatform } from "../testing";
import { probe } from "./ffmpeg";
import { createWorker } from "./runner";

/*
  Render quality: inspects the real MP4, not just that FFmpeg exited 0.
  A clip with sound, a cross-dissolve, a fade and a brand-colour text card.
*/
let t: Awaited<ReturnType<typeof createTestPlatform>>;
let aroha: Ctx;
const dir = mkdtempSync(join(tmpdir(), "rd-rq-"));
const ff = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
/** FFmpeg's stderr (where filters like volumedetect report). */
const ffErr = (args: string[]) => spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8" }).stderr;
let clip = "";

beforeAll(async () => {
  t = await createTestPlatform({ clips: 1 });
  aroha = await t.ctxFor(t.demo.tokens.aroha_owner_full);
  // A 4-second 16:9 clip with a 440 Hz tone (real sound), uploaded and analysed.
  const src = join(dir, "tone.mp4");
  ff(["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-shortest", src]);
  clip = randomUUID();
  const key = mediaKey(t.demo.ids.orgA, clip, "mp4");
  await t.p.storage.putFile(key, src, "video/mp4");
  await t.p.db.system((sql) => sql.query("insert into public.media_assets (id, org_id, title, kind, mime_type, storage_key, status) values ($1, $2, 'Tone clip', 'video', 'video/mp4', $3, 'uploaded')", [clip, t.demo.ids.orgA, key]));
  await t.p.db.system((sql) => sql.query("update public.brand_profiles set colours = $2::text::jsonb where id = (select brand_id from public.projects where id = $1)", [t.demo.ids.projectA, JSON.stringify([{ name: "Lake", hex: "#1F4E79", role: "primary" }])]));
  await requestAnalysis(aroha, clip);
  const w = createWorker(t.p);
  while (await w.runOnce()) {}
}, 180_000);
afterAll(async () => t?.p.db.close());

describe("render output quality", () => {
  it("keeps clip sound, dissolves without losing length, uses the brand colour and caps the bitrate", async () => {
    const sb = await submitStoryboard(aroha, {
      project_id: t.demo.ids.projectA,
      title: "Quality",
      format: "9:16",
      scenes: [
        { duration_seconds: 2, asset_id: clip, source_in_seconds: 0, on_screen_text: "Morning on the lake" },
        { duration_seconds: 2, asset_id: clip, source_in_seconds: 2, transition: "dissolve" },
        { duration_seconds: 2, on_screen_text: "Book direct", transition: "fade" },
      ],
    });
    const q = await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: sb.storyboard_id });
    if (q.status !== "confirmation_required") throw new Error("quote expected");
    await createVideo(aroha, { project_id: t.demo.ids.projectA, storyboard_id: sb.storyboard_id, confirm: true, quote_token: q.quote.quote_token });
    const job = await createWorker(t.p).runOnce();
    expect(job?.status).toBe("succeeded");
    const exportId = (job!.result as { exports: { export_id: string }[] }).exports[0]!.export_id;
    const e = await getExport(aroha, exportId, { includeDownloadUrl: false });
    const [row] = await t.p.db.system((sql) => sql.query<{ storage_key: string }>("select storage_key from public.exports where id = $1", [exportId]));
    const out = join(dir, "out.mp4");
    if (process.env.KEEP_RENDER) console.log("render kept at", out);
    await t.p.storage.downloadToFile(row!.storage_key, out);

    const meta = await probe(t.p.media, out);
    expect([meta.width, meta.height]).toEqual([1080, 1920]);
    expect(meta.has_audio).toBe(true);
    // 2 + 2 + 2 seconds: the dissolve overlap is compensated, so the length matches the storyboard.
    expect(meta.duration_seconds).toBeGreaterThan(5.9);
    expect(meta.duration_seconds).toBeLessThan(6.15);
    expect(e.duration_seconds).toBeCloseTo(6, 0);

    const vol = (from: number, to: number) => Number(/mean_volume: (-?[\d.]+|-inf)/.exec(ffErr(["-ss", String(from), "-to", String(to), "-i", out, "-af", "volumedetect", "-f", "null", "-"]))?.[1] ?? -999);
    expect(vol(0.2, 1.8)).toBeGreaterThan(-35); // the clip's tone is kept
    expect(vol(4.3, 5.9)).toBeLessThan(-80); // the text card is silent

    // The text card's background is the brand colour #1F4E79 (sample a corner, away from the text).
    const px = execFileSync("ffmpeg", ["-v", "error", "-ss", "5.5", "-i", out, "-frames:v", "1", "-vf", "crop=40:40:10:10,scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    const [r, g, b] = [...px];
    expect(Math.abs(r! - 0x1f)).toBeLessThan(12);
    expect(Math.abs(g! - 0x4e)).toBeLessThan(12);
    expect(Math.abs(b! - 0x79)).toBeLessThan(12);

    // Bitrate stays within the 10 Mbit/s cap (with container overhead).
    const br = Number(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "format=bit_rate", "-of", "csv=p=0", out], { encoding: "utf8" }).trim());
    expect(br).toBeLessThan(11_000_000);
  }, 240_000);

  it("gives AI on-screen text enough time to be read", async () => {
    const { validateScenes } = await import("../services/projects");
    const v = await t.p.db.asUser(t.demo.ids.aroha, (sql) => validateScenes(sql, t.demo.ids.orgA, [{ duration_seconds: 1, on_screen_text: "Book your stay directly with us today" }], "lenient"));
    expect(v.scenes[0]!.duration_seconds).toBeGreaterThanOrEqual(3);
    expect(v.warnings.join()).toMatch(/lengthened/);
  });
});

describe("image thumbnails", () => {
  it("analyses an image into a small thumbnail (the library never loads the original)", async () => {
    const { mediaThumbnails, getMediaAnalysis } = await import("../services/media");
    const png = join(dir, "big.png");
    ff(["-f", "lavfi", "-i", "testsrc2=size=3000x2000", "-frames:v", "1", png]);
    const id = randomUUID();
    const key = mediaKey(t.demo.ids.orgA, id, "png");
    await t.p.storage.putFile(key, png, "image/png");
    await t.p.db.system((sql) => sql.query("insert into public.media_assets (id, org_id, title, kind, mime_type, storage_key, status) values ($1, $2, 'Big image', 'image', 'image/png', $3, 'uploaded')", [id, t.demo.ids.orgA, key]));
    await requestAnalysis(aroha, id);
    expect((await createWorker(t.p).runOnce())?.status).toBe("succeeded");
    const a = (await getMediaAnalysis(aroha, id)) as unknown as { status: string; analysis: { technical: { width: number; height: number } } };
    expect(a).toMatchObject({ status: "analysed", analysis: { technical: { width: 3000, height: 2000 } } });
    const url = (await mediaThumbnails(aroha, [id]))[id]!;
    expect(url).toContain("/analysis/");
    expect(url).not.toContain("original.png");
  }, 120_000);
});
