import type { MetadataRoute } from "next";

import { START_URL } from "@/lib/pwa";

/**
 * The web app manifest — what turns a bookmark into an app.
 *
 * ── Why a route and not `public/manifest.json` ──────────────────────────────
 * Next 16 treats `app/manifest.ts` as a metadata route: it is served at
 * `/manifest.webmanifest` with `application/manifest+json`, and — this is the
 * part a static file cannot do — Next injects the `<link rel="manifest">` into
 * every page's `<head>` on its own. A file in `public/` would need that tag
 * added to `layout.tsx` by hand and would be served as `application/json`,
 * which some Android versions refuse to parse as a manifest.
 *
 * ── `display: "standalone"` is the whole point ──────────────────────────────
 * Launched from the home screen there is no URL bar, no tab strip and no
 * browser toolbar — the app owns the screen. `mobile.css` already has a
 * `@media (display-mode: standalone)` block that pads the top bar down past
 * the status bar, so the chrome-less mode was designed for before it existed.
 *
 * ── The colours are not decoration ──────────────────────────────────────────
 * `background_color` is painted by the OS *before* a single byte of the app
 * renders. It is `--ux-canvas`, so the launch goes tinted-lavender → the app,
 * with no white flash in between. `theme_color` tints the Android status bar
 * and the task-switcher card; the manifest takes exactly one value, so it is
 * the brand violet rather than either theme's canvas.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "WomSakhi",
    short_name: "WomSakhi",
    description:
      "Learn a skill, find work, sell what you make, and save with women you trust.",

    /*
      She lands inside the app, not on the marketing page. `scope` stays "/"
      so the sign-in and public routes still open inside the installed window
      instead of bouncing her out to the browser mid-login — a scope of "/app"
      would do exactly that at the one moment it hurts most.
    */
    start_url: START_URL,
    scope: "/",

    display: "standalone",
    /*
      If a browser will not honour `standalone`, `minimal-ui` (a back button
      and a title, no address bar) is a far better fallback than dropping
      straight to a full browser tab.
    */
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",

    background_color: "#f4f2fa", // --ux-canvas, light
    theme_color: "#7648b3", // --ux-brand-600

    lang: "en-IN",
    dir: "ltr",
    categories: ["education", "finance", "productivity", "social"],

    /*
      Tapping the icon returns her to the window she left, rather than starting
      the app over. Without this, an app resumed from the launcher can reload
      from `start_url` and lose a half-filled form.
    */
    launch_handler: { client_mode: "navigate-existing" },

    icons: [
      /*
        Two purposes, and they are not interchangeable. An "any" icon is drawn
        as given. A "maskable" icon is cropped by the launcher to whatever
        shape the phone uses — circle, squircle, teardrop — and only a circle
        of 80% diameter is guaranteed to survive. The maskable files are the
        same mark rendered smaller on a full-bleed ground so the crop takes
        paper and never the artwork. Shipping one file for both purposes is
        the usual mistake: as "any" it looks shrunken, as "maskable" it loses
        its edges.
      */
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],

    /*
      Long-press the home-screen icon and these four appear. It is a small
      thing that no bookmarked website has, and it lands her on the section she
      wanted without a single tap inside the app. The names and the one-liners
      are the same ones `nav-tree.ts` uses for the four bottom tabs, so the
      long-press menu and the tab bar cannot drift apart.
    */
    shortcuts: [
      {
        name: "Learn",
        short_name: "Learn",
        description: "Get better at what you do",
        url: "/app/learn",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Work",
        short_name: "Work",
        description: "Find it, win it, prove it",
        url: "/app/work",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Earn",
        short_name: "Earn",
        description: "Sell it, and get paid",
        url: "/app/earn",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Circle",
        short_name: "Circle",
        description: "The women around you",
        url: "/app/circle",
        icons: [{ src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" }],
      },
    ],

    prefer_related_applications: false,
  };
}
