import {
  DM_Sans,
  Geist_Mono,
  Instrument_Serif,
  Inter,
  Manrope,
  Sora,
  Space_Grotesk,
} from "next/font/google";

/*
  Each font only publishes a CSS variable. tokens/tokens.css reads these through
  --rd-font-display / -body / -mono / -accent, and .type-a / .type-b / .type-c pick
  the combination. Swapping a typeface means changing this file or the tokens,
  never the components.

  Combination A (default) and the shared fonts are preloaded. B and C are declared
  but not preloaded: the browser only downloads them when a page uses them.
*/

// A: Space Grotesk + Inter
export const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

// B: Sora + DM Sans
export const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", preload: false });
export const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap", preload: false });

// C: Manrope throughout
export const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });

// Shared by all combinations
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
// Instrument Serif is italic only: one or two emphasis words per headline.
export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
  display: "swap",
});

/** Marketing site: brand type only (combination A). */
export const brandFontVariables = [spaceGrotesk, inter, geistMono, instrumentSerif]
  .map((f) => f.variable)
  .join(" ");

/** App and review pages: every combination, so the user's type choice can apply. */
export const allFontVariables = [spaceGrotesk, inter, sora, dmSans, manrope, geistMono, instrumentSerif]
  .map((f) => f.variable)
  .join(" ");
