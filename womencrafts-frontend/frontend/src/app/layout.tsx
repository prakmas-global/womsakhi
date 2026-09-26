import type { Metadata, Viewport } from "next";
import {
  Caveat,
  Fraunces,
  Poppins,
  Inter,
  Plus_Jakarta_Sans,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import RouteProgress from "@/design-system/primitives/RouteProgress";
import { I18nProvider } from "@/i18n";
// Straight from the data module, not the "@/i18n" barrel: that barrel is a
// client component, so anything re-exported through it cannot be called here.
import { DEFAULT_LOCALE, isRtl, localeSpec } from "@/i18n/locales";
import { cookies } from "next/headers";
import { serverBoot } from "@/lib/server-api";
import ThemeStyle from "@/theme-engine/ThemeStyle";
import { TEXT_SIZE_COOKIE, rootPx, type TextSize } from "@/components/ux/reach/text-size";
import ThemeEngineBridge from "@/components/theme/ThemeEngineBridge";
import ServiceWorkerRegistrar from "@/components/ux/mobile/ServiceWorkerRegistrar";
import LayoutStyle from "@/layout-engine/LayoutStyle";
import LayoutEngineBridge from "@/components/layout/LayoutEngineBridge";
import ConnectionBanner from "@/components/layout/ConnectionBanner";
import ToastProvider from "@/design-system/feedback/ToastProvider";
import ConfirmProvider from "@/design-system/feedback/ConfirmProvider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

/**
 * The display face — headlines and figures only.
 *
 * Poppins is a fine interface sans and a poor magazine voice: at 56px a
 * geometric sans reads as an app header, not a cover line. Fraunces is a
 * variable serif with a `SOFT`/`WONK` axis, which is what gives the Home
 * masthead and the money figure their editorial weight without importing a
 * second static family per weight.
 *
 * Latin only, and deliberately: every non-Latin script already has a Noto
 * face below, and those keep their own headline rendering rather than being
 * forced through a serif that has no glyphs for them.
 */
const fraunces = Fraunces({
  subsets: ["latin"],
  // No `weight` list on purpose: Fraunces is a variable font, and next/font
  // rejects `axes` alongside pinned static weights. Omitting weight ships the
  // whole variable range, which is what lets one file cover 400 body italics
  // and the 900 cover line without a second download.
  axes: ["SOFT", "WONK", "opsz"],
  /*
    `--font-fraunces`, not `--font-display`.

    It was `--font-display`, and `design-system/tokens.css` also declares a
    `--font-display` — so the two collided and the token file won. Fraunces was
    downloaded on every request and never drawn anywhere. Naming the face after
    itself and letting the token compose the STACK is the only arrangement
    where that cannot happen again.
  */
  variable: "--font-fraunces",
  display: "swap",
});

/**
 * The hand-written voice — annotations only.
 *
 * The Learn board carries two pieces of handwriting from the supplied art:
 * "Small Steps Big Changes" and the WomSakhi quote, both baked into
 * `hero-learn-banner.webp`. The third, "You can do this" over the How-it-works
 * strip, is live text — it sits beside content that changes and had to stay
 * selectable and translatable rather than becoming a picture of a sentence.
 *
 * `preload: false` because exactly one line on one screen uses it. It is
 * fetched when that screen renders and never sits in the critical path of the
 * other hundred and twenty-eight routes.
 */
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-script",
  display: "swap",
  preload: false,
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * The reading face, and the reason it is not Inter any more.
 *
 * The marketing site is Fraunces over Plus Jakarta Sans. A woman who reads the
 * site and then signs in should not meet a different typeface on the other
 * side of the door — the brand is the pair, not the colours alone. Jakarta is
 * also a slightly warmer, rounder humanist than Inter, which suits a berry and
 * cream palette better than Inter's neutrality does.
 *
 * Variable, so the whole weight range is one file.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const viewport: Viewport = {
  /*
    `viewport-fit: cover` is what lets the app reach under the notch and the
    home indicator — and it is also what makes `env(safe-area-inset-*)` return
    anything other than zero. Without this line every safe-area rule in
    `tokens.css` silently evaluates to 0px and the bottom tab bar sits beneath
    the iPhone's home indicator, where a third of every tap lands on the
    system gesture instead of the button.
  */
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  /* Deliberately NOT `maximumScale: 1` or `userScalable: false`. Locking zoom
     is the most common accessibility failure on mobile web, and this app is
     built for women who may well need to pinch a form field larger. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcf8f7" },  /* Warm Cream */
    { media: "(prefers-color-scheme: dark)", color: "#150c0f" },   /* Deep Plum, deepened */
  ],
};

export const metadata: Metadata = {
  // "Wom" (women) + "Sakhi" (a woman's trusted friend) — the name is the promise.
  title: {
    default: "WomSakhi — Empowering Women",
    template: "%s · WomSakhi",
  },
  description:
    "WomSakhi — the admin platform behind womsakhi.com. Manage members, programs, appointments and content for the women's community.",
  applicationName: "WomSakhi",
  /*
    iOS ignores the web app manifest for most of this.

    `capable` is what makes the home-screen icon launch WITHOUT Safari's
    chrome — the entire difference between "a bookmark" and "an app". The
    status bar stays `default` (dark text) rather than `black-translucent`,
    because translucent draws the app under the clock with WHITE text, which
    is invisible on this app's #f4f2fa canvas.
  */
  appleWebApp: {
    capable: true,
    title: "WomSakhi",
    statusBarStyle: "default",
  },
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
  const jar = await cookies();
  const mode = jar.get("theme")?.value;
  const isDark = mode === "dark";

  // Her text-size preference, read here for the same reason as the theme: the
  // rem scale answers to the root font-size, so setting it server-side means
  // the page never resizes after it has been read.
  const textSize = (jar.get(TEXT_SIZE_COOKIE)?.value ?? "normal") as TextSize;
  const rootSize = rootPx(textSize);

  // Her language, read here for the same reason as the two above. Without it
  // the first paint is always English and then swaps once the provider has
  // mounted — which on a slow phone is long enough to read.
  const locale = DEFAULT_LOCALE;
  // `lang` and `dir` belong on the server render, not on a mount effect: they
  // drive screen-reader pronunciation, hyphenation and every start/end style
  // rule, all of which are decided before an effect gets to run.
  const lang = localeSpec(locale).code;
  const dir = isRtl(locale) ? "rtl" : "ltr";

  // Who is signed in, and — for a member — her whole shell, answered here
  // rather than by round trips from the browser after the page has mounted.
  // Every screen in both apps used to render a spinner until `/auth/session`
  // came back, and the member app then fired `/me/shell` behind it. Both
  // arrive with the HTML now. Falls back to the client fetches if the API did
  // not answer.
  const { session, shell } = await serverBoot();

  return (
    <html
      lang={lang}
      dir={dir}
      suppressHydrationWarning
      className={`${poppins.variable} ${inter.variable} ${jakarta.variable} ${fraunces.variable} ${caveat.variable} h-full${isDark ? " dark" : ""}`}
      data-text-size={textSize}
      style={{ fontSize: `${rootSize}px`, ["--ux-fs-scale" as string]: String(rootSize / 16) }}
    >
      <body className="min-h-full font-sans antialiased text-ink">
        {/* Next 16 emits only the modern `mobile-web-app-capable`. iOS before
            16.4 honours only this apple- prefixed name, and without it those
            phones open the home-screen icon in a Safari tab with chrome —
            which is the one thing installing was meant to remove. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <ServiceWorkerRegistrar />
        {/* Rendered inside <body>, not in an explicit <head>.
            React 19 hoists <style> for us, and an explicit <head> in the root
            layout fights Next's own head management — the server ended up
            emitting <meta charset> where the client rendered the first body
            child, which is the hydration mismatch that kept appearing on
            random pages. Styles in <body> apply exactly the same. */}
        <ThemeStyle />
        <LayoutStyle />
        <ThemeProvider>
          <I18nProvider initialLocale={locale}>
              {/* Inside I18nProvider, not above it. The bar grew a label that
                  says "Opening…" in words after a second and a half, and a
                  label the app cannot translate is a label half this audience
                  cannot read. */}
              <RouteProgress />
              {/* Both feedback channels live at the root for the same reason as
                  ConnectionBanner: a screen should not have to opt in to being
                  able to tell the user what happened. ConfirmProvider is inside
                  ToastProvider so a dialog can raise a toast on the way out —
                  "Deleted · Undo".

                  ToastProvider sits ABOVE AuthProvider, not below it as it did
                  at first. Signing out is an operation like any other and has
                  to be able to confirm itself — "You are signed out" is raised
                  by `signOut` and read on the sign-in screen it lands on. With
                  the old nesting `useToast()` inside AuthContext threw, so the
                  one operation that takes the whole app away was the one
                  operation that could not say it had finished. Nothing else
                  depends on the order: the toast list needs neither the
                  session nor the shell. */}
              <ToastProvider>
              <AuthProvider initialUser={session.user} sessionResolved={session.resolved}>
              <ThemeEngineBridge>
                <LayoutEngineBridge initialShell={shell}>
                    <ConfirmProvider>
                      {children}
                      {/* A failed request must never be mistaken for empty
                          data. Mounted at the root so it covers both apps, and
                          every screen written from here on. */}
                      <ConnectionBanner />
                    </ConfirmProvider>
                </LayoutEngineBridge>
              </ThemeEngineBridge>
            </AuthProvider>
              </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
