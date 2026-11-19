/*
  Screenshots of the LIVE customer pages (Mission 6) for the design review artifact
  (npm run review:live-shots). Runs against the app on the local stack (infra/local) with a new
  test account; nothing is sample data. Desktop 1440 and phone 390, Light Workspace, 2×.
    BASE_URL (default http://localhost:3000)  MAILPIT_URL  OUT (default .data/live-shots)
*/
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { chromium, type Page } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAIL = process.env.MAILPIT_URL ?? "http://localhost:8025";
const OUT = process.env.OUT ?? ".data/live-shots";
const shots: { file: string; label: string; vp: "desktop" | "mobile" }[] = [];

async function confirmLink(to: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const list = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
    if (list.messages?.[0]) {
      const msg = (await (await fetch(`${MAIL}/api/v1/message/${list.messages[0].ID}`)).json()) as { Text: string };
      const link = /(https?:\/\/[^\s"'<>]+auth\/callback[^\s"'<>]+)/.exec(msg.Text)?.[1];
      if (link) return link.replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no confirmation email");
}

async function shot(page: Page, file: string, label: string, vp: "desktop" | "mobile", full = true) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, file), fullPage: full, type: "jpeg", quality: 80 });
  shots.push({ file, label, vp });
  console.log(`✓ ${file}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), "rd-live-shots-"));
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x2038E2:size=400x400", "-frames:v", "1", join(dir, "logo.png")]);
  const email = `harbour-${Date.now()}@reeldeal.local`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/sign-up`);
  await page.getByLabel("Your name").fill("Mere Harbour");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("live-shots-password");
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/verify-email");
  await page.goto(await confirmLink(email));
  await page.waitForURL("**/onboarding?verified=1");
  await page.getByLabel("Business name").fill("Harbour Kitchen");
  await page.getByLabel("Industry").click();
  await page.getByRole("option", { name: "Food and drink" }).click();
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL("**/onboarding/setup**");
  await page.getByLabel("Brand name").fill("Harbour Kitchen");
  await page.getByRole("button", { name: "+ Add colour" }).click();
  await page.getByRole("button", { name: "Warm" }).click();
  await page.getByRole("button", { name: "Down-to-earth" }).click();
  await page.getByLabel("Who are your customers? (optional)").fill("Locals and visitors after a relaxed waterfront lunch");
  await shot(page, "m6-01-setup-brand-desktop.jpg", "Setup step 4: brand (live)", "desktop");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Step 5 of 7").waitFor();
  await page.getByLabel("Upload logo").setInputFiles(join(dir, "logo.png"));
  await page.getByText("Uploaded · choose another to replace it").first().waitFor({ timeout: 30000 });
  await shot(page, "m6-02-setup-assets-desktop.jpg", "Setup step 5: logo uploaded (live)", "desktop");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Step 6 of 7").waitFor();
  await shot(page, "m6-03-setup-preferences-desktop.jpg", "Setup step 6: preferences (live)", "desktop");
  await page.goto(`${BASE}/dashboard`);
  await page.getByText(/Finish setting up/).waitFor();
  await shot(page, "m6-04-dashboard-finish-setup-desktop.jpg", "Dashboard: finish setup card (U11, live)", "desktop", false);
  await page.getByRole("link", { name: "Continue setup" }).click();
  await page.getByText("Step 6 of 7").waitFor();
  await page.getByRole("button", { name: "Finish setup" }).click();
  await page.getByText(/You.re all/).waitFor();
  await shot(page, "m6-05-setup-done-desktop.jpg", "Setup step 7: done, with what was saved (live)", "desktop");

  for (const [path, file, label] of [
    ["/settings/workspace", "m6-06-workspace-desktop.jpg", "Workspace settings (live)"],
    ["/settings/billing", "m6-07-billing-desktop.jpg", "Usage and billing: Free, billing not set up (live)"],
    ["/settings/tokens", "m6-08-tokens-empty-desktop.jpg", "Access tokens: none yet (live)"],
  ] as const) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    await shot(page, file, label, "desktop");
  }
  await page.getByRole("button", { name: "Create token" }).first().click();
  await page.getByRole("dialog").getByLabel("Name").fill("Claude Desktop on my laptop");
  await page.getByRole("dialog").getByRole("button", { name: "Create token" }).click();
  await page.getByLabel("New access token").waitFor();
  // The token on screen belongs to a throwaway local account and is revoked straight after.
  await shot(page, "m6-09-token-created-desktop.jpg", "Token created: shown once (live, local test account)", "desktop", false);
  await page.getByRole("checkbox", { name: "I've stored this token somewhere safe" }).check();
  await page.getByRole("button", { name: "Done" }).click();
  await page.getByRole("button", { name: "Revoke" }).first().click();
  await page.getByRole("button", { name: "Revoke token" }).click();
  await page.waitForTimeout(1200);

  // Test setup only: Free has one seat, so the workspace moves to Business to show the team.
  const db = postgres(process.env.DATABASE_URL!, { max: 1 });
  await db`update public.organisations o set plan_id = 'business' from public.memberships m join auth.users u on u.id = m.user_id where m.org_id = o.id and u.email = ${email}`;
  await db.end();
  await page.goto(`${BASE}/settings/team`);
  await page.getByRole("button", { name: "Invite people" }).first().click();
  await page.getByLabel("Email addresses").fill("chef@harbourkitchen.example, front-of-house@harbourkitchen.example, not-an-email");
  await page.getByRole("dialog").getByRole("button", { name: "Create invitations" }).click();
  await page.getByText("2 invitations ready").waitFor();
  await shot(page, "m6-10-invite-results-desktop.jpg", "Invite results with copy link (live)", "desktop", false);
  await page.getByRole("button", { name: "Done" }).click();
  await page.waitForTimeout(800);
  await shot(page, "m6-11-team-desktop.jpg", "Team with pending invitations (live)", "desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, file, label] of [
    ["/settings/team", "m6-12-team-phone.jpg", "Team (live)"],
    ["/settings/workspace", "m6-13-workspace-phone.jpg", "Workspace settings (live)"],
    ["/settings/billing", "m6-14-billing-phone.jpg", "Usage and billing (live)"],
    ["/dashboard", "m6-15-dashboard-phone.jpg", "Dashboard after setup (live)"],
  ] as const) {
    await page.goto(`${BASE}${path}`);
    await page.waitForLoadState("networkidle");
    await shot(page, file, label, "mobile");
  }
  await browser.close();
  writeFileSync(join(OUT, "index.json"), JSON.stringify(shots, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
