import type { Metadata } from "next";
import { ReviewToolbar } from "@/components/review/review-toolbar";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_THEME, themeClassName } from "@/lib/theme";
import { allFontVariables } from "../fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Design review", template: "%s · Design review" },
  robots: { index: false, follow: false },
};

/* Root layout for the internal design review pages (hidden in production, see src/proxy.ts). */
export default function ReviewRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${allFontVariables} ${themeClassName(DEFAULT_THEME)} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-ink">
        <TooltipProvider>
          <ReviewToolbar />
          {children}
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
