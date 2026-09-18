"use client";

import { useState } from "react";

import "@/app/ux/tokens.css";
import "@/app/ux/mobile.css";

import * as Icons from "@/components/ux/icons";
import {
  ListGroup,
  ListRow,
  PullToRefresh,
  SegmentedControl,
  Sheet,
  Stepper,
  SwipeAction,
  ToastHost,
  toast,
} from "@/components/ux/mobile";

/**
 * Every mobile control on one screen, so a human can judge them together.
 *
 * Kept out of `/app` on purpose: the member shell brings a tab bar, a top bar
 * and a session with it, and a gallery that only renders for a signed-in
 * member is a gallery nobody opens. This route carries its own `.ux` wrapper
 * and imports the two stylesheets the shell would otherwise have imported —
 * which is also the honest test that these components depend on nothing but
 * the tokens.
 *
 * Best viewed at 390x844. `?dark` or the toggle switches the theme, because
 * "no hardcoded colours" is a claim that has to be looked at rather than
 * asserted.
 */

const DEMO_ROWS = [
  { id: 1, title: "Priya Sharma", subtitle: "Paid 12 of 12 · Circle lead", icon: "UserRoundCheck", tint: "violet" as const },
  { id: 2, title: "Anjali Verma", subtitle: "Paid 11 of 12", icon: "UserCheck", tint: "blue" as const },
  { id: 3, title: "Meena Kumari", subtitle: "Due in 3 days", icon: "AlarmClock", tint: "amber" as const },
];

export default function MobileKitPage() {
  const [view, setView] = useState<"all" | "due" | "paid">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detentOpen, setDetentOpen] = useState(false);
  const [qty, setQty] = useState(2);
  const [rows, setRows] = useState(DEMO_ROWS);
  const [refreshed, setRefreshed] = useState(0);
  const [dark, setDark] = useState(false);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const restore = () => setRows(DEMO_ROWS);

  return (
    <div className="ux min-h-screen pb-24" style={{ background: "var(--ux-canvas)" }}>
      <ToastHost />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header
        className="ux-topbar sticky top-0 z-[var(--ux-z-sticky)] flex items-center gap-3 border-b px-4 py-3"
        style={{ background: "var(--ux-surface)", borderColor: "var(--ux-line)" }}
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold tracking-[-0.02em]" style={{ color: "var(--ux-ink)" }}>
            Mobile kit
          </h1>
          <p className="text-[12px]" style={{ color: "var(--ux-muted)" }}>
            Seven controls · best at 390x844
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={dark}
          className="ux-press grid h-[40px] w-[40px] place-items-center rounded-full"
          style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}
        >
          {dark ? <Icons.Sun className="h-[18px] w-[18px]" /> : <Icons.Moon className="h-[18px] w-[18px]" />}
          <span className="sr-only">Toggle dark theme</span>
        </button>
      </header>

      <main className="flex flex-col gap-7 px-4 pt-5">
        {/* ── SegmentedControl ──────────────────────────────────────────── */}
        <Section
          name="SegmentedControl"
          note="Sliding thumb measured from the active segment, so it is right in RTL and at any label length. Arrow keys move it."
        >
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All" },
              { value: "due", label: "Due" },
              { value: "paid", label: "Paid" },
            ]}
          />
          <p className="mt-2 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            Showing: <b style={{ color: "var(--ux-ink)" }}>{view}</b>
          </p>
        </Section>

        {/* ── ListRow / ListGroup ───────────────────────────────────────── */}
        <Section
          name="ListRow"
          note="Hairlines start after the icon, never at the screen edge. The last one is hidden by the group."
        >
          <ListGroup title="Circle" footnote="Tap a row to open it.">
            <ListRow icon="Wallet" tint="green" title="Contributions" value="₹18,000" href="#" />
            <ListRow icon="Users" tint="blue" title="Members" subtitle="12 active, 1 invited" value="13" href="#" />
            <ListRow icon="Bell" tint="amber" title="Reminders" trailing={<Pill>On</Pill>} onClick={() => toast("Reminders opened")} chevron />
            <ListRow title="No icon, so the rule runs full width" subtitle="Which is what a plain group looks like" href="#" />
            <ListRow icon="Trash2" title="Leave this circle" destructive onClick={() => toast("Nothing was deleted", { tone: "error" })} />
          </ListGroup>
        </Section>

        {/* ── SwipeAction ───────────────────────────────────────────────── */}
        <Section
          name="SwipeAction"
          note="Swipe a row towards the start edge, or Tab to the buttons — focusing one opens the row so nothing is pressed while hidden."
        >
          <ListGroup title="Members">
            {rows.map((r) => (
              <SwipeAction
                key={r.id}
                actions={[
                  { label: "Archive", icon: "Archive", onPress: () => toast(`${r.title} archived`) },
                  {
                    label: "Delete",
                    icon: "Trash2",
                    destructive: true,
                    onPress: () => {
                      setRows((cur) => cur.filter((x) => x.id !== r.id));
                      toast(`${r.title} removed`, { tone: "error", action: { label: "Undo", onPress: restore } });
                    },
                  },
                ]}
              >
                <ListRow icon={r.icon} tint={r.tint} title={r.title} subtitle={r.subtitle} />
              </SwipeAction>
            ))}
          </ListGroup>
          {rows.length < DEMO_ROWS.length && (
            <button
              type="button"
              onClick={restore}
              className="ux-press mt-2 rounded-[var(--ux-r-pill)] px-4 py-2 text-[13px] font-bold"
              style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}
            >
              Put them back
            </button>
          )}
        </Section>

        {/* ── Stepper ───────────────────────────────────────────────────── */}
        <Section name="Stepper" note="44px targets, hold to repeat, and adjustable with VoiceOver because it is a real spinbutton.">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                Sarees
              </p>
              <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>
                ₹{(qty * 450).toLocaleString("en-IN")}
              </p>
            </div>
            <Stepper label="Quantity" value={qty} onChange={setQty} min={0} max={20} />
          </div>
        </Section>

        {/* ── Sheet ─────────────────────────────────────────────────────── */}
        <Section name="Sheet" note="Drag the grab bar: it follows the finger, rubber-bands upward, and a fast flick dismisses from a short drag.">
          <div className="flex flex-wrap gap-2">
            <Primary id="open-sheet" onClick={() => setSheetOpen(true)}>
              Open a sheet
            </Primary>
            <Secondary id="open-detent-sheet" onClick={() => setDetentOpen(true)}>
              Half / full detents
            </Secondary>
          </div>
        </Section>

        {/* ── Toast ─────────────────────────────────────────────────────── */}
        <Section name="Toast" note="Sits above the tab bar and the home indicator. Errors announce as alerts, the rest as status.">
          <div className="flex flex-wrap gap-2">
            <Secondary id="toast-info" onClick={() => toast("Saved to your circle")}>
              Info
            </Secondary>
            <Secondary id="toast-ok" onClick={() => toast("Payment received", { tone: "success" })}>
              Success
            </Secondary>
            <Secondary id="toast-err" onClick={() => toast("That did not go through", { tone: "error" })}>
              Error
            </Secondary>
            <Secondary
              id="toast-undo"
              onClick={() => toast("Message deleted", { action: { label: "Undo", onPress: () => toast("Restored") } })}
            >
              With action
            </Secondary>
          </div>
        </Section>

        {/* ── PullToRefresh ─────────────────────────────────────────────── */}
        <Section name="PullToRefresh" note="Only engages when the list is already at the top. Tab into it for the button version.">
          <div className="overflow-hidden rounded-[var(--ux-r-lg)] border" style={{ borderColor: "var(--ux-line)" }}>
            <PullToRefresh
              className="h-[230px]"
              onRefresh={async () => {
                await new Promise((r) => setTimeout(r, 900));
                setRefreshed((n) => n + 1);
                toast("Up to date", { tone: "success" });
              }}
            >
              <div className="flex flex-col gap-2 p-3">
                <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>
                  Pull down · refreshed {refreshed}x
                </p>
                {Array.from({ length: 9 }, (_, i) => (
                  <div
                    key={i}
                    className="rounded-[var(--ux-r-md)] px-3 py-2.5 text-[15px]"
                    style={{ background: "var(--ux-surface)", color: "var(--ux-ink)" }}
                  >
                    Update {i + 1}
                  </div>
                ))}
              </div>
            </PullToRefresh>
          </div>
        </Section>
      </main>

      {/* A stand-in tab bar, so the toast and the sheet can be judged against
          the thing they have to clear. */}
      <nav
        className="ux-tabbar fixed inset-x-0 bottom-0 flex h-[58px] items-center justify-around border-t"
        style={{ background: "var(--ux-surface)", borderColor: "var(--ux-line)" }}
        aria-label="Sections"
      >
        {(["Home", "Learn", "Earn", "Circle", "Me"] as const).map((t, i) => (
          <span
            key={t}
            className="flex flex-col items-center gap-0.5 text-[12px] font-semibold"
            style={{ color: i === 0 ? "var(--ux-brand)" : "var(--ux-faint)" }}
          >
            <Icons.Circle className="h-[18px] w-[18px]" aria-hidden="true" />
            {t}
          </span>
        ))}
      </nav>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Record a contribution"
        description="Drag this down, or flick it — velocity wins over distance."
        footer={
          <button
            type="button"
            onClick={() => {
              setSheetOpen(false);
              toast("Contribution recorded", { tone: "success" });
            }}
            className="ux-press w-full rounded-[var(--ux-r-pill)] py-3 text-[15px] font-bold"
            style={{ background: "var(--ux-fill)", color: "var(--ux-on-brand)" }}
          >
            Record ₹{(qty * 450).toLocaleString("en-IN")}
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          <ListGroup title="Amount">
            <ListRow icon="BadgeIndianRupee" tint="green" title="Per share" value="₹450" />
            <ListRow
              icon="Boxes"
              tint="violet"
              title="Shares"
              trailing={<Stepper label="Shares" value={qty} onChange={setQty} min={1} max={20} />}
            />
          </ListGroup>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            The list below is here to prove the body still scrolls while the grab bar is draggable — the one thing
            `touch-action: none` on the wrong element breaks.
          </p>
          <ListGroup title="Recent">
            {Array.from({ length: 14 }, (_, i) => (
              <ListRow key={i} icon="Clock" tint="blue" title={`Payment ${i + 1}`} subtitle="12 Aug 2026" value="₹450" />
            ))}
          </ListGroup>
        </div>
      </Sheet>

      <Sheet
        open={detentOpen}
        onClose={() => setDetentOpen(false)}
        title="Two resting places"
        description="Opens half way. Drag up for full, down to dismiss."
        detents={["half", "full"]}
        initialDetent="half"
      >
        <div className="flex flex-col gap-2">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="rounded-[var(--ux-r-md)] px-3 py-3 text-[15px]"
              style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}
            >
              Row {i + 1}
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

/* ── Gallery furniture. Not part of the kit. ─────────────────────────────── */

function Section({ name, note, children }: { name: string; note: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-extrabold tracking-[-0.01em]" style={{ color: "var(--ux-ink)" }}>
        {name}
      </h2>
      <p className="mb-3 mt-0.5 text-[12px] leading-snug" style={{ color: "var(--ux-muted)" }}>
        {note}
      </p>
      {children}
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-[var(--ux-r-pill)] px-2 py-0.5 text-[12px] font-bold"
      style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}
    >
      {children}
    </span>
  );
}

function Primary({ id, onClick, children }: { id: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className="ux-press rounded-[var(--ux-r-pill)] px-4 py-2.5 text-[15px] font-bold"
      style={{ background: "var(--ux-fill)", color: "var(--ux-on-brand)" }}
    >
      {children}
    </button>
  );
}

function Secondary({ id, onClick, children }: { id: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className="ux-press rounded-[var(--ux-r-pill)] border px-4 py-2.5 text-[15px] font-bold"
      style={{ background: "var(--ux-surface)", borderColor: "var(--ux-line)", color: "var(--ux-ink)" }}
    >
      {children}
    </button>
  );
}
