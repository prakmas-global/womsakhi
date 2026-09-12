import { Suspense } from "react";

import MemberShell from "./MemberShell";
import { serverBoot } from "@/lib/server-api";
import { AppShellSkeleton } from "@/components/ux/home/AppSkeleton";
import "@/app/ux/tokens.css";
// After tokens.css on purpose: both are unlayered, so the later import wins.
import "@/app/ux/mobile.css";

/**
 * The member app's server entry point.
 *
 * It exists to do one thing before the HTML is sent: fetch `/me/shell`, using
 * the session cookie the request already carried. That request used to be made
 * by the browser, and it could not even *start* until a second browser request,
 * `/auth/session`, had come back — because the provider that makes it lives
 * inside the gate that waits on the session. Two round trips in a fixed order,
 * on every one of the member app's screens, before the first one asked for
 * anything of its own.
 *
 * Both are now answered here. `MemberShell` holds every guard, unchanged; if
 * this fetch returns null — a member still in verification gets a 401 from
 * `/me/shell`, and an API that is down gets nothing — the client falls back to
 * fetching for itself exactly as before.
 */
async function Boot({ children }: { children: React.ReactNode }) {
  // Already fetched by the root layout on this same request — `serverBoot` is
  // wrapped in React's `cache`, so this costs nothing and needs no prop
  // threaded through a layout boundary that cannot carry one.
  const { shell: initialShell } = await serverBoot();
  return <MemberShell initialShell={initialShell}>{children}</MemberShell>;
}

/**
 * ── Why the await above is wrapped, and this function is not `async` ────────
 *
 * `loading.tsx` does not cover the layout in its own folder. Next is explicit
 * about it: it "wraps `not-found.js`, `page.js`, and nested `layout.js` files
 * in a `<Suspense>` boundary. It does **not** wrap the `layout.js`,
 * `template.js`, or `error.js` in the same segment" — and a layout that reads
 * uncached runtime data gets no fallback from it at all.
 *
 * So while `serverBoot()` was in flight, the boundary that actually caught this
 * segment was the one ABOVE it, `src/app/loading.tsx` — the admin app's loading
 * screen. Six identical cards in a 3x2 grid, no topbar, no rail, and no
 * palette: it renders outside the `.ux` wrapper `MemberShell` provides, where
 * every colour token in this product is declared, so it fell through to
 * `body { background: var(--background) }` and painted the admin theme's pink.
 * Then the real screen — violet, with a 70px bar, a 253px rail, a hero and two
 * columns — replaced all of it at once.
 *
 * Wrapping the data access in its own boundary is what the Next docs prescribe
 * for exactly this, and it moves the fallback inside the member app, where it
 * can be shaped like the member app. Nothing above this file renders for `/app`
 * any more.
 */
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <Boot>{children}</Boot>
    </Suspense>
  );
}
