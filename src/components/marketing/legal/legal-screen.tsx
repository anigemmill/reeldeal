import Link from "next/link";
import { MarketingPage, SectionEyebrow } from "@/components/marketing/shared";
import { Container } from "@/components/ui/misc";
import { LEGAL_STATUS, type LegalDoc } from "@/content/legal";

/*
  Terms of Service and Privacy Policy layout. The content is placeholders only
  (src/content/legal.ts): the draft notice stays until the owner supplies final text.
*/
export function LegalScreen({ doc }: { doc: LegalDoc }) {
  const other = doc.slug === "terms" ? { href: "/privacy", label: "Privacy Policy" } : { href: "/terms", label: "Terms of Service" };
  return (
    <MarketingPage>
      <section aria-labelledby="page-title" className="pt-10 pb-10 sm:pt-16 sm:pb-14">
        <Container>
          <SectionEyebrow>Legal</SectionEyebrow>
          <h1 id="page-title" className="font-display text-[clamp(44px,6.4vw,88px)] leading-[0.95] font-semibold tracking-[-0.045em]">
            {doc.title} <em className="font-accent font-normal">{doc.accent}</em>
          </h1>
          <div role="note" aria-label="Draft notice" className="mt-8 flex max-w-[760px] flex-col gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-5 py-4">
            <p className="font-mono text-[11px] tracking-label uppercase">{LEGAL_STATUS.label}</p>
            <p className="text-[15px] leading-relaxed">{LEGAL_STATUS.note}</p>
          </div>
          <dl className="mt-6 grid max-w-[760px] gap-x-8 gap-y-2 font-mono text-[13px] text-ink-muted sm:grid-cols-[auto_1fr]">
            <dt>Effective</dt>
            <dd className="text-ink">{LEGAL_STATUS.effectiveDate}</dd>
            <dt>Provider</dt>
            <dd className="text-ink">{LEGAL_STATUS.entity}</dd>
          </dl>
        </Container>
      </section>

      <Container className="grid gap-12 pb-24 lg:grid-cols-[240px_minmax(0,760px)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-3 font-mono text-[11px] tracking-label text-ink-muted uppercase">On this page</p>
          <ol className="flex flex-col gap-2 text-sm">
            {doc.sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ink-muted underline-offset-4 hover:text-ink hover:underline">
                  <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span> {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="flex flex-col gap-10">
          <p className="text-lg leading-relaxed text-ink-muted">{doc.summary}</p>
          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24 border-t border-line pt-6">
              <h2 id={`${s.id}-h`} className="font-display text-2xl font-semibold tracking-[-0.02em]">
                <span className="mr-2 font-mono text-sm font-normal text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                {s.heading}
              </h2>
              <p className="mt-3 rounded-md border border-dashed border-line-strong bg-surface-muted px-4 py-3 font-mono text-[13px] leading-relaxed text-ink-muted">{s.placeholder}</p>
            </section>
          ))}
          <p className="border-t border-line pt-6 text-sm text-ink-muted">
            Questions: {LEGAL_STATUS.contact}. See also the{" "}
            <Link href={other.href} className="text-link underline underline-offset-4">
              {other.label}
            </Link>
            .
          </p>
        </article>
      </Container>
    </MarketingPage>
  );
}
