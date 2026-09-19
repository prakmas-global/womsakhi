"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import * as Icons from "@/components/ux/icons";
import styles from "./notifications.module.css";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { useNotifications, type UxNotification } from "@/components/ux/live";
import {
  apiChannels, apiReadAllNotifications, apiReadNotification, apiSetChannel,
  type ApiChannel,
} from "@/lib/me-api";
import { apiNotificationPrefs, type NotificationPrefs } from "@/lib/member-api";
import { useT } from "@/i18n";
import { SegmentedControl } from "@/components/ux/mobile/SegmentedControl";
import { PhoneTitle } from "@/components/ux/PhoneParts";

/**
 * Notifications — the day as a line.
 *
 * ── Why a timeline and not a list ───────────────────────────────────────────
 * A list says "here are fifty things". A line says "here is your day, and this
 * is where you are in it": the same rows, in the order they actually reached
 * her, with a marker for now. What needs her is a card; what does not is a
 * line she can skim past. Weight tracks urgency instead of being uniform.
 *
 * ── One at a time ──────────────────────────────────────────────────────────
 * The second mode hands her only the unread ones, one full card at a time,
 * ending on an all-clear. Scrolling past a payment is easy; being handed it
 * alone on a card is not.
 *
 * ── A bug worth remembering ────────────────────────────────────────────────
 * This screen showed nothing but titles for a long time, and it looked like
 * missing data. It was not: `ApiNotification` declared `desc`, `time` and
 * `group`, and the server has always sent `body`, `href`, `when` and
 * `created_at`. The response is cast at the boundary, so the wrong names
 * compiled cleanly and the fields were simply never read.
 */

const LOOK: Record<string, { tint: string; ink: string; label: string }> = {
  booking:    { tint: "--ux-tint-amber",  ink: "--ux-amber-ink",  label: "Open the booking" },
  event:      { tint: "--ux-tint-amber",  ink: "--ux-amber-ink",  label: "See the event" },
  program:    { tint: "--ux-tint-blue",   ink: "--ux-blue-ink",   label: "Continue" },
  mentorship: { tint: "--ux-tint-violet", ink: "--ux-violet-ink", label: "Open" },
  message:    { tint: "--ux-tint-blue",   ink: "--ux-blue-ink",   label: "Reply" },
  money:      { tint: "--ux-tint-green",  ink: "--ux-green-ink",  label: "Open your wallet" },
  circle:     { tint: "--ux-tint-pink",   ink: "--ux-pink-ink",   label: "Open the circle" },
  safety:     { tint: "--ux-tint-pink",   ink: "--ux-pink-ink",   label: "See what happened" },
  account:    { tint: "--ux-tint-violet", ink: "--ux-violet-ink", label: "Open" },
};
const look = (kind: string) => LOOK[kind] ?? LOOK.account;

/**
 * The kinds, grouped into the handful of things she would actually ask for.
 *
 * The server sends nine `kind` values and a woman does not think in nine
 * categories — she thinks "did I get paid" and "is anything happening with my
 * circle". Filtering by raw kind would offer her `mentorship` and `program` as
 * separate choices, which is the data model leaking into the screen (§97).
 *
 * Safety is deliberately its own filter even though it is rarely non-empty:
 * on the day it is not empty, it is the only thing she wants to see.
 */
const CATEGORIES: { id: string; label: string; icon: string; kinds: string[] }[] = [
  { id: "all",    label: "All",         icon: "LayoutGrid",   kinds: [] },
  { id: "work",   label: "Opportunities",icon: "Briefcase",   kinds: ["booking", "work", "opportunity", "money"] },
  { id: "learn",  label: "Learning",   icon: "BookOpen",     kinds: ["program", "course", "mentorship"] },
  { id: "events", label: "Events",      icon: "CalendarDays", kinds: ["event"] },
  { id: "circle", label: "Community",   icon: "UsersRound",   kinds: ["circle", "message"] },
  { id: "wins",   label: "Achievements",icon: "Trophy",       kinds: ["achievement", "certificate"] },
  { id: "system", label: "System",      icon: "Settings",     kinds: ["safety", "account"] },
];

/** Types that expect something of her, rather than just telling her. */
const ACTIONABLE = new Set(["booking", "event", "message", "mentorship", "safety"]);

/** One row on the line: a notification, plus any identical ones folded under it. */
type Bundle = { head: UxNotification; rest: UxNotification[] };

function Ico({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Bell;
  return <C className={className} strokeWidth={1.9} />;
}

function dayOf(iso?: string): string {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const mid = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((mid(new Date()) - mid(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(d);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(d);
}

function clockOf(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export default function NotificationsPage() {
  const tr = useT();
  const { data: allRows, refetch } = useNotifications();
  const [mode, setMode] = useState<"day" | "one">("day");
  const [read, setRead] = useState<Set<string>>(new Set());
  const [at, setAt] = useState(0);

  const isUnread = useCallback(
    (n: UxNotification) => n.unread && !read.has(n.id), [read]);

  const markOne = useCallback(async (id: string) => {
    setRead((p) => new Set(p).add(id));
    try { await apiReadNotification(id); } catch { /* the list refetches anyway */ }
  }, []);

  const markAll = useCallback(async () => {
    // Everything, not just the filtered view: a badge that survives
    // "mark all read" because of a filter she forgot she set is a bug
    // she has no way to diagnose.
    setRead(new Set(allRows.map((n) => n.id)));
    try { await apiReadAllNotifications(); } finally { refetch(); }
  }, [allRows, refetch]);

  const [category, setCategory] = useState("all");

  /**
   * Filtered before anything else is computed, so the day grouping, the
   * actionable queue and the counts all describe what she is actually looking
   * at. Filtering only the final list would leave "3 need you" above a screen
   * showing none of them.
   */
  const rows = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.id === category);
    if (!cat || !cat.kinds.length) return allRows;
    return allRows.filter((n) => cat.kinds.includes(n.kind));
  }, [allRows, category]);

  const unread = rows.filter(isUnread);
  const queue = unread.filter((n) => ACTIONABLE.has(n.kind)).slice(0, 8);

  /**
   * Only the newest few are drawn loud.
   *
   * "Weight tracks urgency" stops meaning anything when sixteen rows are all
   * unread and all actionable — everything shouts, which is the same as
   * nothing shouting. The three most recent that want an answer get the card;
   * the rest stay lines, and are still one tap from the same actions.
   */
  const loudIds = useMemo(
    () => new Set(unread.filter((n) => ACTIONABLE.has(n.kind)).slice(0, 3).map((n) => n.id)),
    [unread],
  );

  /**
   * Grouped by day, newest first, and repeats folded together.
   *
   * Twenty-four identical "We've got your alert" rows is what the server
   * actually holds, and printing all of them is honest but useless — the
   * screen becomes one sentence repeated until nothing else can be seen.
   * Consecutive rows sharing a title collapse into one, carrying a count and
   * the times of the rest, which is the same treatment the circle joins get.
   */
  const days = useMemo(() => {
    const map = new Map<string, Bundle[]>();
    for (const n of rows) {
      const key = dayOf(n.createdAt);
      if (!map.has(key)) map.set(key, []);
      const list = map.get(key)!;
      // Folded across the whole day, not just runs. The repeats are
      // interleaved with other kinds — alert, booking, alert — so matching
      // only neighbours left ten copies of the same sentence standing.
      const seen = list.find((x) => x.head.title === n.title && x.head.kind === n.kind);
      if (seen) seen.rest.push(n);
      else list.push({ head: n, rest: [] });
    }
    return [...map.entries()];
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of unread) c[n.kind] = (c[n.kind] ?? 0) + 1;
    return c;
  }, [unread]);

  /**
   * Unread per category, computed from the UNFILTERED rows.
   *
   * Deriving these from the filtered set would make every chip except the
   * selected one read zero, which is worse than no number at all — she would
   * conclude nothing is happening anywhere else.
   */
  const catCounts = useMemo(() => {
    const c: Record<string, number> = { all: allRows.filter(isUnread).length };
    for (const cat of CATEGORIES) {
      if (!cat.kinds.length) continue;
      c[cat.id] = allRows.filter((n) => isUnread(n) && cat.kinds.includes(n.kind)).length;
    }
    return c;
  }, [allRows, isUnread]);

  return (
    <HomeShell active="/app/notifications" bare>
      <div className={`${styles.page} flex flex-col gap-4`}>
        <section className={styles.hero}>
          <Image
            src="/ux/notifications/whats-new-hero-v1.png"
            alt="Woman calmly reviewing helpful updates"
            fill
            priority
            unoptimized
            sizes="100vw"
          />
          <div className={styles.heroCopy}>
            <p>WHAT&apos;S NEW</p>
            <h1>{unread.length > 0 ? `${unread.length} updates for you` : "You’re all caught up!"}</h1>
            <span>{unread.length > 0 ? "Here’s everything new that matters to you." : "Nothing needs your attention right now."}</span>
          </div>
          <p className={styles.heroNote}>New opportunities<br/>New stories<br/>A brighter you</p>
        </section>
        {/* On a phone the screen's name is the large title; the sentence that
            says what needs her follows it, and the date is the quiet line. */}
        <PhoneTitle
          title="Notifications"
          sub={queue.length > 0
            ? <>{queue.length === 1 ? "One thing needs" : `${queue.length} things need`} you{unread.length > queue.length && <>, and <span style={{ color: "var(--ux-amber-ink)" }}>{unread.length - queue.length} to read</span></>}.</>
            : unread.length > 0 ? <>{unread.length} to read, nothing urgent.</> : tr("notifications.youAreAllCaughtUp")}
          note={new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())} />
        <header className={`${styles.controls} flex flex-wrap items-end gap-5 max-lg:-mt-2`}>
          <div className="hidden min-w-0 flex-1 lg:block">
            <p className="text-2xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--ux-brand)" }}>
              {new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
            </p>
            <h1 className="mt-2 max-w-[20ch] text-[clamp(1.5rem,3.2vw,2.25rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: "var(--ux-ink)" }}>
              {queue.length > 0 ? (
                <>
                  {queue.length === 1 ? "One thing needs" : `${queue.length} things need`} you
                  {unread.length > queue.length && (
                    <>, and <span style={{ color: "var(--ux-amber-ink)" }}>{unread.length - queue.length} to read</span></>
                  )}.
                </>
              ) : unread.length > 0 ? <>{unread.length} to read, nothing urgent.</> : <>{tr("notifications.youAreAllCaughtUp")}</>}
            </h1>
          </div>

        {/* Categories. Only shown when there is more than one thing to choose
            between — a single chip row that never changes anything is noise. */}
        {(
          /* `ux-chiprow` turns this into one sideways-scrolling row on a phone. */
          <div className="ux-chiprow flex flex-wrap gap-2" role="group" aria-label={tr("notifications.filterNotifications")}>
            {CATEGORIES.map((c) => {
              const on = category === c.id;
              const n = catCounts[c.id] ?? 0;
              return (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)}
                        aria-pressed={on}
                        className={`${styles.filterButton} ux-press ux-sq inline-flex items-center gap-2 rounded-[12px] border px-3.5 py-2.5 text-xsm font-semibold`}
                        style={{
                          borderColor: on ? "var(--ux-fill)" : "var(--ux-line-strong)",
                          background: on ? "var(--ux-fill)" : "var(--ux-surface)",
                          color: on ? "var(--ux-on-brand)" : "var(--ux-ink)",
                        }}>
                  <Ico name={c.icon} className="h-[0.9375rem] w-[0.9375rem]" />
                  {c.label}
                  {n > 0 && (
                    <span className="rounded-full px-1.5 text-2xs font-bold"
                          style={{ background: on ? "rgba(255,255,255,0.22)" : "var(--ux-brand-tint)",
                                   color: on ? "var(--ux-on-brand)" : "var(--ux-brand)" }}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

          {/* On a phone: the two ways of reading as a segmented control, and
              "Mark all read" full width under it. */}
          <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:flex-row lg:items-center">
            <SegmentedControl className="lg:hidden" label="How to read them" value={mode}
              onChange={(m) => { setMode(m); setAt(0); }}
              options={[{ value: "day" as const, label: "Your day", icon: "List" },
                        { value: "one" as const, label: "One at a time", icon: "Target" }]} />
            <div className="hidden gap-1 rounded-full p-1 lg:flex"
                 style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
              {([["day", "Your day", "List"], ["one", "One at a time", "Target"]] as const).map(([m, label, icon]) => (
                <button key={m} type="button" onClick={() => { setMode(m); setAt(0); }} aria-pressed={mode === m}
                        className="ux-press flex items-center gap-2 rounded-full px-4 py-2.5 text-xsm font-bold"
                        style={mode === m
                          ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
                          : { color: "var(--ux-muted)" }}>
                  <Ico name={icon} className="h-[14px] w-[14px]" /> {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={markAll} disabled={unread.length === 0}
                    className="ux-press flex min-h-[44px] items-center gap-2 rounded-full px-4 text-xsm font-bold disabled:opacity-40 max-lg:justify-center"
                    style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", color: "var(--ux-ink-2)" }}>
              <Icons.CheckCheck className="h-4 w-4" />{tr("notifications.markAllRead")}</button>
          </div>
        </header>

        <div className={`grid grid-cols-1 gap-7 ${mode === "day" ? "xl:grid-cols-[minmax(0,1fr)_274px]" : ""}`}>
          {mode === "day" ? (
            <>
              <Timeline days={days} isUnread={isUnread} onRead={markOne} loudIds={loudIds} />
              <Rail counts={counts} unread={unread.length} />
            </>
          ) : (
            <Focus queue={queue} at={at} setAt={setAt} onRead={markOne} onDone={() => setMode("day")} />
          )}
        </div>
      </div>
    </HomeShell>
  );
}

/* ── the day ────────────────────────────────────────────────────────────── */

function Timeline({
  days, isUnread, onRead, loudIds,
}: {
  days: [string, Bundle[]][];
  isUnread: (n: UxNotification) => boolean;
  onRead: (id: string) => void;
  loudIds: Set<string>;
}) {
  const tr = useT();
  if (days.length === 0) {
    return (
      <section className="ux-sq grid place-items-center rounded-[20px] p-12 text-center max-lg:rounded-[16px] max-lg:p-8"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
        <div>
          <Icons.BellOff className="mx-auto h-[32px] w-[32px]" style={{ color: "var(--ux-faint)" }} />
          <p className="mt-3 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("notifications.nothingYet")}</p>
          <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("notifications.paymentsRepliesAndClassRemindersLa")}</p>
        </div>
      </section>
    );
  }

  return (
    <div className={`${styles.timeline} ux-tl`}>
      {days.map(([day, items], di) => (
        <div key={day}>
          {di === 0 ? (
            /* Where she is in the day — only ever on the newest group. */
            <div className="ux-tl-row items-center py-1">
              <span className="pe-0 text-end text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>
                {clockOf(new Date().toISOString())}
              </span>
              <span className="flex items-center" style={{ paddingInlineStart: 14.5 }}>
                <i className="block h-[11px] w-[11px] rounded-full"
                   style={{ background: "var(--ux-rib-3)", boxShadow: "0 0 0 4px var(--ux-tint-pink)" }} />
              </span>
              <span className="flex items-center gap-2.5 text-2xs font-bold uppercase tracking-[0.2em]"
                    style={{ color: "var(--ux-pink-ink)" }}>
                Now
                <span className="h-px flex-1"
                      style={{ background: "linear-gradient(90deg, var(--ux-pink), transparent)" }} />
              </span>
            </div>
          ) : (
            <div className="ux-tl-row my-5 items-center">
              <span />
              <span className="col-span-2 flex items-center gap-3 text-2xs font-bold uppercase tracking-[0.18em]"
                    style={{ color: "var(--ux-faint)" }}>
                {day}
                <span className="h-px flex-1" style={{ background: "var(--ux-line)" }} />
              </span>
            </div>
          )}

          {items.map((bundle) => (
            <Event key={bundle.head.id} bundle={bundle} unread={isUnread(bundle.head)}
                   onRead={onRead} loud={loudIds.has(bundle.head.id)} isUnread={isUnread} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Event({
  bundle, unread, onRead, loud, isUnread,
}: {
  bundle: Bundle; unread: boolean; loud: boolean;
  onRead: (id: string) => void; isUnread: (n: UxNotification) => boolean;
}) {
  const { head: n, rest } = bundle;
  const [open, setOpen] = useState(false);
  const l = look(n.kind);
  const folded = rest.length;
  const unreadInBundle = (unread ? 1 : 0) + rest.filter(isUnread).length;

  /** Marking the row read marks everything folded under it. */
  const readAll = () => { onRead(n.id); for (const r of rest) onRead(r.id); };

  return (
    <div className="ux-tl-row items-start py-2.5">
      <span className="pt-[8px] text-end text-xs font-semibold" style={{ color: "var(--ux-faint)" }}>
        {clockOf(n.createdAt) || n.when}
      </span>
      <span className="ux-tl-node grid h-[34px] w-[34px] place-items-center rounded-[12px]"
            style={{ background: `var(${l.tint})`, color: `var(${l.ink})` }}>
        <Ico name={n.icon} className="h-[17px] w-[17px]" />
      </span>

      <div className={`${styles.eventCard} rounded-[16px] transition-colors`} data-loud={loud || undefined}
           style={loud
             ? { background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                 boxShadow: "var(--ux-shadow-card)", padding: 16 }
             : { background: "transparent", border: "1px solid transparent", padding: "6px 0" }}>
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
            {n.title}
            {folded > 0 && (
              <span className="ms-2 rounded-full px-2 py-[3px] text-2xs font-bold align-middle"
                    style={{ background: `var(${l.tint})`, color: `var(${l.ink})` }}>
                {folded + 1}&#215;
              </span>
            )}
          </h2>
          {unreadInBundle > 0 && (
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: "var(--ux-rib-3)" }} />
          )}
        </div>
        {n.body && (
          <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>{n.body}</p>
        )}

        {/* The folded ones, on request — each keeps its own time. */}
        {folded > 0 && (
          <>
            <button type="button" onClick={() => setOpen((o) => !o)}
                    className="ux-press mt-1.5 flex min-h-[24px] items-center gap-1.5 py-1 text-xs font-bold"
                    style={{ color: "var(--ux-brand)" }}>
              {open ? "Hide" : `Show the other ${folded}`}
              <Icons.ChevronDown className={`h-[13px] w-[13px] transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="mt-2 flex flex-col gap-1.5 ps-3"
                   style={{ borderInlineStart: "2px solid var(--ux-line)" }}>
                {rest.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs" style={{ color: "var(--ux-muted)" }}>
                    {isUnread(r) && (
                      <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: "var(--ux-rib-3)" }} />
                    )}
                    <span>{clockOf(r.createdAt) || r.when}</span>
                    {r.href && (
                      <Link href={r.href} onClick={() => onRead(r.id)} className="ms-auto font-semibold"
                            style={{ color: "var(--ux-brand)" }}>Open</Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {n.href && (
            <Link href={n.href} onClick={readAll}
                  className="ux-press flex min-h-[36px] items-center gap-2 rounded-[12px] px-3.5 text-xs font-bold"
                  style={loud
                    ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
                    : { background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
              {l.label}
              <Icons.ArrowRight className="h-[13px] w-[13px]" />
            </Link>
          )}
          {unreadInBundle > 0 && (
            <button type="button" onClick={readAll}
                    className="ux-press flex min-h-[36px] items-center gap-2 rounded-[12px] px-3.5 text-xs font-bold"
                    style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-muted)" }}>
              <Icons.Check className="h-[13px] w-[13px]" />
              {folded > 0 ? `Mark all ${unreadInBundle} read` : "Mark read"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── one at a time ──────────────────────────────────────────────────────── */

function Focus({
  queue, at, setAt, onRead, onDone,
}: {
  queue: UxNotification[]; at: number; setAt: (n: number) => void;
  onRead: (id: string) => void; onDone: () => void;
}) {
  const tr = useT();
  const n = queue[at];

  if (queue.length === 0 || !n) {
    return (
      <section className="mx-auto w-full max-w-[620px] rounded-[24px] p-12 text-center max-lg:rounded-[16px] max-lg:p-8"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)" }}>
        <Icons.CheckCheck className="mx-auto h-[40px] w-[40px]" style={{ color: "var(--ux-green-ink)" }} />
        <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.02em]" style={{ color: "var(--ux-ink)" }}>{tr("notifications.thatIsEverything")}</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--ux-muted)" }}>{tr("notifications.nothingElseNeedsYouTheRest")}</p>
        <button type="button" onClick={onDone}
                className="ux-press ux-btn-g mx-auto mt-6 flex min-h-[44px] items-center gap-2 rounded-[12px] px-5 text-xsm font-bold"
                style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>{tr("notifications.backToYourDay")}<Icons.ArrowRight className="h-4 w-4" />
        </button>
      </section>
    );
  }

  const l = look(n.kind);
  const next = () => { onRead(n.id); setAt(at + 1); };

  return (
    <section className="mx-auto w-full max-w-[620px]">
      <div className="mb-6 flex gap-1.5">
        {queue.map((q, i) => (
          <i key={q.id} className="h-[4px] flex-1 rounded-full"
             style={{ background: i < at
               ? "linear-gradient(90deg, var(--ux-rib-2), var(--ux-rib-3))" : "var(--ux-track)" }} />
        ))}
      </div>

      <div className="rounded-[24px] p-8 text-center max-lg:rounded-[16px] max-lg:p-6"
           style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                    boxShadow: "var(--ux-shadow-card)" }}>
        <span className="mx-auto grid h-[56px] w-[56px] place-items-center rounded-[20px]"
              style={{ background: `var(${l.tint})`, color: `var(${l.ink})` }}>
          <Ico name={n.icon} className="h-[26px] w-[26px]" />
        </span>
        <h2 className="mt-5 text-xl font-extrabold leading-[1.25] tracking-[-0.025em]" style={{ color: "var(--ux-ink)" }}>
          {n.title}
        </h2>
        {n.body && <p className="mt-3 text-sm" style={{ color: "var(--ux-muted)" }}>{n.body}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          {n.href && (
            <Link href={n.href} onClick={() => onRead(n.id)}
                  className="ux-press flex min-h-[46px] items-center gap-2 rounded-[12px] px-6 text-xsm font-bold"
                  style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
              {l.label} <Icons.ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {/* Skipping is a choice, not a failure — so it is offered plainly. */}
          <button type="button" onClick={next}
                  className="ux-press flex min-h-[46px] items-center gap-2 rounded-[12px] px-5 text-xsm font-bold"
                  style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)" }}>
            <Icons.Check className="h-4 w-4" />{tr("notifications.doneWithThis")}</button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between text-xs" style={{ color: "var(--ux-muted)" }}>
        <button type="button" onClick={() => setAt(Math.max(0, at - 1))} disabled={at === 0}
                className="ux-press flex items-center gap-1.5 font-bold disabled:opacity-40">
          <Icons.ChevronLeft className="h-4 w-4" /> Back
        </button>
        <span>{at + 1} of {queue.length}</span>
        <button type="button" onClick={() => setAt(at + 1)} className="ux-press flex items-center gap-1.5 font-bold">{tr("notifications.skipForNow")}<Icons.ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

/* ── the rail ───────────────────────────────────────────────────────────── */

const DOT: Record<string, string> = {
  safety: "--ux-pink", booking: "--ux-amber", mentorship: "--ux-violet",
  event: "--ux-amber", program: "--ux-blue", message: "--ux-blue",
  money: "--ux-green", circle: "--ux-pink", account: "--ux-violet",
};
const NAME: Record<string, string> = {
  safety: "Safety", booking: "Bookings", mentorship: "Mentors", event: "Events",
  program: "Learning", message: "Messages", money: "Money", circle: "Circles", account: "Account",
};

/**
 * How she is told — the real delivery toggles.
 *
 * These read "Always / Daily / Payments" as fixed text for a while, which was
 * decorative: the server has had `/notifications/channels` all along, with a
 * real on/off per channel and a PATCH to set it. Text that looks like a
 * setting but cannot be changed is worse than no panel at all.
 */
function Channels({ card, style }: { card: string; style: React.CSSProperties }) {
  const tr = useT();
  const [items, setItems] = useState<ApiChannel[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    apiChannels(ac.signal).then(setItems).catch(() => setItems([]));
    return () => ac.abort();
  }, []);

  const flip = async (c: ApiChannel) => {
    setBusy(c.label);
    // Shown immediately, put back if the server disagrees.
    setItems((p) => p?.map((x) => (x.label === c.label ? { ...x, on: !x.on } : x)) ?? p);
    try { await apiSetChannel(c.label, !c.on); }
    catch { setItems((p) => p?.map((x) => (x.label === c.label ? { ...x, on: c.on } : x)) ?? p); }
    finally { setBusy(null); }
  };

  return (
    <section className={card} style={style}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
        <Icons.Sparkles className="h-[15px] w-[15px]" style={{ color: "var(--ux-brand)" }} />{tr("notifications.howYouAreTold")}<Link href="/app/settings/notifications" className="ux-tap ms-auto text-xs font-semibold"
              style={{ color: "var(--ux-brand)" }}>Settings</Link>
      </h2>
      {items === null ? (
        <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("notifications.couldNotLoadYourChannels")}</p>
      ) : (
        items.map((c) => (
          <button key={c.id} type="button" onClick={() => flip(c)} disabled={busy === c.label}
                  aria-pressed={c.on}
                  className="ux-press flex min-h-[38px] w-full items-center gap-2.5 text-xsm disabled:opacity-50"
                  style={{ color: "var(--ux-muted)" }}>
            <Ico name={c.icon} className="h-[14px] w-[14px]" />
            {c.label}
            <span className="ms-auto grid h-[20px] w-[34px] shrink-0 items-center rounded-full px-[2px] transition-colors"
                  style={{ background: c.on ? "var(--ux-brand)" : "var(--ux-track)",
                           justifyItems: c.on ? "end" : "start" }}>
              <i className="block h-[16px] w-[16px] rounded-full" style={{ background: "var(--ux-surface)" }} />
            </span>
          </button>
        ))
      )}
    </section>
  );
}

/**
 * Quiet hours, as she actually set them.
 *
 * This printed "9:30 PM — 7:00 AM" as fixed text, which was not her window —
 * there were no quiet-hours fields on the server at all, and the button under
 * it went to the notification preferences page, which had nowhere to put one.
 */
function QuietCard() {
  const tr = useT();
  const [p, setP] = useState<NotificationPrefs | null>(null);
  useEffect(() => {
    let live = true;
    apiNotificationPrefs().then((v) => live && setP(v)).catch(() => {});
    return () => { live = false; };
  }, []);

  const fmt = (m: number) => {
    const h = Math.floor(m / 60) % 24, mm = m % 60;
    return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  const days = p?.quiet_days.filter(Boolean).length ?? 7;

  return (
    <section className="overflow-hidden rounded-[20px] p-4 max-lg:rounded-[16px]"
             style={{ background: "linear-gradient(150deg, var(--ux-brand-900), var(--ux-fill))" }}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--ux-on-brand)" }}>
        <Icons.Moon className="h-[15px] w-[15px]" style={{ color: "var(--ux-rib-5)" }} />{tr("notifications.quietHours")}</h2>
      {p && p.quiet_hours ? (
        <>
          <b className="block text-lg font-extrabold tabular-nums" style={{ color: "var(--ux-on-brand)" }}>
            {fmt(p.quiet_start)} — {fmt(p.quiet_end)}
          </b>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--ux-on-brand-2)" }}>
            {days === 7 ? "Every night" : days === 0 ? "No nights picked" : `${days} nights a week`}.
            Anything urgent still waits here for the morning.
          </p>
        </>
      ) : (
        <p className="text-xs leading-relaxed" style={{ color: "var(--ux-on-brand-2)" }}>
          {p ? tr("notifications.offEverythingReachesYouAtAny")
              : tr("notifications.nothingBuzzesWhileYouSleep")}
        </p>
      )}
      <Link href="/app/settings/quiet-hours"
            className="ux-press mt-3 flex min-h-[38px] items-center justify-center gap-2 rounded-[12px] text-xs font-bold"
            style={{ background: "var(--ux-on-brand-btn)", color: "var(--ux-on-brand-btn-ink)" }}>
        {p && p.quiet_hours ? tr("notifications.changeYourQuietHours")
              : tr("notifications.setYourQuietHours")}
        <Icons.ArrowRight className="h-[14px] w-[14px]" />
      </Link>
    </section>
  );
}

function Rail({ counts, unread }: { counts: Record<string, number>; unread: number }) {
  const tr = useT();
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const card = "ux-sq rounded-[20px] p-4 max-lg:rounded-[16px]";
  const style = { background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                  boxShadow: "var(--ux-shadow-card)" } as const;

  return (
    <div className={`${styles.rail} flex flex-col gap-4`}>
      <section className={card} style={style}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
          <Icons.Bell className="h-[15px] w-[15px]" style={{ color: "var(--ux-brand)" }} />
          Unread
          <b className="ms-auto text-base font-extrabold tabular-nums">{unread}</b>
        </h2>
        {rows.length === 0 ? (
          <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("notifications.nothingUnread")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map(([kind, n]) => (
              <div key={kind} className="flex items-center gap-2.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
                <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: `var(${DOT[kind] ?? "--ux-violet"})` }} />
                {NAME[kind] ?? kind}
                <b className="ms-auto font-bold" style={{ color: "var(--ux-ink)" }}>{n}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <QuietCard />

      <Channels card={card} style={style} />
    </div>
  );
}
