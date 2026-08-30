import type { Metadata } from "next";
import {
  Poppins,
  Inter,
  Noto_Sans_Devanagari,
  Noto_Naskh_Arabic,
  Noto_Sans_Tamil,
  Noto_Sans_Bengali,
  Noto_Sans_Telugu,
  Noto_Sans_Gujarati,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Oriya,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import QueryProvider from "@/lib/query/QueryProvider";
import { RouteProgress } from "@/design-system";
import { I18nProvider } from "@/i18n";
import { cookies } from "next/headers";
import ThemeStyle from "@/theme-engine/ThemeStyle";
import ThemeEngineBridge from "@/components/theme/ThemeEngineBridge";
import LayoutStyle from "@/layout-engine/LayoutStyle";
import LayoutEngineBridge from "@/components/layout/LayoutEngineBridge";
import ConnectionBanner from "@/components/layout/ConnectionBanner";
import { ToastProvider, ConfirmProvider } from "@/design-system";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Script coverage for non-Latin locales. `preload: false` keeps these out of
// the critical path — they are only fetched when such a locale is rendered.
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
  preload: false,
});

const notoArabic = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
  preload: false,
});

// One family per script the app is actually translated into. Without these a
// device that happens not to ship a Tamil or Odia font renders every string as
// empty boxes — the language switch appears to work and the screen is
// unreadable, which is worse than leaving it in English.
const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"], variable: "--font-tamil", display: "swap", preload: false,
});
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"], variable: "--font-bengali", display: "swap", preload: false,
});
const notoTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"], variable: "--font-telugu", display: "swap", preload: false,
});
const notoGujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"], variable: "--font-gujarati", display: "swap", preload: false,
});
const notoKannada = Noto_Sans_Kannada({
  subsets: ["kannada"], variable: "--font-kannada", display: "swap", preload: false,
});
const notoMalayalam = Noto_Sans_Malayalam({
  subsets: ["malayalam"], variable: "--font-malayalam", display: "swap", preload: false,
});
const notoGurmukhi = Noto_Sans_Gurmukhi({
  subsets: ["gurmukhi"], variable: "--font-gurmukhi", display: "swap", preload: false,
});
const notoOdia = Noto_Sans_Oriya({
  subsets: ["oriya"], variable: "--font-odia", display: "swap", preload: false,
});

/** Every script variable, for the <body> class. */
const SCRIPT_FONTS = [
  notoDevanagari, notoArabic, notoTamil, notoBengali, notoTelugu,
  notoGujarati, notoKannada, notoMalayalam, notoGurmukhi, notoOdia,
].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  // "Wom" (women) + "Sakhi" (a woman's trusted friend) — the name is the promise.
  title: {
    default: "WomSakhi — Empowering Women",
    template: "%s · WomSakhi",
  },
  description:
    "WomSakhi — the admin platform behind womsakhi.com. Manage members, programs, appointments and content for the women's community.",
  applicationName: "WomSakhi",
  metadataBase: new URL("https://www.womsakhi.com"),
  openGraph: {
    title: "WomSakhi — Empowering Women",
    description: "Manage members, programs, appointments and content for the women's community.",
    url: "https://www.womsakhi.com",
    siteName: "WomSakhi",
    type: "website",
  },
};

// Runs before paint so the correct theme is applied with no flash of light.

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The colour mode is read on the server from its cookie, so `dark` is already
  // on <html> in the first byte of HTML. That replaces the inline no-flash
  // script — which React re-rendered on every client navigation and warned
  // about — with nothing at all.
  const mode = (await cookies()).get("theme")?.value;
  const isDark = mode === "dark";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${poppins.variable} ${inter.variable} ${SCRIPT_FONTS} h-full${isDark ? " dark" : ""}`}
    >
      <body className="min-h-full font-sans antialiased text-ink">
        {/* Rendered inside <body>, not in an explicit <head>.
            React 19 hoists <style> for us, and an explicit <head> in the root
            layout fights Next's own head management — the server ended up
            emitting <meta charset> where the client rendered the first body
            child, which is the hydration mismatch that kept appearing on
            random pages. Styles in <body> apply exactly the same. */}
        <ThemeStyle />
        <LayoutStyle />
        <ThemeProvider>
          <RouteProgress />
          <QueryProvider>
            <I18nProvider>
              <AuthProvider>
              <ThemeEngineBridge>
                <LayoutEngineBridge>
                  {/* Both feedback channels live at the root for the same
                      reason as ConnectionBanner: a screen should not have to
                      opt in to being able to tell the user what happened.
                      ConfirmProvider is inside ToastProvider so a dialog can
                      raise a toast on the way out — "Deleted · Undo". */}
                  <ToastProvider>
                    <ConfirmProvider>
                      {children}
                      {/* A failed request must never be mistaken for empty
                          data. Mounted at the root so it covers both apps, and
                          every screen written from here on. */}
                      <ConnectionBanner />
                    </ConfirmProvider>
                  </ToastProvider>
                </LayoutEngineBridge>
              </ThemeEngineBridge>
            </AuthProvider>
            </I18nProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
