/*
  One-off: renders the placeholder Scene artwork (src/components/media/scene.tsx) to
  JPEG stills in supabase/seed/stills/. The demo seed turns these into short video
  clips with FFmpeg. Run after `npm run build` (it reuses the compiled CSS).
  Usage: npx tsx scripts/render-seed-stills.tsx
*/
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { SCENE_VARIANTS, Scene } from "../src/components/media/scene";

const cssDir = ".next/static/chunks";
const css = readdirSync(cssDir).filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(cssDir, f), "utf8")).join("\n");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  for (const v of SCENE_VARIANTS) {
    const html = renderToStaticMarkup(
      <div style={{ position: "relative", width: 1280, height: 720, overflow: "hidden" }}>
        <Scene variant={v} label={v} />
      </div>,
    );
    await page.setContent(`<!doctype html><html><head><style>${css}</style><style>body{margin:0}</style></head><body>${html}</body></html>`);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `supabase/seed/stills/${v}.jpg`, type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: 1280, height: 720 } });
    console.log("rendered", v);
  }
  await browser.close();
}
main();
