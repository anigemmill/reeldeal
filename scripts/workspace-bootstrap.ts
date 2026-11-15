/*
  Create a workspace for an existing Supabase Auth user and give them an MCP token.
  The user must already exist in Supabase Auth (Dashboard → Authentication → Add user,
  or a normal sign-up). This never creates or changes auth users.

    npm run workspace:bootstrap -- --email you@example.com --org "Lakeside Lodge" [--plan creator]
        [--scopes mcp:read,mcp:write,mcp:render] [--token-name "Claude Desktop"] [--days 30]

  Re-running for the same user and workspace name reuses the workspace and only
  issues a new token. The token is printed once; only its hash is stored.
*/
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { getPlan } from "../src/lib/pricing";
import { SCOPES, type Scope } from "../src/server/auth/principal";
import { createAccessToken } from "../src/server/auth/tokens";
import { createPlatform } from "../src/server/platform";
import { ensureGrant } from "../src/server/services/usage";

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, org: { type: "string" }, plan: { type: "string" }, scopes: { type: "string" }, "token-name": { type: "string" }, days: { type: "string" } },
  });
  if (!values.email || !values.org) throw new Error("Usage: --email <existing auth user> --org <workspace name>");
  const plan = values.plan ?? "free";
  if (!getPlan(plan)) throw new Error(`Unknown plan "${plan}" (see config/pricing.json)`);
  const scopes = (values.scopes ?? "mcp:read,mcp:write").split(",").map((s) => s.trim()) as Scope[];
  for (const s of scopes) if (!SCOPES.includes(s)) throw new Error(`Unknown scope ${s}. Allowed: ${SCOPES.join(", ")}`);

  const p = await createPlatform();
  try {
    const { userId, orgId, created } = await p.db.system(async (sql) => {
      const [user] = await sql.query<{ id: string }>("select id from auth.users where lower(email) = lower($1)", [values.email]);
      if (!user) throw new Error(`No Supabase Auth user with that email. Create the user in Supabase (Authentication → Add user) first.`);
      const [existing] = await sql.query<{ id: string }>(
        "select o.id from public.organisations o join public.memberships m on m.org_id = o.id where m.user_id = $1 and m.role = 'owner' and o.name = $2",
        [user.id, values.org],
      );
      if (existing) return { userId: user.id, orgId: existing.id, created: false };
      const slug = `${values.org!.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workspace"}-${randomBytes(3).toString("hex")}`;
      const [org] = await sql.query<{ id: string }>("insert into public.organisations (name, slug, plan_id) values ($1, $2, $3) returning id", [values.org, slug, plan]);
      await sql.query("insert into public.memberships (org_id, user_id, role) values ($1, $2, 'owner')", [org.id, user.id]);
      await ensureGrant(sql, org.id);
      return { userId: user.id, orgId: org.id, created: true };
    });
    const t = await createAccessToken(p.db, { userId, orgId, name: values["token-name"] ?? "MCP client", scopes, expiresInDays: Number(values.days ?? 30) });
    console.log(`${created ? "Created" : "Reusing"} workspace "${values.org}" (${plan} plan) owned by ${values.email}.`);
    console.log(`Token (scopes ${scopes.join(", ")}, expires ${t.expiresAt?.toISOString().slice(0, 10)}), shown once:\n\n${t.token}\n`);
    console.log(`Token id for revoking: ${t.id}   (npm run mcp:token -- --revoke ${t.id})`);
  } finally {
    await p.db.close();
  }
}
main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
