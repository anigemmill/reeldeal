/*
  Logged-in app layout. The AppNav sidebar (design/app/AppNav.dc.html) and auth
  arrive in later phases. Studio will opt into .mode-studio for its subtree.
*/
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <div className="flex min-h-dvh bg-surface-muted text-ink">{children}</div>;
}
