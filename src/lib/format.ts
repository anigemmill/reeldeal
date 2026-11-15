/* Display formatting for real data (no business rules). */

export function relativeTime(isoDate: string | null | undefined, now = Date.now()) {
  if (!isoDate) return "";
  const s = Math.round((now - new Date(isoDate).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(isoDate).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

export function duration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined) return "–";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function bytes(n: number | null | undefined) {
  if (!n) return "–";
  if (n < 1e6) return `${Math.max(1, Math.round(n / 1e3))} KB`;
  if (n < 1e9) return `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`;
  return `${(n / 1e9).toFixed(2)} GB`;
}

export const ratioOf = (w: number | null | undefined, h: number | null | undefined) => {
  if (!w || !h) return null;
  const r = w / h;
  const known: [string, number][] = [["9:16", 9 / 16], ["4:5", 0.8], ["1:1", 1], ["16:9", 16 / 9]];
  const best = known.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a));
  return Math.abs(best[1] - r) < 0.04 ? best[0] : `${w}×${h}`;
};
