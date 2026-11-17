import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/app/page-loading";
import { AccountScreen } from "@/components/app/settings/account-screen";
import { requireAppContext } from "@/server/app/session";
import { initials } from "@/server/app/view";

export const metadata: Metadata = { title: "Account" };

async function Account({ searchParams }: PageProps<"/settings/account">) {
  const c = await requireAppContext("/settings/account");
  const q = await searchParams;
  const name = c.user.displayName ?? c.user.email ?? "You";
  return (
    <AccountScreen
      emailStatus={typeof q.email === "string" ? q.email : undefined}
      data={{
        name,
        initials: initials(name),
        email: c.user.email ?? "",
        emailVerified: c.user.emailVerified,
        pendingEmail: c.user.pendingEmail,
        createdAt: c.user.createdAt,
        lastSignInAt: c.user.lastSignInAt,
        workspaces: c.memberships.map((m) => ({ name: m.name, role: m.role })),
      }}
    />
  );
}

export default function AccountPage(props: PageProps<"/settings/account">) {
  return (
    <Suspense fallback={<PageLoading label="Loading your account" />}>
      <Account {...props} />
    </Suspense>
  );
}
