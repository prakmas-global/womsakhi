import type { NextConfig } from "next";

/**
 * Next.js 16.2.7 · Turbopack.
 *
 * Every option below was checked against `node_modules/next/dist/docs/` for
 * THIS version and then measured on a real production build. Options that
 * looked obviously right but changed nothing — or broke something — are listed
 * at the bottom with the measurement, so nobody has to find out twice.
 */
const nextConfig: NextConfig = {

  /**
   * Build a self-contained server for the container image.
   *
   * `.next/standalone` carries its own trimmed `node_modules` and a `server.js`
   * to run instead of `next start`, which takes the runtime image from ~1.4 GB
   * to ~200 MB. Checked against `node_modules/next/dist/docs/` for 16.2.7:
   * the minimal server does NOT copy `public/` or `.next/static/` itself, so
   * the Dockerfile copies both in explicitly. Miss that step and the app boots
   * perfectly and serves every page without CSS or images — a failure that
   * looks like a styling bug rather than a packaging one.
   */
  output: "standalone",

  /**
   * Put the API on this app's own origin.
   *
   * The browser calls `/api/v1/…` and Next forwards it to the backend, so the
   * session cookie the API sets belongs to THIS host — which is the only way
   * both the browser and this server can read it. See `src/lib/api-base.ts`
   * for the full reasoning; the short version is that a cookie set by a
   * different host is invisible here, and every signed-in page bounces to
   * /signin while the API reports a perfectly successful login.
   *
   * `rewrites()` is evaluated at BUILD time and baked into the routes
   * manifest, so `INTERNAL_API_URL` has to be present during `next build`,
   * not merely at runtime. It is a Docker build arg for exactly that reason.
   */
  async rewrites() {
    const api = process.env.INTERNAL_API_URL ?? "http://localhost:8020/api/v1";
    return [{ source: "/api/v1/:path*", destination: `${api}/:path*` }];
  },

  /**
   * Drop `X-Powered-By: Next.js` from every response.
   *
   * Verified present before the change (`curl -I` on /signin returned it) and
   * gone after. It is a free 22 bytes on every request, and naming the exact
   * framework to anyone scanning is a hint we get nothing back for.
   */
  poweredByHeader: false,

  /**
   * No browser source maps in production. This is already the default; it is
   * pinned so that turning it on stays a deliberate act rather than a stray
   * commit.
   *
   * Off matters more here than in most apps: the client bundle is ~8.7 MB of
   * JS, and a source map would republish all of `src/` — including the member
   * API shapes and the wording of every unshipped screen — as readable text
   * next to it, and add that much again to `next build` time and memory.
   */
  productionBrowserSourceMaps: false,
};

/*
 * ── Evaluated, measured, and deliberately NOT here ──────────────────────────
 *
 * `experimental.optimizePackageImports`
 *   Do not add `culori`. It saves 38 KB and breaks the app. culori's ESM entry
 *   is a barrel whose side effects register the colour spaces
 *   (`export const rgb = useMode(modeRgb)`, ×25). Rewriting
 *   `import { parse } from "culori"` into deep imports skips those
 *   registrations, so `parse("#d21f7c")` returns undefined and
 *   theme-engine/palette.ts throws "Not a colour" — every signed-in screen
 *   falls into the error boundary. The 38 KB "saving" IS the missing colour
 *   spaces. (culori declares `sideEffects: ["src/index.js", ...]`; the barrel
 *   optimiser does not honour it.)
 *
 *   Nothing else in package.json benefits either. `lucide-react` and
 *   `recharts` are already in Next's built-in default list (see
 *   node_modules/next/dist/server/config.js). Adding @dnd-kit/*, @tanstack/*,
 *   react-resizable-panels and axios produced a byte-for-byte identical build.
 *   And it could never help `@/components/ux/icons`: that barrel is consumed
 *   as `import * as Icons`, and the transform only rewrites named imports.
 *
 * `images: { remotePatterns, formats, … }`
 *   Tried and reverted, 2026-09-07. The motivation was real: avatars come from
 *   the API at whatever size she uploaded — the seeded one is 1240x1269 and
 *   1.8MB, drawn at 40px — which is exactly what the optimiser is for.
 *
 *   It does not work here. `/_next/image` answers `400 "url" parameter is not
 *   allowed` for `http://localhost:8020/media/avatar/*.png` with
 *   `remotePatterns` written both ways the Next 16 docs describe (the object
 *   form with protocol/hostname/port/pathname/search, and the `new URL()`
 *   shorthand), after `rm -rf .next` and a full restart. The block appears to
 *   be genuinely inert in this setup rather than misconfigured.
 *
 *   Left as plain <img> with explicit width/height, which still buys no layout
 *   shift and a right-sized decode. **The bytes remain wrong** — the real fix
 *   is a thumbnail generated at upload time, server-side.
 *
 * `compiler.removeConsole`
 *   Measured: byte-for-byte identical output. The app's own code contains no
 *   console calls at all — the ten `console.log`s in the tree are in
 *   src/theme-engine/__checks__/*.mjs, CLI scripts that are never bundled. The
 *   27 console.error / 18 console.warn left in the built chunks are React and
 *   Next internals, which `removeConsole` explicitly does not touch.
 *
 * `typedRoutes`
 *   Fails the build today. Several screens compute hrefs from arrays (e.g.
 *   src/app/(public)/layout.tsx:42, `[...].map(([label, href]) => <Link
 *   href={href}>)`), which typed routes rejects as `string`. Worth doing, but
 *   it is a refactor, not a config flag.
 *
 * `experimental.inlineCss`
 *   Wrong trade for this app. It inlines CSS into every HTML response; ours is
 *   a 128 KB stylesheet shared across 71 routes that members navigate around
 *   all day, so external + cached beats re-sending it on every navigation.
 *
 * `experimental.cssChunking`, `reactStrictMode`,
 * `experimental.turbopackFileSystemCacheForDev`
 *   Already the defaults in 16.2.7. Writing them changes nothing.
 */

export default nextConfig;
