import { Plus, Shield } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageLoading } from "@/components/app/page-loading";
import { Button } from "@/components/ui/button";
import { getPlan } from "@/lib/pricing";
import { relativeTime } from "@/lib/format";
import { requireAppContext } from "@/server/app/session";
import { permissionsFor } from "@/server/auth/principal";
import { listBrands } from "@/server/services/brands";
import { getMyWorkspace } from "@/server/services/workspace";

export const metadata: Metadata = { title: "Brands" };

async function Brands() {
  const { ctx } = await requireAppContext("/brands");
  const [brands, ws] = await Promise.all([listBrands(ctx), getMyWorkspace(ctx)]);
  const limit = getPlan(ws.plan.id)?.brandProfiles ?? null;
  const canAdd = permissionsFor(ctx.principal).can_create_and_edit && (limit === null || brands.brands.length < limit);
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em]">Brands</h1>
          <p className="mt-1 text-ink-muted">
            {brands.brands.length} of {limit ?? "unlimited"} brand profile{limit === 1 ? "" : "s"} on the {ws.plan.name} plan. Autopilot and the assistant write in your brand&apos;s voice.
          </p>
        </div>
        {canAdd ? (
          <Button asChild variant="primary">
            <Link href="/brands/new">
              <Plus aria-hidden /> New brand
            </Link>
          </Button>
        ) : null}
      </header>
      {brands.brands.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {brands.brands.map((b) => (
            <li key={b.id}>
              <Link href={`/brands/${b.id}`} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-5 hover:border-line-strong">
                <span className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Shield className="size-4 text-primary" aria-hidden /> {b.name}
                </span>
                <span className="text-sm text-ink-muted">{b.description ?? b.industry ?? "No description yet"}</span>
                <span className="font-mono text-[11px] text-ink-muted">
                  v{b.version} · updated {relativeTime(b.updated_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-line bg-surface px-5 py-8 text-center text-ink-muted">No brand profile yet. Create one so videos use your voice, colours and logo.</p>
      )}
    </div>
  );
}

export default function BrandsPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading brands" />}>
      <Brands />
    </Suspense>
  );
}
