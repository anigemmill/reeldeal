import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { PageLoading } from "@/components/app/page-loading";
import { requireAppContext } from "@/server/app/session";
import { navData } from "@/server/app/view";

/* App pages with the sidebar, for a signed-in user with a workspace. Studio sits outside (full-screen). */
async function Shell({ children }: { children: React.ReactNode }) {
  const c = await requireAppContext();
  return <AppShell nav={await navData(c)}>{children}</AppShell>;
}

export default function ShellLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
