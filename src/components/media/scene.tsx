/*
  PLACEHOLDER ARTWORK. Illustrated cinematic stills standing in for real
  photography and footage until the owner's asset library exists (see
  docs/decisions.md). Replace assets in src/content/media.ts, not here.

  Colours in this file are artwork, not UI: they describe a picture the way a
  photo's pixels would, so they are exempt from the semantic-token rule
  (allow-listed in scripts/check-tokens.ts).

  Everything is deterministic (seeded), so server and client render identically.
  The scene is drawn on a 1600×900 canvas and cropped to fill any aspect ratio;
  subjects sit near the centre so 9:16 crops keep them.
*/

export const SCENE_VARIANTS = [
  "alpine-dawn",
  "lake-morning",
  "coast-sunset",
  "forest-trail",
  "geothermal",
  "night-sky",
  "vineyard",
  "harbour-dusk",
  "beach-day",
] as const;
export type SceneVariant = (typeof SCENE_VARIANTS)[number];

type Ridge = { color: string; base: number; amp: number; seed: number; rough?: number; smooth?: boolean; opacity?: number };
type Subject = "kayak" | "sailboat" | "hiker" | "lodge" | "jetty" | "palms" | "cyclist";
type Def = {
  sky: [string, string, string];
  sun?: { x: number; y: number; r: number; color: string; glow: string };
  stars?: boolean;
  ridges: Ridge[];
  water?: { y: number; top: string; bottom: string; glitter?: string; reflect?: number };
  front?: Ridge[];
  mist?: { y: number; color: string; opacity: number };
  steam?: boolean;
  rows?: string;
  lights?: string;
  rays?: string;
  subject?: { kind: Subject; x: number; y: number; scale?: number; color: string };
};

const SCENES: Record<SceneVariant, Def> = {
  "alpine-dawn": {
    sky: ["#3D3A6B", "#C98A9B", "#F6CDA8"],
    sun: { x: 900, y: 290, r: 46, color: "#FFF1D9", glow: "#FFD9B0" },
    ridges: [
      { color: "#B48AA6", base: 560, amp: 300, seed: 3, rough: 0.58 },
      { color: "#93668A", base: 600, amp: 300, seed: 11, rough: 0.56 },
      { color: "#5C3D61", base: 730, amp: 220, seed: 21, rough: 0.55 },
      { color: "#281B37", base: 860, amp: 130, seed: 5, rough: 0.5 },
    ],
    mist: { y: 56, color: "#F6CDA8", opacity: 0.22 },
    subject: { kind: "hiker", x: 800, y: 800, scale: 1.2, color: "#160F22" },
  },
  "lake-morning": {
    sky: ["#9DBFD9", "#CFE2EE", "#EEF3F2"],
    sun: { x: 690, y: 250, r: 40, color: "#FFFFFF", glow: "#FFFFFF" },
    ridges: [
      { color: "#9CB3C2", base: 470, amp: 150, seed: 8, smooth: true },
      { color: "#6F8F92", base: 520, amp: 90, seed: 14, smooth: true },
      { color: "#3F6457", base: 560, amp: 40, seed: 30, rough: 0.7 },
    ],
    water: { y: 560, top: "#8FB2C4", bottom: "#2E566B", glitter: "#FFFFFF", reflect: 0.32 },
    front: [{ color: "#1D3A2F", base: 880, amp: 60, seed: 41, rough: 0.8 }],
    mist: { y: 61, color: "#FFFFFF", opacity: 0.4 },
    subject: { kind: "kayak", x: 830, y: 690, scale: 1, color: "#E8622C" },
  },
  "coast-sunset": {
    sky: ["#4B4E7A", "#E3896B", "#FFD49B"],
    sun: { x: 820, y: 520, r: 70, color: "#FFE9B8", glow: "#FFB979" },
    ridges: [{ color: "#8C5A61", base: 545, amp: 60, seed: 4, smooth: true, opacity: 0.85 }],
    water: { y: 545, top: "#C6806E", bottom: "#24364F", glitter: "#FFE2A8", reflect: 0 },
    front: [{ color: "#2A1F2B", base: 760, amp: 260, seed: 17, rough: 0.55 }],
    subject: { kind: "sailboat", x: 640, y: 610, scale: 1, color: "#1E1A26" },
  },
  "forest-trail": {
    sky: ["#B9D3B0", "#DCE8CF", "#F1F2DD"],
    rays: "#FFF7D6",
    ridges: [
      { color: "#8FAE86", base: 430, amp: 120, seed: 9, rough: 0.9, opacity: 0.9 },
      { color: "#5E8562", base: 520, amp: 160, seed: 2, rough: 0.95 },
      { color: "#355A42", base: 620, amp: 200, seed: 19, rough: 0.95 },
      { color: "#1B3326", base: 760, amp: 260, seed: 27, rough: 0.98 },
    ],
    mist: { y: 52, color: "#F1F2DD", opacity: 0.35 },
    subject: { kind: "cyclist", x: 800, y: 842, scale: 0.9, color: "#0F1F16" },
  },
  geothermal: {
    sky: ["#6F7F8E", "#A9B3BA", "#CDD2D0"],
    steam: true,
    ridges: [
      { color: "#9A9C93", base: 470, amp: 140, seed: 6, smooth: true },
      { color: "#787468", base: 560, amp: 110, seed: 12, rough: 0.6 },
      { color: "#55503F", base: 680, amp: 80, seed: 33, rough: 0.5 },
    ],
    water: { y: 760, top: "#6FB7B2", bottom: "#2F6F73", reflect: 0 },
    front: [{ color: "#2C2A22", base: 880, amp: 50, seed: 44, rough: 0.6 }],
  },
  "night-sky": {
    sky: ["#0B1030", "#1F2A5A", "#43507E"],
    stars: true,
    sun: { x: 1120, y: 200, r: 34, color: "#F3E9CF", glow: "#B9C1E6" },
    ridges: [
      { color: "#28325E", base: 520, amp: 220, seed: 15, rough: 0.6 },
      { color: "#1A2148", base: 640, amp: 140, seed: 25, rough: 0.55 },
      { color: "#0C1129", base: 780, amp: 60, seed: 35, smooth: true },
    ],
    lights: "#FFC56B",
    subject: { kind: "lodge", x: 760, y: 788, scale: 1, color: "#070A1C" },
  },
  vineyard: {
    sky: ["#7FA6C9", "#F2C98F", "#FBE3B5"],
    sun: { x: 930, y: 400, r: 52, color: "#FFF0C4", glow: "#FFD27E" },
    ridges: [
      { color: "#A7A47F", base: 480, amp: 90, seed: 7, smooth: true },
      { color: "#8C8B55", base: 560, amp: 110, seed: 13, smooth: true },
    ],
    front: [{ color: "#5E6A2E", base: 700, amp: 110, seed: 23, smooth: true }],
    rows: "#3E4A1E",
  },
  "harbour-dusk": {
    sky: ["#1E2B56", "#5A64A0", "#E4A08C"],
    ridges: [{ color: "#3A3F6C", base: 470, amp: 120, seed: 10, smooth: true }],
    water: { y: 590, top: "#4B5689", bottom: "#141B38", glitter: "#FFC979", reflect: 0.25 },
    lights: "#FFC979",
    subject: { kind: "jetty", x: 800, y: 640, scale: 1, color: "#10142A" },
  },
  "beach-day": {
    sky: ["#3E8FD0", "#8CC6EC", "#D9F0FA"],
    sun: { x: 640, y: 170, r: 44, color: "#FFFFFF", glow: "#FFFFFF" },
    ridges: [{ color: "#5D9B8A", base: 480, amp: 70, seed: 16, smooth: true, opacity: 0.8 }],
    water: { y: 500, top: "#1F9FB7", bottom: "#5BD1D0", glitter: "#FFFFFF", reflect: 0 },
    front: [{ color: "#EBD6AE", base: 790, amp: 50, seed: 31, smooth: true }],
    subject: { kind: "palms", x: 930, y: 800, scale: 1.2, color: "#1F4A38" },
  },
};

/* ---- generators -------------------------------------------------------- */

function rng(seed: number) {
  let a = seed * 9301 + 49297;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Midpoint-displacement ridgeline across the canvas, closed to the bottom. */
function ridgePath({ base, amp, seed, rough = 0.6, smooth }: Ridge, mirror = false): string {
  const rand = rng(seed);
  const n = 64;
  const ys = new Array(n + 1).fill(0);
  ys[0] = rand() - 0.5;
  ys[n] = rand() - 0.5;
  let step = n;
  let scale = 1;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < n; i += step) {
      ys[i] = (ys[i - half] + ys[i + half]) / 2 + (rand() - 0.5) * scale;
    }
    step = half;
    scale *= rough;
  }
  const pts = ys.map((y, i) => [-20 + (i * 1640) / n, base - (y + 0.5) * amp] as const);
  const bottom = 900;
  const flip = (y: number) => (mirror ? 2 * base - y : y);
  let d = `M${pts[0][0].toFixed(1)} ${flip(pts[0][1]).toFixed(1)}`;
  if (smooth) {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const mx = (x0 + x1) / 2;
      d += ` Q${x0.toFixed(1)} ${flip(y0).toFixed(1)} ${mx.toFixed(1)} ${flip((y0 + y1) / 2).toFixed(1)}`;
    }
    d += ` L${pts[n][0].toFixed(1)} ${flip(pts[n][1]).toFixed(1)}`;
  } else {
    for (let i = 1; i < pts.length; i++) d += ` L${pts[i][0].toFixed(1)} ${flip(pts[i][1]).toFixed(1)}`;
  }
  return mirror ? `${d} L1620 ${base} L-20 ${base} Z` : `${d} L1620 ${bottom} L-20 ${bottom} Z`;
}

function SubjectShape({ kind, x, y, scale = 1, color }: NonNullable<Def["subject"]>) {
  const t = `translate(${x} ${y}) scale(${scale})`;
  switch (kind) {
    case "kayak":
      return (
        <g transform={t}>
          <path d="M-70 0 Q0 14 70 0 Q0 6 -70 0Z" fill={color} />
          <circle cx="0" cy="-16" r="6" fill="#18242B" />
          <path d="M-5 -10 L5 -10 L6 0 L-6 0Z" fill="#18242B" />
          <path d="M-46 -26 L46 6" stroke="#18242B" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M-90 8 Q0 20 90 8" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" fill="none" />
        </g>
      );
    case "sailboat":
      return (
        <g transform={t}>
          <path d="M-46 0 L46 0 L34 14 L-34 14Z" fill={color} />
          <path d="M0 -2 L0 -120 L44 -8Z" fill={color} />
          <path d="M-4 -2 L-4 -100 L-40 -8Z" fill={color} fillOpacity="0.85" />
        </g>
      );
    case "hiker":
      return (
        <g transform={t} fill={color}>
          <circle cx="0" cy="-46" r="7" />
          <path d="M-7 -38 L7 -38 L9 -14 L4 0 L-1 0 L1 -14 L-3 -14 L-6 0 L-11 0 L-8 -14Z" />
          <path d="M6 -36 L16 -34 L17 -18 L8 -20Z" />
          <path d="M-12 -30 L-22 2" stroke={color} strokeWidth="2" />
        </g>
      );
    case "cyclist":
      return (
        <g transform={t} fill="none" stroke={color} strokeWidth="4">
          <circle cx="-24" cy="-14" r="14" />
          <circle cx="24" cy="-14" r="14" />
          <path d="M-24 -14 L-4 -36 L16 -36 L24 -14 M-4 -36 L4 -14 L-24 -14" />
          <circle cx="2" cy="-66" r="7" fill={color} stroke="none" />
          <path d="M2 -58 L-2 -40 L4 -14 M0 -54 L16 -40" />
        </g>
      );
    case "lodge":
      return (
        <g transform={t}>
          <path d="M-90 0 L-90 -50 L-30 -96 L30 -50 L30 0Z" fill={color} />
          <path d="M30 0 L30 -36 L90 -36 L90 0Z" fill={color} />
          <rect x="-66" y="-40" width="16" height="18" fill="#FFC56B" />
          <rect x="-40" y="-40" width="16" height="18" fill="#FFC56B" opacity="0.85" />
          <rect x="44" y="-26" width="30" height="14" fill="#FFC56B" opacity="0.9" />
          <path d="M-30 -96 L-30 -110 L-20 -110 L-20 -88" fill={color} />
        </g>
      );
    case "jetty":
      return (
        <g transform={t} fill={color}>
          <rect x="-260" y="-6" width="520" height="8" />
          {[-240, -160, -80, 0, 80, 160, 240].map((px) => (
            <rect key={px} x={px - 3} y="-6" width="6" height="34" />
          ))}
          <path d="M120 -10 L200 -10 L190 -2 L130 -2Z" />
          <path d="M160 -10 L160 -70 L190 -14Z" />
        </g>
      );
    case "palms":
      return (
        <g transform={t} fill={color}>
          {[0, 70].map((dx, i) => (
            <g key={dx} transform={`translate(${dx} 0) scale(${i ? 0.8 : 1})`}>
              <path d="M-4 0 Q-10 -90 10 -180 L16 -178 Q0 -90 6 0Z" />
              <path d="M12 -180 Q60 -200 90 -160 Q50 -180 12 -176Z" />
              <path d="M12 -180 Q-40 -210 -80 -170 Q-30 -186 12 -176Z" />
              <path d="M12 -182 Q30 -240 70 -240 Q30 -224 14 -178Z" />
              <path d="M12 -182 Q-10 -236 -50 -236 Q-12 -218 10 -178Z" />
            </g>
          ))}
        </g>
      );
  }
}

/* ---- component --------------------------------------------------------- */

export function Scene({ variant, label, className }: { variant: SceneVariant; label: string; className?: string }) {
  const s = SCENES[variant];
  const starRand = rng(99);
  return (
    <div
      role="img"
      aria-label={label}
      className={`absolute inset-0 overflow-hidden ${className ?? ""}`}
      style={{ background: `linear-gradient(180deg, ${s.sky[0]} 0%, ${s.sky[1]} 52%, ${s.sky[2]} 100%)` }}
    >
      <svg
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        {s.stars &&
          Array.from({ length: 70 }, (_, i) => (
            <circle
              key={i}
              cx={starRand() * 1600}
              cy={starRand() * 460}
              r={starRand() * 1.6 + 0.4}
              fill="#FFFFFF"
              opacity={starRand() * 0.6 + 0.3}
            />
          ))}
        {s.sun && (
          <g>
            {[6, 4.2, 3, 2.1, 1.5].map((m, i) => (
              <circle key={m} cx={s.sun!.x} cy={s.sun!.y} r={s.sun!.r * m} fill={s.sun!.glow} opacity={0.07 + i * 0.03} />
            ))}
            <circle cx={s.sun.x} cy={s.sun.y} r={s.sun.r} fill={s.sun.color} />
          </g>
        )}
        {s.rays &&
          [300, 620, 980, 1250].map((x, i) => (
            <path key={x} d={`M${x} -40 L${x + 120} -40 L${x - 160 + i * 20} 900 L${x - 330 + i * 20} 900Z`} fill={s.rays} opacity="0.13" />
          ))}
        {s.ridges.map((r, i) => (
          <path key={i} d={ridgePath(r)} fill={r.color} opacity={r.opacity ?? 1} />
        ))}
        {s.water && (
          <g>
            {Array.from({ length: 12 }, (_, i) => {
              const h = (900 - s.water!.y) / 12;
              return (
                <rect key={i} x="-20" y={s.water!.y + i * h} width="1640" height={h + 1} fill={mix(s.water!.top, s.water!.bottom, i / 11)} />
              );
            })}
            {s.water.reflect
              ? s.ridges.map((r, i) => (
                  <path key={i} d={ridgePath({ ...r, base: s.water!.y }, true)} fill={r.color} opacity={s.water!.reflect! * (0.6 + i * 0.2)} />
                ))
              : null}
            {s.water.glitter &&
              Array.from({ length: 26 }, (_, i) => {
                const g = rng(200 + i);
                const cx = (s.sun?.x ?? 800) + (g() - 0.5) * 360 * (1 + i / 13);
                const y = s.water!.y + 14 + i * ((900 - s.water!.y) / 28);
                return <rect key={i} x={cx} y={y} width={30 + g() * 90} height={2 + i / 8} rx="2" fill={s.water!.glitter} opacity={0.5 - i / 70} />;
              })}
          </g>
        )}
        {s.front?.map((r, i) => (
          <path key={i} d={ridgePath(r)} fill={r.color} opacity={r.opacity ?? 1} />
        ))}
        {s.rows &&
          Array.from({ length: 11 }, (_, i) => (
            <path
              key={i}
              d={`M${-200 + i * 60} 900 Q${500 + i * 70} ${730 - i * 6} ${1700} ${640 + i * 14}`}
              stroke={s.rows}
              strokeWidth={9 - i * 0.5}
              fill="none"
              opacity="0.75"
            />
          ))}
        {s.lights &&
          Array.from({ length: 22 }, (_, i) => {
            const g = rng(300 + i);
            const x = 200 + g() * 1200;
            const y = (s.water?.y ?? 760) - 6 - g() * 30;
            return <rect key={i} x={x} y={y} width="5" height="5" rx="1" fill={s.lights} opacity={0.6 + g() * 0.4} />;
          })}
        {s.subject && <SubjectShape {...s.subject} />}
      </svg>
      {s.mist && (
        <div
          aria-hidden
          className="absolute inset-x-0 h-[22%] blur-xl"
          style={{ top: `${s.mist.y}%`, background: s.mist.color, opacity: s.mist.opacity }}
        />
      )}
      {s.steam && (
        <div aria-hidden className="absolute inset-0">
          {[
            [34, 40, 22, 44],
            [50, 30, 18, 56],
            [62, 50, 14, 34],
          ].map(([l, t, w, h]) => (
            <span
              key={l}
              className="absolute rounded-full bg-white blur-2xl"
              style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, opacity: 0.75 }}
            />
          ))}
        </div>
      )}
      {/* Lens vignette and film grain, so placeholders read as photographic stills. */}
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(130% 100% at 50% 40%, transparent 55%, rgba(0,0,0,0.38) 100%)" }} />
      <div aria-hidden className="absolute inset-0 opacity-[0.16] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}

/** Mix two #RRGGBB colours (for banded water). */
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
}

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.4 -0.2"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>',
)}")`;
