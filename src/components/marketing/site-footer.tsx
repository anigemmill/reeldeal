import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/misc";
import { FOOTER_NAV } from "@/content/site";

/*
  Marketing footer (design/components/Footer.dc.html): a Dark Studio surface with
  the gradient call-to-action panel and the giant brand wordmark.
*/
export function SiteFooter() {
  return (
    <footer className="mode-studio overflow-hidden bg-bg pt-10 text-ink">
      <Container>
        {/* The panel is a Workspace surface so its text and buttons use light-mode tokens. */}
        <div className="mode-workspace flex flex-wrap items-center justify-between gap-7 rounded-2xl bg-grad-panel p-7 text-ink sm:p-10 lg:p-14">
          <h2 className="max-w-[620px] font-display text-[clamp(34px,4vw,56px)] leading-[0.98] font-semibold tracking-[-0.035em]">
            Bring a folder of clips. <em className="font-accent font-normal">Leave with a week of content.</em>
          </h2>
          <div className="flex flex-wrap gap-2.5">
            <Button asChild shape="pill" size="lg" className="border-0 bg-ink font-semibold text-bg hover:bg-ink/90">
              <Link href="/signup">Start free</Link>
            </Button>
            <Button asChild shape="pill" size="lg" className="border-0 bg-surface hover:bg-surface/90">
              <Link href="/demo">Book a demo</Link>
            </Button>
          </div>
        </div>

        <div className="mt-18 flex flex-wrap justify-between gap-12">
          <div className="max-w-sm flex-[1_1_280px]">
            <p className="mb-4 text-[15px] leading-relaxed text-ink-muted">
              AI video production for businesses. Upload your footage, describe the video, publish everywhere.
            </p>
            {/* Newsletter sign-up hidden until there is more to announce (owner, 2026-11-21). */}
          </div>
          <nav aria-label="Footer" className="grid flex-[2_1_560px] grid-cols-2 gap-7 text-sm sm:grid-cols-4">
            {FOOTER_NAV.map((col) => (
              <div key={col.heading} className="flex flex-col gap-3">
                <Eyebrow>{col.heading}</Eyebrow>
                {col.links.map((l) => (
                  <Link key={l.href} href={l.href} className="w-fit rounded-sm hover:underline">
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-wrap justify-between gap-3 border-t border-line pt-5 text-[13px] text-ink-muted">
          <span>© Reeldeal</span>
          <span className="flex gap-4.5">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="https://www.instagram.com/theoutsidein.nz/" className="hover:underline">
              Instagram
            </a>
          </span>
        </div>
      </Container>
      <Wordmark className="mt-8 translate-y-[8%]" />
    </footer>
  );
}
