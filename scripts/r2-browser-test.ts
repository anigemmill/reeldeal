/*
  Genuine browser uploads to the REAL R2 bucket (npm run test:r2-browser).

  Run AFTER the R2 CORS policy is applied (docs/review/r2-cors-approval.md). Before that, the
  browser's uploads are refused by R2's CORS check and this test reports exactly that.

  Needs:
    - the app running on BASE_URL (default http://localhost:3000, the origin CORS allows), started
      with the real R2 credentials (R2_*; no R2_ENDPOINT) and the local Supabase stack for accounts:
        set -a; . infra/local/stack.env; set +a
        unset R2_ENDPOINT STORAGE_DRIVER; export R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=reeldeal-dev-media
        R2_SIGNED_URL_TTL_SECONDS=30 AI_PROVIDER=fixture npx next dev -p 3000   (and npm run worker, same env)
    - this script with the same environment (DATABASE_URL of the LOCAL stack, the real R2_*)

  Covers: image upload, video upload, large multipart upload, cancel, retry after a network
  failure, signed download, expired signed link, and that an original can't be overwritten.
  Clean-up: every object and unfinished multipart upload under the test workspace's prefix in
  the bucket is removed at the end, pass or fail. Nothing else in the bucket is touched.
  The account and workspace live in the LOCAL database only.
*/
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AwsClient } from "aws4fetch";
import postgres from "postgres";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAIL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const env = process.env;
for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "DATABASE_URL"]) {
  if (!env[k]) throw new Error(`${k} is not set (see the header of this file)`);
}
if (env.R2_ENDPOINT) throw new Error("R2_ENDPOINT is set: this test must use the real R2 endpoint");
if (!/^(127\.|localhost)/.test(new URL(env.DATABASE_URL!).hostname)) throw new Error("DATABASE_URL must be the LOCAL stack: this test creates an account");
const R2 = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;
const s3 = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" });
const db = postgres(env.DATABASE_URL!, { max: 1, onnotice: () => {} });

const results: { name: string; ok: boolean; note?: string }[] = [];
const check = (name: string, ok: boolean, note?: string) => {
  results.push({ name, ok, note });
  console.log(`${ok ? "✓" : "✗"} ${name}${note ? ` (${note})` : ""}`);
};
const dir = mkdtempSync(join(tmpdir(), "rd-r2-browser-"));
const ff = (args: string[]) => execFileSync(env.FFMPEG_PATH ?? "ffmpeg", ["-loglevel", "error", "-y", ...args]);
const tags = (t: string, tag: string) => [...t.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]!);
const pathOf = (key: string) => key.split("/").map(encodeURIComponent).join("/");

async function mailLink(to: string, since: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string; Created: string }[] };
    const m = (list.messages ?? []).find((x) => new Date(x.Created).getTime() >= since - 1000);
    if (m) {
      const msg = (await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()) as { HTML: string; Text: string };
      const link = (/(https?:\/\/[^\s"'<>]+(?:verify|auth\/callback)[^\s"'<>]+)/.exec(msg.Text || msg.HTML)?.[1] ?? "").replace(/&amp;/g, "&");
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no confirmation email");
}

/** Remove everything this run put in the bucket: objects and open multipart uploads under the org prefix. */
async function cleanup(orgId: string) {
  if (!/^[0-9a-f-]{36}$/.test(orgId)) return;
  const prefix = `org/${orgId}/`;
  const up = await (await s3.fetch(`${R2}?uploads&prefix=${encodeURIComponent(prefix)}`)).text();
  for (const u of tags(up, "Upload")) await s3.fetch(`${R2}/${pathOf(tags(u, "Key")[0]!)}?uploadId=${encodeURIComponent(tags(u, "UploadId")[0]!)}`, { method: "DELETE" });
  let removed = 0;
  for (let token = ""; ; ) {
    const t = await (await s3.fetch(`${R2}?list-type=2&prefix=${encodeURIComponent(prefix)}${token ? `&continuation-token=${encodeURIComponent(token)}` : ""}`)).text();
    for (const k of tags(t, "Key")) if (k.startsWith(prefix) && (await s3.fetch(`${R2}/${pathOf(k)}`, { method: "DELETE" })).ok) removed++;
    token = tags(t, "NextContinuationToken")[0] ?? "";
    if (!token) break;
  }
  const left = tags(await (await s3.fetch(`${R2}?list-type=2&prefix=${encodeURIComponent(prefix)}`)).text(), "Key").length;
  const open = tags(await (await s3.fetch(`${R2}?uploads&prefix=${encodeURIComponent(prefix)}`)).text(), "Upload").length;
  check("Clean-up: nothing left in the bucket under the test workspace", left === 0 && open === 0, `${removed} object(s) removed`);
}

const statusOf = async (title: string) => (await db<{ status: string }[]>`select status from media_assets where title ilike ${`${title}%`} order by created_at desc limit 1`)[0]?.status ?? "missing";
async function waitStatus(title: string, ok: RegExp, ms = 180_000) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; ) {
    const s = await statusOf(title);
    if (ok.test(s)) return s;
    if (s === "failed") return s;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return statusOf(title);
}

async function main() {
  ff(["-f", "lavfi", "-i", "testsrc2=size=1200x800", "-frames:v", "1", join(dir, "r2_still.png")]);
  ff(["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-c:v", "libx264", "-preset", "veryfast", join(dir, "r2_clip.mp4")]);
  // ~150 MB: above the 100 MiB multipart threshold.
  ff(["-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=12", "-vf", "noise=alls=40:allf=t+u", "-c:v", "libx264", "-preset", "ultrafast", "-b:v", "100M", "-maxrate", "100M", "-bufsize", "100M", join(dir, "r2_large.mp4")]);
  ff(["-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=12", "-vf", "noise=alls=40:allf=t+u", "-c:v", "libx264", "-preset", "ultrafast", "-b:v", "100M", "-maxrate", "100M", "-bufsize", "100M", join(dir, "r2_cancel.mp4")]);
  ff(["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30:duration=4", "-c:v", "libx264", "-preset", "veryfast", join(dir, "r2_retry.mp4")]);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page: Page = await ctx.newPage();
  const corsErrors: string[] = [];
  page.on("console", (m) => /CORS|Access-Control/i.test(m.text()) && corsErrors.push(m.text().slice(0, 160)));
  const email = `r2-browser-${Date.now()}@reeldeal.local`;
  let orgId = "";
  try {
    // Account and workspace (local stack).
    const since = Date.now();
    await page.goto(`${BASE}/sign-up`);
    await page.getByLabel("Your name").fill("R2 Browser Test");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("checkbox", { name: /I agree/ }).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/verify-email");
    await page.goto(await mailLink(email, since));
    await page.waitForURL("**/onboarding**");
    await page.getByLabel("Business name").fill("R2 Browser Test");
    await page.getByLabel("Industry").click();
    await page.getByRole("option", { name: "Accommodation" }).click();
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.waitForURL("**/dashboard**", { timeout: 30000 });
    orgId = (await db<{ org_id: string }[]>`select m.org_id from memberships m join auth.users u on u.id = m.user_id where u.email = ${email}`)[0]!.org_id;
    await db`update organisations set plan_id = 'business' where id = ${orgId}`; // enough storage and analysis for the test files

    await page.goto(`${BASE}/library`);
    await page.waitForTimeout(2000);
    const input = page.locator("input[type=file]");
    const panel = page.locator("#uploads-title").locator("xpath=../..");

    // 1–3. Image, video, large multipart.
    await input.setInputFiles([join(dir, "r2_still.png"), join(dir, "r2_clip.mp4")]);
    check("Image upload reaches the real bucket", /uploaded|analysing|ready/.test(await waitStatus("r2 still", /uploaded|analysing|ready/)), corsErrors[0]);
    check("Video upload reaches the real bucket", /uploaded|analysing|ready/.test(await waitStatus("r2 clip", /uploaded|analysing|ready/)));
    await input.setInputFiles(join(dir, "r2_large.mp4"));
    check("Large multipart upload (~150 MB) completes", /uploaded|analysing|ready/.test(await waitStatus("r2 large", /uploaded|analysing|ready/, 600_000)));

    // 4. Cancel mid-upload: the asset is marked failed and the multipart upload is aborted in the bucket.
    await input.setInputFiles(join(dir, "r2_cancel.mp4"));
    await panel.getByText(/Uploading/).first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Cancel upload of r2_cancel.mp4" }).click();
    const cancelled = await waitStatus("r2 cancel", /failed/, 30_000);
    const [row] = await db<{ storage_key: string }[]>`select storage_key from media_assets where title ilike 'r2 cancel%' order by created_at desc limit 1`;
    const openParts = row ? tags(await (await s3.fetch(`${R2}?uploads&prefix=${encodeURIComponent(row.storage_key)}`)).text(), "Upload").length : -1;
    check("Cancel stops the upload and discards its parts", cancelled === "failed" && openParts === 0, `status ${cancelled}, open multipart uploads ${openParts}`);

    // 5. Retry after a network failure.
    await page.route(/r2\.cloudflarestorage\.com/, (r) => (r.request().method() === "PUT" ? r.abort("failed") : r.continue()));
    await input.setInputFiles(join(dir, "r2_retry.mp4"));
    await panel.getByText(/Failed: /).first().waitFor({ timeout: 60000 });
    await page.unroute(/r2\.cloudflarestorage\.com/);
    await panel.getByRole("button", { name: "Retry" }).first().click();
    check("Retry completes the upload after a network failure", /uploaded|analysing|ready/.test(await waitStatus("r2 retry", /uploaded|analysing|ready/)));

    // 6–8. Signed download, expiry, overwrite protection (direct checks against the bucket).
    await page.getByRole("button", { name: /^.*r2 clip/ }).first().click();
    const video = page.getByRole("dialog").locator("video");
    await video.waitFor({ timeout: 30000 });
    const signed = (await video.getAttribute("src"))!;
    check("Signed link is for the real bucket and private", signed.includes("r2.cloudflarestorage.com") && signed.includes("X-Amz-Signature"));
    check("Signed download works", (await fetch(signed, { method: "GET", headers: { range: "bytes=0-1023" } })).status < 300);
    const unsigned = signed.split("?")[0]!;
    check("The same object without a signature is refused", [400, 401, 403].includes((await fetch(unsigned)).status));
    const ttl = Number(/X-Amz-Expires=(\d+)/.exec(signed)?.[1] ?? 0);
    if (ttl && ttl <= 60) {
      await new Promise((r) => setTimeout(r, (ttl + 5) * 1000));
      check(`A signed link stops working after its ${ttl}s lifetime`, (await fetch(signed)).status === 403);
    } else check("Expired signed link (needs R2_SIGNED_URL_TTL_SECONDS=30 on the app)", false, `link lifetime is ${ttl}s`);
    const [orig] = await db<{ storage_key: string }[]>`select storage_key from media_assets where title ilike 'r2 clip%' order by created_at desc limit 1`;
    const over = await s3.fetch(`${R2}/${pathOf(orig!.storage_key)}`, { method: "PUT", headers: { "if-none-match": "*", "content-type": "video/mp4" }, body: "overwrite attempt" });
    check("An original can't be overwritten (conditional PUT refused)", over.status === 412, `HTTP ${over.status}`);
  } catch (e) {
    check("run", false, (e as Error).message.split("\n")[0]!.slice(0, 200));
  } finally {
    if (corsErrors.length) console.log(`Browser reported CORS errors, e.g.: ${corsErrors[0]}`);
    if (orgId) await cleanup(orgId).catch((e) => check("Clean-up", false, (e as Error).message));
    await browser.close();
    await db.end();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} of ${results.length} checks passed`);
  if (failed) process.exitCode = 1;
}
main();
