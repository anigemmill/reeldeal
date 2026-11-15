import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandEditor } from "@/components/app/brands/brand-editor";
import { PageLoading } from "@/components/app/page-loading";
import { requireAppContext } from "@/server/app/session";
import { permissionsFor } from "@/server/auth/principal";

export const metadata: Metadata = { title: "New brand" };

async function NewBrand() {
  const { ctx } = await requireAppContext("/brands/new");
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
      <h1 className="font-display text-[32px] font-semibold tracking-[-0.03em]">New brand</h1>
      <BrandEditor brand={{}} canEdit={permissionsFor(ctx.principal).can_create_and_edit} logoUrl={null} versions={[]} assets={[]} />
    </div>
  );
}

export default function NewBrandPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewBrand />
    </Suspense>
  );
}
