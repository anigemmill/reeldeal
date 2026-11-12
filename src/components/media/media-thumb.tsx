import { Play } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { formatDuration, type MediaAsset } from "@/content/media";
import { MediaArt, PlaceholderTag } from "./media-art";

/*
  Thumbnail for an image or clip: aspect-ratio box, duration, optional AI score,
  processing overlay ("Uploading 42%", "Analysing"), and selection ring.
*/
export type ProcessingState = { stage: "uploading" | "analysing"; progress?: number };

const ratios = { "16:9": "aspect-video", "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]" } as const;

export function MediaThumb({
  asset,
  ratio = "16:9",
  score,
  processing,
  selected,
  showTag = true,
  showDuration = true,
  className,
  ...props
}: {
  asset: MediaAsset;
  ratio?: keyof typeof ratios;
  /** AI quality score, 0–100. */
  score?: number;
  processing?: ProcessingState;
  selected?: boolean;
  showTag?: boolean;
  showDuration?: boolean;
} & ComponentProps<"div">) {
  const isPlaceholder = !asset.src;
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-md bg-surface-muted",
        ratios[ratio],
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-bg",
        className,
      )}
      {...props}
    >
      <MediaArt asset={asset} className={cn(processing && "scale-105 blur-[2px]")} />
      {isPlaceholder && showTag && !processing && <PlaceholderTag />}

      {score !== undefined && !processing && (
        <span
          className="absolute top-2 right-2 inline-flex h-6 items-center gap-1 rounded-pill bg-ai px-2 font-mono text-[11px] font-medium text-ai-foreground"
          title="AI quality score"
        >
          <span className="sr-only">AI score</span>
          {score}
        </span>
      )}
      {showDuration && asset.kind === "video" && asset.duration !== undefined && !processing && (
        <span className="absolute right-2 bottom-2 inline-flex h-6 items-center gap-1 rounded-pill bg-media-veil/55 px-2 font-mono text-[11px] text-on-media backdrop-blur-sm">
          <Play className="size-3 fill-current" aria-hidden />
          <span className="sr-only">Duration</span>
          {formatDuration(asset.duration)}
        </span>
      )}
      {processing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-media-veil/45 p-3 text-center text-on-media">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide uppercase">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-ai motion-reduce:animate-none" />
            {processing.stage === "uploading" ? "Uploading" : "Analysing"}
            {processing.progress !== undefined && ` ${Math.round(processing.progress)}%`}
          </span>
          {processing.progress !== undefined && (
            <span className="h-1 w-2/3 overflow-hidden rounded-pill bg-on-media/30" aria-hidden>
              <span className="block h-full rounded-pill bg-ai" style={{ width: `${processing.progress}%` }} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
