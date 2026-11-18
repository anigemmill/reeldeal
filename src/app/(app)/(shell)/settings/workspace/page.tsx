import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/app/page-loading";
import { WorkspaceScreen } from "@/components/app/settings/workspace-screen";
import { leaveWorkspaceAction, setAiConsentAction, updateWorkspaceAction } from "@/app/(app)/_actions/settings";
import { serverEnv } from "@/env/server";
import { requireAppContext } from "@/server/app/session";
import { toWorkspaceData } from "@/server/app/settings-view";
import { INDUSTRIES } from "@/server/services/account";
import { getWorkspaceSettings } from "@/server/services/workspace-settings";

export const metadata: Metadata = { title: "Workspace" };

async function Workspace() {
  const c = await requireAppContext("/settings/workspace");
  const w = await getWorkspaceSettings(c.ctx);
  return (
    <WorkspaceScreen
      data={toWorkspaceData(w, { industries: INDUSTRIES, region: serverEnv.DATA_REGION_LABEL })}
      actions={{ save: updateWorkspaceAction, setConsent: setAiConsentAction, leave: leaveWorkspaceAction, billingHref: "/settings/billing", transferHref: "/settings/team?dialog=transfer" }}
    />
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<PageLoading label="Loading workspace settings" />}>
      <Workspace />
    </Suspense>
  );
}
