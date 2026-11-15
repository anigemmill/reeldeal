/*
  End-to-end customer journey in a real browser (npm run test:e2e).

  Runs against a running app connected to real local services:
    npm run stack:up                 Supabase Postgres + Auth, S3-compatible storage, mail catcher
    (env from infra/local/stack.env) npm run db:migrate, npm run worker, and
    AI_PROVIDER=fixture npm run dev  (or next start on a build)
  BASE_URL defaults to http://localhost:3000; MAILPIT_URL to http://localhost:8025.

  Everything is real (Supabase Auth, Postgres with RLS, signed uploads to S3, the
  FFmpeg worker, rendering, signed downloads) EXCEPT the creative AI, which uses
  the labelled fixture provider so no paid calls are made. Also runs axe-core on
  the signed-in pages.
*/
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAIL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const results: { name: string; ok: boolean; note?: string }[] = [];
const check = (name: string, ok: boolean, note?: string) => {
  results.push({ name, ok, note });
  console.log(`${ok ? "✓" : "✗"} ${name}${note ? ` (${note})` : ""}`);
};
const run = async (name: string, fn: () => Promise<void>) => {
  try {
    await fn();
  } catch (e) {
    check(name, false, (e as Error).message.split("\n")[0]!.slice(0, 200));
    await shot?.(name).catch(() => {});
  }
};

const dir = mkdtempSync(join(tmpdir(), "rd-e2e-"));
let shot: ((name: string) => Promise<void>) | null = null;
const ff = (args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
function makeMedia() {
  ff(["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8", "-f", "lavfi", "-i", "sine=frequency=330:duration=8", "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-shortest", join(dir, "lake_morning.mp4")]);
  ff(["-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=12", "-f", "lavfi", "-i", "sine=frequency=440:duration=12", "-vf", "noise=alls=40:allf=t+u", "-c:v", "libx264", "-preset", "ultrafast", "-b:v", "100M", "-maxrate", "100M", "-bufsize", "100M", "-c:a", "aac", "-shortest", join(dir, "drone_ridge.mp4")]);
  ff(["-f", "lavfi", "-i", "testsrc2=size=800x600", "-frames:v", "1", join(dir, "logo.png")]);
  writeFileSync(join(dir, "broken_clip.mp4"), Buffer.alloc(300_000, 7)); // not a video: analysis must fail
  writeFileSync(join(dir, "notes.txt"), "not media");
  ff(["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=6", "-c:v", "libx264", "-preset", "veryfast", join(dir, "doomed_clip.mp4")]);
}

async function axe(page: Page, label: string) {
  await page.addScriptTag({ content: AXE });
  const v = (await page.evaluate(async () => {
    // @ts-expect-error injected
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return r.violations.map((x: { id: string; nodes: { target: string[] }[] }) => `${x.id} @ ${x.nodes[0]?.target.join(" ")}`);
  })) as string[];
  check(`axe: ${label}`, v.length === 0, v.slice(0, 3).join("; "));
}

const settle = (page: Page) => page.waitForTimeout(1200);
async function signUp(ctx: BrowserContext, name: string, email: string, business: string) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-up`);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/onboarding", { timeout: 30000 });
  await settle(page);
  await page.getByLabel("Business name").fill(business);
  await page.getByLabel("Industry").click();
  await page.getByRole("option", { name: "Accommodation" }).click();
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL("**/dashboard**", { timeout: 30000 });
  return page;
}

async function main() {
  makeMedia();
  const browser = await chromium.launch();
  const stamp = Date.now();
  const emailA = `e2e-a-${stamp}@reeldeal.local`;
  const emailB = `e2e-b-${stamp}@reeldeal.local`;
  const A = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, reducedMotion: "reduce" });
  let page = await A.newPage();
  shot = async (name) => {
    await page.screenshot({ path: join(dir, `fail-${name.replace(/\W+/g, "-")}.png`) });
    console.log(`  screenshot: ${join(dir, `fail-${name.replace(/\W+/g, "-")}.png`)}`);
  };
  let projectA = "";
  let brandA = "";
  let exportUrlA = "";

  /* ---- authentication ---- */
  await run("auth", async () => {
    await page.goto(`${BASE}/dashboard`);
    check("Signed-out visit to /dashboard redirects to sign-in", page.url().includes("/sign-in?next=%2Fdashboard"));
    await settle(page);
    await page.getByLabel("Email").fill("nobody@reeldeal.local");
    await page.getByLabel("Password").fill("wrong-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByText("That email and password don't match an account.").waitFor({ timeout: 10000 });
    check("Invalid credentials show a clear error", true);

    await page.goto(`${BASE}/sign-up`);
    await settle(page);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByText("Enter your name.").waitFor({ timeout: 10000 });
    check("Sign-up validates required fields", true);
    await page.close();

    page = await signUp(A, "Ana Example", emailA, "E2E Lakeside");
    check("Register and complete onboarding lands on the dashboard", page.url().includes("/dashboard"));
    const eyebrow = await page.getByText(/E2E Lakeside · Free plan/i).first().waitFor({ timeout: 15000 }).then(() => true, () => false);
    check("Dashboard shows the new workspace and plan", eyebrow);
    await axe(page, "/dashboard (new workspace)");

    const second = await A.newPage();
    await second.goto(`${BASE}/library`);
    check("Session persists across pages", second.url().endsWith("/library"));
    await second.close();

    await page.getByRole("button", { name: "Sign out" }).first().click();
    await page.waitForURL("**/sign-in?signed_out=1");
    await page.goto(`${BASE}/dashboard`);
    check("After sign-out the app is protected again", page.url().includes("/sign-in"));
    await settle(page);
    await page.getByLabel("Email").fill(emailA);
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/dashboard**");
    check("Sign in with the new account", true);

    // Expired / tampered session cookie.
    const X = await browser.newContext();
    const cookies = (await A.cookies()).filter((c) => c.name.startsWith("sb-"));
    await X.addCookies(cookies.map((c) => ({ ...c, value: "base64-eyJhY2Nlc3NfdG9rZW4iOiJleHBpcmVkIn0" })));
    const xp = await X.newPage();
    await xp.goto(`${BASE}/dashboard`);
    check("An invalid or expired session redirects to sign-in with a notice", xp.url().includes("expired=1"));
    await X.close();
  });

  /* ---- password reset (email via the local mail catcher) ---- */
  await run("password reset", async () => {
    const R = await browser.newContext();
    const rp = await R.newPage();
    await rp.goto(`${BASE}/forgot-password`);
    await settle(rp);
    await rp.getByLabel("Email").fill(emailA);
    await rp.getByRole("button", { name: "Send reset link" }).click();
    await rp.getByText(/we've sent a link/).waitFor({ timeout: 10000 });
    let link = "";
    for (let i = 0; i < 20 && !link; i++) {
      const list = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${emailA}`)}`)).json()) as { messages: { ID: string }[] };
      if (list.messages?.[0]) {
        const msg = (await (await fetch(`${MAIL}/api/v1/message/${list.messages[0].ID}`)).json()) as { HTML: string; Text: string };
        link = (/(https?:\/\/[^\s"'<>]+verify[^\s"'<>]+)/.exec(msg.Text || msg.HTML)?.[1] ?? "").replace(/&amp;/g, "&");
      }
      if (!link) await rp.waitForTimeout(500);
    }
    check("Password reset email is sent", Boolean(link));
    await rp.goto(link);
    await rp.waitForURL("**/reset-password", { timeout: 15000 });
    await settle(rp);
    await rp.getByLabel("New password").fill("new-correct-horse-battery");
    await rp.getByRole("button", { name: "Save new password" }).click();
    await rp.waitForURL("**/dashboard**", { timeout: 15000 });
    check("Reset link signs in and the new password is saved", true);
    await R.close();
    const S = await browser.newContext();
    const sp = await S.newPage();
    await sp.goto(`${BASE}/sign-in`);
    await settle(sp);
    await sp.getByLabel("Email").fill(emailA);
    await sp.getByLabel("Password").fill("new-correct-horse-battery");
    await sp.getByRole("button", { name: "Sign in" }).click();
    await sp.waitForURL("**/dashboard**", { timeout: 15000 });
    check("Sign in with the new password", true);
    await S.close();
    // Changing the password ends other sessions: the first browser must sign in again.
    await page.goto(`${BASE}/library`);
    check("Other sessions end after a password change", page.url().includes("/sign-in"));
    await settle(page);
    await page.getByLabel("Email").fill(emailA);
    await page.getByLabel("Password").fill("new-correct-horse-battery");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/library**", { timeout: 15000 });
  });

  /* ---- media library ---- */
  await run("media", async () => {
    await page.goto(`${BASE}/library`);
    await page.waitForTimeout(2500);
    await axe(page, "/library (empty)");
    await page.locator("input[type=file]").setInputFiles([join(dir, "lake_morning.mp4"), join(dir, "drone_ridge.mp4"), join(dir, "logo.png"), join(dir, "broken_clip.mp4"), join(dir, "notes.txt")]);
    const panel = page.locator("#uploads-title").locator("xpath=../..");
    await panel.getByText(/isn't supported/).waitFor({ timeout: 10000 });
    check("Unsupported file types are rejected before upload", true);
    for (let i = 0; i < 120 && !/4 of 5 done/.test(await panel.innerText()); i++) await page.waitForTimeout(1000);
    const p = await panel.innerText();
    check("Four files upload (incl. a 150 MB multipart upload)", /4 of 5 done/.test(p), p.match(/\d+ of \d+ done[^\n]*/)?.[0]);
    const grid = page.getByLabel("Media");
    for (let i = 0; i < 90; i++) {
      const t = await grid.innerText();
      if (!/Analysing|Queued|Uploading/.test(t)) break;
      await page.waitForTimeout(2000);
    }
    const t = await grid.innerText();
    check("Videos are analysed by the worker (quality scores shown)", /lake morning/.test(t) && /\b\d{2,3}\b/.test(t));
    check("A file that is not a real video shows Analysis failed", /Analysis failed/.test(t));
    await page.getByRole("searchbox").fill("drone");
    await page.waitForTimeout(1500);
    const s = await grid.innerText();
    check("Search finds footage by title", /drone ridge/.test(s) && !/lake morning/.test(s));
    await page.getByRole("searchbox").fill("");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /^lake morning/ }).first().click();
    await page.getByRole("dialog").getByText(/Quality \d+\/100/).waitFor({ timeout: 15000 });
    check("Asset details show real metadata and analysis", /1280×720/.test(await page.getByRole("dialog").innerText()));
    await axe(page, "/library media detail");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 5000 });
    check("Keyboard: Escape closes the media details", true);
    const item = page.getByRole("button", { name: /^lake morning/ }).first();
    await item.focus();
    await page.keyboard.press("Enter");
    check("Keyboard: Enter on a library item opens its details", await page.getByRole("dialog").isVisible({ timeout: 5000 }));
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Upload" }).focus();
    const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), page.keyboard.press("Enter")]);
    check("Keyboard: Upload opens the file chooser", chooser.isMultiple());
  });

  /* ---- brand ---- */
  await run("brand", async () => {
    await page.goto(`${BASE}/brands`);
    await settle(page);
    await page.locator("main").getByRole("link", { name: /E2E Lakeside/ }).click();
    await page.waitForURL("**/brands/*");
    brandA = page.url().split("/brands/")[1]!;
    await settle(page);
    await page.getByLabel("Brand voice").fill("Warm and calm.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText(/Saved as version 2/).first().waitFor({ timeout: 10000 });
    check("Brand edits save as a new brand version", true);
    await axe(page, "/brands/[id]");
  });

  /* ---- Autopilot → render → download ---- */
  await run("autopilot", async () => {
    await page.goto(`${BASE}/autopilot?brief=${encodeURIComponent("A calm summer morning on the lake. Push direct bookings.")}`);
    await page.waitForTimeout(2500);
    await axe(page, "/autopilot (brief)");
    await page.getByLabel("Your analysed footage").getByRole("button").first().click();
    await page.getByRole("button", { name: /Create 3 concepts/ }).first().click();
    await page.waitForURL("**/autopilot?project=*", { timeout: 60000 });
    projectA = new URL(page.url()).searchParams.get("project")!;
    await page.getByRole("heading", { name: "Scenes" }).waitFor({ timeout: 30000 });
    check("Autopilot creates a brief, concepts and a saved storyboard", (await page.getByRole("radio").count()) === 3);
    await axe(page, "/autopilot (review)");
    await page.getByRole("button", { name: "Approve and render" }).click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    check("Render quote shows the credit cost and balance before anything starts", /This uses 1 video credit\. You have 2\./.test(await dlg.innerText()));
    await dlg.getByRole("button", { name: /Render · 1 credit/ }).click();
    await page.getByText(/Rendering|Queued/).first().waitFor({ timeout: 15000 });
    await page.getByText("Your video is ready").waitFor({ timeout: 240000 });
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), page.getByRole("button", { name: /Download .* MP4/ }).first().click()]);
    exportUrlA = download.url();
    const buf = readFileSync((await download.path())!);
    check("The rendered MP4 downloads through a signed link", buf.subarray(4, 8).toString() === "ftyp" && buf.length > 100_000, `${(buf.length / 1e6).toFixed(1)} MB`);
    await page.goto(`${BASE}/dashboard`);
    await settle(page);
    check("Credits drop by exactly one after a successful render", /Videos\s*1 of 2 left/.test(await page.getByLabel("Usage").first().innerText()));
  });

  /* ---- Studio ---- */
  await run("studio", async () => {
    await page.goto(`${BASE}/studio?project=${projectA}`);
    await page.waitForTimeout(2500);
    const header = await page.locator("header").first().innerText();
    const before = Number(/storyboard v(\d+)/.exec(header)?.[1]);
    await page.getByRole("button", { name: /^Scene 1,/ }).click();
    await page.getByLabel("On-screen text").fill("Slow mornings");
    await page.getByRole("button", { name: /Save as version/ }).click();
    await page.getByText(/Saved as version \d+/).first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const after = Number(/storyboard v(\d+)/.exec(await page.locator("header").first().innerText())?.[1]);
    check("Studio saves edits as a new storyboard version", after === before + 1, `v${before} → v${after}`);
    await axe(page, "/studio (Dark Studio)");
  });

  /* ---- failure recovery ---- */
  await run("recovery: uploads", async () => {
    await page.goto(`${BASE}/library`);
    await page.waitForTimeout(2500);
    // Network failure during upload: the file is marked failed, and Retry finishes it.
    await page.route(/127\.0\.0\.1:9000|r2\.cloudflarestorage\.com/, (r) => (r.request().method() === "PUT" ? r.abort("failed") : r.continue()));
    await page.locator("input[type=file]").setInputFiles(join(dir, "lake_morning.mp4"));
    const panel = page.locator("#uploads-title").locator("xpath=../..");
    await panel.getByText(/Failed: /).waitFor({ timeout: 30000 });
    check("A network failure during upload is reported (not silent)", true);
    await page.unroute(/127\.0\.0\.1:9000|r2\.cloudflarestorage\.com/);
    await panel.getByRole("button", { name: "Retry" }).first().click();
    await panel.getByText(/1 of 1 done|Analysing|Uploaded/).first().waitFor({ timeout: 60000 });
    check("Retry completes the upload after the network recovers", true);
    // Interrupted upload (page closed mid-upload): shown as interrupted, and can be removed.
    await page.route(/127\.0\.0\.1:9000|r2\.cloudflarestorage\.com/, () => {
      /* never answer: the upload hangs */
    });
    await page.locator("input[type=file]").setInputFiles(join(dir, "drone_ridge.mp4"));
    await panel.getByText(/Uploading/).first().waitFor({ timeout: 15000 });
    await page.unroute(/127\.0\.0\.1:9000|r2\.cloudflarestorage\.com/);
    await page.reload();
    await page.waitForTimeout(2500);
    const grid = page.getByLabel("Media");
    check("An upload interrupted by leaving the page is shown as interrupted", /Upload interrupted/.test(await grid.innerText()));
    page.once("dialog", (d) => void d.accept());
    await grid.getByRole("button", { name: /drone ridge/ }).filter({ hasText: /Upload interrupted/ }).first().click();
    await page.getByRole("button", { name: "Remove unfinished upload" }).click();
    await page.waitForTimeout(2000);
    check("The interrupted upload can be removed", !/Upload interrupted/.test(await grid.innerText()));
  });

  await run("recovery: AI failure", async () => {
    await page.goto(`${BASE}/autopilot?brief=${encodeURIComponent("[simulate-ai-failure] Spring offer for families")}`);
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /Create 3 concepts/ }).first().click();
    await page.getByRole("alert").filter({ hasText: /AI service didn.t respond/ }).waitFor({ timeout: 30000 });
    check("A failed AI request shows a clear error and stops (nothing charged)", /Nothing was charged/.test(await page.locator("main").innerText()));
    check("The failed stage offers Try again", await page.getByRole("button", { name: "Try again" }).isVisible());
    await page.getByRole("button", { name: "Back to brief" }).click();
    check("Going back keeps the brief text", (await page.getByLabel("Describe it").inputValue()).includes("Spring offer for families"));
  });

  await run("recovery: failed render, insufficient credits, duplicate confirm", async () => {
    // Make a project whose footage then disappears from storage: the render must fail without charging.
    const { default: postgres } = await import("postgres");
    const { AwsClient } = await import("aws4fetch");
    const db = postgres(process.env.DATABASE_URL!, { max: 1 });
    const creditsText = async () => {
      await page.goto(`${BASE}/dashboard`);
      await settle(page);
      return /Videos \d+ of \d+ left/.exec((await page.getByLabel("Usage").first().innerText()).replace(/\s+/g, " "))?.[0] ?? "";
    };
    const before = await creditsText();
    await page.goto(`${BASE}/library`);
    await page.waitForTimeout(2000);
    await page.locator("input[type=file]").setInputFiles(join(dir, "doomed_clip.mp4"));
    await page.waitForTimeout(3000);
    for (let i = 0; i < 60 && /Analysing|Queued|Uploading/.test(await page.getByLabel("Media").innerText()); i++) await page.waitForTimeout(2000);
    await page.goto(`${BASE}/autopilot?brief=${encodeURIComponent("Doomed render test video for the lake")}`);
    await page.waitForTimeout(2500);
    await page.getByLabel("Your analysed footage").getByRole("button", { name: "doomed clip" }).click();
    await page.getByRole("button", { name: /Create 3 concepts/ }).first().click();
    await page.waitForURL("**/autopilot?project=*", { timeout: 60000 });
    const doomed = new URL(page.url()).searchParams.get("project")!;
    await page.getByRole("heading", { name: "Scenes" }).waitFor({ timeout: 30000 });
    // Only the doomed clip is removed (no other project uses it).
    const keys = await db<{ storage_key: string }[]>`select m.storage_key from project_media pm join media_assets m on m.id = pm.media_id where pm.project_id = ${doomed} and m.title = 'doomed clip'`;
    const s3 = new AwsClient({ accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" });
    for (const k of keys) await s3.fetch(`${process.env.R2_ENDPOINT}/${process.env.R2_BUCKET}/${k.storage_key}`, { method: "DELETE" });
    await page.getByRole("button", { name: "Approve and render" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Render · / }).click();
    await page.getByText(/The render failed\. You were not charged\./).waitFor({ timeout: 120000 });
    const failText = await page.locator("main").innerText();
    check("A render with footage missing from storage names the clip and the fix", /"doomed clip" is missing from storage\. Replace it in Studio/.test(failText));
    check("…and doesn't offer a retry that can't succeed", !(await page.getByRole("button", { name: "Retry free" }).isVisible()));
    check("…and is not charged", (await creditsText()) === before, before);

    // Duplicate confirmation: a double click starts one render and charges once.
    await page.goto(`${BASE}/autopilot?project=${projectA}`);
    await page.getByRole("heading", { name: "Scenes" }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /Approve and render|Render again/ }).click();
    const confirm = page.getByRole("dialog").getByRole("button", { name: /Render · / });
    await confirm.dblclick();
    await page.getByText("Your video is ready").waitFor({ timeout: 240000 });
    const [{ n }] = await db<{ n: number }[]>`select count(*)::int as n from jobs where project_id = ${projectA} and kind = 'render'`;
    check("Double-clicking confirm starts one render", n === 2, `${n} render jobs for the project`);
    check("…and charges one credit", /Videos 0 of 2 left/.test(await creditsText()));

    // No credits left: the quote says so and confirming is impossible.
    await page.goto(`${BASE}/autopilot?project=${projectA}`);
    await page.getByRole("heading", { name: "Scenes" }).waitFor({ timeout: 30000 });
    await page.getByRole("button", { name: /Approve and render|Render again/ }).click();
    const dlg = page.getByRole("dialog");
    await dlg.getByText("Not enough credits for this render.").waitFor({ timeout: 10000 });
    check("With no credits left the quote explains and Render is disabled", await dlg.getByRole("button", { name: /Render · / }).isDisabled());
    await page.keyboard.press("Escape");
    await db.end();
  });

  /* ---- isolation: a second customer ---- */
  await run("isolation", async () => {
    const B = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const pb = await signUp(B, "Ben Other", emailB, "Other Cafe");
    await pb.goto(`${BASE}/library`);
    await settle(pb);
    check("Another workspace's library is empty", /library is empty/i.test(await pb.locator("main").innerText()));
    // Pages stream inside Suspense, so not-found arrives as the page content (and data never leaks).
    const notFoundShown = async () => /This isn.t available|could not be found/i.test(await pb.locator("body").innerText());
    await pb.goto(`${BASE}/studio?project=${projectA}`);
    await settle(pb);
    check("Opening another workspace's project shows not found", await notFoundShown());
    await pb.goto(`${BASE}/brands/${brandA}`);
    await settle(pb);
    check("Opening another workspace's brand shows not found", await notFoundShown());
    await pb.goto(`${BASE}/autopilot?project=${projectA}`);
    await settle(pb);
    check("Another workspace's project can't be loaded in Autopilot", /Project not found|not found/i.test(await pb.locator("main").innerText()));
    await pb.goto(`${BASE}/exports`);
    await settle(pb);
    check("Another workspace sees no exports", /No exports yet/.test(await pb.locator("main").innerText()));
    await pb.goto(`${BASE}/dashboard`);
    await settle(pb);
    check("Credit balances are separate (the new workspace still has 2 of 2)", /Videos\s*2 of 2 left/.test(await pb.getByLabel("Usage").first().innerText()));
    // A signed link only opens the one object it was signed for: pointing it at another
    // workspace's storage path is refused.
    if (exportUrlA) {
      const foreign = exportUrlA.replace(/org\/[0-9a-f-]{36}\//, "org/00000000-0000-4000-8000-000000000000/");
      check("A signed download link can't be redirected to another workspace's files", (await fetch(foreign)).status === 403);
    }
    await pb.goto(`${BASE}/settings/appearance`);
    await settle(pb);
    await axe(pb, "/settings/appearance");
    await B.close();
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
