"use client";

/**
 * Everything the inbox draws, separated from everything it does.
 *
 * ── Why here ────────────────────────────────────────────────────────────────
 * The page was 943 lines carrying the conversation state, the read-marking,
 * the send loop AND nine view components. The views take typed props and hold
 * none of that state, so the page can own *what happens* and this file *what
 * it looks like* — which means changing a message bubble cannot break the
 * send loop, and reading the send loop is no longer a scroll past the avatar
 * component.
 */

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Bold, Italic, PinOff } from "lucide-react";
import * as Icons from "@/components/ux/icons";
import { useToast } from "@/design-system/feedback/ToastProvider";

import { formatMoney } from "@/components/ux/kit/money";
import Link from "next/link";
import { apiEditMessage, apiPinMessage, EDIT_WINDOW_MS, MAX_PINS, MESSAGE_MAX, type ConvBubble, type ConvDetail, type ConvRow, type InboxSummary, type PartyKind } from "@/lib/me-messages-api";
import { useT } from "@/i18n";
import { bubbleRadius, ChatDock, ChatFrame, ChatInput, ChatLog, JumpToLatest, Says, SendButton, Stamp, useChatScroll } from "@/components/ux/sakhi/chat";
import { ListGroup, ListRow } from "@/components/ux/mobile/ListRow";
import { monogram } from "@/lib/monogram";

/**
 * Messages.
 *
 * ── Why the inbox is not sorted by recency ──────────────────────────────────
 * Every chat app sorts newest-first, and for a chat app that is right. This is
 * not a chat app — it is the place a woman runs her shop from. A buyer who
 * asked a question two days ago matters more than a circle that chatted a
 * minute ago, so conversations *waiting for her reply* come first, longest wait
 * at the top, and everything else follows by recency.
 *
 * Only buyers and mentors can be "waiting": a circle chatting among itself and
 * a team announcement are unanswered too, but nobody is sitting there wondering
 * why she has not replied. Counting them is how that section stops meaning
 * anything. The rule lives on the server — `MemberConversationModel.awaits_reply`.
 *
 * ── The thread carries what it is about ─────────────────────────────────────
 * A message here is about work, not chat, so the order sits in the header strip
 * and again in the thread at the moment it was created. She never has to
 * remember which order "is it ready?" refers to.
 */

/** "3 hours" · "2 days" · "12 minutes" — how long she has left someone waiting. */
function waited(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - parseAt(iso)) / 60_000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"}`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** "12:40" for today, "Mon" this week, "30 Aug" beyond. */
function shortWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(parseAt(iso));
  if (Number.isNaN(d.getTime())) return "";
  const mid = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((mid(new Date()) - mid(d)) / 86_400_000);
  if (days === 0) return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  if (days === 1) return "Yesterday";
  if (days < 7) return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}

function clock(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(parseAt(iso));
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function dayLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(parseAt(iso));
  const mid = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((mid(new Date()) - mid(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short" }).format(d);
}

/**
 * Who a thread is with, as a small coloured dot and a word.
 *
 * The kind used to be a gradient ring around the face AND a tinted chip in a
 * different colour per kind. The ring stretched with the row (a block span in
 * a flex row), so every avatar sat on a tall gold/green/violet pill, and five
 * chip colours made the list look like five different lists depending on the
 * tab. Now every row is the same neutral shape and the kind is only a dot.
 */
export const DOT: Record<PartyKind, string> = {
  buyer: "var(--ux-green)",
  // A woman she is buying FROM — amber, so the two directions are tellable
  // apart at a glance in one list.
  seller: "var(--ux-amber)",
  mentor: "var(--ux-violet)",
  circle: "var(--ux-pink)",
  team: "var(--ux-blue)",
};
export const TAG: Record<PartyKind, { label: string }> = {
  buyer: { label: "Buyer" },
  seller: { label: "You are buying" },
  mentor: { label: "Mentor" },
  circle: { label: "Circle" },
  team: { label: "Team" },
};

/** The kind, as the one neutral chip every row carries. */
export function KindChip({ kind, extra }: { kind: PartyKind; extra?: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-[2px] text-[12px] font-semibold leading-[18px]"
          style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-ink-2)" }}>
      <i aria-hidden className="block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: DOT[kind] }} />
      <span className="truncate">{TAG[kind].label}{extra ? ` · ${extra}` : ""}</span>
    </span>
  );
}

export const FILTERS: { value: PartyKind | "all"; label: string }[] = [
  { value: "all", label: "All" }, { value: "buyer", label: "Buyers" },
  { value: "seller", label: "Sellers" },
  { value: "mentor", label: "Mentors" }, { value: "circle", label: "Circles" },
  { value: "team", label: "Team" },
];

export function Header({ summary, className, rows, onPick }: {
  summary: InboxSummary | null; className?: string;
  rows: ConvRow[]; onPick: (id: string) => void;
}) {
  const tr = useT();
  const stats = [
    { icon: "Clock", tint: "--ux-tint-amber", ink: "--ux-amber-ink",
      value: String(summary?.waiting ?? 0), note: tr("views.waitingOnYou") },
    { icon: "Wallet", tint: "--ux-tint-green", ink: "--ux-green-ink",
      value: formatMoney(summary?.open_order_minor ?? 0), note: tr("views.inOpenOrders") },
    { icon: "Zap", tint: "--ux-tint-violet", ink: "--ux-violet-ink",
      // Measured from her own replies, not a promise. Absent until there is
      // at least one answered message to measure.
      value: summary?.reply_minutes == null ? "—"
        : summary.reply_minutes < 60 ? `${summary.reply_minutes}m` : `${Math.round(summary.reply_minutes / 60)}h`,
      note: tr("views.yourReplyTime") },
  ];
  /*
    On a phone the three stat cards were 250px — most of the conversation list —
    spent on numbers she did not come here for. They become one quiet line under
    the title, which is where a phone puts a summary. Nothing is lost: every one
    of the three is still a full card from `lg` up.
  */
  const line = [
    `${summary?.waiting ?? 0} waiting on you`,
    `${formatMoney(summary?.open_order_minor ?? 0)} in open orders`,
    summary?.reply_minutes == null ? null
      : summary.reply_minutes < 60 ? `${summary.reply_minutes}m reply time`
      : `${Math.round(summary.reply_minutes / 60)}h reply time`,
  ].filter(Boolean).join(" · ");

  return (
    <header className={`flex-wrap items-end gap-4 ${className ?? "flex"}`}>
      <div className="min-w-0 flex-1">
        <h1 className="ux-screen-title text-2xl font-bold tracking-[-0.03em]" style={{ color: "var(--ux-ink)" }}>Messages</h1>
        <p className="mt-1 hidden text-xsm lg:block" style={{ color: "var(--ux-muted)" }}>{tr("messages.buyersMentorsAndYourCirclesAll")}</p>
        <p className="mt-1.5 text-[13px] lg:hidden" style={{ color: "var(--ux-muted)" }}>{line}</p>
      </div>
      <div className="hidden flex-wrap items-center gap-2.5 lg:flex">
        {stats.map((s) => (
          <div key={s.note} className="ux-sq flex items-center gap-2.5 rounded-[12px] px-3.5 py-2.5"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                        boxShadow: "var(--ux-shadow-card)" }}>
            <span className="grid h-[32px] w-[32px] place-items-center rounded-[12px]"
                  style={{ background: `var(${s.tint})`, color: `var(${s.ink})` }}>
              <Ico name={s.icon} className="h-[16px] w-[16px]" />
            </span>
            <span>
              <b className="block text-base font-bold leading-none tracking-[-0.02em]" style={{ color: "var(--ux-ink)" }}>
                {s.value}
              </b>
              <i className="mt-1 block text-[12px] lg:text-2xs not-italic" style={{ color: "var(--ux-muted)" }}>{s.note}</i>
            </span>
          </div>
        ))}
        <NewMessage rows={rows} onPick={onPick} />
      </div>
    </header>
  );
}

/**
 * New message.
 *
 * Not a blank compose window: a member cannot invent a recipient here, because
 * a buyer is not a WomSakhi account — conversations begin when someone writes
 * to her about an order or joins a circle with her. So this jumps to a person
 * she already talks to, and says plainly where a new one comes from.
 */
export function NewMessage({ rows, onPick, full = false }: {
  rows: ConvRow[]; onPick: (id: string) => void;
  /** Docked at the bottom of a phone screen: full width, and it opens upward. */
  full?: boolean;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={wrap} className={full ? "relative" : "relative"}>
      <button type="button" onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu" aria-expanded={open}
              /* The docked phone button carries its own 50px / 14 / 17px bold.
                 Not `.ux-action-primary`: that shared rule sets 16px, which is
                 off the phone type scale, and it is unlayered, so it beat the
                 17px beside it. */
              className={`ux-press ux-btn-g flex items-center justify-center gap-2 font-bold ${
                full ? "min-h-[50px] w-full rounded-[14px] text-[17px]"
                     : "min-h-[46px] rounded-[12px] px-4 text-xsm"}`}
              style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                       color: "var(--ux-on-brand)", boxShadow: "var(--ux-shadow-glow-2)" }}>
        <Icons.Plus className="h-[18px] w-[18px]" />{tr("messages.newMessage")}</button>
      {open && (
        <div role="menu"
             className={`ux-pop absolute z-50 max-h-[340px] overflow-y-auto rounded-[14px] p-1.5 ${
               full ? "inset-x-0 bottom-[calc(100%+8px)]" : "end-0 top-[calc(100%+8px)] w-[290px]"}`}
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                      boxShadow: "var(--ux-shadow-pop)" }}>
          <p className="px-2.5 pb-1 pt-2 text-[12px] lg:text-2xs font-bold uppercase tracking-[0.16em]"
             style={{ color: "var(--ux-faint)" }}>{tr("messages.writeTo")}</p>
          {rows.map((r) => (
            <button key={r.id} type="button" role="menuitem"
                    onClick={() => { setOpen(false); onPick(r.id); }}
                    className="ux-row flex min-h-[48px] w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-start">
              <Avatar src={r.avatar} name={r.name} kind={r.kind} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{r.name}</span>
                <span className="block truncate text-[12px] lg:text-2xs" style={{ color: "var(--ux-muted)" }}>{TAG[r.kind].label}</span>
              </span>
            </button>
          ))}
          <p className="border-t px-2.5 pb-1.5 pt-2.5 text-[12px] lg:text-2xs leading-snug"
             style={{ borderColor: "var(--ux-line)", color: "var(--ux-muted)" }}>
            New conversations start when a buyer writes about an order, or when you
            join a circle.
          </p>
        </div>
      )}
    </div>
  );
}

export function Ico({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={1.9} />;
}

/**
 * A face, as a fixed circle.
 *
 * `inline-block` with an explicit width and height, `self-start` and
 * `flex: none`: the old block span was a flex item with `align-self: stretch`,
 * so inside a two- or three-line row it grew to the row's height and its
 * gradient fill became a tall pill behind the face. A thin neutral ring now;
 * the kind lives on the row's chip.
 */
export function Avatar({ src, name, kind, size = 42, online }: { src: string; name?: string; kind: PartyKind; size?: number; online?: boolean }) {
  return (
    <span className="relative inline-block shrink-0 self-start rounded-full"
          style={{ width: size, height: size, flex: "none", boxShadow: "0 0 0 2px var(--ux-surface), 0 0 0 3px var(--ux-line-strong)",
                   background: "var(--ux-surface-2)" }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" decoding="async" src={src} alt=""
             className="block h-full w-full rounded-full object-cover" />
      ) : (
        <span aria-hidden className="grid h-full w-full place-items-center rounded-full font-bold uppercase"
              style={{ color: "var(--ux-brand)", fontSize: Math.max(10, size * 0.34) }}>
          {monogram(name || TAG[kind].label)}
        </span>
      )}
      {online && (
        <i className="absolute bottom-0 right-0 block h-[11px] w-[11px] rounded-full"
           style={{ background: "var(--ux-green)", border: "2px solid var(--ux-surface)" }} />
      )}
    </span>
  );
}

/* ── inbox ──────────────────────────────────────────────────────────────── */

export function Inbox({
  waiting, rest, counts, filter, setFilter, search, setSearch, openId, onOpen, total,
  rows, onPick, onThread,
}: {
  waiting: ConvRow[]; rest: ConvRow[]; counts: Partial<Record<PartyKind, number>>;
  filter: PartyKind | "all"; setFilter: (v: PartyKind | "all") => void;
  search: string; setSearch: (v: string) => void;
  openId: string | null; onOpen: (id: string) => void; total: number;
  rows: ConvRow[]; onPick: (id: string) => void;
  /** She is reading a conversation, so on a phone the list is behind it. */
  onThread: boolean;
}) {
  const tr = useT();
  const empty = waiting.length + rest.length === 0;
  const nothing = search ? tr("messages.nothingMatchesThat") : tr("messages.whenABuyerOrAMentor");

  return (
    <>
      {/* ── the phone ───────────────────────────────────────────────────────
          No card. A grouped list running to both edges of the screen, a
          segmented control instead of five wrapped pills, and the compose
          action docked where a thumb reaches rather than floating at the top
          beside a heading. */}
      <section className={`min-h-0 flex-col lg:hidden ${onThread ? "hidden" : "flex"}`}>
        <label className="ux-comp mb-3 flex h-[44px] items-center gap-2.5 rounded-[12px] px-4"
               style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
          <Icons.Search className="h-[17px] w-[17px] shrink-0" style={{ color: "var(--ux-faint)" }} />
          {/*
            `type="search"` gives the phone a keyboard with a magnifier on the
            return key and a clear button in the field; 16px stops iOS zooming
            the whole app in on focus and never zooming back out.
          */}
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder={tr("messages.searchPeopleAndMessages")} aria-label={tr("messages.searchYourMessages")}
                 inputMode="search" enterKeyHint="search" autoComplete="off"
                 className="w-full bg-transparent text-[17px] outline-none" style={{ color: "var(--ux-ink)" }} />
        </label>

        {/*
          Chips, not a segmented control — measured rather than preferred.

          A segmented control divides the track evenly, so five segments across
          390px get 69px each; take away the 24px of padding a 44px-tall segment
          needs and 45px of text is left. "Mentors" is 56px at 14px semibold, so
          the control rendered "All · Buy… · Men… · Circ… · Team". A truncated
          filter is a filter she has to guess at.

          Five-plus filters over one list is what a scrolling chip row is for,
          and it is what WhatsApp itself uses for exactly this (All / Unread /
          Favourites / Groups). The segmented control stays the right answer at
          two to four segments and is used that way elsewhere.
        */}
        <div role="group" aria-label={tr("views.filterConversations")}
             className="ux-chiprow -mx-[20px] flex gap-2 px-[20px]">
          {FILTERS.map((f) => {
            const on = filter === f.value;
            const n = f.value === "all" ? total : counts[f.value] ?? 0;
            return (
              <button key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={on}
                      className="ux-press flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold"
                      style={on
                        ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
                        : { background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                {f.label}
                {n > 0 && (
                  <span className="text-[12px] font-bold tabular-nums"
                        style={{ color: on ? "var(--ux-on-brand-2)" : "var(--ux-faint)" }}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="ux-scroll-y -mx-[20px] mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto px-[20px] pb-[76px]">
          {waiting.length > 0 && (
            <ListGroup title={tr("messages.waitingForYourReply")}>
              {waiting.map((r) => <PhoneRow key={r.id} row={r} onOpen={onOpen} />)}
            </ListGroup>
          )}
          {rest.length > 0 && (
            <ListGroup title={waiting.length > 0 ? tr("messages.everythingElse") : undefined}>
              {rest.map((r) => <PhoneRow key={r.id} row={r} onOpen={onOpen} />)}
            </ListGroup>
          )}
          {empty && (
            <p className="px-1 py-6 text-[15px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>{nothing}</p>
          )}
        </div>

        {/* The screen's one action, full width, above the bar — where a right
            thumb actually goes. `ux-dock-bottom` is `mobile.css`'s own hook for
            stacking on top of the tab bar rather than underneath it. */}
        <div className="ux-dock-bottom fixed inset-x-0 z-[46] px-[20px] pb-2 pt-2"
             style={{ background: "linear-gradient(transparent, var(--ux-canvas) 34%)" }}>
          <NewMessage rows={rows} onPick={onPick} full />
        </div>
      </section>

      {/* ── the desktop inbox column, unchanged ─────────────────────────── */}
      <section className="ux-sq hidden min-h-0 flex-col overflow-hidden rounded-[20px] lg:flex"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                        boxShadow: "var(--ux-shadow-card)" }}>
        <div className="shrink-0 border-b p-3.5" style={{ borderColor: "var(--ux-line)" }}>
          <label className="ux-comp flex h-[40px] items-center gap-2.5 rounded-[12px] px-3"
                 style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
            <Icons.Search className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-faint)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder={tr("messages.searchPeopleAndMessages")} aria-label={tr("messages.searchYourMessages")}
                   className="w-full bg-transparent text-xsm outline-none" style={{ color: "var(--ux-ink)" }} />
          </label>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const on = filter === f.value;
              const n = f.value === "all" ? total : counts[f.value] ?? 0;
              return (
                <button key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={on}
                        className="ux-press flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                        style={on
                          ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
                          : { background: "transparent", border: "1px solid var(--ux-line)", color: "var(--ux-muted)" }}>
                  {f.label}
                  {n > 0 && (
                    <b className="rounded-full px-1.5 text-[12px] lg:text-2xs"
                       style={on ? { background: "var(--ux-on-brand-track)" } : { background: "var(--ux-surface-2)" }}>
                      {n}
                    </b>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {waiting.length > 0 && (
            <>
              <p className="flex items-center gap-2 px-4 pb-1.5 pt-3.5 text-[12px] lg:text-2xs font-bold uppercase tracking-[0.16em]"
                 style={{ color: "var(--ux-amber-ink)" }}>
                <Icons.Clock className="h-[13px] w-[13px]" />{tr("messages.waitingForYourReply")}</p>
              {waiting.map((r) => <Row key={r.id} row={r} on={r.id === openId} onOpen={onOpen} />)}
            </>
          )}
          {rest.length > 0 && (
            <>
              <p className="flex items-center gap-2 px-4 pb-1.5 pt-3.5 text-[12px] lg:text-2xs font-bold uppercase tracking-[0.16em]"
                 style={{ color: "var(--ux-faint)" }}>
                <Icons.List className="h-[13px] w-[13px] " />{tr("messages.everythingElse")}</p>
              {rest.map((r) => <Row key={r.id} row={r} on={r.id === openId} onOpen={onOpen} />)}
            </>
          )}
          {empty && (
            <p className="p-5 text-xsm" style={{ color: "var(--ux-muted)" }}>{nothing}</p>
          )}
        </div>
      </section>
    </>
  );
}

/** "24" from "24 members" — a circle's size, when the subtitle carries it. */
function memberCount(row: ConvRow): string {
  return row.kind === "circle" ? (row.subtitle || "").replace(/\D+/g, "") : "";
}

/**
 * One conversation, phone-shaped.
 *
 * `ListRow` from the mobile kit does the shape — the inset hairline, the 52px
 * floor, the fill-on-press. The subtitle carries the kind as a dot and a word
 * in front of the preview, the same on every tab; a conversation waiting on
 * her replaces the preview with how long it has been waiting, in amber.
 */
function PhoneRow({ row, onOpen }: { row: ConvRow; onOpen: (id: string) => void }) {
  const n = memberCount(row);
  return (
    <ListRow
      avatar={<Avatar src={row.avatar} name={row.name} kind={row.kind} size={40} online={row.online} />}
      title={row.name}
      subtitle={
        <span className="flex min-w-0 items-center gap-1.5">
          <i aria-hidden className="block h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: DOT[row.kind] }} />
          <span className="sr-only">{TAG[row.kind].label}{n ? ` · ${n}` : ""}. </span>
          <span className="min-w-0 truncate">
            {row.waiting_since
              ? <span style={{ color: "var(--ux-amber-ink)", fontWeight: 600 }}>Waiting {waited(row.waiting_since)}</span>
              : (plain(row.preview || "") || "No messages yet")}
          </span>
        </span>
      }
      value={shortWhen(row.last_at)}
      trailing={row.unread > 0
        ? (
          <span className="grid h-[20px] min-w-[20px] shrink-0 place-items-center rounded-full px-1.5 text-[12px] font-bold"
                style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
            {row.unread}
          </span>
        )
        : undefined}
      chevron={false}
      onClick={() => onOpen(row.id)}
    />
  );
}

/**
 * One conversation, desktop-shaped. Always three lines — name and time, the
 * preview, the neutral kind chip — so a row is the same height on every tab.
 */
export function Row({ row, on, onOpen }: { row: ConvRow; on: boolean; onOpen: (id: string) => void }) {
  const n = memberCount(row);
  return (
    <button type="button" onClick={() => onOpen(row.id)} aria-current={on ? "true" : undefined}
            className="ux-row relative flex min-h-[84px] w-full items-start gap-3 border-t px-4 py-3 text-start"
            style={{ borderColor: "var(--ux-line)", background: on ? "var(--ux-surface-2)" : "transparent" }}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]"
            style={{ background: on ? "linear-gradient(var(--ux-rib-2), var(--ux-rib-3))"
                                    : row.waiting_since ? "var(--ux-amber)" : "transparent" }} />
      <Avatar src={row.avatar} name={row.name} kind={row.kind} online={row.online} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <b className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{row.name}</b>
          <time className="shrink-0 text-[12px] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>{shortWhen(row.last_at)}</time>
        </span>
        <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>
          {plain(row.preview || "") || "No messages yet"}
        </span>
        <span className="mt-1.5 flex min-w-0 items-center gap-1.5">
          <KindChip kind={row.kind} extra={n ? `${n}` : undefined} />
          {row.waiting_since && (
            <span className="flex min-w-0 items-center gap-1 truncate text-[12px] font-bold" style={{ color: "var(--ux-amber-ink)" }}>
              <Icons.Clock className="h-[11px] w-[11px] shrink-0" /> {waited(row.waiting_since)}
            </span>
          )}
          {row.unread > 0 && (
            <span className="ms-auto grid h-[19px] min-w-[19px] place-items-center rounded-full px-1.5 text-[12px] font-bold"
                  style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
              {row.unread}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/* ── thread ─────────────────────────────────────────────────────────────── */

export const QUICK = ["Yes, ready by Friday", "Stitching it today", "Can you send your address?", "Shall I send a photo?"];

/** Where the counter starts showing — early enough to trim, late enough not to nag. */
const COUNT_FROM = 3500;

export function EmptyThread({ className }: { className?: string }) {
  const tr = useT();
  return (
    <section className={`ux-sq min-h-0 place-items-center rounded-[20px] p-10 text-center ${className ?? "grid"}`}
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <div>
        <Icons.MessagesSquare className="mx-auto h-[34px] w-[34px]" style={{ color: "var(--ux-faint)" }} />
        <p className="mt-3 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("messages.chooseAConversation")}</p>
        <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("messages.yourBuyersMentorsAndCirclesAre")}</p>
      </div>
    </section>
  );
}

/* ── rich text: **bold** and _italic_, and nothing else ──────────────────── */

/*
  A message is text a stranger typed, so it is never HTML. These two patterns
  become <strong> and <em> elements built by React, and everything else stays a
  string React escapes. No `dangerouslySetInnerHTML`, no markdown library that
  would also honour links, images and raw tags.

  `**x**` must hug its text (`** x **` stays literal). `_x_` must stand at a
  word boundary on both sides, so `snake_case_name` and a UPI handle like
  `priya_k@okaxis` are not italicised by accident.
*/
const RICH = /\*\*(?=\S)([^\n]*?\S)\*\*|(^|[^\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/gu;

function parseRich(text: string, depth = 0): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(RICH)) {
    const at = m.index ?? 0;
    if (m[1] !== undefined) {
      out.push(text.slice(last, at));
      out.push(<strong key={key++} className="font-bold">{depth < 2 ? parseRich(m[1], depth + 1) : m[1]}</strong>);
    } else {
      const lead = m[2] ?? "";
      out.push(text.slice(last, at + lead.length));
      out.push(<em key={key++} className="italic">{depth < 2 ? parseRich(m[3] ?? "", depth + 1) : m[3]}</em>);
    }
    last = at + m[0].length;
  }
  out.push(text.slice(last));
  return out.filter((x) => x !== "");
}

export function Rich({ text }: { text: string }) {
  return <>{parseRich(text)}</>;
}

/** The same text with the markers taken out — for previews and the pin strip. */
export function plain(text: string): string {
  return text.replace(RICH, (_m, b?: string, lead?: string, it?: string) => (b !== undefined ? b : `${lead ?? ""}${it ?? ""}`));
}

/**
 * The server sends naive UTC timestamps (no `Z`). `new Date()` reads those as
 * LOCAL time, which in India is 5h30 off — enough to make a message sent a
 * minute ago look older than the 15-minute edit window.
 */
function parseAt(iso: string | null | undefined): number {
  if (!iso) return NaN;
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`).getTime();
}

function canEdit(b: ConvBubble): boolean {
  if (b.dir !== "out" || b.order || !b.text.trim() || !b.id) return false;
  const at = parseAt(b.at);
  return Number.isFinite(at) && Date.now() - at <= EDIT_WINDOW_MS;
}

/** Clipboard, with the old `execCommand` path for a browser that refuses it. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the fallback */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch { return false; }
}

/** `min-width: 1024px` — the app's `lg`, read in JS for the one place layout needs it. */
function useDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => true,
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * What a dialog owes the keyboard: focus moves in, Tab stays in, Esc and a
 * click outside close it, and focus goes back to what opened it.
 */
function useDialog(open: boolean, panel: React.RefObject<HTMLElement | null>,
                   trigger: React.RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const back = trigger.current;
    const box = panel.current;
    const first = box?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close.current(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || trigger.current?.contains(t)) return;
      close.current();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", down);
      // Only if focus is still somewhere inside, or nowhere: a link inside the
      // panel that navigated away must not be yanked back.
      if (back && (!document.activeElement || document.activeElement === document.body
                   || box?.contains(document.activeElement) || !box?.isConnected)) {
        back.focus({ preventScroll: true });
      }
    };
  }, [open, panel, trigger]);
}

/** An icon-only button that says what it does — on hover as well as to a screen reader. */
function IconBtn({ label, onClick, children, className = "", style, pressed, disabled }: {
  label: string; onClick: () => void; children: ReactNode; className?: string;
  style?: React.CSSProperties; pressed?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={pressed} disabled={disabled}
            className={`grid shrink-0 place-items-center rounded-full disabled:opacity-40 ${className}`}
            style={{ color: "var(--ux-muted)", transform: "none", ...style }}>
      {children}
    </button>
  );
}

export function Thread({
  conv, draft, setDraft, onSend, sending, className, onBack, onStar, onUnread, onDelete, onChanged,
}: {
  conv: ConvDetail; draft: string; setDraft: (v: string) => void; onSend: () => void; sending: boolean;
  className?: string; onBack: () => void;
  onStar: () => void; onUnread: () => void; onDelete: () => void;
  /** The server's copy of the thread after an edit or a pin. */
  onChanged: (d: ConvDetail) => void;
}) {
  const tr = useT();
  const toast = useToast();
  const desktop = useDesktop();
  const pick = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [about, setAbout] = useState(false);
  const aboutBtn = useRef<HTMLButtonElement>(null);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pinAt, setPinAt] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  // A different conversation: nothing half-done carries over.
  const [seen, setSeen] = useState(conv.id);
  if (seen !== conv.id) {
    setSeen(conv.id);
    setAbout(false); setActionsFor(null); setEditing(null); setPinAt(0);
  }

  /**
   * The thread opens at the newest message and stays there — unless she has
   * scrolled up, in which case nothing moves and a button offers the way back.
   */
  const scroll = useChatScroll(`${conv.id}:${conv.messages.length}`);

  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [menu]);

  const ctx = conv.context;
  const typed = draft.trim().length > 0;
  const reportHref = `/app/messages/report/${conv.id}`;

  const byId = new Map(conv.messages.map((m) => [m.id, m]));
  const pins = (conv.pinned ?? []).map((id) => byId.get(id)).filter((m): m is ConvBubble => Boolean(m));
  const pin = pins.length ? pins[Math.min(pinAt, pins.length - 1)] : null;

  function focusComposer() {
    composer.current?.querySelector("textarea")?.focus();
  }

  /** Wrap the selection in a marker; with nothing selected, leave the caret between two. */
  function wrap(mark: string) {
    const el = composer.current?.querySelector("textarea");
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const sel = draft.slice(start, end);
    const next = draft.slice(0, start) + mark + sel + mark + draft.slice(end);
    if (next.length > MESSAGE_MAX) { toast.error(`A message can be up to ${MESSAGE_MAX} characters`); return; }
    setDraft(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const a = start + mark.length;
      el.setSelectionRange(a, a + sel.length);
    });
  }

  async function copy(b: ConvBubble) {
    setActionsFor(null);
    if (await copyText(b.text)) toast.success("Copied");
    else toast.error("That could not be copied");
  }

  async function saveEdit() {
    if (!editing || saving) return;
    const text = editing.text.trim();
    if (!text) return;
    const before = byId.get(editing.id);
    if (before && text === before.text) { setEditing(null); return; }
    setSaving(true);
    try {
      onChanged(await apiEditMessage(conv.id, editing.id, text));
      setEditing(null);
    } catch (e) {
      toast.error(errorText(e, "That edit was not saved"));
    } finally { setSaving(false); }
  }

  async function togglePin(b: ConvBubble) {
    setActionsFor(null);
    const on = !(conv.pinned ?? []).includes(b.id);
    if (on && (conv.pinned ?? []).length >= MAX_PINS) {
      toast.error(`You can pin up to ${MAX_PINS} messages. Unpin one first.`);
      return;
    }
    try {
      onChanged(await apiPinMessage(conv.id, b.id, on));
      if (on) setPinAt((conv.pinned ?? []).length);
    } catch (e) {
      toast.error(errorText(e, on ? "That could not be pinned" : "That could not be unpinned"));
    }
  }

  function jumpTo(id: string) {
    document.getElementById(`msg-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 1400);
  }

  const count = draft.length;

  return (
    <ChatFrame
      label={`Conversation with ${conv.name}`}
      className={`ux-sq min-h-0 flex-col overflow-hidden bg-[var(--ux-surface)]
                  lg:rounded-[20px] lg:border lg:border-[var(--ux-line-strong)] lg:shadow-[var(--ux-shadow-card)]
                  ${className ?? "flex"}`}
    >
      <div className="relative flex shrink-0 items-center gap-1.5 border-b px-1.5 py-1.5 lg:gap-3 lg:p-3.5"
           style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)" }}>
        <IconBtn label={tr("messages.backToYourMessages")} onClick={onBack}
                 className="h-[44px] w-[44px] lg:hidden" style={{ color: "var(--ux-ink)" }}>
          <Icons.ChevronLeft className="h-[24px] w-[24px] rtl:rotate-180" />
        </IconBtn>

        {/* Who this is — and the way into everything known about her. */}
        <div className="min-w-0 flex-1">
          <button ref={aboutBtn} type="button" onClick={() => setAbout((v) => !v)}
                  aria-haspopup="dialog" aria-expanded={about} title={`About ${conv.name}`}
                  className="ux-row flex min-h-[44px] w-full min-w-0 items-center gap-2.5 rounded-[12px] px-1 text-start lg:max-w-max lg:pe-3">
            <Avatar src={conv.avatar} name={conv.name} kind={conv.kind} size={38} online={conv.online} />
            <span className="min-w-0 flex-1">
              <b className="flex items-center gap-1 truncate text-[17px] font-bold leading-tight lg:text-base" style={{ color: "var(--ux-ink)" }}>
                <span className="truncate">{conv.name}</span>
                <Icons.ChevronDown className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-faint)" }} aria-hidden />
              </b>
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] leading-tight lg:text-xs"
                    style={{ color: conv.online ? "var(--ux-green-ink)" : "var(--ux-muted)" }}>
                {conv.online && <i className="block h-[7px] w-[7px] rounded-full" style={{ background: "var(--ux-green)" }} />}
                <span className="truncate">{conv.subtitle || (conv.online ? "Online now" : TAG[conv.kind].label)}</span>
              </span>
            </span>
          </button>
          {about && (
            <AboutPopover conv={conv} desktop={desktop} trigger={aboutBtn} reportHref={reportHref}
                          onClose={() => setAbout(false)} onStar={onStar}
                          onDraft={(v) => { setDraft(v); setAbout(false); requestAnimationFrame(focusComposer); }}
                          onMessage={() => { setAbout(false); requestAnimationFrame(focusComposer); }} />
          )}
        </div>

        <IconBtn label={conv.starred ? tr("messages.removeStar") : tr("messages.starThisConversation")}
                 onClick={onStar} pressed={conv.starred}
                 className="h-[44px] w-[44px] lg:h-[36px] lg:w-[36px] lg:rounded-[12px]"
                 style={{ color: conv.starred ? "var(--ux-amber-ink)" : "var(--ux-faint)" }}>
          <Icons.Star className="h-[19px] w-[19px]" fill={conv.starred ? "currentColor" : "none"} />
        </IconBtn>
        <div ref={menuRef} className="relative">
          <button type="button" onClick={() => setMenu((v) => !v)} title="More"
                  aria-label={tr("views.moreInThisConversation")}
                  aria-haspopup="menu" aria-expanded={menu}
                  className="grid h-[44px] w-[44px] place-items-center rounded-full lg:h-[36px] lg:w-[36px] lg:rounded-[12px]"
                  style={{ color: "var(--ux-faint)", transform: "none" }}>
            <Icons.MoreVertical className="h-[19px] w-[19px]" />
          </button>
          {menu && (
            <div role="menu" className="ux-pop absolute end-0 top-[calc(100%+6px)] z-50 w-[240px] rounded-[14px] p-1.5"
                 style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                          boxShadow: "var(--ux-shadow-pop)" }}>
              {[
                { icon: "Info", label: `About ${conv.name.split(" ")[0]}`, run: () => setAbout(true) },
                { icon: "MailOpen", label: tr("views.markAsUnread"), run: onUnread },
                { icon: conv.starred ? "StarOff" : "Star", label: conv.starred ? tr("messages.removeStar2")
              : tr("messages.starThisConversation2"), run: onStar },
              ].map((a) => (
                <button key={a.label} type="button" role="menuitem"
                        onClick={() => { setMenu(false); a.run(); }}
                        className="ux-row flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-[15px] lg:text-xsm"
                        style={{ color: "var(--ux-ink)" }}>
                  <Ico name={a.icon} className="h-[16px] w-[16px]" /> {a.label}
                </button>
              ))}
              <Link href={reportHref} role="menuitem" onClick={() => setMenu(false)}
                    className="ux-row flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-[15px] lg:text-xsm"
                    style={{ color: "var(--ux-ink)" }}>
                <Icons.Flag className="h-[16px] w-[16px]" style={{ color: "var(--ux-pink-ink)" }} />{tr("messages.reportThisPerson")}</Link>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); onDelete(); }}
                      className="ux-row flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-[15px] lg:text-xsm"
                      style={{ color: "var(--ux-pink-ink)" }}>
                <Icons.Trash2 className="h-[16px] w-[16px]" />{tr("messages.deleteConversation")}</button>
            </div>
          )}
        </div>
      </div>

      {/* What this conversation is actually about. */}
      {ctx && (
        <div className="flex shrink-0 items-center gap-2.5 border-b px-3 py-2 lg:flex-wrap lg:gap-3 lg:p-3.5"
             style={{ borderColor: "var(--ux-line-strong)",
                      background: "linear-gradient(96deg, var(--ux-brand-tint), var(--ux-tint-pink))" }}>
          {ctx.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async" src={ctx.image} alt="" className="h-[34px] w-[34px] shrink-0 rounded-[10px] object-cover lg:h-[46px] lg:w-[46px] lg:rounded-[12px]" />
          )}
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[13px] font-bold lg:text-xsm" style={{ color: "var(--ux-ink)" }}>
              Order #{ctx.ref} · {ctx.title}
            </b>
            <i className="mt-0.5 hidden truncate text-[12px] lg:text-2xs not-italic lg:block" style={{ color: "var(--ux-ink-2)" }}>{ctx.sub}</i>
          </span>
          {ctx.status && (
            <span className="hidden shrink-0 rounded-full px-2.5 py-1 text-[12px] lg:text-2xs font-bold uppercase tracking-[0.08em] lg:inline"
                  style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
              {ctx.status}
            </span>
          )}
          <Link href="/app/documents" aria-label={tr("messages.openOrder")} title={tr("messages.openOrder")}
                className="ux-press flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold lg:rounded-[12px] lg:px-3 lg:text-xs"
                style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
            <span className="hidden lg:inline">{tr("messages.openOrder")}</span>
            <span className="lg:hidden">Order</span>
            <Icons.ChevronRight className="h-[13px] w-[13px] rtl:rotate-180" />
          </Link>
        </div>
      )}

      {/* Pinned — one at a time, like every chat app; tapping walks through them. */}
      {pin && (
        <div className="flex shrink-0 items-center gap-1 border-b ps-3 pe-1 lg:pe-2"
             style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)" }}
             data-pinned-strip>
          <Icons.Pin className="h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-brand)" }} aria-hidden />
          <button type="button" title="Show pinned message"
                  onClick={() => { jumpTo(pin.id); setPinAt((i) => (i + 1) % pins.length); }}
                  className="flex min-h-[44px] min-w-0 flex-1 flex-col justify-center px-1.5 text-start">
            <span className="text-[12px] font-bold" style={{ color: "var(--ux-brand)" }}>
              Pinned{pins.length > 1 ? ` · ${Math.min(pinAt, pins.length - 1) + 1} of ${pins.length}` : ""}
            </span>
            <span className="block truncate text-[13px]" style={{ color: "var(--ux-ink-2)" }}>{plain(pin.text) || "Photo"}</span>
          </button>
          <IconBtn label="Unpin" onClick={() => void togglePin(pin)} className="h-[44px] w-[44px]">
            <PinOff className="h-[16px] w-[16px]" />
          </IconBtn>
        </div>
      )}

      {/*
        The thread, on its own tint: a white page of white bubbles had nothing
        to separate them. Incoming bubbles are now white with a border on top
        of it; hers keep the brand fill.
      */}
      <ChatLog scroll={scroll} label={`Messages with ${conv.name}`}
               className="min-h-0 flex-1 overflow-y-auto bg-[var(--ux-surface-2)] px-3 py-2 lg:p-4">
        <ol className="flex min-h-full flex-col justify-end">
          {conv.messages.map((m, i) => {
            const prev = conv.messages[i - 1];
            const newDay = !prev || dayLabel(prev.at) !== dayLabel(m.at);
            const first = newDay || prev?.dir !== m.dir;
            return (
              <Bubble key={m.id || i} bubble={m} first={first} conv={conv}
                      day={newDay ? dayLabel(m.at) : null}
                      desktop={desktop} flash={flash === m.id}
                      menuOpen={actionsFor === m.id}
                      onMenu={(open) => setActionsFor(open ? m.id : null)}
                      editing={editing?.id === m.id ? editing.text : null}
                      saving={saving}
                      onEditStart={() => { setActionsFor(null); setEditing({ id: m.id, text: m.text }); }}
                      onEditChange={(text) => setEditing({ id: m.id, text })}
                      onEditSave={() => void saveEdit()}
                      onEditCancel={() => setEditing(null)}
                      onCopy={() => void copy(m)}
                      onPin={() => void togglePin(m)} />
            );
          })}
        </ol>
      </ChatLog>

      <input ref={pick} type="file" className="hidden" accept="image/*,.pdf"
             onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

      <ChatDock className="lg:border-t lg:border-[var(--ux-line-strong)] lg:px-4 lg:pb-4">
        <JumpToLatest scroll={scroll} label="Latest" />

        {!typed && (
          <div className="ux-chat-tip ux-chiprow flex gap-2 px-1 pb-2 pt-2 lg:flex-wrap lg:px-0 lg:pt-3">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setDraft(q)}
                      className="ux-press ux-tap-exempt shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold"
                      style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)",
                               color: "var(--ux-ink-2)" }}>
                {q}
              </button>
            ))}
          </div>
        )}

        {file && (
          <div className="flex flex-wrap items-center gap-2 px-1 pb-2 lg:px-0">
            <span className="flex min-w-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-[12px]"
                  style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)" }}>
              <Icons.Paperclip className="h-[13px] w-[13px] shrink-0" style={{ color: "var(--ux-faint)" }} />
              <span className="truncate font-semibold" style={{ color: "var(--ux-ink)" }}>{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label={tr("messages.removeAttachment")}
                      title={tr("messages.removeAttachment")}
                      className="ux-press ux-tap-exempt grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
                      style={{ color: "var(--ux-faint)" }}>
                <Icons.X className="h-[12px] w-[12px]" />
              </button>
            </span>
            <span className="text-[12px]" style={{ color: "var(--ux-amber-ink)" }}>{tr("messages.sendingFilesIsComingTheName")}</span>
          </div>
        )}

        {/* Bold and italic, and the count once it matters. On a phone the row
            only appears once she is writing — before that the suggestions
            have the space. */}
        <div className={`${typed ? "flex" : "hidden lg:flex"} items-center gap-1 px-1 pt-1 lg:px-0 lg:pt-2`}>
          <IconBtn label="Bold — wraps the selection in **" onClick={() => wrap("**")}
                   className="h-[44px] w-[44px] lg:h-[32px] lg:w-[32px] lg:rounded-[10px]">
            <Bold className="h-[16px] w-[16px]" />
          </IconBtn>
          <IconBtn label="Italic — wraps the selection in _" onClick={() => wrap("_")}
                   className="h-[44px] w-[44px] lg:h-[32px] lg:w-[32px] lg:rounded-[10px]">
            <Italic className="h-[16px] w-[16px]" />
          </IconBtn>
          {count >= COUNT_FROM && (
            <span className="ms-auto pe-1 text-[12px] font-semibold tabular-nums" aria-live="polite" data-char-count
                  style={{ color: count >= MESSAGE_MAX ? "var(--ux-pink-ink)" : count >= MESSAGE_MAX - 100 ? "var(--ux-amber-ink)" : "var(--ux-muted)" }}>
              {count.toLocaleString("en-IN")} / {MESSAGE_MAX.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {/* One row: attach, the field, send. The camera button is gone — the
            paperclip already opens the phone's own picker, which offers the
            camera, and sending files is not live yet anyway. */}
        <div className="flex items-end gap-1.5 pb-2 lg:gap-2 lg:pb-0 lg:pt-1">
          <IconBtn label={tr("messages.attachAFile")} onClick={() => pick.current?.click()}
                   className="h-[44px] w-[44px] lg:h-[38px] lg:w-[38px]">
            <Icons.Paperclip className="h-[20px] w-[20px]" />
          </IconBtn>
          <Link href="/app/documents" aria-label={tr("messages.sendAnOrder")} title={tr("messages.sendAnOrder")}
                className="hidden shrink-0 place-items-center rounded-full lg:grid lg:h-[38px] lg:w-[38px]"
                style={{ color: "var(--ux-muted)", transform: "none" }}>
            <Icons.Package className="h-[20px] w-[20px]" />
          </Link>
          <div ref={composer} className="ux-comp min-w-0 flex-1 rounded-[24px] px-3.5 py-2.5"
               style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)" }}>
            <ChatInput
              value={draft} onChange={(v) => setDraft(v.slice(0, MESSAGE_MAX))} onSend={onSend}
              placeholder={`Write to ${conv.name.split(" ")[0]}…`}
              label={tr("messages.writeAMessage")}
              maxLength={MESSAGE_MAX}
            />
          </div>
          <span title="Send" className="inline-flex shrink-0">
            <SendButton onClick={onSend} disabled={!draft.trim() || sending} busy={sending} label="Send" />
          </span>
        </div>

        <p className="ux-chat-tip flex shrink-0 items-center gap-2 pb-2 text-[12px] leading-snug lg:pt-3"
           style={{ color: "var(--ux-muted)" }}>
          <Icons.ShieldCheck className="h-[13px] w-[13px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />{tr("messages.keepPaymentsInsideWomsakhiNobodyHe")}</p>
      </ChatDock>
    </ChatFrame>
  );
}

/** The server's own sentence when it sent one ("Messages can be edited for 15 minutes…"). */
function errorText(e: unknown, fallback: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" && detail.trim() ? detail : fallback;
}

/**
 * One message.
 *
 * Sender and receiver are told apart by four things at once, and only the last
 * of them is colour: which side of the screen the bubble hugs, which corner
 * carries the tail, whether there is a face beside it, and the fill.
 *
 * Actions — copy, edit, pin — sit beside the bubble on hover (or keyboard
 * focus) on a desktop, and open as a menu under it on a tap or long-press on a
 * phone.
 */
export function Bubble({
  bubble, first, conv, day, desktop, flash, menuOpen, onMenu, editing, saving,
  onEditStart, onEditChange, onEditSave, onEditCancel, onCopy, onPin,
}: {
  bubble: ConvBubble; first: boolean; conv: ConvDetail; day?: string | null;
  desktop: boolean; flash: boolean; menuOpen: boolean; onMenu: (open: boolean) => void;
  editing: string | null; saving: boolean;
  onEditStart: () => void; onEditChange: (t: string) => void; onEditSave: () => void; onEditCancel: () => void;
  onCopy: () => void; onPin: () => void;
}) {
  const out = bubble.dir === "out";
  const menuRef = useRef<HTMLDivElement>(null);
  const hasText = Boolean(bubble.text.trim());
  const editable = canEdit(bubble);
  const pinned = (conv.pinned ?? []).includes(bubble.id);

  useEffect(() => {
    if (!menuOpen) return;
    const off = (e: PointerEvent) => { if (!menuRef.current?.contains(e.target as Node)) onMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onMenu(false); };
    // Next tick: the tap that opened the menu must not be the one that closes it.
    const t = window.setTimeout(() => document.addEventListener("pointerdown", off), 0);
    document.addEventListener("keydown", esc);
    return () => { window.clearTimeout(t); document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [menuOpen, onMenu]);

  const actions = [
    hasText && { key: "copy", label: "Copy", icon: <Icons.Copy className="h-[15px] w-[15px]" />, run: onCopy },
    editable && { key: "edit", label: "Edit", icon: <Icons.Pencil className="h-[15px] w-[15px]" />, run: onEditStart },
    bubble.id && { key: "pin", label: pinned ? "Unpin" : "Pin", icon: pinned ? <PinOff className="h-[15px] w-[15px]" /> : <Icons.Pin className="h-[15px] w-[15px]" />, run: onPin },
  ].filter(Boolean) as { key: string; label: string; icon: ReactNode; run: () => void }[];

  const isEditing = editing !== null;

  return (
    <>
      {day && (
        <li className="my-3 flex justify-center">
          <span className="rounded-full px-3 py-1 text-[12px] font-semibold"
                style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", color: "var(--ux-muted)" }}>
            {day}
          </span>
        </li>
      )}
      <li id={bubble.id ? `msg-${bubble.id}` : undefined} data-msg={bubble.id || undefined}
          className={`group relative flex items-end gap-2 ${first ? "mt-2" : "mt-[3px]"} ${out ? "flex-row-reverse" : ""}`}>
        <span className="w-[26px] shrink-0" style={{ visibility: first && !out ? "visible" : "hidden" }}>
          <Avatar src={conv.avatar} name={conv.name} kind={conv.kind} size={22} />
        </span>
        {bubble.order ? (
          <OrderCard order={bubble.order} />
        ) : (
        <div className={`max-w-[78%] px-3.5 py-2.5 text-[15px] leading-[1.45] transition-shadow lg:max-w-[70%] lg:text-sm ${isEditing ? "w-full" : ""}`}
             data-bubble
             onClick={() => { if (!desktop && !isEditing && actions.length) onMenu(!menuOpen); }}
             onContextMenu={(e) => { if (!desktop && actions.length) { e.preventDefault(); onMenu(true); } }}
             style={{
               ...(out
                 ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)",
                     borderRadius: bubbleRadius("out", first), boxShadow: "var(--ux-shadow-glow-2)" }
                 : { background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink)",
                     borderRadius: bubbleRadius("in", first), boxShadow: "0 1px 1px rgb(0 0 0 / 0.03)" }),
               ...(flash ? { outline: "2px solid var(--ux-brand)", outlineOffset: 2 } : null),
               ...(isEditing ? { background: "var(--ux-surface)", color: "var(--ux-ink)", border: "1px solid var(--ux-brand)", boxShadow: "none" } : null),
             }}>
          <Says who={out ? "You" : conv.name} />
          {bubble.file?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async" src={bubble.file.url} alt={bubble.file.name}
                 className="mb-2 block max-w-[210px] rounded-[12px]" style={{ border: "1px solid var(--ux-line)" }} />
          )}
          {isEditing ? (
            <div onClick={(e) => e.stopPropagation()}>
              <textarea value={editing} autoFocus rows={Math.min(6, Math.max(2, editing.split("\n").length))}
                        maxLength={MESSAGE_MAX} aria-label="Edit your message"
                        onChange={(e) => onEditChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onEditCancel(); }
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEditSave(); }
                        }}
                        className="block w-full resize-none bg-transparent text-[16px] leading-[1.45] outline-none lg:text-sm"
                        style={{ color: "var(--ux-ink)" }} />
              <div className="mt-2 flex items-center justify-end gap-2">
                {editing.length >= COUNT_FROM && (
                  <span className="me-auto text-[12px] tabular-nums" style={{ color: "var(--ux-muted)" }}>{editing.length} / {MESSAGE_MAX}</span>
                )}
                <button type="button" onClick={onEditCancel} title="Cancel editing"
                        className="min-h-[44px] rounded-full px-3.5 text-[13px] font-bold lg:min-h-[34px]"
                        style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                  Cancel
                </button>
                <button type="button" onClick={onEditSave} disabled={saving || !editing.trim()} title="Save the edit"
                        className="flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold disabled:opacity-50 lg:min-h-[34px]"
                        style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
                  {saving && <Icons.Loader2 className="h-[13px] w-[13px] animate-spin" />} Save
                </button>
              </div>
            </div>
          ) : (
            <span className="whitespace-pre-wrap [overflow-wrap:anywhere]"><Rich text={bubble.text} /></span>
          )}
          {!isEditing && (
            <span className={`mt-1 flex items-center gap-1.5 ${out ? "justify-end" : ""}`}>
              {pinned && <Icons.Pin className="h-[11px] w-[11px]" aria-label="Pinned" style={{ opacity: 0.8 }} />}
              {bubble.edited_at && <Stamp tone={out ? "on-brand" : "muted"}>(edited)</Stamp>}
              <Stamp tone={out ? "on-brand" : "muted"}>{clock(bubble.at)}</Stamp>
              {out && <Icons.CheckCheck className="h-[13px] w-[13px]"
                                        style={{ color: bubble.read ? "var(--ux-read-tick)" : "var(--ux-on-brand-2)" }} />}
            </span>
          )}
        </div>
        )}

        {/* Desktop: a quiet toolbar that appears on hover or keyboard focus. */}
        {desktop && !isEditing && actions.length > 0 && !bubble.order && (
          <div className="flex items-center gap-0.5 self-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
               data-msg-actions>
            {actions.map((a) => (
              <IconBtn key={a.key} label={a.label === "Copy" ? "Copy message" : a.label === "Edit" ? "Edit message" : `${a.label} message`}
                       onClick={a.run} className="h-[32px] w-[32px] rounded-[10px] hover:bg-[var(--ux-surface)]">
                {a.icon}
              </IconBtn>
            ))}
          </div>
        )}

        {/* Phone: the same actions, as a menu under the bubble. */}
        {!desktop && menuOpen && (
          <div ref={menuRef} role="menu" aria-label="Message actions"
               className={`ux-pop absolute top-[calc(100%+4px)] z-30 w-[200px] rounded-[14px] p-1.5 ${out ? "end-0" : "start-[34px]"}`}
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", boxShadow: "var(--ux-shadow-pop)" }}>
            {actions.map((a) => (
              <button key={a.key} type="button" role="menuitem" onClick={a.run} title={a.label}
                      className="ux-row flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-2.5 text-start text-[15px]"
                      style={{ color: "var(--ux-ink)" }}>
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        )}
      </li>
    </>
  );
}

/**
 * An order, inside the conversation it was agreed in.
 */
export function OrderCard({ order }: { order: NonNullable<ConvBubble["order"]> }) {
  return (
    <div className="max-w-[320px] overflow-hidden rounded-[16px]"
         style={{ border: "1px solid var(--ux-line-strong)", background: "var(--ux-surface)",
                  boxShadow: "var(--ux-shadow-card)" }}>
      <p className="flex items-center gap-2 px-3.5 py-2.5 text-[12px] lg:text-2xs font-bold uppercase tracking-[0.11em]"
         style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
        <Icons.Package className="h-[13px] w-[13px]" /> {order.state}
      </p>
      <div className="flex gap-3 p-3.5">
        {order.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" decoding="async" src={order.image} alt="" className="h-[56px] w-[56px] shrink-0 rounded-[12px] object-cover" />
        )}
        <div className="min-w-0">
          <b className="block text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>{order.title}</b>
          <i className="mt-0.5 block text-xs not-italic" style={{ color: "var(--ux-muted)" }}>{order.sub}</i>
          <b className="mt-1.5 block text-lg font-bold tracking-[-0.02em]" style={{ color: "var(--ux-ink)" }}>
            {formatMoney(order.amount_minor)}
          </b>
        </div>
      </div>
      <div className="flex gap-2 px-3.5 pb-3.5">
        <button type="button"
                className="ux-press flex flex-1 items-center justify-center gap-1.5 rounded-[12px] py-2.5 text-xs font-bold"
                style={order.paid
                  ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
                  : { background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
          <Icons.Wallet className="h-[13px] w-[13px]" /> {order.paid ? "Paid" : "Not paid"}
        </button>
        <button type="button"
                className="ux-press flex-1 rounded-[12px] py-2.5 text-xs font-bold"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
          Change
        </button>
      </div>
    </div>
  );
}

/* ── who am I talking to ────────────────────────────────────────────────── */

/**
 * "About", as a popover off the thread header.
 *
 * It used to be a permanent third column, and it was the buyer panel for every
 * kind of thread — a mentor showed "0 orders · ₹0 spent · Send her an order".
 * Now it opens where her name is, says what fits the kind of person, and gets
 * out of the way. On a phone it is a bottom sheet over a scrim, portalled to
 * the `.ux` root (not `document.body` — the colour tokens live on `.ux`) so it
 * clears the tab bar.
 */
function AboutPopover({ conv, desktop, trigger, reportHref, onClose, onStar, onDraft, onMessage }: {
  conv: ConvDetail; desktop: boolean; trigger: React.RefObject<HTMLButtonElement | null>; reportHref: string;
  onClose: () => void; onStar: () => void; onDraft: (v: string) => void; onMessage: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(true, panel, trigger, onClose);

  const card = (
    <div ref={panel} role="dialog" aria-modal={desktop ? undefined : true} aria-labelledby={titleId}
         data-about-popover
         className={desktop
           ? "ux-pop absolute start-0 top-[calc(100%+8px)] z-50 max-h-[min(560px,70vh)] w-[340px] overflow-y-auto"
           : "ux-pop fixed inset-x-0 bottom-0 z-[90] max-h-[82dvh] overflow-y-auto"}
         style={{
           background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
           boxShadow: "var(--ux-shadow-pop)", borderRadius: desktop ? 16 : "16px 16px 0 0",
           padding: 16, paddingBottom: desktop ? 16 : "calc(16px + env(safe-area-inset-bottom, 0px))",
         }}>
      <About conv={conv} titleId={titleId} reportHref={reportHref} onClose={onClose}
             onStar={onStar} onDraft={onDraft} onMessage={onMessage} />
    </div>
  );

  if (desktop) return card;
  const root = trigger.current?.closest(".ux") ?? null;
  if (!root) return card;
  return createPortal(
    <>
      <div aria-hidden className="fixed inset-0 z-[89]" style={{ background: "rgb(0 0 0 / 0.42)" }} />
      {card}
    </>,
    root,
  );
}

/** The inside of the popover. Kind-aware: a buyer, a seller, a mentor, a circle and the team are different people. */
export function About({ conv, titleId, reportHref, onClose, onStar, onDraft, onMessage }: {
  conv: ConvDetail; titleId: string; reportHref: string; onClose: () => void;
  onStar: () => void; onDraft: (v: string) => void; onMessage: () => void;
}) {
  const tr = useT();
  const p = conv.party;
  const first = conv.name.split(" ")[0];
  const shots = conv.messages.filter((m) => m.file?.url).slice(-3);
  const members = conv.kind === "circle" ? (conv.subtitle || "").replace(/\D+/g, "") : "";
  const circleHref = conv.context?.kind === "circle" && conv.context.ref ? `/app/circles/${conv.context.ref}` : "/app/circles";
  const role = p.role || (conv.kind === "mentor" ? "Mentor" : conv.kind === "team" ? "WomSakhi team" : TAG[conv.kind].label);

  const action = "ux-row flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-2.5 text-start text-xsm font-semibold";
  const stat = (value: ReactNode, label: string) => (
    <div className="rounded-[12px] p-2.5 text-center" style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
      <b className="block text-base font-bold tracking-[-0.02em]" style={{ color: "var(--ux-ink)" }}>{value}</b>
      <i className="mt-0.5 block text-[12px] not-italic" style={{ color: "var(--ux-muted)" }}>{label}</i>
    </div>
  );

  return (
    <>
      <div className="flex items-start gap-3">
        <Avatar src={conv.avatar} name={conv.name} kind={conv.kind} size={52} online={conv.online} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 id={titleId} className="truncate text-base font-bold" style={{ color: "var(--ux-ink)" }}>{conv.name}</h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>
            {[role, p.since].filter(Boolean).join(" · ")}
          </p>
          <span className="mt-1.5 inline-flex"><KindChip kind={conv.kind} /></span>
        </div>
        <Link href={reportHref} title={`Report ${first}`} aria-label={`Report ${first}`}
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full lg:h-[36px] lg:w-[36px] lg:rounded-[12px]"
              style={{ color: "var(--ux-pink-ink)" }}>
          <Icons.Flag className="h-[17px] w-[17px]" />
        </Link>
        <IconBtn label="Close" onClick={onClose} className="h-[44px] w-[44px] lg:h-[36px] lg:w-[36px] lg:rounded-[12px]">
          <Icons.X className="h-[18px] w-[18px]" />
        </IconBtn>
      </div>

      {(conv.kind === "buyer" || conv.kind === "seller") && (
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {stat(p.orders ?? 0, (p.orders ?? 0) === 1 ? "order" : "orders")}
          {stat(formatMoney(p.spent_minor ?? 0), conv.kind === "buyer" ? tr("views.spentWithYou") : "you spent")}
        </div>
      )}
      {conv.kind === "circle" && members && (
        <div className="mt-3.5 grid grid-cols-1 gap-2">{stat(members, Number(members) === 1 ? "member" : "members")}</div>
      )}

      <div className="mt-3.5 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
        {conv.kind === "buyer" && (
          <>
            <Link href="/app/documents" className={action} style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Package className="h-[15px] w-[15px]" />{tr("messages.sendHerAnOrder")}</Link>
            <button type="button" className={action} style={{ color: "var(--ux-ink-2)" }}
                    onClick={() => onDraft(`Namaste ${first}, here is what I make and what it costs:\n\n· Cotton kurta — ₹280\n· Silk dupatta — ₹640\n· Blouse stitching — ₹180\n\nTell me what you would like and by when.`)}>
              <Icons.Tag className="h-[15px] w-[15px]" />{tr("messages.shareYourPriceList")}</button>
            <button type="button" onClick={onStar} aria-pressed={conv.starred} className={action}
                    style={{ color: conv.starred ? "var(--ux-amber-ink)" : "var(--ux-ink-2)" }}>
              <Icons.Star className="h-[15px] w-[15px]" fill={conv.starred ? "currentColor" : "none"} />
              {conv.starred ? tr("messages.aGoodBuyer") : tr("messages.markAsAGoodBuyer")}
            </button>
          </>
        )}
        {conv.kind === "seller" && (
          <>
            <Link href="/app/documents" className={action} style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Package className="h-[15px] w-[15px]" />Your orders</Link>
            <button type="button" onClick={onStar} aria-pressed={conv.starred} className={action}
                    style={{ color: conv.starred ? "var(--ux-amber-ink)" : "var(--ux-ink-2)" }}>
              <Icons.Star className="h-[15px] w-[15px]" fill={conv.starred ? "currentColor" : "none"} />
              {conv.starred ? "Starred" : "Star this conversation"}
            </button>
          </>
        )}
        {(conv.kind === "mentor" || conv.kind === "team") && (
          /* A mentor thread does not know which mentor profile it belongs to,
             so there is nothing honest to "Book" against — "Message" is. */
          <button type="button" onClick={onMessage} className={action} style={{ color: "var(--ux-ink-2)" }}>
            <Icons.MessageCircle className="h-[15px] w-[15px]" />Message {first}</button>
        )}
        {conv.kind === "circle" && (
          <Link href={circleHref} className={action} style={{ color: "var(--ux-ink-2)" }}>
            <Icons.Users className="h-[15px] w-[15px]" />Open circle</Link>
        )}
        <Link href={reportHref} className={action} style={{ color: "var(--ux-pink-ink)" }}>
          <Icons.Flag className="h-[15px] w-[15px]" />{conv.kind === "circle" ? "Report this circle" : tr("messages.reportThisPerson2")}</Link>
      </div>

      {shots.length > 0 && (
        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
          <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ux-faint)" }}>{tr("messages.sharedHere")}</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {shots.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" decoding="async" key={i} src={m.file!.url} alt="" className="aspect-square w-full rounded-[8px] object-cover" />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
