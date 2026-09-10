/**
 * The member app, while its layout is still on its way.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * `app/app/layout.tsx` awaits `serverBoot()`, and Next is explicit about what
 * that costs: a layout that reads uncached runtime data is NOT covered by the
 * `loading.tsx` beside it — that file wraps `page.tsx` and the segments below,
 * never the layout in its own folder. So the boundary that actually caught this
 * moment was the one above it, `src/app/loading.tsx`, which is the ADMIN app's
 * loading screen: six identical cards in a 3x2 grid.
 *
 * It rendered outside the `.ux` wrapper, where every colour token in this
 * product is declared, so it also had no palette at all and fell through to
 * `body { background: var(--background) }` — the admin theme's #ece0ea. A pink
 * page of six cards, with no topbar and no rail, standing in for a violet page
 * with both. The layout now catches its own data in its own `<Suspense>`, and
 * this is what that boundary shows.
 *
 * ── Why every number here is written down ───────────────────────────────────
 * A skeleton's whole job is to occupy the space the real thing will occupy. The
 * sizes below were read off the finished screen at the design width (1536) with
 * `getBoundingClientRect`, not estimated: topbar 70, rail 253, content column
 * 899 at x=273, right rail 320 at x=1196, and the seven blocks `Dashboard`
 * stacks — 408, 317, 138, 129, 178, 333, 163 — with a 16px gap between them.
 * Anything guessed here is a jump she sees.
 */

/** The topbar's height, the one dimension the shell reads from a token. */
const TOPBAR = "var(--ux-topbar-h)";

/**
 * One shimmering block.
 *
 * `.ux-skeleton` is the app's own sweep — `linear-gradient` over
 * `--ux-surface-2` with `--ux-line` as the moving highlight — and it is already
 * cancelled outright under `prefers-reduced-motion`, leaving a flat block of
 * the same size. Nothing here re-implements it.
 */
function Bar({
  w = "100%", h = 12, r = 7, className = "", style,
}: {
  w?: number | string; h?: number | string; r?: number | string;
  className?: string; style?: React.CSSProperties;
}) {
  return (
    <span aria-hidden className={`ux-skeleton block ${className}`}
          style={{ width: w, height: h, borderRadius: r, ...style }} />
  );
}

/**
 * A blank card at a measured height — the shape of a card, with nothing in it.
 *
 * `pointer-events: none` because `.ux-card` lifts 3px and blooms on hover, and
 * a placeholder that answers the cursor is claiming to be something she can
 * press. It is also gone before she could press it.
 */
function Slab({
  h, r = 16, className = "", children,
}: { h?: number; r?: number; className?: string; children?: React.ReactNode }) {
  return (
    <div aria-hidden className={`ux-card ux-sq ${className}`}
         style={{ height: h, borderRadius: r, pointerEvents: "none" }}>
      {children}
    </div>
  );
}

/* ── the chrome ─────────────────────────────────────────────────────────── */

/**
 * The top bar.
 *
 * Same element, same classes and the same height token as `Shell`'s `Topbar`,
 * so the glass, the hairline under it and the 70px band are not approximations
 * of the real bar — they are the real bar's own rules with bars where the
 * controls will be.
 */
function TopbarSkeleton() {
  return (
    <header aria-hidden className="ux-glass relative z-[60] flex shrink-0 flex-col"
            style={{ height: TOPBAR, borderRadius: 0, borderWidth: "0 0 1px 0" }}>
      <div className="flex flex-1 items-center gap-3 ps-[18px] pe-[18px]">
        {/* The lockup: 177 x 36 in the finished bar. */}
        <span className="flex shrink-0 items-center gap-2.5">
          <Bar w={36} h={36} r={12} />
          <Bar w={128} h={18} r={6} />
        </span>

        {/* The search button: 300 wide, 42 tall, pinned to the right of the gap. */}
        <div className="ms-auto hidden min-w-0 max-w-[300px] flex-1 justify-end sm:flex">
          <Bar h={42} r={12} />
        </div>

        {/* Five round controls, her photo and her name — 380 wide, ending 18px
            from the edge, exactly as the real group does. */}
        <div className="ms-auto flex items-center gap-1 sm:ms-0">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="grid h-[42px] w-[42px] place-items-center">
              <Bar w={22} h={22} r={999} />
            </span>
          ))}
          <span className="ms-2 flex items-center gap-2">
            <Bar w={34} h={34} r={999} />
            <Bar w={72} h={13} />
            <Bar w={14} h={14} r={4} />
          </span>
        </div>
      </div>
    </header>
  );
}

/**
 * The left rail.
 *
 * 253px, and that number is the reason this file exists at all: a skeleton that
 * leaves the rail out lays the content column out 253px further left and then
 * slides the whole screen sideways the moment the page lands.
 */
function ModeRailSkeleton() {
  return (
    <aside aria-hidden
           className="hidden h-full shrink-0 flex-col overflow-hidden border-e lg:flex"
           style={{ width: 253, borderColor: "var(--ux-line)",
                    background: "var(--ux-surface)", paddingTop: 18 }}>
      {/* Her card: 228 x 136, 12px in from either edge, a 52px band across the
          top with the photo pulled up over it. */}
      <div className="ux-sq mx-3 mb-4 shrink-0 overflow-hidden rounded-[16px]"
           style={{ border: "1px solid var(--ux-line)", height: 136 }}>
        <span className="block h-[52px]" style={{ background: "var(--ux-surface-2)" }} />
        <span className="block px-3.5 pb-3.5">
          <Bar w={46} h={46} r={999} className="-mt-6"
               style={{ border: "3px solid var(--ux-surface)" }} />
          <Bar w={104} h={14} className="mt-2.5" />
          <Bar w={78} h={10} className="mt-1.5" />
        </span>
      </div>

      {/* The sections. One is open — Home is, on Home — so it carries the
          indented run of screens underneath it that the real rail does. */}
      <div className="min-h-0 flex-1 px-3 pb-3">
        <div className="ux-sq mb-0.5 flex h-[36px] items-center gap-3 rounded-[12px] px-2.5"
             style={{ background: "var(--ux-brand-tint)" }}>
          <Bar w={16} h={16} r={5} />
          <Bar w={62} h={12} />
        </div>
        <div className="mb-1 ms-[18px] mt-0.5">
          {[104, 88, 78, 110, 62, 96, 84].map((w, i) => (
            <div key={i} className="mb-0.5 flex h-[31px] items-center gap-2.5 px-2.5">
              <Bar w={14} h={14} r={4} />
              <Bar w={w} h={11} />
            </div>
          ))}
        </div>
        {[54, 52, 46, 54, 44, 34].map((w, i) => (
          <div key={i} className="mb-0.5 flex h-[36px] items-center gap-3 px-2.5">
            <Bar w={16} h={16} r={5} />
            <Bar w={w} h={12} />
            <Bar w={14} h={14} r={4} className="ms-auto" />
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ── the screen inside the chrome ───────────────────────────────────────── */

/**
 * Home's content column.
 *
 * The hero is built the way the real hero is built rather than as a box of a
 * remembered height: a banner at its own 2.8:1 followed by the greeting strip.
 * At 899px wide that resolves to 320 + 86 + 2px of border = 408, which is what
 * the finished hero measures — so it stays right at every width, not only at
 * the one it was measured at.
 */
export function HomeBodySkeleton() {
  return (
    <div className="ux-fade flex flex-col gap-4" role="status" aria-live="polite"
         style={{ animationDelay: "var(--ux-t-fast)" }}>
      <span className="sr-only">Loading your home screen…</span>

      {/* 1 — the hero: 408 */}
      <section className="ux-sq relative isolate overflow-hidden rounded-[20px]"
               style={{ border: "1px solid var(--ux-line)" }}>
        <Bar h="auto" r={0} style={{ aspectRatio: "2.8 / 1" }} />
        {/* The real strip is a brand gradient. `--ux-surface` here, not
            `--ux-surface-2`: the shimmer's own base IS `--ux-surface-2`, so a
            bar drawn on that colour is a bar nobody can see — 86px of hero that
            looked empty rather than loading. Bars read on a card, so the strip
            is a card. */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 p-5 sm:px-7"
             style={{ background: "var(--ux-surface)", minHeight: 86 }}>
          <div className="min-w-0">
            <Bar w={148} h={14} />
            <Bar w={286} h={22} r={8} className="mt-2" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Bar w={204} h={44} r={999} />
            <Bar w={176} h={44} r={999} />
          </div>
        </div>
      </section>

      {/* 2 — "Your next step": 317 */}
      <Slab h={317} r={20} className="p-6">
        <Bar w={112} h={11} />
        <Bar w="46%" h={30} r={10} className="mt-4" />
        <Bar w="38%" h={30} r={10} className="mt-2.5" />
        <Bar w="72%" h={13} className="mt-5" />
        <Bar w="58%" h={13} className="mt-2" />
        <Bar w={196} h={46} r={12} className="mt-8" />
      </Slab>

      {/* 3 — "Your journey": 138 */}
      <Slab h={138} className="p-5">
        <div className="flex items-center justify-between gap-3">
          <Bar w={118} h={14} />
          <Bar w={132} h={12} />
        </div>
        <div className="mt-6 grid grid-cols-7 gap-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i}>
              <Bar h={6} r={999} />
              <Bar w="72%" h={11} className="mt-2.5" />
            </div>
          ))}
        </div>
      </Slab>

      {/* 4 — the five figures: five 125px cards on a row 129 tall */}
      <div className="grid grid-cols-2 gap-3 pb-1 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Slab key={i} h={125} className="p-4">
            <div className="flex items-center gap-2.5">
              <Bar w={34} h={34} r={12} />
              <Bar w="58%" h={11} />
            </div>
            <Bar w="52%" h={20} r={8} className="mt-3" />
            <Bar w="70%" h={10} className="mt-3" />
          </Slab>
        ))}
      </div>

      {/* 5 — Quick Access: a 24px head, 12px of air, then a 142px grid */}
      <section aria-hidden>
        <div className="mb-3 flex h-[24px] items-center justify-between gap-3">
          <Bar w={132} h={16} r={6} />
          <div className="flex items-center gap-3">
            <Bar w={92} h={12} />
            <Bar w={108} h={12} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Slab key={i} h={142} className="flex flex-col p-4">
              <Bar w={44} h={44} r={12} />
              <Bar w="76%" h={14} className="mt-auto" />
              <Bar w="54%" h={10} className="mt-1.5" />
            </Slab>
          ))}
        </div>
      </section>

      {/* 6 — the three panels: 333 each */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Slab key={i} h={333} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <Bar w="46%" h={14} />
              <Bar w={54} h={11} />
            </div>
            <div className="mt-5 flex flex-col gap-3.5">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex items-start gap-3">
                  <Bar w={34} h={34} r={12} />
                  <div className="min-w-0 flex-1">
                    <Bar w="82%" h={12} />
                    <Bar w="54%" h={10} className="mt-2" />
                  </div>
                </div>
              ))}
            </div>
          </Slab>
        ))}
      </div>

      {/* 7 — the closing strip: 163 */}
      <Slab h={163} r={20} className="flex items-center gap-5 p-7">
        <Bar w={180} h={110} r={16} className="hidden shrink-0 sm:block" />
        <div className="min-w-0 flex-1">
          <Bar w="34%" h={22} r={8} />
          <Bar w="56%" h={13} className="mt-2.5" />
        </div>
        <Bar w={198} h={46} r={12} className="shrink-0" />
      </Slab>
    </div>
  );
}

/**
 * Home's right-hand rail.
 *
 * Four cards at the heights the real four measure — 273, 162, 147, 186 — rather
 * than the kit's generic pair, which reserved the column but not the column's
 * contents and let the rail settle by 200px under her.
 */
export function HomeRailSkeleton() {
  return (
    <div className="ux-fade flex flex-col gap-4" aria-hidden
         style={{ animationDelay: "var(--ux-t-fast)" }}>
      {[273, 162, 147, 186].map((h, i) => (
        <Slab key={i} h={h} className="p-4">
          <div className="flex items-center justify-between gap-3">
            <Bar w="52%" h={14} />
            <Bar w={62} h={11} />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {/* As many rows as the card is tall enough to hold, so a 273px
                card is not two rows and 140px of nothing. */}
            {[0, 1, 2, 3].slice(0, h > 250 ? 4 : h > 170 ? 3 : 2).map((j) => (
              <div key={j} className="flex items-center gap-3">
                <Bar w={38} h={38} r={12} />
                <div className="min-w-0 flex-1">
                  <Bar w="76%" h={12} />
                  <Bar w="44%" h={10} className="mt-2" />
                </div>
              </div>
            ))}
          </div>
        </Slab>
      ))}
    </div>
  );
}

/* ── the whole frame ────────────────────────────────────────────────────── */

/**
 * The member app's frame, drawn empty.
 *
 * `.ux` is on the outermost element and that is not decoration: every colour
 * token in this product is declared on `.ux`, never on `:root`, so anything
 * rendered above the wrapper `MemberShell` provides — a portal, an error
 * boundary, or a Suspense fallback like this one — resolves `var(--ux-canvas)`
 * to nothing and paints on whatever the document body happens to be. That is
 * precisely how this moment came to be pink.
 *
 * The frame below is `Shell`'s own structure, class for class: the same
 * negative top margin that slides the scroller under the glass, the same
 * `calc(topbar + 18px)` of top padding, the same 24px gutter and 20px sides. So
 * the content column starts at x=273 and the rail at x=1196 here for the same
 * reasons they do there, not because those numbers were copied in.
 */
export function AppShellSkeleton() {
  return (
    <div data-skel="shell" className="ux flex h-screen flex-col overflow-hidden"
         style={{ background: "var(--ux-canvas)" }}>
      <TopbarSkeleton />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ModeRailSkeleton />

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
             style={{ marginTop: `calc(${TOPBAR} * -1)`, height: `calc(100% + ${TOPBAR})` }}>
          <div data-skel="scroll" className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex min-w-0 gap-[24px] px-[20px] pb-[calc(96px+env(safe-area-inset-bottom,0px))] lg:pb-24"
                 style={{ paddingTop: `calc(${TOPBAR} + 18px)` }}>
              {/* `data-skel` rather than the shell's own `id="ux-scroll"` /
                  `data-rail`: while the real screen is streaming in, both trees
                  are briefly in the document at once, and a duplicated id makes
                  every measurement — mine and the checks' — ambiguous about
                  which column it just measured. */}
              <div data-skel="main" className="min-w-0 flex-1">
                <HomeBodySkeleton />
              </div>
              <div data-skel="rail" className="hidden w-[320px] shrink-0 pb-24 xl:block">
                <HomeRailSkeleton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
