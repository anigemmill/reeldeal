"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { Logo } from "@/components/brand/logo";
import { MediaArt } from "@/components/media/media-art";
import { Button } from "@/components/ui/button";
import { getMedia } from "@/content/media";
import { MAIN_NAV } from "@/content/site";
import { cn } from "@/lib/utils";

/* Marketing header (design/components/Nav.dc.html) with the full-screen mobile menu (W-Menu). */
export function SiteHeader({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <header className={cn("mx-auto flex w-full max-w-container items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10", className)}>
      <Link href="/" aria-label="Reeldeal home" className="rounded-sm">
        <Logo />
      </Link>

      <nav aria-label="Main" className="hidden rounded-pill border border-line bg-surface p-1 text-sm font-medium lg:flex">
        {MAIN_NAV.map((l) => {
          const current = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current ? "page" : undefined}
              className={cn("rounded-pill px-4 py-2 transition-colors", current ? "bg-ink text-bg" : "text-ink hover:bg-surface-muted")}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 text-sm font-medium">
        <Link href="/login" className="hidden rounded-sm px-2 py-2.5 sm:inline-block">
          Sign in
        </Link>
        <Button asChild variant="secondary" shape="pill" size="sm" className="hidden h-10 md:inline-flex">
          <Link href="/demo">Book a demo</Link>
        </Button>
        <Button asChild variant="primary" shape="pill" size="sm" className="h-10 px-4.5 font-semibold">
          <Link href="/signup">Start free</Link>
        </Button>
        <MobileMenu />
      </div>
    </header>
  );
}

function MobileMenu() {
  const tiles = (["lake-kayak", "geo-valley", "coast-sail"] as const).map(getMedia);
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="Open menu" className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface lg:hidden">
          <Menu className="size-5" aria-hidden />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        {/* The menu is a Dark Studio surface on every page. */}
        <Dialog.Content className="mode-studio fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg p-5 text-ink" aria-describedby={undefined}>
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            <Dialog.Close aria-label="Close menu" className="inline-flex size-11 items-center justify-center rounded-full bg-ink text-bg">
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          <nav aria-label="Main" className="mt-12 flex flex-col items-start gap-0.5">
            {[{ label: "Home", href: "/" }, ...MAIN_NAV].map((l) => (
              <Dialog.Close asChild key={l.href}>
                <Link
                  href={l.href}
                  className="-ml-3.5 rounded-lg px-3.5 font-display text-[clamp(36px,11vw,46px)] leading-[1.12] font-semibold tracking-display hover:bg-tint hover:text-on-tint focus-visible:bg-tint focus-visible:text-on-tint"
                >
                  {l.label}
                </Link>
              </Dialog.Close>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-4 pt-10">
            <div className="flex gap-2" aria-hidden>
              {tiles.map((a) => (
                <div key={a.id} className="relative h-24 flex-1 overflow-hidden rounded-lg">
                  <MediaArt asset={a} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button asChild variant="primary" shape="pill" size="lg" className="flex-1">
                <Link href="/signup">Start free</Link>
              </Button>
              <Button asChild variant="secondary" shape="pill" size="lg" className="flex-1 bg-transparent">
                <Link href="/demo">Book a demo</Link>
              </Button>
            </div>
            <Link href="/login" className="py-2 text-center text-[15px] text-ink-muted">
              Sign in
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
