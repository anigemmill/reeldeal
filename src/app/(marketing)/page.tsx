import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Container, Eyebrow } from "@/components/ui/misc";

// CHECKPOINT 1 PLACEHOLDER between the real header and footer. The designed homepage arrives at Checkpoint 2.
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Container className="flex min-h-[50vh] flex-col justify-center gap-4 py-20">
          <Eyebrow>Placeholder · Checkpoint 1</Eyebrow>
          <h1 className="font-display text-[length:var(--rd-display-md)] leading-[0.95] font-semibold tracking-display">
            Homepage <em className="font-accent font-normal">coming next</em>
          </h1>
          <p className="max-w-prose text-ink-muted">Header, mobile menu and footer are built. The homepage sections arrive at Checkpoint 2.</p>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
