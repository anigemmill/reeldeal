"use server";

import { revalidatePath } from "next/cache";
import { withCtx } from "@/server/app/result";
import { createBrand, getBrand, listBrandVersions, updateBrand, type BrandInput } from "@/server/services/brands";
import { mediaThumbnails } from "@/server/services/media";

/* Brand profile actions over the shared brand service (the same one MCP and the creative AI use). */

export async function saveBrand(id: string | null, input: Partial<BrandInput>) {
  const r = await withCtx(async (ctx) => (id ? updateBrand(ctx, id, input) : createBrand(ctx, input as BrandInput)));
  if (r.ok) revalidatePath("/brands", "layout");
  return r;
}

export async function brandDetail(id: string) {
  return withCtx(async (ctx) => {
    const [brand, versions] = await Promise.all([getBrand(ctx, id), listBrandVersions(ctx, id)]);
    const logoId = (brand as { logo_media_id?: string }).logo_media_id;
    const thumbs = await mediaThumbnails(ctx, [logoId, ...(((brand as { approved_assets?: { id: string }[] }).approved_assets ?? []).map((a) => a.id))].filter((x): x is string => Boolean(x)));
    return { brand, versions: versions.versions, thumbnails: thumbs };
  });
}
