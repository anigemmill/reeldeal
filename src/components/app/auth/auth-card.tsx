import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/* Centered card used by sign-in, sign-up, password reset and onboarding. */
export function AuthCard({ title, accent, intro, children, footer }: { title: string; accent?: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <Link href="/" aria-label="Reeldeal home" className="w-fit self-center rounded-sm px-1.5 py-1">
          <Logo size="sm" />
        </Link>
        <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <header className="flex flex-col gap-2">
            <h1 className="font-display text-[30px] leading-[1.05] font-semibold tracking-display">
              {title} {accent ? <em className="font-accent font-normal">{accent}</em> : null}
            </h1>
            {intro ? <p className="text-[15px] leading-relaxed text-ink-muted">{intro}</p> : null}
          </header>
          {children}
        </section>
        {footer ? <p className="text-center text-sm text-ink-muted">{footer}</p> : null}
      </div>
    </main>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "notice"; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={tone === "error" ? "rounded-md border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-ink" : "rounded-md border border-success/40 bg-success/10 px-3.5 py-2.5 text-sm text-ink"}>
      {children}
    </p>
  );
}
