import { cn } from "@/lib/utils";

type Tone = "primary" | "ai" | "success" | "muted";
const fill: Record<Tone, string> = {
  primary: "bg-primary",
  ai: "bg-ai",
  success: "bg-success",
  muted: "bg-ink-muted",
};
const stroke: Record<Tone, string> = {
  primary: "stroke-primary",
  ai: "stroke-ai",
  success: "stroke-success",
  muted: "stroke-ink-muted",
};

/** Linear progress. Omit `value` for an indeterminate bar. */
export function ProgressBar({
  value,
  label,
  tone = "primary",
  size = "md",
  className,
}: {
  value?: number;
  label: string;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = value === undefined ? undefined : Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("w-full overflow-hidden rounded-pill bg-line", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div
        className={cn(
          "h-full rounded-pill transition-[width] duration-(--rd-dur-slow) ease-brand",
          fill[tone],
          pct === undefined && "w-1/3 animate-pulse motion-reduce:animate-none",
        )}
        style={pct === undefined ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}

/** Circular progress with the value in the middle (Generate and Autopilot working states). */
export function ProgressRing({
  value,
  label,
  tone = "ai",
  size = 96,
  stroke: strokeWidth = 8,
  children,
  className,
}: {
  value: number;
  label: string;
  tone?: Tone;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-line" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className={cn(stroke[tone], "transition-[stroke-dashoffset] duration-(--rd-dur-slow) ease-brand")}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {children ?? <span className="font-mono text-sm text-ink">{Math.round(pct)}%</span>}
      </div>
    </div>
  );
}
