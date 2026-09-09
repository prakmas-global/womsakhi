"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Card, I, IconTile, v } from "@/components/ux/kit";
import type { DiaryEntry } from "@/components/ux/diary";
import { useT } from "@/i18n";

/* ------------------------------------------------------------------ */
/*  Categories                                                         */
/* ------------------------------------------------------------------ */

/**
 * The six kinds of thing a day can hold.
 *
 * Colour is doing real work here rather than decoration: on a month grid the
 * entries are too small to read at a glance, so the tint is what tells her
 * "that Tuesday is a class, that Friday is money" before she reads a word.
 * Each one comes from the tint/ink pair so it stays legible in both themes —
 * the plain accents only clear the 3:1 a graphic needs, not text on a tint.
 */
export const CATEGORIES = [
  { id: "learning",  label: "Learning",  icon: "GraduationCap", tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  { id: "work",      label: "Work",      icon: "Briefcase",     tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  { id: "community", label: "Community", icon: "Users",         tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  { id: "mentoring", label: "Mentoring", icon: "UserRound",     tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  { id: "personal",  label: "Personal",  icon: "Leaf",          tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  { id: "other",     label: "Other",     icon: "Circle",        tint: "--ux-surface-2",   ink: "--ux-muted" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

/** What the diary calls a thing → what this screen calls it. */
export function categoryOf(entry: DiaryEntry): CategoryId {
  switch (entry.kind) {
    case "Session":   return "learning";
    case "Event":     return "community";
    case "Mentoring": return "mentoring";
    default:          return "other";
  }
}

export const catFor = (id: CategoryId) =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

/* ------------------------------------------------------------------ */
/*  Month grid                                                         */
/* ------------------------------------------------------------------ */

export interface DayCell {
  iso: string;
  date: number;
  outside: boolean;
  today: boolean;
  entries: DiaryEntry[];
}

/**
 * Six weeks of cells, Sunday-first, always the same height.
 *
 * Always six rows even when five would do. A grid that changes height between
 * March and April makes everything below it jump when she pages through the
 * year, and the whole point of a month view is that the shape stays still.
 */
export function buildMonth(year: number, month: number, entries: DiaryEntry[], todayIso: string): DayCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  const byDay = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.on);
    if (list) list.push(e);
    else byDay.set(e.on, [e]);
  }

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return {
      iso,
      date: d.getDate(),
      outside: d.getMonth() !== month,
      today: iso === todayIso,
      entries: byDay.get(iso) ?? [],
    };
  });
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * "09:00 · 60 min" → "9:00 AM".
 *
 * The diary stores 24-hour with the length appended. In a month cell there is
 * room for one of those, and the one she needs is when it starts; the length
 * belongs in the day panel where there is space to say it.
 */
export function clockTime(raw: string): string {
  const [head] = raw.split("·").map((x) => x.trim());
  const m = /^(\d{1,2}):(\d{2})/.exec(head);
  if (!m) return head;
  const h = Number(m[1]);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/** What is left after the time — "60 min", for the day panel's second line. */
export function lengthOf(raw: string): string {
  const [, ...rest] = raw.split("·").map((x) => x.trim());
  return rest.join(" · ");
}

/**
 * One entry inside a day cell.
 *
 * The title is allowed two lines rather than truncated to one: "Advanced
 * Stitching Techniques" clipped to "Advanced Stitc…" tells her nothing, and a
 * month cell has the height to spare.
 */
function EventPill({ entry }: { entry: DiaryEntry }) {
  const cat = catFor(categoryOf(entry));
  return (
    <Link href={entry.href} className="ux-sq block rounded-[7px] px-2 py-1.5"
          style={{ background: v(cat.tint) }}>
      <span className="flex items-start gap-1">
        <I name={cat.icon} className="mt-[2px] h-[11px] w-[11px] shrink-0" style={{ color: v(cat.ink) }} />
        <span className="min-w-0 flex-1">
          <span className="block text-2xs font-semibold leading-[1.25]"
                style={{ color: v(cat.ink), display: "-webkit-box", WebkitLineClamp: 2,
                         WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {entry.title}
          </span>
          {entry.time && (
            <span className="mt-[2px] block truncate text-2xs leading-tight"
                  style={{ color: v(cat.ink), opacity: 0.72 }}>
              {clockTime(entry.time)}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

export function MonthGrid({ cells, onPick }: { cells: DayCell[]; onPick: (iso: string) => void }) {
  return (
    <div className="overflow-hidden rounded-[12px] border" style={{ borderColor: v("--ux-line") }}>
      {/* Day names */}
      <div className="grid grid-cols-7 border-b" style={{ borderColor: v("--ux-line") }}>
        {DOW.map((d) => (
          <div key={d} className="py-3.5 text-center text-xsm font-semibold" style={{ color: v("--ux-muted") }}>
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((c, i) => (
          <button
            key={c.iso}
            type="button"
            onClick={() => onPick(c.iso)}
            // A day is only a heading for what it holds, so it is not a
            // heading element — it is the control that opens that day.
            aria-label={`${c.date}, ${c.entries.length} activities`}
            className="ux-sq relative flex min-h-[128px] flex-col gap-[4px] border-b border-e p-2 text-start"
            style={{
              borderColor: v("--ux-line"),
              // The last column and last row sit on the wrapper's own edge.
              borderInlineEndWidth: (i + 1) % 7 === 0 ? 0 : undefined,
              borderBottomWidth: i >= 35 ? 0 : undefined,
              background: c.today ? v("--ux-brand-tint") : "transparent",
            }}
          >
            {/* Today is ringed as well as tinted: on a pale tint alone the
                current day is easy to miss at a glance. */}
            {c.today && (
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[2px]"
                    style={{ border: `1.5px solid ${v("--ux-brand")}` }} />
            )}
            <span
              className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-xsm font-medium"
              style={{
                background: c.today ? v("--ux-fill") : "transparent",
                color: c.today ? v("--ux-on-brand") : c.outside ? v("--ux-faint") : v("--ux-ink-2"),
              }}
            >
              {c.date}
            </span>
            {c.entries.slice(0, 3).map((e) => <EventPill key={e.id} entry={e} />)}
            {c.entries.length > 3 && (
              <span className="ps-1 text-3xs font-semibold" style={{ color: v("--ux-muted") }}>
                +{c.entries.length - 3} more
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Right rail                                                         */
/* ------------------------------------------------------------------ */

/**
 * One row in the day panel.
 *
 * The time is its own column on the left, with the length under it, because
 * that is the column she scans — "what is at five" is the question, not "what
 * is the third thing".
 */
function DayRow({ entry }: { entry: DiaryEntry }) {
  const cat = catFor(categoryOf(entry));
  const at = clockTime(entry.time);
  const len = lengthOf(entry.time);
  return (
    <Link href={entry.href} className="ux-hov ux-sq -mx-2 flex items-center gap-3 rounded-[10px] px-2 py-2.5">
      <span className="w-[58px] shrink-0">
        <span className="block text-sm font-bold leading-tight" style={{ color: v("--ux-ink") }}>{at || "—"}</span>
        {len && <span className="mt-0.5 block text-2xs" style={{ color: v("--ux-faint") }}>{len}</span>}
      </span>
      <IconTile icon={cat.icon} tint={cat.tint} ink={cat.ink} size={40} radius={12} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold" style={{ color: v("--ux-ink") }}>{entry.title}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: v("--ux-muted") }}>
          <I name={entry.where === "Online" ? "Video" : "MapPin"} className="h-[11px] w-[11px] shrink-0" />
          <span className="truncate">{entry.where}</span>
        </span>
      </span>
      <Icons.ChevronRight className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-faint") }} />
    </Link>
  );
}

export function TodayPanel({
  label, count, entries, onToday, isToday, onFullDay,
}: {
  label: string; count: number; entries: DiaryEntry[];
  onToday: () => void; isToday: boolean; onFullDay: () => void;
}) {
  const tr = useT();
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold leading-tight tracking-[-0.01em]" style={{ color: v("--ux-ink") }}>{label}</h2>
          <p className="mt-1 text-xsm" style={{ color: v("--ux-muted") }}>
            {count === 1 ? "1 activity" : `${count} activities`}{isToday ? " today" : ""}
          </p>
        </div>
        {/* Always present, not only when she has wandered off: a control that
            appears and disappears is one she has to hunt for. */}
        <button type="button" onClick={onToday}
                className="ux-press ux-sq shrink-0 rounded-[10px] px-3.5 py-2 text-xs font-bold"
                style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
          Today
        </button>
      </div>

      {entries.length ? (
        <>
          <div className="mt-3 space-y-0.5">
            {entries.map((e) => <DayRow key={e.id} entry={e} />)}
          </div>
          <button type="button" onClick={onFullDay}
                  className="ux-press ux-sq mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[11px] border text-xsm font-bold"
                  style={{ borderColor: v("--ux-line"), color: v("--ux-brand") }}>
            {tr("calendar.viewFullDay")}
            <Icons.ArrowRight className="h-[15px] w-[15px]" />
          </button>
        </>
      ) : (
        <p className="mt-3 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
          {tr("calendar.nothingOnThisDayAFree")}
        </p>
      )}
    </Card>
  );
}

export function ComingUp({ entries }: { entries: DiaryEntry[] }) {
  const tr = useT();
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-[-0.01em]" style={{ color: v("--ux-ink") }}>{tr("calendar.comingUp")}</h2>
        <Link href="/app/bookings" className="ux-sq flex items-center gap-0.5 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          {tr("calendar.viewAll")} <Icons.ChevronRight className="h-[13px] w-[13px]" />
        </Link>
      </div>

      {entries.length ? (
        <div className="space-y-0.5">
          {entries.map((e) => {
            const cat = catFor(categoryOf(e));
            return (
              <Link key={e.id} href={e.href}
                    className="ux-hov ux-sq -mx-2 flex items-center gap-3 rounded-[10px] px-2 py-2.5">
                <span className="w-[46px] shrink-0">
                  <span className="block text-xsm font-bold leading-tight" style={{ color: v("--ux-ink") }}>
                    {e.d} {e.m}
                  </span>
                  <span className="mt-0.5 block text-2xs" style={{ color: v("--ux-faint") }}>{e.day}</span>
                </span>
                <IconTile icon={cat.icon} tint={cat.tint} ink={cat.ink} size={34} radius={10} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>{e.title}</span>
                  <span className="mt-0.5 block truncate text-xs" style={{ color: v("--ux-muted") }}>{clockTime(e.time)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
          {tr("calendar.nothingBookedAheadYet")}
        </p>
      )}
    </Card>
  );
}
