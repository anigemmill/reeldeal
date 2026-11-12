import { Geist_Mono, Instrument_Serif, Inter, Space_Grotesk } from "next/font/google";

/*
  Each font only publishes a CSS variable. tokens/tokens.css reads these through
  --rd-font-display / -body / -mono / -accent, so swapping a typeface means
  changing this file (or the token), never the components.
*/
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

// Instrument Serif is used in italic only (one or two emphasis words per headline).
export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
  display: "swap",
});

export const fontVariables = [spaceGrotesk, inter, geistMono, instrumentSerif]
  .map((font) => font.variable)
  .join(" ");
