import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/content/media";
import { Scene } from "./scene";

/*
  Renders a media asset filling its (relatively positioned) parent: the real
  image/poster when `src` is set, otherwise the placeholder scene.
*/
export function MediaArt({ asset, className, sizes }: { asset: MediaAsset; className?: string; sizes?: string }) {
  if (asset.src) {
    const src = asset.kind === "video" ? (asset.poster ?? asset.src) : asset.src;
    // Plain <img>: real assets will come from object storage via signed URLs (Phase 3).
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={asset.alt} sizes={sizes} className={cn("absolute inset-0 size-full object-cover", className)} />;
  }
  return <Scene variant={asset.placeholder ?? "lake-morning"} label={`Placeholder image: ${asset.alt}`} className={className} />;
}

/** Small corner tag so placeholder media is always identifiable. */
export function PlaceholderTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute top-2 left-2 rounded-pill bg-media-veil/45 px-2 py-0.5 font-mono text-[10px] tracking-wide text-on-media uppercase backdrop-blur-sm",
        className,
      )}
    >
      Placeholder
    </span>
  );
}
