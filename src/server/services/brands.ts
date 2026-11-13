import { z } from "zod";
import { asUser, iso, type Ctx } from "../context";
import { requireRole, requireScope } from "../auth/principal";
import { invalid, notFound, toAppError, parseInput } from "../errors";

/* Brand profiles: the organisation's own brand data only. Nothing is invented. */

const HEX = /^#[0-9A-Fa-f]{6}$/;
export const BrandInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  industry: z.string().trim().max(120).optional(),
  audiences: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
  voice: z.string().trim().max(1000).optional(),
  colours: z
    .array(z.object({ name: z.string().trim().min(1).max(60), hex: z.string().regex(HEX, "Use #RRGGBB"), role: z.string().trim().max(60).optional() }))
    .max(12)
    .optional(),
  typography: z.object({ headings: z.string().max(80).optional(), body: z.string().max(80).optional(), notes: z.string().max(500).optional() }).optional(),
  guidelines: z.string().trim().max(10000).optional(),
  restrictions: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
});
export type BrandInput = z.infer<typeof BrandInput>;

type BrandRow = {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  audiences: string[];
  voice: string | null;
  colours: unknown;
  typography: unknown;
  logo_media_id: string | null;
  guidelines: string | null;
  restrictions: string[];
  version: number;
  created_at: string;
  updated_at: string;
};

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** Only fields that hold data are returned. */
function present(b: BrandRow) {
  const out: Record<string, unknown> = { id: b.id, name: b.name, version: b.version, created_at: iso(b.created_at), updated_at: iso(b.updated_at) };
  const fields: [string, unknown][] = [
    ["description", b.description],
    ["industry", b.industry],
    ["target_audiences", b.audiences],
    ["brand_voice", b.voice],
    ["colours", b.colours],
    ["typography", b.typography],
    ["logo_media_id", b.logo_media_id],
    ["guidelines", b.guidelines],
    ["restrictions", b.restrictions],
  ];
  for (const [k, v] of fields) if (!isEmpty(v)) out[k] = v;
  return out;
}

const COLS = "id, name, description, industry, audiences, voice, colours, typography, logo_media_id, guidelines, restrictions, version, created_at, updated_at";

export async function listBrands(ctx: Ctx) {
  const rows = await asUser(ctx, (sql) => sql.query<BrandRow>(`select ${COLS} from public.brand_profiles where org_id = $1 order by name`, [ctx.principal.orgId]));
  return {
    brands: rows.map((b) => ({ id: b.id, name: b.name, industry: b.industry, description: b.description, version: b.version, updated_at: iso(b.updated_at) })),
  };
}

export async function getBrand(ctx: Ctx, id: string) {
  const [row] = await asUser(ctx, (sql) =>
    sql.query<BrandRow>(`select ${COLS} from public.brand_profiles where org_id = $1 and id = $2`, [ctx.principal.orgId, id]),
  );
  if (!row) throw notFound("Brand profile");
  const assets = await asUser(ctx, (sql) =>
    sql.query<{ id: string; title: string; kind: string }>(
      "select id, title, kind from public.media_assets where org_id = $1 and brand_id = $2 and status in ('uploaded', 'ready') order by created_at desc limit 20",
      [ctx.principal.orgId, id],
    ),
  );
  return { ...present(row), ...(assets.length ? { approved_assets: assets } : {}) };
}

export async function createBrand(ctx: Ctx, input: BrandInput) {
  requireScope(ctx.principal, "mcp:write");
  requireRole(ctx.principal, "editor");
  const b = parseInput(BrandInput, input);
  try {
    const [row] = await asUser(ctx, (sql) =>
      sql.query<BrandRow>(
        `insert into public.brand_profiles (org_id, name, description, industry, audiences, voice, colours, typography, guidelines, restrictions, created_by)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11) returning ${COLS}`,
        [
          ctx.principal.orgId,
          b.name,
          b.description ?? null,
          b.industry ?? null,
          b.audiences ?? [],
          b.voice ?? null,
          JSON.stringify(b.colours ?? []),
          JSON.stringify(b.typography ?? {}),
          b.guidelines ?? null,
          b.restrictions ?? [],
          ctx.principal.userId,
        ],
      ),
    );
    return present(row);
  } catch (e) {
    throw toAppError(e);
  }
}

/** Update the fields that are provided and bump the version. */
export async function updateBrand(ctx: Ctx, id: string, input: Partial<BrandInput>) {
  requireScope(ctx.principal, "mcp:write");
  requireRole(ctx.principal, "editor");
  const b = parseInput(BrandInput.partial(), input);
  const candidates: [string, unknown, string?][] = [
    ["name", b.name],
    ["description", b.description],
    ["industry", b.industry],
    ["audiences", b.audiences],
    ["voice", b.voice],
    ["colours", b.colours && JSON.stringify(b.colours), "::jsonb"],
    ["typography", b.typography && JSON.stringify(b.typography), "::jsonb"],
    ["guidelines", b.guidelines],
    ["restrictions", b.restrictions],
  ];
  const sets = candidates.filter(([, v]) => v !== undefined);
  if (sets.length === 0) throw invalid("Nothing to update");
  const params: unknown[] = [ctx.principal.orgId, id];
  const assignments = sets.map(([col, v, cast]) => {
    params.push(v);
    return `${col} = $${params.length}${cast ?? ""}`;
  });
  let row: BrandRow | undefined;
  try {
    [row] = await asUser(ctx, (sql) =>
      sql.query<BrandRow>(`update public.brand_profiles set ${assignments.join(", ")}, version = version + 1 where org_id = $1 and id = $2 returning ${COLS}`, params),
    );
  } catch (e) {
    throw toAppError(e);
  }
  if (!row) throw notFound("Brand profile");
  return present(row);
}
