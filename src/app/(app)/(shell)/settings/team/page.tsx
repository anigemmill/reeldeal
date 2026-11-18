import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/app/page-loading";
import { TeamScreen } from "@/components/app/settings/team-screen";
import { changeRoleAction, inviteAction, leaveWorkspaceAction, removeMemberAction, renewInviteAction, revokeInviteAction, transferOwnershipAction } from "@/app/(app)/_actions/settings";
import { serverEnv } from "@/env/server";
import { requireAppContext } from "@/server/app/session";
import { requestNow } from "@/server/app/view";
import { toTeamData } from "@/server/app/settings-view";
import { emailConfigured } from "@/server/email/resend";
import { getTeam } from "@/server/services/team";

export const metadata: Metadata = { title: "Team" };

async function Team() {
  const c = await requireAppContext("/settings/team");
  const team = await getTeam(c.ctx);
  const emailDelivery = emailConfigured({ apiKey: serverEnv.RESEND_API_KEY, from: serverEnv.EMAIL_FROM });
  return (
    <TeamScreen
      data={toTeamData(team, { emailDelivery, now: requestNow() })}
      actions={{ invite: inviteAction, renew: renewInviteAction, revoke: revokeInviteAction, changeRole: changeRoleAction, remove: removeMemberAction, leave: leaveWorkspaceAction, transfer: transferOwnershipAction }}
    />
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading your team" />}>
      <Team />
    </Suspense>
  );
}
