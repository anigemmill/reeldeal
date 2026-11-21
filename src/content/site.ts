/*
  Self-serve sign-up and sign-in on the website. OFF until Supabase Auth, email (Resend) and the
  database are live in production (owner, 2026-11-21): every "Start free", plan and "Sign in"
  button sends visitors to Book a demo instead, and the Sign in links are hidden. The pages
  themselves (/sign-in, /sign-up) still exist. Set to true to switch sign-up back on.
*/
export const SIGN_UP_OPEN = false;

/** The main call to action: Start free while sign-up is open, otherwise Book a demo. */
export const PRIMARY_CTA = SIGN_UP_OPEN ? { label: "Start free", href: "/signup" } : { label: "Book a demo", href: "/demo" };

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
  {
    heading: "Account",
    links: SIGN_UP_OPEN
      ? [{ label: "Pricing", href: "/pricing" }, { label: "Sign in", href: "/login" }, { label: "Start free", href: "/signup" }]
      : [{ label: "Pricing", href: "/pricing" }, { label: "Book a demo", href: "/demo" }],
  },
] as const;
