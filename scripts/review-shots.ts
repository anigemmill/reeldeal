/*
  Screenshot pack for design review (npm run review:shots). Runs against a running app
  with the design review pages enabled (next dev, or next start with REELDEAL_DESIGN_REVIEW=1):
    BASE_URL (default http://localhost:3000)  OUT (default .data/review-shots)
  Captures each area at desktop (1440), tablet (834) and mobile (390), in Light Workspace
  and Dark Studio (Crossroads Blue), plus every onboarding step, key dialogs and the
  implemented auth and legal pages. Writes JPEGs at 2x and an index.json.
*/
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.OUT ?? ".data/review-shots";
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 834, height: 1112 }, mobile: { width: 390, height: 844 } } as const;
const THEMES = { light: "crossroads.workspace.a", dark: "crossroads.studio.a" } as const;
type V = keyof typeof VIEWPORTS;
type T = keyof typeof THEMES;
type Shot = { group: string; label: string; path: string; viewport: V; theme: T | "site"; full: boolean; file?: string };

const shots: Shot[] = [];
const all = (group: string, label: string, path: string) => {
  for (const viewport of Object.keys(VIEWPORTS) as V[]) for (const theme of Object.keys(THEMES) as T[]) shots.push({ group, label, path, viewport, theme, full: true });
};
all("Account settings", "Account", "/design-system/screens/account");
all("Workspace settings", "Workspace", "/design-system/screens/workspace");
all("Team management", "Team", "/design-system/screens/team");
all("Usage and billing", "Usage and billing", "/design-system/screens/billing");
all("Access tokens", "Access tokens", "/design-system/screens/tokens");
for (const step of ["account", "verify", "workspace", "business", "brand", "assets", "preferences", "done"]) {
  if (step === "business") all("Onboarding", `Step: ${step}`, `/design-system/screens/onboarding?step=${step}`);
  else for (const [viewport, theme] of [["desktop", "light"], ["mobile", "dark"]] as const) shots.push({ group: "Onboarding", label: `Step: ${step}`, path: `/design-system/screens/onboarding?step=${step}`, viewport, theme, full: true });
}
for (const [viewport, theme] of [["desktop", "light"], ["mobile", "dark"]] as const) shots.push({ group: "Onboarding", label: "Invitation waiting", path: "/design-system/screens/onboarding/invited", viewport, theme, full: true });
for (const [label, path] of [
  ["Invite people", "/design-system/screens/team?dialog=invite"],
  ["Transfer ownership", "/design-system/screens/team?dialog=transfer"],
  ["Create token", "/design-system/screens/tokens?dialog=create"],
  ["Token created (shown once)", "/design-system/screens/tokens?dialog=created"],
  ["Delete workspace", "/design-system/screens/workspace?dialog=delete"],
] as const)
  for (const [viewport, theme] of [["desktop", "light"], ["mobile", "dark"]] as const) shots.push({ group: "Dialogs", label, path, viewport, theme, full: false });
for (const [label, path] of [
  ["Sign-up (with Terms consent)", "/sign-up"],
  ["Check your inbox", "/verify-email"],
  ["Expired or used link", "/verify-email?link=invalid"],
  ["Terms of Service (placeholder)", "/terms"],
  ["Privacy Policy (placeholder)", "/privacy"],
] as const)
  for (const viewport of ["desktop", "mobile"] as const) shots.push({ group: "Implemented: sign-up, verification, legal", label, path, viewport, theme: "site", full: true });

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems: string[] = [];
  for (const [n, s] of shots.entries()) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[s.viewport], deviceScaleFactor: 2, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const sep = s.path.includes("?") ? "&" : "?";
    await page.goto(`${BASE}${s.path}${s.theme === "site" ? "" : `${sep}theme=${THEMES[s.theme]}`}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(s.full ? 600 : 900);
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) problems.push(`horizontal scroll: ${s.label} ${s.viewport} ${s.theme}`);
    s.file = `${String(n + 1).padStart(3, "0")}-${s.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${s.viewport}-${s.theme}.jpg`;
    await page.screenshot({ path: join(OUT, s.file), fullPage: s.full, type: "jpeg", quality: 80 });
    await ctx.close();
    process.stdout.write(".");
  }
  await browser.close();
  writeFileSync(join(OUT, "index.json"), JSON.stringify({ base: BASE, takenAt: new Date().toISOString(), viewports: VIEWPORTS, shots }, null, 2));
  console.log(`\n${shots.length} screenshots in ${OUT}`);
  if (problems.length) {
    console.log(problems.join("\n"));
    process.exitCode = 1;
  }
}
main();
