import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/app/page-loading";
import { TokensScreen } from "@/components/app/settings/tokens-screen";
import { createTokenAction, revokeTokenAction } from "@/app/(app)/_actions/settings";
import { requireAppContext } from "@/server/app/session";
import { requestNow } from "@/server/app/view";
import { toTokensData } from "@/server/app/settings-view";
import { listMyTokens } from "@/server/services/access-tokens";

export const metadata: Metadata = { title: "Access tokens" };

async function Tokens() {
  const c = await requireAppContext("/settings/tokens");
  const tokens = await listMyTokens(c.ctx);
  const workspace = c.memberships.find((m) => m.org_id === c.ctx.principal.orgId)?.name ?? "this workspace";
  return (
    <TokensScreen
      data={toTokensData(tokens, { workspace, myRole: c.ctx.principal.role, me: c.user.displayName ?? c.user.email ?? "You", now: requestNow() })}
      actions={{ create: createTokenAction, revoke: revokeTokenAction }}
    />
  );
}

export default function TokensPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading your access tokens" />}>
      <Tokens />
    </Suspense>
  );
}
