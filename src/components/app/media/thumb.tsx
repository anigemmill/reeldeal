import { Film, ImageIcon, Music } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Thumbnail for a real media asset or project: a short-lived signed image URL, or
  a neutral tile with the media type when no keyframe exists yet (e.g. before analysis).
*/
const ratios = { "9:16": "aspect-[9/16]", "4:5": "aspect-[4/5]", "1:1": "aspect-square", "16:9": "aspect-video" } as const;

export function Thumb({ src, alt, kind = "video", ratio = "16:9", className, children }: { src?: string | null; alt: string; kind?: string; ratio?: keyof typeof ratios; className?: string; children?: React.ReactNode }) {
  const Icon = kind === "image" ? ImageIcon : kind === "audio" ? Music : Film;
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-surface-muted", ratios[ratio], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URLs (not optimisable)
        <img src={src} alt={alt} loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-ink-muted" aria-label={alt} role="img">
          <Icon className="size-6" strokeWidth={1.5} aria-hidden />
        </div>
      )}
      {children}
    </div>
  );
}
