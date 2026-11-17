import { readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { APP_PREFIXES } from "@/proxy";
import { SCOPES, type MemberRole } from "../auth/principal";
import type { Ctx, Platform } from "../context";
import type { AppError } from "../errors";
import type { DemoData } from "../seed";
import { ownedKey } from "../storage/types";
import { createTestPlatform } from "../testing";
import { principalForSession } from "./account";
import { getMediaDetails, searchMedia } from "./media";
import { getProject, listProjects } from "./projects";
import { getUsage } from "./usage";

/*
  Customer-journey security regressions (docs/security-review.md). Complements the isolation
  tests in services.test.ts, mcp.test.ts, privileges.test.ts, team.test.ts, access-tokens.test.ts
  and customer-integration.test.ts, which cover removed members, invitations, tokens and
  plan/credit tampering.
*/
let t: Awaited<ReturnType<typeof createTestPlatform>>;
let p: Platform;
let d: DemoData;
const code = async (pr: Promise<unknown>) => ((await pr.then(() => null, (e) => e)) as AppError | null)?.code ?? "ok";
const ctx = (userId: string, orgId: string, role: MemberRole): Ctx => t.ctxAs({ userId, orgId, role, scopes: [...SCOPES], via: "session" });

beforeAll(async () => {
  t = await createTestPlatform({ seed: true, clips: 2 });
  p = t.p;
  d = t.demo;
}, 120_000);
afterAll(async () => p?.db.close());

describe("workspace switching", () => {
  it("a workspace cookie for someone else's organisation is ignored: you get your own", async () => {
    const s = await principalForSession(p, d.ids.ben, d.ids.orgB); // Ben is only in A
    expect(s?.principal.orgId).toBe(d.ids.orgA);
    expect(s?.memberships.map((m) => m.org_id)).toEqual([d.ids.orgA]);
    expect(await principalForSession(p, d.ids.ben, "not-a-uuid")).toMatchObject({ principal: { orgId: d.ids.orgA } });
  });

  it("someone in two workspaces sees only the one they switched to, with that workspace's role", async () => {
    await p.db.system((sql) => sql.query("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'viewer')", [d.ids.orgB, d.ids.ben]));
    const inA = (await principalForSession(p, d.ids.ben, d.ids.orgA))!.principal;
    const inB = (await principalForSession(p, d.ids.ben, d.ids.orgB))!.principal;
    expect([inA.role, inB.role]).toEqual(["editor", "viewer"]);
    const projectsA = (await listProjects({ ...p, principal: inA })).projects.map((x) => x.id);
    const projectsB = (await listProjects({ ...p, principal: inB })).projects.map((x) => x.id);
    expect(projectsA).toContain(d.ids.projectA);
    expect(projectsA).not.toContain(d.ids.projectB);
    expect(projectsB).toEqual([d.ids.projectB]);
    // Usage and credits follow the selected workspace too.
    expect((await getUsage({ ...p, principal: inB })).plan.id).toBe("starter");
    expect((await getUsage({ ...p, principal: inA })).plan.id).toBe("creator");
  });

  it("a context whose organisation id was tampered with sees nothing, even with a high role", async () => {
    // As if a bug put another org's id into Cleo's (viewer in A) context with owner role.
    const forged = ctx(d.ids.cleo, d.ids.orgB, "owner");
    expect((await listProjects(forged)).projects).toEqual([]);
    expect(await code(getProject(forged, d.ids.projectB))).toBe("not_found");
    expect((await searchMedia(forged, {})).results).toEqual([]);
  });
});

describe("projects and footage", () => {
  it("another organisation's project and media look exactly like ones that don't exist", async () => {
    const outsider = ctx(d.ids.dev, d.ids.orgB, "owner");
    const mediaA = d.media.find((m) => m.org === "a")!.id;
    const missing = "00000000-0000-4000-8000-000000000000";
    const msg = async (pr: Promise<unknown>) => ((await pr.then(() => null, (e) => e)) as Error).message;
    expect(await msg(getProject(outsider, d.ids.projectA))).toBe(await msg(getProject(outsider, missing)));
    expect(await msg(getMediaDetails(outsider, mediaA))).toBe(await msg(getMediaDetails(outsider, missing)));
  });

  it("signing refuses storage keys outside the caller's organisation, including path tricks", () => {
    const a = d.ids.orgA;
    const b = d.ids.orgB;
    expect(ownedKey(`org/${a}/media/x/original.mp4`, a)).toBe(`org/${a}/media/x/original.mp4`);
    for (const key of [`org/${b}/media/x/original.mp4`, `org/${a}/../${b}/media/x/original.mp4`, `org/${a}//media/x`, `/org/${a}/media/x`, `org/${a}`]) {
      expect(() => ownedKey(key, a)).toThrow();
    }
  });

  it("a signed download link is only minted for the caller's own footage", async () => {
    const mediaA = d.media.find((m) => m.org === "a")!.id;
    const own = await getMediaDetails(ctx(d.ids.aroha, d.ids.orgA, "owner"), mediaA, { includePreviewUrl: true });
    const url = (own as { preview_url?: { url: string } | null }).preview_url?.url ?? "";
    expect(url === "" || url.includes(`org%2F${d.ids.orgA}`) || url.includes(`org/${d.ids.orgA}`)).toBe(true);
    expect(await code(getMediaDetails(ctx(d.ids.dev, d.ids.orgB, "owner"), mediaA, { includePreviewUrl: true }))).toBe("not_found");
  });
});

describe("routes", () => {
  it("every signed-in app page is behind the proxy's sign-in check", () => {
    const root = join(process.cwd(), "src/app/(app)");
    const top = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith("(") && !e.name.startsWith("_")).map((e) => `/${e.name}`);
    const pages = [...top(root), ...top(join(root, "(shell)"))];
    expect(pages.length).toBeGreaterThan(5);
    for (const page of pages) expect(APP_PREFIXES, `${page} is not protected in src/proxy.ts`).toContain(page);
  });
});
