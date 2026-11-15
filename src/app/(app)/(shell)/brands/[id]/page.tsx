import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BrandEditor, type BrandData } from "@/components/app/brands/brand-editor";
import { PageLoading } from "@/components/app/page-loading";
import { requireAppContext } from "@/server/app/session";
import { permissionsFor } from "@/server/auth/principal";
import { AppError } from "@/server/errors";
import { getBrand, listBrandVersions } from "@/server/services/brands";
import { mediaThumbnails } from "@/server/services/media";

export const metadata: Metadata = { title: "Brand" };

async function Brand({ params }: PageProps<"/brands/[id]">) {
  const { id } = await params;
  const { ctx } = await requireAppContext("/brands");
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const brand = await getBrand(ctx, id).catch((e) => {
    if (e instanceof AppError && e.code === "not_found") notFound();
    throw e;
  });
  const b = brand as BrandData & { approved_assets?: { id: string; title: string; kind: string }[] };
  const [versions, thumbs] = await Promise.all([listBrandVersions(ctx, id), mediaThumbnails(ctx, [b.logo_media_id, ...(b.approved_assets ?? []).map((a) => a.id)].filter((x): x is string => Boolean(x)))]);
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <div>
        <Link href="/brands" className="text-sm text-link underline-offset-4 hover:underline">
          All brands
        </Link>
        <h1 className="mt-1 font-display text-[32px] font-semibold tracking-[-0.03em]">{b.name}</h1>
        <p className="font-mono text-xs text-ink-muted">Version {b.version}</p>
      </div>
      <BrandEditor
        key={`${b.id}-${b.version}`}
        brand={b}
        canEdit={permissionsFor(ctx.principal).can_create_and_edit}
        logoUrl={b.logo_media_id ? (thumbs[b.logo_media_id] ?? null) : null}
        versions={versions.versions}
        assets={(b.approved_assets ?? []).map((a) => ({ ...a, thumbnail: thumbs[a.id] ?? null }))}
      />
    </div>
  );
}

export default function BrandPage(props: PageProps<"/brands/[id]">) {
  return (
    <Suspense fallback={<PageLoading label="Loading brand" />}>
      <Brand {...props} />
    </Suspense>
  );
}
