import { themeScript } from "@/lib/theme";

/** Put in <head> of a themed root layout. See themeScript(). */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript() }} />;
}
