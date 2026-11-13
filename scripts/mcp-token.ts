/*
  Manage personal access tokens for MCP clients.
    npm run mcp:token -- --email aroha@lakeside.example [--org <slug>] [--scopes mcp:read,mcp:write,mcp:render] [--name "Claude Desktop"] [--days 90]
    npm run mcp:token -- --list --email aroha@lakeside.example
    npm run mcp:token -- --revoke <token-id>
  The token is printed once; only its hash is stored. Put it in your MCP client config
  as REELDEAL_MCP_TOKEN. Never commit it.
*/
import { parseArgs } from "node:util";
import { SCOPES, type Scope } from "../src/server/auth/principal";
import { createAccessToken, revokeAccessToken } from "../src/server/auth/tokens";
import { createPlatform } from "../src/server/platform";

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" }, org: { type: "string" }, scopes: { type: "string" }, name: { type: "string" }, days: { type: "string" }, list: { type: "boolean" }, revoke: { type: "string" } },
  });
  const p = await createPlatform();
  try {
    if (values.revoke) {
      await revokeAccessToken(p.db, values.revoke);
      console.log(`Revoked token ${values.revoke}`);
      return;
    }
    if (!values.email) throw new Error("--email is required");
    const memberships = await p.db.system((sql) =>
      sql.query<{ user_id: string; org_id: string; slug: string; name: string; role: string }>(
        "select m.user_id, m.org_id, o.slug, o.name, m.role from auth.users u join public.memberships m on m.user_id = u.id join public.organisations o on o.id = m.org_id where lower(u.email) = lower($1)",
        [values.email],
      ),
    );
    if (!memberships.length) throw new Error("No user with that email belongs to a workspace");
    if (values.list) {
      const rows = await p.db.system((sql) =>
        sql.query("select id, name, token_prefix, scopes, created_at, expires_at, last_used_at, revoked_at from public.api_tokens where user_id = $1 order by created_at desc", [memberships[0].user_id]),
      );
      console.table(rows);
      return;
    }
    const m = values.org ? memberships.find((x) => x.slug === values.org) : memberships.length === 1 ? memberships[0] : null;
    if (!m) throw new Error(`Choose a workspace with --org: ${memberships.map((x) => x.slug).join(", ")}`);
    const scopes = (values.scopes ?? "mcp:read,mcp:write").split(",").map((s) => s.trim()) as Scope[];
    if (scopes.some((s) => !SCOPES.includes(s))) throw new Error(`Scopes must be from: ${SCOPES.join(", ")}`);
    const t = await createAccessToken(p.db, { userId: m.user_id, orgId: m.org_id, name: values.name ?? "MCP client", scopes, expiresInDays: Number(values.days ?? 90) });
    console.log(`Token for ${values.email} in ${m.name} (${m.role}), scopes ${scopes.join(" ")}, expires ${t.expiresAt?.toISOString().slice(0, 10) ?? "never"}:\n\n${t.token}\n\nShown once. Token id (for revoking): ${t.id}`);
  } finally {
    await p.db.close();
  }
}
main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
