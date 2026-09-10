import { redirect } from "next/navigation";

/**
 * ── Why there is no `loading.tsx` beside this file ──────────────────────────
 *
 * There was one, and it was the reason `/app` opened pink.
 *
 * A `loading.tsx` is the Suspense fallback for everything BELOW its segment,
 * which at the root means every top-level segment's layout: `/dashboard`,
 * `(auth)`, `/learning` — and `/app`. It rendered `RouteLoading shape="cards"`,
 * six admin cards in a 3x2 grid, and it rendered them OUTSIDE the `.ux`
 * wrapper the member app's shell provides. Every colour token in that product
 * is declared on `.ux` rather than on `:root`, so it resolved none of them and
 * fell through to `body { background: var(--background) }` — the admin theme's
 * #ece0ea. A woman signing in saw six pink cards, no topbar and no rail, and
 * then the whole thing was replaced by a violet screen with both.
 *
 * Nothing needed it. This page is a `redirect()` with no UI to stand in for;
 * every other top-level layout is a client component, so none of them keeps the
 * boundary open; and the one layout that did read runtime data, `app/app`, now
 * catches its own await in its own `<Suspense>` with a fallback shaped like the
 * member app (see the note there). Without a boundary here, each segment's
 * first paint is its OWN loading UI instead of another product's.
 */
export default function Home() {
  // Admin platform has no public landing — send visitors into the app.
  // Unauthenticated users get bounced to /signin by the auth guard.
  redirect("/dashboard");
}
