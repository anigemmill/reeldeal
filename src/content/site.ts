/* Marketing navigation. Pages other than Home are built in Phase 2. */
export const MAIN_NAV = [
  { label: "Product", href: "/product" },
  { label: "Solutions", href: "/solutions/tourism" },
  { label: "Showcase", href: "/showcase" },
  { label: "Pricing", href: "/pricing" },
  { label: "Company", href: "/about" },
] as const;

export const FOOTER_NAV = [
  { heading: "Product", links: [{ label: "Overview", href: "/product" }, { label: "Autopilot", href: "/product#autopilot" }, { label: "Studio", href: "/product#studio" }, { label: "Brand intelligence", href: "/product#brand" }] },
  { heading: "Solutions", links: [{ label: "Tourism and hospitality", href: "/solutions/tourism" }, { label: "Agencies", href: "/solutions/agencies" }, { label: "All industries", href: "/solutions" }] },
  { heading: "Company", links: [{ label: "About", href: "/about" }, { label: "Showcase", href: "/showcase" }, { label: "Book a demo", href: "/demo" }] },
  { heading: "Account", links: [{ label: "Pricing", href: "/pricing" }, { label: "Sign in", href: "/login" }, { label: "Start free", href: "/signup" }] },
] as const;
