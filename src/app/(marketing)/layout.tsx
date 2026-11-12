/*
  Marketing website layout (public, SEO). Nav and Footer arrive in Phase 2
  (design/components/Nav.dc.html, Footer.dc.html).
*/
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return <div className="flex min-h-dvh flex-col bg-bg text-ink">{children}</div>;
}
