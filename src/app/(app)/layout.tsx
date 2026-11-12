import type { Metadata } from "next";
import { ThemeScript } from "@/components/theme/theme-script";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_THEME, themeClassName } from "@/lib/theme";
import { allFontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Reeldeal", template: "%s · Reeldeal" },
  robots: { index: false, follow: false },
};

/*
  Root layout for the logged-in product. Renders the default theme, then
  ThemeScript applies the user's saved palette, mode and type before first paint.
  suppressHydrationWarning: the script changes <html> classes before React hydrates.
*/
export default function AppRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${allFontVariables} ${themeClassName(DEFAULT_THEME)} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh bg-bg text-ink">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
