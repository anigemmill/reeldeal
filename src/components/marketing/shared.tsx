import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { PRIMARY_CTA, SIGN_UP_OPEN } from "@/content/site";

/*
  Building blocks shared by every marketing page (design/website/*.dc.html).
  Pages compose these instead of repeating header, footer and heading styles.
*/

/** Instrument Serif italic emphasis: one or two words per headline. `underline` adds the orange AI underline. */
export function Accent({ children, underline }: { children: ReactNode; underline?: boolean }) {
  return (
    <em className={cn("font-accent font-normal", underline && "underline decoration-ai decoration-[0.07em] underline-offset-[0.14em]")}>{children}</em>
  );
}

/** Mono eyebrow with the orange dot, above section headings. */
export function SectionEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Eyebrow className={cn("mb-4 flex items-center gap-2.5 text-xs", className)}>
      <span aria-hidden className="size-[7px] rounded-full bg-ai" />
      {children}
    </Eyebrow>
  );
}

/** Header, main landmark and footer around a marketing page's content. */
export function MarketingPage({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-clip bg-bg text-ink">
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Standard page intro: eyebrow, display headline and lead paragraph. */
export function PageIntro({
  eyebrow,
  title,
  lead,
  children,
  align = "left",
  titleId = "page-title",
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  align?: "left" | "center";
  titleId?: string;
}) {
  const centred = align === "center";
  return (
    <section aria-labelledby={titleId} className="pt-10 pb-14 sm:pt-16 sm:pb-20">
      <Container className={cn(centred && "text-center")}>
        <SectionEyebrow className={cn(centred && "justify-center")}>{eyebrow}</SectionEyebrow>
        <h1
          id={titleId}
          className={cn(
            "font-display text-[clamp(44px,6.4vw,96px)] leading-[0.95] font-semibold tracking-[-0.045em]",
            centred ? "mx-auto max-w-[1000px]" : "max-w-[1100px]",
          )}
        >
          {title}
        </h1>
        {lead && <p className={cn("mt-6 max-w-[620px] text-lg leading-relaxed text-ink-muted sm:text-xl", centred && "mx-auto")}>{lead}</p>}
        {children}
      </Container>
    </section>
  );
}

/**
 * The conversion paths every page ends in: Start free (self-serve) and Book a demo (sales-led).
 * While sign-up is closed (SIGN_UP_OPEN), only Book a demo.
 */
export function CtaPair({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", className)}>
      <Button asChild variant="primary" shape="pill" size="lg" className="font-semibold">
        <Link href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</Link>
      </Button>
      {SIGN_UP_OPEN && (
        <Button asChild variant="secondary" shape="pill" size="lg" className={cn(onDark && "bg-transparent")}>
          <Link href="/demo">Book a demo</Link>
        </Button>
      )}
    </div>
  );
}
