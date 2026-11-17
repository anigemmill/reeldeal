import type { Metadata } from "next";
import { AuthCard } from "@/components/app/auth/auth-card";
import { InvitationAccept } from "@/components/app/auth/invitation-accept";

/*
  Invitation acceptance (/invite#rdl_inv_…). The token is in the URL fragment, which the server
  never receives, so this page is static: the client component reads the token and asks the
  server (POST body) what to show. Not indexed, and no Referer to other sites.
*/
export const metadata: Metadata = { title: "Join a workspace", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Page() {
  return (
    <AuthCard title="You're" accent="invited." intro="Join your team's Reeldeal workspace to work on their footage, brand and videos.">
      <InvitationAccept />
    </AuthCard>
  );
}
