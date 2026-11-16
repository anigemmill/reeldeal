import { Accent, MarketingPage, SectionEyebrow } from "@/components/marketing/shared";
import { Container, Eyebrow } from "@/components/ui/misc";
import { DEMO_EMAIL, DEMO_POINTS } from "@/content/demo";
import { DemoForm } from "./demo-form";

/* Book a demo and contact (design/website/W-Demo.dc.html). */
export function DemoScreen() {
  return (
    <MarketingPage>
      <section aria-labelledby="demo-title" className="pt-10 pb-24 sm:pt-14 sm:pb-28">
        <Container className="flex flex-wrap items-start gap-12">
          <div className="min-w-0 flex-[1_1_400px] pt-6">
            <SectionEyebrow>Book a demo</SectionEyebrow>
            <h1 id="demo-title" className="mb-5.5 font-display text-[clamp(44px,5.4vw,80px)] leading-[0.95] font-semibold tracking-[-0.045em]">
              See it with <Accent>your own footage.</Accent>
            </h1>
            <p className="mb-8 max-w-[460px] text-lg leading-relaxed text-ink-muted">
              Send us a handful of clips before the call and we will build your first videos live, in 30 minutes.
            </p>
            <ul className="mb-10 flex flex-col gap-3.5 text-base">
              {DEMO_POINTS.map((p) => (
                <li key={p.text} className="flex items-center gap-3">
                  <span aria-hidden className={`size-2.5 flex-none rounded-full ${p.dot}`} />
                  {p.text}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 rounded-[22px] border border-line bg-surface p-5.5 text-[15px]">
              <Eyebrow>Prefer email?</Eyebrow>
              {/* Not a mailto link until the owner supplies the address. */}
              <span className="font-semibold">{DEMO_EMAIL}</span>
              <span className="text-ink-muted">We reply within one working day.</span>
            </div>
          </div>

          <div className="min-w-0 flex-[1.1_1_520px] rounded-[30px] bg-grad-blue p-[3px]">
            <div className="rounded-[27px] bg-surface p-6 sm:p-10">
              <h2 className="sr-only">Booking details</h2>
              <DemoForm />
            </div>
          </div>
        </Container>
      </section>
    </MarketingPage>
  );
}
