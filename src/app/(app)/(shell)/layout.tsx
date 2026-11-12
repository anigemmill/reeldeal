import { AppShell } from "@/components/app/app-shell";

/* App pages with the sidebar. Studio sits outside this group (full-screen). */
export default function ShellLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
