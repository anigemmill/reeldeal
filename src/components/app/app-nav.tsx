"use client";

import { Clapperboard, Download, FolderOpen, Home, LayoutGrid, LayoutTemplate, Plus, Settings, Shield, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { SAMPLE_WORKSPACE, sampleUsageMeters } from "@/content/sample/workspace";
import { cn } from "@/lib/utils";

/*
  App sidebar (design/app/AppNav.dc.html). Destinations that are not built yet
  are shown as "Soon" and are not links, so nothing pretends to work.
*/
const NAV = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Autopilot", href: "/autopilot", icon: Sparkles },
  { label: "Studio", href: "/studio", icon: Clapperboard },
  { label: "Library", icon: LayoutGrid },
  { label: "Projects", icon: FolderOpen },
  { label: "Brands", icon: Shield },
  { label: "Templates", icon: LayoutTemplate },
  { label: "Exports", icon: Download },
] as const;

const meterFill = ["bg-primary", "bg-primary/70", "bg-primary/45"];

export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const { planName, meters } = sampleUsageMeters();
  const ws = SAMPLE_WORKSPACE;

  return (
    <nav aria-label="App" className={cn("flex h-full flex-col gap-4.5 bg-surface px-3.5 py-4.5 text-sm text-ink", className)}>
      <Link href="/dashboard" aria-label="Reeldeal home" className="w-fit rounded-sm px-1.5 py-1">
        <Logo size="sm" />
      </Link>

      {/* Workspace switching arrives with organisations (Phase 3). */}
      <div className="flex items-center gap-2.5 rounded-md border border-line bg-surface-muted px-2.5 py-2">
        <Avatar initials={ws.initials} label={ws.name} shape="square" className="bg-primary text-primary-foreground" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{ws.name}</span>
          <span className="text-xs text-ink-muted">{ws.kind}</span>
        </span>
      </div>

      <Button asChild variant="action" className="w-full">
        <Link href="/autopilot">
          <Plus aria-hidden strokeWidth={2.4} />
          New video
        </Link>
      </Button>

      <ul className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          if (!("href" in item)) {
            return (
              <li key={item.label}>
                <span aria-disabled="true" className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-ink-muted">
                  <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  <span className="font-mono text-[10px] tracking-wide uppercase">Soon</span>
                </span>
              </li>
            );
          }
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors",
                  current ? "bg-surface-muted font-semibold text-link" : "hover:bg-surface-muted",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-3 rounded-lg bg-surface-muted p-3.5">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{planName} plan</span>
          <span className="text-xs text-ink-muted">Sample usage</span>
        </div>
        {meters.map((m, i) => (
          <div key={m.id}>
            <div className="mb-1.5 flex justify-between text-xs">
              <span>{m.label}</span>
              <span className="font-mono text-ink-muted">{m.value}</span>
            </div>
            <div className="h-1.5 rounded-pill bg-line" role="presentation">
              <div className={cn("h-full rounded-pill", meterFill[i])} style={{ width: `${m.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2.5 px-1.5">
        <Avatar initials={ws.user.initials} label={ws.user.name} />
        <span className="flex-1 truncate text-[13px]">{ws.user.name}</span>
        <Link href="/settings/appearance" aria-label="Settings" className="inline-flex size-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink">
          <Settings className="size-[18px]" strokeWidth={1.8} aria-hidden />
        </Link>
      </div>
    </nav>
  );
}
