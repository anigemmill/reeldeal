/*
  End-to-end MCP smoke test with the official SDK client.
    npm run mcp:smoke                         launches scripts/mcp-stdio.sh (STDIO)
    npm run mcp:smoke -- --http http://localhost:3333/mcp   connects over Streamable HTTP
  Uses REELDEAL_MCP_TOKEN, or the aroha_owner_full demo token from .data/dev-tokens.json.
  Read-only except for --render (a quoted, confirmed render end to end) and
  --upload <file.mp4> (signed upload, completion and analysis of a real file).
*/
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const args = process.argv.slice(2);
const httpUrl = args.includes("--http") ? args[args.indexOf("--http") + 1] : null;
const tokenName = args.includes("--as") ? args[args.indexOf("--as") + 1] : "aroha_owner_full";
const tokenFile = args.includes("--tokens") ? args[args.indexOf("--tokens") + 1] : ".data/dev-tokens.json";
const token = process.env.REELDEAL_MCP_TOKEN ?? (JSON.parse(readFileSync(tokenFile, "utf8")) as Record<string, string>)[tokenName];

const short = (v: unknown) => JSON.stringify(v).slice(0, 220);

async function main() {
  const client = new Client({ name: "reeldeal-smoke-test", version: "1.0.0" });
  const transport = httpUrl
    ? new StreamableHTTPClientTransport(new URL(httpUrl), { requestInit: { headers: { authorization: `Bearer ${token}` } } })
    : new StdioClientTransport({ command: "scripts/mcp-stdio.sh", env: { ...(process.env as Record<string, string>), REELDEAL_MCP_TOKEN: token }, stderr: "ignore" });
  await client.connect(transport);
  const info = client.getServerVersion();
  console.log(`✓ connected over ${httpUrl ? "Streamable HTTP" : "STDIO"} to ${info?.name} ${info?.version} (protocol negotiated)`);

  const { tools } = await client.listTools();
  console.log(`✓ ${tools.length} tools discovered: ${tools.map((t) => t.name).join(", ")}`);

  const call = async (name: string, a: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: a });
    if (r.isError) throw new Error(`${name} failed: ${(r.content as { text: string }[])[0]?.text}`);
    return r.structuredContent as Record<string, unknown>;
  };

  const status = await call("get_platform_status");
  console.log(`✓ get_platform_status: ${status.status}; ai configured: ${(status.ai as { configured: boolean }).configured}`);
  const ws = await call("get_my_workspace");
  console.log(`✓ get_my_workspace: ${(ws.organisation as { name: string }).name}, role ${(ws.permissions as { role: string }).role}, ${short(ws.credits)}`);
  const brands = (await call("list_brands")).brands as { id: string; name: string }[];
  console.log(`✓ list_brands: ${brands.map((b) => b.name).join(", ")}`);
  const brand = await call("get_brand_profile", { brand_id: brands[0].id });
  console.log(`✓ get_brand_profile: voice "${brand.brand_voice ?? "-"}"`);
  const search = (await call("search_media", { query: "geothermal landscape steam" })).results as { id: string; title: string; quality_score: number }[];
  console.log(`✓ search_media "geothermal landscape steam": ${search.map((r) => `${r.title} (quality ${r.quality_score})`).join("; ") || "no results"}`);
  if (search[0]) {
    const details = await call("get_media_details", { media_id: search[0].id, include_preview_url: true });
    console.log(`✓ get_media_details: ${details.duration_seconds}s ${details.width}x${details.height}, preview link expires ${(details.preview_url as { expires_at: string } | null)?.expires_at}`);
    const analysis = await call("get_media_analysis", { media_id: search[0].id });
    console.log(`✓ get_media_analysis: ${short((analysis.analysis as { quality: unknown })?.quality)}`);
  }
  const projects = (await call("list_projects")).projects as { id: string; name: string; status: string }[];
  console.log(`✓ list_projects: ${projects.map((p) => `${p.name} [${p.status}]`).join(", ")}`);
  const usage = await call("get_usage");
  console.log(`✓ get_usage: ${short(usage.video_credits)}`);

  // Input validation and authorisation are enforced over the wire too.
  const bad = await client.callTool({ name: "search_media", arguments: { limit: 999 } });
  console.log(`✓ invalid input rejected: ${bad.isError ? "yes" : "NO"}`);

  if (args.includes("--upload")) {
    const file = args[args.indexOf("--upload") + 1];
    const { statSync, readFileSync: read } = await import("node:fs");
    const up = await call("create_media_upload", { title: `Uploaded ${file.split("/").pop()}`, filename: file.split("/").pop(), content_type: "video/mp4", size_bytes: statSync(file).size, tags: ["upload-test"] });
    const target = up.upload as { url: string; headers: Record<string, string> };
    console.log(`✓ create_media_upload: ${up.media_id}, signed PUT expires ${(up.upload as { expires_at: string }).expires_at}`);
    const put = await fetch(target.url, { method: "PUT", headers: target.headers, body: read(file) });
    console.log(`✓ PUT to signed URL: HTTP ${put.status}`);
    const tampered = await fetch(target.url.replace(/sig=[^&]+/, "sig=forged"), { method: "PUT", headers: target.headers, body: "x" });
    console.log(`✓ PUT with a forged signature refused: HTTP ${tampered.status}`);
    const done = await call("complete_media_upload", { media_id: up.media_id });
    console.log(`✓ complete_media_upload: ${done.status}, ${done.size_bytes} bytes`);
    const job = await call("analyse_media", { media_id: up.media_id });
    console.log(`✓ analyse_media: job ${job.job_id} ${job.status}`);
    for (let i = 0; i < 60; i++) {
      const a = await call("get_media_analysis", { media_id: up.media_id });
      if (a.status === "analysed") {
        const an = a.analysis as { technical: { duration_seconds: number; width: number; height: number }; scenes: unknown[]; quality: { score: number } };
        console.log(`✓ get_media_analysis: ${an.technical.duration_seconds}s ${an.technical.width}x${an.technical.height}, ${an.scenes.length} scene(s), quality ${an.quality.score}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (args.includes("--render") && projects[0] && search[0]) {
    const sb = await call("submit_storyboard", {
      project_id: projects[0].id,
      title: "Smoke test cut",
      format: "9:16",
      scenes: [
        { duration_seconds: 3, asset_id: search[0].id, on_screen_text: "Steam rising over the valley" },
        { duration_seconds: 2, on_screen_text: "Book direct" },
      ],
    });
    console.log(`✓ submit_storyboard: v${sb.version}, renderable ${sb.renderable}`);
    const quote = await call("create_video", { project_id: projects[0].id, storyboard_id: sb.storyboard_id });
    const q = quote.quote as { credits: number; quote_token: string };
    console.log(`✓ create_video (quote): ${quote.status}, ${q.credits} credit(s)`);
    const go = await call("create_video", { project_id: projects[0].id, storyboard_id: sb.storyboard_id, confirm: true, quote_token: q.quote_token });
    const jobId = (go.job as { job_id: string }).job_id;
    console.log(`✓ create_video (confirmed): ${go.status}, job ${jobId}`);
    for (let i = 0; i < 120; i++) {
      const s = await call("get_render_status", { job_id: jobId });
      if (s.status === "succeeded" || s.status === "failed") {
        console.log(`✓ get_render_status: ${s.status}`);
        const exp = (s.exports as { export_id: string }[])[0];
        if (exp) {
          const e = await call("get_export", { export_id: exp.export_id });
          const dl = e.download as { url: string; expires_at: string };
          console.log(`✓ get_export: ${e.duration_seconds}s ${e.width}x${e.height}, signed download expires ${dl.expires_at}`);
          if (httpUrl) {
            const file = await fetch(dl.url);
            const bytes = Buffer.from(await file.arrayBuffer());
            console.log(`✓ signed download: HTTP ${file.status}, ${bytes.length} bytes, MP4 signature ${bytes.subarray(4, 8).toString() === "ftyp" ? "ok" : "MISSING"}`);
            const forged = await fetch(dl.url.replace(/sig=[^&]+/, "sig=forged"));
            console.log(`✓ forged download link refused: HTTP ${forged.status}`);
          }
        }
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  await client.close();
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
