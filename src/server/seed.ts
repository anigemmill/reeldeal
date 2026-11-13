import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAccessToken } from "./auth/tokens";
import type { Platform } from "./context";
import type { Scope } from "./auth/principal";
import { mediaKey } from "./storage/types";
import { ensureGrant } from "./services/usage";
import { run } from "./workers/ffmpeg";

/*
  Demo data for local development and automated tests (never for production).
  Two separate organisations so isolation can be seen and tested:
    Lakeside Lodge  (Creator plan): Aroha (owner), Ben (editor), Cleo (viewer)
    Harbour Café    (Starter plan): Dev (owner)
  Footage is REAL video generated from the placeholder scene artwork
  (supabase/seed/stills, our own illustrations) with FFmpeg: slow pans, and real cuts
  in multi-shot clips. Names and businesses are invented sample data.
  Media starts as "uploaded" (not analysed): run the worker to analyse it.
*/
const STILLS = join(process.cwd(), "supabase", "seed", "stills");

type ClipSpec = { org: "a" | "b"; title: string; description: string; tags: string[]; shots: string[]; seconds: number; portrait?: boolean; brand?: boolean };

export const DEMO_CLIPS: ClipSpec[] = [
  { org: "a", title: "Geothermal valley with rising steam", description: "Wide shot over the geothermal valley at the lake's north end, steam drifting over the hot pools.", tags: ["geothermal", "landscape", "steam", "wide"], shots: ["geothermal"], seconds: 6, brand: true },
  { org: "a", title: "Kayaker on the lake at sunrise", description: "Calm morning paddle on the lake, mist on the hills, guest in an orange kayak.", tags: ["kayak", "lake", "morning", "guests", "activity"], shots: ["lake-morning"], seconds: 8, brand: true },
  { org: "a", title: "Sunset sail on the bay", description: "Sailboat crossing the bay at sunset, warm light on the water.", tags: ["sunset", "boat", "sailing", "golden hour"], shots: ["coast-sunset"], seconds: 7 },
  { org: "a", title: "Forest trail ride (vertical)", description: "Cyclist riding the lodge forest trail with light through the trees. Shot vertical for Reels.", tags: ["forest", "cycling", "trail", "vertical", "activity"], shots: ["forest-trail"], seconds: 6, portrait: true },
  { org: "a", title: "Ridge walk at dawn (vertical)", description: "Guided ridge walk at dawn, hiker on the skyline.", tags: ["hiking", "dawn", "mountains", "vertical"], shots: ["alpine-dawn"], seconds: 6, portrait: true },
  { org: "a", title: "Lodge highlights, raw (three shots)", description: "Unedited sequence: the lodge under the stars, the lake in the morning, the forest trail.", tags: ["lodge", "night", "stars", "highlights"], shots: ["night-sky", "lake-morning", "forest-trail"], seconds: 3 },
  { org: "a", title: "Vineyard at golden hour", description: "Rolling vineyard rows near the lodge at golden hour.", tags: ["vineyard", "golden hour", "landscape"], shots: ["vineyard"], seconds: 5 },
  { org: "b", title: "Harbour at blue hour", description: "The café's jetty and harbour lights at dusk.", tags: ["harbour", "dusk", "jetty"], shots: ["harbour-dusk"], seconds: 5 },
  { org: "b", title: "Turquoise bay swim spot", description: "Palm-fringed beach near the café, turquoise water.", tags: ["beach", "summer", "swimming"], shots: ["beach-day"], seconds: 6 },
  { org: "b", title: "Geothermal day trip (Harbour Café private)", description: "Harbour Café's own geothermal footage from a staff day trip.", tags: ["geothermal", "steam", "day trip"], shots: ["geothermal"], seconds: 5 },
];

async function makeClip(ffmpeg: string, shots: string[], seconds: number, out: string, size: { w: number; h: number }) {
  const { w, h } = size;
  const inputs = shots.flatMap((s) => ["-loop", "1", "-framerate", "30", "-t", String(seconds), "-i", join(STILLS, `${s}.jpg`)]);
  const parts = shots.map(
    (_, i) => `[${i}:v]scale=-2:${Math.round(h * 1.12 / 2) * 2},crop=${w}:${h}:x='(in_w-${w})*t/${seconds}':y='(in_h-${h})/2',setsar=1,fps=30,format=yuv420p[v${i}]`,
  );
  const filter = `${parts.join(";")};${shots.map((_, i) => `[v${i}]`).join("")}concat=n=${shots.length}:v=1:a=0[v]`;
  await run(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", ...inputs, "-f", "lavfi", "-t", String(seconds * shots.length), "-i", "anullsrc=r=48000:cl=stereo", "-filter_complex", filter, "-map", "[v]", "-map", `${shots.length}:a`, "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26", "-c:a", "aac", "-shortest", "-y", out],
    { timeoutMs: 120_000 },
  );
}

export type DemoData = Awaited<ReturnType<typeof seedDemoData>>;

export async function seedDemoData(p: Platform, opts: { scale?: number; clips?: number; tokens?: boolean } = {}) {
  const scale = opts.scale ?? 1;
  const ids = {
    orgA: randomUUID(), orgB: randomUUID(),
    aroha: randomUUID(), ben: randomUUID(), cleo: randomUUID(), dev: randomUUID(),
    brandA: randomUUID(), brandB: randomUUID(),
    projectA: randomUUID(), projectB: randomUUID(),
  };
  const media: { id: string; org: "a" | "b"; title: string }[] = [];

  await p.db.system(async (sql) => {
    for (const [id, email] of [[ids.aroha, "aroha@lakeside.example"], [ids.ben, "ben@lakeside.example"], [ids.cleo, "cleo@lakeside.example"], [ids.dev, "dev@harbourcafe.example"]]) {
      await sql.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
    }
    await sql.query("insert into public.organisations (id, name, slug, plan_id) values ($1, 'Lakeside Lodge', $3, 'creator'), ($2, 'Harbour Café', $4, 'starter')", [ids.orgA, ids.orgB, `lakeside-lodge-${ids.orgA.slice(0, 6)}`, `harbour-cafe-${ids.orgB.slice(0, 6)}`]);
    await sql.query(
      "insert into public.memberships (org_id, user_id, role) values ($1, $3, 'owner'), ($1, $4, 'editor'), ($1, $5, 'viewer'), ($2, $6, 'owner')",
      [ids.orgA, ids.orgB, ids.aroha, ids.ben, ids.cleo, ids.dev],
    );
    await sql.query(
      `insert into public.brand_profiles (id, org_id, name, description, industry, audiences, voice, colours, typography, guidelines, restrictions, created_by) values
       ($1, $2, 'Lakeside Lodge', 'A 12-room lakeside lodge 20 minutes from town, known for sunrise kayaking and geothermal hot pools.', 'Accommodation',
        array['Couples on weekend escapes', 'Active travellers aged 30-55'], 'Warm, unhurried and specific. Short sentences. No hype words.',
        '[{"name":"Deep lake","hex":"#1F4E79","role":"primary"},{"name":"Sunrise orange","hex":"#F4721E","role":"accent"},{"name":"Sand","hex":"#E9D9CA","role":"background"}]'::jsonb,
        '{"headings":"Inter Bold","body":"Inter"}'::jsonb,
        'Show real guests and real places. Lead with the experience, not the room. Logo end card on every video.',
        array['No drone footage over the hot pools (guest privacy)', 'Do not mention prices in organic posts'], $3),
       ($4, $5, 'Harbour Café', 'Waterfront café on the harbour, open for breakfast and lunch.', 'Hospitality', array['Locals', 'Day visitors'],
        'Friendly and local.', '[{"name":"Harbour navy","hex":"#10142A","role":"primary"},{"name":"Lamp gold","hex":"#FFC979","role":"accent"}]'::jsonb, '{}'::jsonb, null, '{}', $6)`,
      [ids.brandA, ids.orgA, ids.aroha, ids.brandB, ids.orgB, ids.dev],
    );
  });

  const work = await mkdtemp(join(tmpdir(), "rd-seed-"));
  try {
    const specs = DEMO_CLIPS.slice(0, opts.clips ?? DEMO_CLIPS.length);
    for (const spec of specs) {
      const id = randomUUID();
      const orgId = spec.org === "a" ? ids.orgA : ids.orgB;
      const [w, h] = spec.portrait ? [Math.round((720 * scale * 9) / 16 / 2) * 2, Math.round((720 * scale) / 2) * 2] : [Math.round((1280 * scale) / 2) * 2, Math.round((720 * scale) / 2) * 2];
      const file = join(work, `${id}.mp4`);
      await makeClip(p.media.ffmpeg, spec.shots, spec.seconds, file, { w, h });
      const key = mediaKey(orgId, id, "mp4");
      await p.storage.putFile(key, file, "video/mp4");
      const size = (await stat(file)).size;
      await p.db.system((sql) =>
        sql.query(
          `insert into public.media_assets (id, org_id, title, description, kind, mime_type, size_bytes, status, storage_key, original_filename, tags, brand_id, usage_rights, created_by)
           values ($1, $2, $3, $4, 'video', 'video/mp4', $5, 'uploaded', $6, $7, $8, $9, 'Owned by the business (demo footage generated from placeholder artwork)', $10)`,
          [id, orgId, spec.title, spec.description, size, key, `${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.mp4`, spec.tags, spec.brand ? (spec.org === "a" ? ids.brandA : ids.brandB) : null, spec.org === "a" ? ids.aroha : ids.dev],
        ),
      );
      media.push({ id, org: spec.org, title: spec.title });
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }

  await p.db.system(async (sql) => {
    await sql.query(
      `insert into public.projects (id, org_id, brand_id, name, objective, audience, description, platform, formats, duration_seconds, created_by)
       values ($1, $2, $3, 'Summer bookings reel', 'Drive direct summer bookings', 'Couples planning a weekend escape', 'A calm summer morning at the lodge: kayaking, the hot pools, ending on the lake view.', 'Instagram Reels', array['9:16'], 15, $4),
              ($5, $6, $7, 'Weekend specials', 'Promote weekend brunch', 'Locals', 'Weekend brunch on the harbour.', 'Instagram', array['1:1'], 15, $8)`,
      [ids.projectA, ids.orgA, ids.brandA, ids.aroha, ids.projectB, ids.orgB, ids.brandB, ids.dev],
    );
    for (const m of media.filter((x) => x.org === "a").slice(0, 3)) {
      await sql.query("insert into public.project_media (project_id, media_id, org_id) values ($1, $2, $3)", [ids.projectA, m.id, ids.orgA]);
    }
    await ensureGrant(sql, ids.orgA);
    await ensureGrant(sql, ids.orgB);
  });

  const tokens: Record<string, string> = {};
  if (opts.tokens !== false) {
    const mk = async (name: string, userId: string, orgId: string, scopes: Scope[]) => (tokens[name] = (await createAccessToken(p.db, { userId, orgId, name: `${name} (demo)`, scopes, expiresInDays: 90 })).token);
    await mk("aroha_owner_full", ids.aroha, ids.orgA, ["mcp:read", "mcp:write", "mcp:render"]);
    await mk("ben_editor_no_render", ids.ben, ids.orgA, ["mcp:read", "mcp:write"]);
    await mk("cleo_viewer_read", ids.cleo, ids.orgA, ["mcp:read"]);
    await mk("dev_harbour_full", ids.dev, ids.orgB, ["mcp:read", "mcp:write", "mcp:render"]);
  }
  return { ids, media, tokens };
}
