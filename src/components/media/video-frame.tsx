import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { MediaAsset } from "@/content/media";
import { MediaArt, PlaceholderTag } from "./media-art";

/*
  Aspect-ratio-aware frame for previews. `safeZones` overlays the areas social
  platforms cover with UI (captions, buttons) so text can be kept clear of them.
  The frame fits inside its parent (contain), whatever the ratio.
*/
export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";
const ar: Record<AspectRatio, string> = { "16:9": "16 / 9", "9:16": "9 / 16", "1:1": "1 / 1", "4:5": "4 / 5" };

export function VideoFrame({
  asset,
  ratio = "16:9",
  safeZones,
  showTag = true,
  overlay,
  className,
}: {
  asset: MediaAsset;
  ratio?: AspectRatio;
  safeZones?: boolean;
  showTag?: boolean;
  /** Content drawn over the picture, e.g. on-screen text. */
  overlay?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex size-full items-center justify-center", className)}>
      <div
        className="relative isolate max-h-full max-w-full overflow-hidden rounded-md bg-media-veil"
        style={{ aspectRatio: ar[ratio], height: ratio === "16:9" ? "auto" : "100%", width: ratio === "16:9" ? "100%" : "auto" }}
      >
        <MediaArt asset={asset} />
        {overlay}
        {safeZones && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-0 top-0 h-[12%] border-b border-dashed border-on-media/60 bg-on-media/10" />
            <div className="absolute inset-x-0 bottom-0 h-[20%] border-t border-dashed border-on-media/60 bg-on-media/10" />
            {ratio === "9:16" && <div className="absolute top-[12%] right-0 bottom-[20%] w-[14%] border-l border-dashed border-on-media/60 bg-on-media/10" />}
            <span className="absolute right-2 bottom-2 rounded-sm bg-media-veil/50 px-1.5 py-0.5 font-mono text-[10px] text-on-media">Safe zones</span>
          </div>
        )}
        {!asset.src && showTag && <PlaceholderTag />}
      </div>
    </div>
  );
}
