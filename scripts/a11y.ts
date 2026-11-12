/*
  Accessibility checks in a real browser (npm run test:a11y).

  1. axe-core (WCAG 2.2 A/AA, incl. colour contrast) on every Phase 1 screen in
     every palette × mode with type A, plus types B and C in Crossroads Blue.
  2. Keyboard paths: modal focus trap / Esc / focus return, tabs, Autopilot
     option radiogroup, Studio playhead slider.
  3. Reduced motion: homepage motion stops.

  Needs a production build (npm run build). Starts `next start` itself with the
  review flag on, unless BASE_URL points at a running server.
*/
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { MODES, PALETTES, serializeTheme, THEME_COOKIE, type Theme } from "../src/lib/theme";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const PORT = 3999;
let BASE = process.env.BASE_URL ?? "";
let server: ChildProcess | undefined;
const stopServer = () => {
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {}
  }
};

const THEMES: Theme[] = [
  ...PALETTES.flatMap((p) => MODES.map((m) => ({ palette: p.id, mode: m.id, type: "a" as const }))),
  { palette: "crossroads", mode: "workspace", type: "b" },
  { palette: "crossroads", mode: "workspace", type: "c" },
];
const APP_PAGES = ["/dashboard", "/autopilot", "/autopilot?step=review", "/studio", "/settings/appearance"];

async function startServer() {
  if (BASE) return;
  BASE = `http://localhost:${PORT}`;
  // Own process group, so stopping it also stops the Next.js server child.
  server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(PORT)], {
    env: { ...process.env, REELDEAL_DESIGN_REVIEW: "1" },
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server did not start. Run `npm run build` first.");
}

type Finding = { page: string; theme: string; rule: string; impact: string; target: string; summary: string };
const findings: Finding[] = [];
const failures: string[] = [];

async function axe(page: Page, label: string, theme: string) {
  await page.addScriptTag({ content: AXE });
  const result = await page.evaluate(async () => {
    // @ts-expect-error axe is injected above
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
    return r.violations.map((v: { id: string; impact: string; nodes: { target: string[]; failureSummary: string }[] }) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 3).map((n) => ({ target: n.target.join(" "), summary: n.failureSummary.split("\n").slice(1, 2).join(" ").trim() })),
    }));
  });
  for (const v of result) for (const n of v.nodes) findings.push({ page: label, theme, rule: v.id, impact: v.impact, target: n.target, summary: n.summary });
}

async function load(ctx: BrowserContext, path: string) {
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures.push(name);
}

async function axeAll(browser: Browser) {
  for (const theme of THEMES) {
    const key = serializeTheme(theme);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await ctx.addCookies([{ name: THEME_COOKIE, value: key, url: BASE }]);
    for (const path of APP_PAGES) {
      const page = await load(ctx, path);
      await axe(page, path, key);
      await page.close();
    }
    // The live homepage is always Crossroads; other palettes via the review route.
    const home = await load(ctx, theme.palette === "crossroads" && theme.mode === "workspace" && theme.type === "a" ? "/" : `/design-system/screens/home?theme=${key}`);
    if (!home.url().endsWith("/")) await home.evaluate(() => document.body.querySelector(":scope > header")?.remove());
    await axe(home, "/ (home)", key);
    await home.close();
    await ctx.close();
    process.stdout.write(".");
  }
  // Mobile layouts (Crossroads, type A)
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  for (const path of ["/", "/dashboard", "/autopilot", "/studio"]) {
    const page = await load(m, path);
    await axe(page, `${path} (390px)`, "crossroads.workspace.a");
    await page.close();
  }
  await m.close();
  console.log();
}

async function keyboard(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // Modal: focus moves in, stays in, Esc closes, focus returns.
  let page = await load(ctx, "/design-system");
  const trigger = page.getByRole("button", { name: "Open modal" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("[role=dialog]");
  const inDialog = () => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"));
  check("Modal: focus moves into the dialog", await inDialog());
  for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
  check("Modal: focus is trapped", await inDialog());
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { state: "detached" });
  check("Modal: Esc closes and returns focus", await trigger.evaluate((el) => el === document.activeElement));

  // Tabs: arrow keys move selection.
  await page.getByRole("tab", { name: "Moments" }).focus();
  await page.keyboard.press("ArrowRight");
  const scenes = page.getByRole("tab", { name: "Scenes" });
  await scenes.and(page.locator('[aria-selected="true"]')).waitFor({ timeout: 2000 }).catch(() => {});
  check("Tabs: arrow key selects next tab", (await scenes.getAttribute("aria-selected")) === "true");
  await page.close();

  // Autopilot: option radiogroup.
  page = await load(ctx, "/autopilot?step=review");
  await page.getByRole("radio", { checked: true }).focus();
  await page.keyboard.press("ArrowRight");
  check("Autopilot: arrow key picks the next option", (await page.getByRole("radio", { name: /2 · Energetic/ }).getAttribute("aria-checked")) === "true");
  await page.close();

  // Studio: playhead slider and clip buttons.
  page = await load(ctx, "/studio");
  const slider = page.getByRole("slider", { name: "Playhead" });
  await slider.focus();
  await page.keyboard.press("End");
  check("Studio: End moves the playhead to the end", (await slider.getAttribute("aria-valuenow")) === "30");
  await page.keyboard.press("Shift+ArrowLeft");
  check("Studio: Shift+Left steps back 5s", (await slider.getAttribute("aria-valuenow")) === "25");
  await page.getByRole("button", { name: /^Shot 2:/ }).focus();
  await page.keyboard.press("Enter");
  check("Studio: Enter on a clip selects it", (await page.getByRole("button", { name: /^Shot 2:/ }).getAttribute("aria-pressed")) === "true");
  await page.close();
  await ctx.close();
}

async function reducedMotion(browser: Browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await load(ctx, "/");
  const t = () => page.$eval("figure", (f) => (f as HTMLElement).style.transform);
  const a = await t();
  await page.waitForTimeout(900);
  check("Reduced motion: hero slider stays still", a === (await t()));
  const animated = await page.$$eval(".rd-motion", (els) => els.filter((e) => getComputedStyle(e).animationName !== "none").length);
  check("Reduced motion: no CSS animations running", animated === 0, `${animated} animated`);
  check("Reduced motion: no pause control offered (nothing moves)", (await page.getByRole("button", { name: /motion/ }).count()) === 0);
  await ctx.close();
}

async function main() {
  await startServer();
  const browser = await chromium.launch();
  try {
    console.log(`axe: ${THEMES.length} theme sets × ${APP_PAGES.length + 1} screens, plus 4 mobile layouts`);
    await axeAll(browser);
    const byRule = new Map<string, Finding[]>();
    for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) ?? []), f]);
    if (byRule.size === 0) console.log("✓ axe: no WCAG 2.2 A/AA violations");
    for (const [rule, list] of byRule) {
      failures.push(`axe ${rule}`);
      console.log(`✗ axe ${rule} (${list[0].impact}): ${list.length} occurrence(s)`);
      for (const f of list.slice(0, 6)) console.log(`    ${f.page} [${f.theme}] ${f.target} — ${f.summary}`);
    }
    await keyboard(browser);
    await reducedMotion(browser);
  } finally {
    await browser.close();
    stopServer();
  }
  if (failures.length) {
    console.error(`\n${failures.length} accessibility check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll accessibility checks passed");
}

main().catch((e) => {
  stopServer();
  console.error(e);
  process.exit(1);
});
