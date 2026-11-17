import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/*
  Settings sub-navigation and page frame (from the approved Appearance screen).
  Items without an href are not built yet: shown as "soon", never as links.
  Below the large breakpoint the items wrap onto several rows, so every item is visible on a
  phone (U1: a sideways-scrolling row hid "Usage and billing" and "Access tokens" at 390px).
*/
export type SettingsItem = { id: string; label: string; href?: string };

/** What the product has today. The design review pages pass their own list (every area linked). */
export const PRODUCT_SETTINGS: SettingsItem[] = [
  { id: "account", label: "Account", href: "/settings/account" },
  { id: "workspace", label: "Workspace" },
  { id: "brands", label: "Brand profiles", href: "/brands" },
  { id: "team", label: "Team" },
  { id: "billing", label: "Usage and billing" },
  { id: "tokens", label: "Access tokens" },
  { id: "appearance", label: "Appearance", href: "/settings/appearance" },
];

export function SettingsNav({ current, items = PRODUCT_SETTINGS }: { current: string; items?: SettingsItem[] }) {
  return (
    <nav aria-label="Settings" className="flex shrink-0 flex-wrap gap-1 border-b border-line px-4 py-3 text-sm lg:w-60 lg:flex-col lg:flex-nowrap lg:border-r lg:border-b-0 lg:px-4 lg:py-8">
      <Eyebrow className="hidden px-3 pb-2 lg:block">Settings</Eyebrow>
      {items.map((item) =>
        item.id === current ? (
          <span key={item.id} aria-current="page" className="shrink-0 rounded-[10px] bg-surface-muted px-3 py-2 font-semibold text-link lg:py-2.5">
            {item.label}
          </span>
        ) : item.href ? (
          <Link key={item.id} href={item.href} className="shrink-0 rounded-[10px] px-3 py-2 hover:bg-surface-muted lg:py-2.5">
            {item.label}
          </Link>
        ) : (
          <span key={item.id} aria-disabled="true" className="flex shrink-0 items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-ink-muted lg:py-2.5">
            {item.label}
            <span className="hidden font-mono text-[10px] uppercase lg:inline">soon</span>
          </span>
        ),
      )}
    </nav>
  );
}

/** Sub-nav + page header + content, used by every settings page. */
export function SettingsFrame({
  current,
  items,
  title,
  intro,
  actions,
  children,
}: {
  current: string;
  items?: SettingsItem[];
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <SettingsNav current={current} items={items} />
      <div className="flex min-w-0 flex-1 flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-2xl flex-col gap-2">
            <h1 className="font-display text-[clamp(32px,3.6vw,44px)] leading-none font-semibold tracking-display">{title}</h1>
            {intro ? <p className="text-ink-muted">{intro}</p> : null}
          </div>
          {actions}
        </header>
        {children}
      </div>
    </div>
  );
}

/** A settings section: title and description on the left (wide screens), content on the right. */
export function SettingsSection({ id, title, description, children, className }: { id: string; title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("grid gap-4 border-t border-line pt-6 xl:grid-cols-[260px_minmax(0,1fr)] xl:gap-10", className)}>
      <div className="flex flex-col gap-1.5">
        <h2 id={`${id}-title`} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      </div>
      <div className="flex min-w-0 max-w-[680px] flex-col gap-4">{children}</div>
    </section>
  );
}
