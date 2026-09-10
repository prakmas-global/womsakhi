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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { formatMoney } from "@/components/ux/kit/money";
import Link from "next/link";
import {
  apiConversation,
  apiConversations,
  apiDeleteConversation,
  apiMarkUnread,
  apiStarConversation,
  apiInboxSummary,
  apiSendToConversation,
  type ConvBubble,
  type ConvDetail,
  type ConvRow,
  type InboxSummary,
  type PartyKind,
} from "@/lib/me-messages-api";
import { useT } from "@/i18n";
import {
  bubbleRadius,
  ChatDock,
  ChatFrame,
  ChatInput,
  ChatLog,
  JumpToLatest,
  Says,
  SendButton,
  Stamp,
  useChatScroll,
} from "@/components/ux/sakhi/chat";
import { ListGroup, ListRow } from "@/components/ux/mobile/ListRow";
import { SegmentedControl } from "@/components/ux/mobile/SegmentedControl";

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
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"}`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** "12:40" for today, "Mon" this week, "30 Aug" beyond. */
function shortWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
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
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function dayLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const mid = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((mid(new Date()) - mid(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short" }).format(d);
}

export const RING: Record<PartyKind, string> = {
  buyer: "linear-gradient(140deg, var(--ux-green), var(--ux-green-ink))",
  mentor: "linear-gradient(140deg, var(--ux-violet), var(--ux-brand-700))",
  circle: "linear-gradient(140deg, var(--ux-pink), var(--ux-pink-ink))",
  team: "linear-gradient(140deg, var(--ux-blue), var(--ux-blue-ink))",
};
export const TAG: Record<PartyKind, { tint: string; ink: string; label: string }> = {
  buyer: { tint: "--ux-tint-green", ink: "--ux-green-ink", label: "Buyer" },
  mentor: { tint: "--ux-tint-violet", ink: "--ux-violet-ink", label: "Mentor" },
  circle: { tint: "--ux-tint-pink", ink: "--ux-pink-ink", label: "Circle" },
  team: { tint: "--ux-tint-blue", ink: "--ux-blue-ink", label: "Team" },
};
export const FILTERS: { value: PartyKind | "all"; label: string }[] = [
  { value: "all", label: "All" }, { value: "buyer", label: "Buyers" },
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
      value: String(summary?.waiting ?? 0), note: "waiting on you" },
    { icon: "Wallet", tint: "--ux-tint-green", ink: "--ux-green-ink",
      value: formatMoney(summary?.open_order_minor ?? 0), note: "in open orders" },
    { icon: "Zap", tint: "--ux-tint-violet", ink: "--ux-violet-ink",
      // Measured from her own replies, not a promise. Absent until there is
      // at least one answered message to measure.
      value: summary?.reply_minutes == null ? "—"
        : summary.reply_minutes < 60 ? `${summary.reply_minutes}m` : `${Math.round(summary.reply_minutes / 60)}h`,
      note: "your reply time" },
  ];
  return (
    <header className={`flex-wrap items-end gap-4 ${className ?? "flex"}`}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold tracking-[-0.03em]" style={{ color: "var(--ux-ink)" }}>Messages</h1>
        <p className="mt-0.5 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("messages.buyersMentorsAndYourCirclesAll")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
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
              <i className="mt-1 block text-2xs not-italic" style={{ color: "var(--ux-muted)" }}>{s.note}</i>
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
export function NewMessage({ rows, onPick }: { rows: ConvRow[]; onPick: (id: string) => void }) {
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
    <div ref={wrap} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu" aria-expanded={open}
              className="ux-press ux-btn-g flex min-h-[46px] items-center gap-2 rounded-[12px] px-4 text-xsm font-bold"
              style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                       color: "var(--ux-on-brand)", boxShadow: "var(--ux-shadow-glow-2)" }}>
        <Icons.Plus className="h-4 w-4" />{tr("messages.newMessage")}</button>
      {open && (
        <div role="menu"
             className="ux-pop absolute end-0 top-[calc(100%+8px)] z-50 max-h-[340px] w-[290px] overflow-y-auto rounded-[12px] p-1.5"
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                      boxShadow: "var(--ux-shadow-pop)" }}>
          <p className="px-2.5 pb-1 pt-2 text-2xs font-bold uppercase tracking-[0.16em]"
             style={{ color: "var(--ux-faint)" }}>{tr("messages.writeTo")}</p>
          {rows.map((r) => (
            <button key={r.id} type="button" role="menuitem"
                    onClick={() => { setOpen(false); onPick(r.id); }}
                    className="ux-row flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-start">
              <Avatar src={r.avatar} kind={r.kind} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{r.name}</span>
                <span className="block truncate text-2xs" style={{ color: "var(--ux-muted)" }}>{TAG[r.kind].label}</span>
              </span>
            </button>
          ))}
          <p className="border-t px-2.5 pb-1.5 pt-2.5 text-2xs leading-snug"
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

export function Avatar({ src, kind, size = 42, online }: { src: string; kind: PartyKind; size?: number; online?: boolean }) {
  return (
    <span className="relative block shrink-0 rounded-full p-[2px]" style={{ background: RING[kind] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async" src={src || "/ux/brand/womsakhi-emblem.webp"} alt=""
           className="block rounded-full object-cover" style={{ width: size, height: size }} />
      {online && (
        <i className="absolute bottom-[2px] right-[1px] block h-[11px] w-[11px] rounded-full"
           style={{ background: "var(--ux-green)", border: "2px solid var(--ux-surface)" }} />
      )}
    </span>
  );
}

/* ── inbox ──────────────────────────────────────────────────────────────── */

export function Inbox({
  waiting, rest, counts, filter, setFilter, search, setSearch, openId, onOpen, total, className,
}: {
  waiting: ConvRow[]; rest: ConvRow[]; counts: Partial<Record<PartyKind, number>>;
  filter: PartyKind | "all"; setFilter: (v: PartyKind | "all") => void;
  search: string; setSearch: (v: string) => void;
  openId: string | null; onOpen: (id: string) => void; total: number; className?: string;
}) {
  const tr = useT();
  return (
    <section className={`ux-sq min-h-0 flex-col overflow-hidden rounded-[20px] ${className ?? "flex"}`}
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
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
                  <b className="rounded-full px-1.5 text-2xs"
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
            <p className="flex items-center gap-2 px-4 pb-1.5 pt-3.5 text-2xs font-bold uppercase tracking-[0.16em]"
               style={{ color: "var(--ux-amber-ink)" }}>
              <Icons.Clock className="h-[13px] w-[13px]" />{tr("messages.waitingForYourReply")}</p>
            {waiting.map((r) => <Row key={r.id} row={r} on={r.id === openId} onOpen={onOpen} />)}
          </>
        )}
        {rest.length > 0 && (
          <>
            <p className="flex items-center gap-2 px-4 pb-1.5 pt-3.5 text-2xs font-bold uppercase tracking-[0.16em]"
               style={{ color: "var(--ux-faint)" }}>
              <Icons.List className="h-[13px] w-[13px] " />{tr("messages.everythingElse")}</p>
            {rest.map((r) => <Row key={r.id} row={r} on={r.id === openId} onOpen={onOpen} />)}
          </>
        )}
        {waiting.length + rest.length === 0 && (
          <p className="p-5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            {search ? tr("messages.nothingMatchesThat")
              : tr("messages.whenABuyerOrAMentor")}
          </p>
        )}
      </div>
    </section>
  );
}

export function Row({ row, on, onOpen }: { row: ConvRow; on: boolean; onOpen: (id: string) => void }) {
  const tag = TAG[row.kind];
  return (
    <button type="button" onClick={() => onOpen(row.id)} aria-current={on ? "true" : undefined}
            className="ux-row relative flex w-full gap-3 border-t px-4 py-3 text-start"
            style={{ borderColor: "var(--ux-line)", background: on ? "var(--ux-surface-2)" : "transparent" }}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]"
            style={{ background: on ? "linear-gradient(var(--ux-rib-2), var(--ux-rib-3))"
                                    : row.waiting_since ? "var(--ux-amber)" : "transparent" }} />
      <Avatar src={row.avatar} kind={row.kind} online={row.online} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <b className="min-w-0 flex-1 truncate text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{row.name}</b>
          <time className="shrink-0 text-2xs" style={{ color: "var(--ux-faint)" }}>{shortWhen(row.last_at)}</time>
        </span>
        <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>
          {row.preview || "No messages yet"}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5">
          <span className="rounded-full px-2 py-[3px] text-2xs font-bold uppercase tracking-[0.08em]"
                style={{ background: `var(${tag.tint})`, color: `var(${tag.ink})` }}>
            {row.kind === "circle" && row.subtitle ? `Circle · ${row.subtitle.replace(/\D+/g, "")}` : tag.label}
          </span>
          {row.waiting_since && (
            <span className="flex items-center gap-1 text-2xs font-bold" style={{ color: "var(--ux-amber-ink)" }}>
              <Icons.Clock className="h-[11px] w-[11px]" /> waiting {waited(row.waiting_since)}
            </span>
          )}
          {row.unread > 0 && (
            <span className="ms-auto grid h-[19px] min-w-[19px] place-items-center rounded-full px-1.5 text-2xs font-bold"
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

export function EmptyThread({ className }: { className?: string }) {
  const tr = useT();
  return (
    <section className={`ux-sq min-h-0 place-items-center rounded-[20px] p-10 text-center ${className ?? "grid"}`}
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <div>
        <Icons.MessagesSquare className="mx-auto h-[34px] w-[34px]" style={{ color: "var(--ux-faint)" }} />
        <p className="mt-3 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("messages.chooseAConversation")}</p>
        <p className="mt-1 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("messages.yourBuyersMentorsAndCirclesAre")}</p>
      </div>
    </section>
  );
}

export function Thread({
  conv, draft, setDraft, onSend, sending, className, onBack, onStar, onUnread, onDelete,
}: {
  conv: ConvDetail; draft: string; setDraft: (v: string) => void; onSend: () => void; sending: boolean;
  className?: string; onBack: () => void;
  onStar: () => void; onUnread: () => void; onDelete: () => void;
}) {
  const tr = useT();
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const shoot = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(false); };
    document.addEventListener("mousedown", off);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [menu]);

  // A conversation opens where it left off — at the newest message. Opening at
  // the top is the commonest way a thread screen gets this wrong.
  //
  // Scrolled once, a photo further up finishes decoding, the content grows, and
  // the newest message slides back under the fold — so it also re-scrolls as
  // each image lands.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const pin = () => { el.scrollTop = el.scrollHeight; };
    pin();
    const imgs = Array.from(el.querySelectorAll("img"));
    imgs.forEach((i) => i.addEventListener("load", pin));
    return () => imgs.forEach((i) => i.removeEventListener("load", pin));
  }, [conv.id, conv.messages.length]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  const ctx = conv.context;

  return (
    <section className={`ux-sq min-h-0 flex-col overflow-hidden rounded-[20px] ${className ?? "flex"}`}
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                      boxShadow: "var(--ux-shadow-card)" }}>
      <div className="flex shrink-0 items-center gap-3 border-b p-3.5" style={{ borderColor: "var(--ux-line)" }}>
        <button type="button" onClick={onBack} aria-label={tr("messages.backToYourMessages")}
                className="ux-row -ms-1 grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[12px] lg:hidden"
                style={{ color: "var(--ux-ink-2)" }}>
          <Icons.ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <Avatar src={conv.avatar} kind={conv.kind} size={40} online={conv.online} />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-base font-bold" style={{ color: "var(--ux-ink)" }}>{conv.name}</b>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs"
                style={{ color: conv.online ? "var(--ux-green-ink)" : "var(--ux-muted)" }}>
            {conv.online && <i className="block h-[7px] w-[7px] rounded-full" style={{ background: "var(--ux-green)" }} />}
            {conv.subtitle || (conv.online ? "Online now" : "")}
          </span>
        </div>
        {/* The telephone icon was here and had nothing to dial — a buyer is not
            a WomSakhi account and no number is stored. It is gone rather than
            decorative. */}
        <button type="button" onClick={onStar}
                title={conv.starred ? tr("messages.removeStar")
              : tr("messages.starThisConversation")}
                aria-pressed={conv.starred}
                className="ux-row grid h-[36px] w-[36px] place-items-center rounded-[12px]"
                style={{ color: conv.starred ? "var(--ux-amber-ink)" : "var(--ux-faint)" }}>
          <Icons.Star className="h-[17px] w-[17px]" fill={conv.starred ? "currentColor" : "none"} />
        </button>
        <div ref={menuRef} className="relative">
          <button type="button" onClick={() => setMenu((v) => !v)} title="More"
                  aria-haspopup="menu" aria-expanded={menu}
                  className="ux-row grid h-[36px] w-[36px] place-items-center rounded-[12px]"
                  style={{ color: "var(--ux-faint)" }}>
            <Icons.MoreVertical className="h-[17px] w-[17px]" />
          </button>
          {menu && (
            <div role="menu" className="ux-pop absolute end-0 top-[calc(100%+6px)] z-50 w-[230px] rounded-[12px] p-1.5"
                 style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                          boxShadow: "var(--ux-shadow-pop)" }}>
              {[
                { icon: "MailOpen", label: "Mark as unread", run: onUnread },
                { icon: conv.starred ? "StarOff" : "Star", label: conv.starred ? tr("messages.removeStar2")
              : tr("messages.starThisConversation2"), run: onStar },
              ].map((a) => (
                <button key={a.label} type="button" role="menuitem"
                        onClick={() => { setMenu(false); a.run(); }}
                        className="ux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-xsm"
                        style={{ color: "var(--ux-ink)" }}>
                  <Ico name={a.icon} className="h-[15px] w-[15px]" /> {a.label}
                </button>
              ))}
              <Link href="/app/safety" role="menuitem" onClick={() => setMenu(false)}
                    className="ux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-xsm"
                    style={{ color: "var(--ux-ink)" }}>
                <Icons.Flag className="h-[15px] w-[15px]" style={{ color: "var(--ux-pink-ink)" }} />{tr("messages.reportThisPerson")}</Link>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); onDelete(); }}
                      className="ux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-xsm"
                      style={{ color: "var(--ux-pink-ink)" }}>
                <Icons.Trash2 className="h-[15px] w-[15px]" />{tr("messages.deleteConversation")}</button>
            </div>
          )}
        </div>
      </div>

      {/* What this conversation is actually about. */}
      {ctx && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b p-3.5"
             style={{ borderColor: "var(--ux-line)",
                      background: "linear-gradient(96deg, var(--ux-brand-tint), var(--ux-tint-pink))" }}>
          {ctx.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img loading="lazy" decoding="async" src={ctx.image} alt="" className="h-[46px] w-[46px] shrink-0 rounded-[12px] object-cover" />
          )}
          <span className="min-w-0 flex-1">
            <b className="block truncate text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>
              Order #{ctx.ref} · {ctx.title}
            </b>
            <i className="mt-0.5 block truncate text-2xs not-italic" style={{ color: "var(--ux-ink-2)" }}>{ctx.sub}</i>
          </span>
          {ctx.status && (
            <span className="shrink-0 rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-[0.08em]"
                  style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
              {ctx.status}
            </span>
          )}
          <Link href="/app/documents"
                className="ux-press flex shrink-0 items-center gap-1.5 rounded-[12px] px-3 py-2 text-xs font-bold"
                style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>{tr("messages.openOrder")}<Icons.ChevronRight className="h-[13px] w-[13px]" />
          </Link>
        </div>
      )}

      {/* A short fade under the strip and above the composer. Content passing
          behind either edge now dissolves instead of being guillotined, which
          is what made the thread look like it was hiding under the header. */}
      <div aria-hidden className="pointer-events-none relative z-10 -mb-4 h-4"
           style={{ background: "linear-gradient(var(--ux-surface), transparent)" }} />

      {/* Grows and shrinks with the window instead of being pinned at 406px,
          which left a void under a one-message conversation and a cramped
          box on a tall screen. */}
      {/* `pb-3` so the newest message ends clear of the quick replies rather
          than tucked under them — scrolled to the bottom, the last timestamp
          was touching the first chip. */}
      <div ref={box} className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-4 pb-3"
           style={{ scrollbarWidth: "thin" }}>
        {conv.messages.map((m, i) => {
          const prev = conv.messages[i - 1];
          const newDay = !prev || dayLabel(prev.at) !== dayLabel(m.at);
          const first = newDay || prev?.dir !== m.dir;
          return (
            <div key={i}>
              {newDay && (
                <div className="my-3 flex items-center gap-3">
                  <span className="h-px flex-1" style={{ background: "var(--ux-line)" }} />
                  <span className="text-2xs font-bold uppercase tracking-[0.15em]" style={{ color: "var(--ux-faint)" }}>
                    {dayLabel(m.at)}
                  </span>
                  <span className="h-px flex-1" style={{ background: "var(--ux-line)" }} />
                </div>
              )}
              <Bubble bubble={m} first={first} conv={conv} />
            </div>
          );
        })}
      </div>

      <div aria-hidden className="pointer-events-none relative z-10 -mt-4 h-4"
           style={{ background: "linear-gradient(transparent, var(--ux-surface))" }} />

      {/* Wraps. Scrolling sideways cut them mid-word — "ady by Friday" — and a
          suggestion you have to swipe to read is not a suggestion. */}
      <div className="flex shrink-0 flex-wrap gap-2 px-4 pt-3">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => setDraft(q)}
                  className="ux-press shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold"
                  style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                           color: "var(--ux-ink-2)" }}>
            {q}
          </button>
        ))}
      </div>

      <input ref={pick} type="file" className="hidden" accept="image/*,.pdf"
             onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <input ref={shoot} type="file" className="hidden" accept="image/*" capture="environment"
             onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

      <div className="ux-comp mx-4 mt-3 shrink-0 rounded-[16px]"
           style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line-strong)" }}>
        {file && (
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            <span className="flex min-w-0 items-center gap-2 rounded-[12px] px-2.5 py-1.5 text-xs"
                  style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)" }}>
              <Icons.Paperclip className="h-[13px] w-[13px] shrink-0" style={{ color: "var(--ux-faint)" }} />
              <span className="truncate font-semibold" style={{ color: "var(--ux-ink)" }}>{file.name}</span>
              <button type="button" onClick={() => setFile(null)} aria-label={tr("messages.removeAttachment")}
                      className="ux-press grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                      style={{ color: "var(--ux-faint)" }}>
                <Icons.X className="h-[12px] w-[12px]" />
              </button>
            </span>
            {/* Honest: the picker works, the upload endpoint does not exist yet. */}
            <span className="text-2xs" style={{ color: "var(--ux-amber-ink)" }}>{tr("messages.sendingFilesIsComingTheName")}</span>
          </div>
        )}
        <textarea
          ref={area} rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={`Write to ${conv.name.split(" ")[0]}…`} aria-label={tr("messages.writeAMessage")}
          className="w-full resize-none bg-transparent px-4 pb-1.5 pt-3 text-sm leading-relaxed outline-none"
          style={{ color: "var(--ux-ink)", maxHeight: 120 }}
        />
        <div className="flex items-center justify-between border-t px-2 py-2" style={{ borderColor: "var(--ux-line)" }}>
          <div className="flex gap-0.5">
            <button type="button" title={tr("messages.attachAFile")} onClick={() => pick.current?.click()}
                    className="ux-row grid h-[36px] w-[36px] place-items-center rounded-[12px]"
                    style={{ color: "var(--ux-faint)" }}>
              <Icons.Paperclip className="h-[17px] w-[17px]" />
            </button>
            <button type="button" title={tr("messages.sendAPhoto")} onClick={() => shoot.current?.click()}
                    className="ux-row grid h-[36px] w-[36px] place-items-center rounded-[12px]"
                    style={{ color: "var(--ux-faint)" }}>
              <Icons.Camera className="h-[17px] w-[17px]" />
            </button>
            <Link href="/app/documents" title={tr("messages.sendAnOrder")}
                  className="ux-row grid h-[36px] w-[36px] place-items-center rounded-[12px]"
                  style={{ color: "var(--ux-faint)" }}>
              <Icons.Package className="h-[17px] w-[17px]" />
            </Link>
          </div>
          <button type="button" onClick={onSend} disabled={!draft.trim() || sending} aria-label="Send"
                  className="ux-press grid h-[38px] w-[38px] place-items-center rounded-[12px] disabled:opacity-40"
                  style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }}>
            <Icons.Send className="h-[17px] w-[17px]" />
          </button>
        </div>
      </div>

      {/* Off-platform payment requests are how women get cheated on marketplaces.
          The warning belongs where money gets discussed, not in a help page. */}
      <p className="flex shrink-0 items-center gap-2 px-4 pb-4 pt-3 text-2xs" style={{ color: "var(--ux-muted)" }}>
        <Icons.ShieldCheck className="h-[13px] w-[13px] shrink-0" style={{ color: "var(--ux-green-ink)" }} />{tr("messages.keepPaymentsInsideWomsakhiNobodyHe")}</p>
    </section>
  );
}

export function Bubble({ bubble, first, conv }: { bubble: ConvBubble; first: boolean; conv: ConvDetail }) {
  const out = bubble.dir === "out";
  return (
    <div className={`mt-[3px] flex items-end gap-2.5 ${out ? "flex-row-reverse" : ""}`}>
      <span className="w-[26px] shrink-0" style={{ visibility: first && !out ? "visible" : "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={conv.avatar || "/ux/brand/womsakhi-emblem.webp"} alt=""
             className="h-[26px] w-[26px] rounded-full object-cover" />
      </span>
      {bubble.order ? (
        <OrderCard order={bubble.order} />
      ) : (
      <div className="max-w-[70%] rounded-[16px] p-[11px_14px] text-sm leading-relaxed"
           style={out
             ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)",
                 borderBottomRightRadius: first ? 5 : 16, boxShadow: "var(--ux-shadow-glow-2)" }
             : { background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)", color: "var(--ux-ink-2)",
                 borderBottomLeftRadius: first ? 5 : 16 }}>
        {bubble.file?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" decoding="async" src={bubble.file.url} alt={bubble.file.name}
               className="mb-2 block max-w-[210px] rounded-[12px]" style={{ border: "1px solid var(--ux-line)" }} />
        )}
        {bubble.text}
        <span className={`mt-1.5 flex items-center gap-1.5 text-2xs ${out ? "justify-end" : ""}`}
              style={{ color: out ? "var(--ux-on-brand-2)" : "var(--ux-faint)" }}>
          {clock(bubble.at)}
          {out && <Icons.CheckCheck className="h-[13px] w-[13px]" style={{ color: bubble.read ? "var(--ux-read-tick)" : "inherit" }} />}
        </span>
      </div>
      )}
    </div>
  );
}

/**
 * An order, inside the conversation it was agreed in.
 *
 * The header strip above shows what the order is *now*; this shows what was
 * said at the time. When a buyer disputes a price three weeks later, the
 * scrollback is the record.
 */
export function OrderCard({ order }: { order: NonNullable<ConvBubble["order"]> }) {
  return (
    <div className="max-w-[320px] overflow-hidden rounded-[16px]"
         style={{ border: "1px solid var(--ux-line-strong)", background: "var(--ux-surface)",
                  boxShadow: "var(--ux-shadow-card)" }}>
      <p className="flex items-center gap-2 px-3.5 py-2.5 text-2xs font-bold uppercase tracking-[0.11em]"
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

export function About({ conv, onStar, onDraft }: {
  conv: ConvDetail; onStar: () => void; onDraft: (v: string) => void;
}) {
  const tr = useT();
  const p = conv.party;
  const first = conv.name.split(" ")[0];
  const shots = conv.messages.filter((m) => m.file?.url).slice(-3);

  return (
    <aside className="ux-sq hidden min-h-0 overflow-y-auto rounded-[20px] pb-[80px] xl:block"
           style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                    boxShadow: "var(--ux-shadow-card)" }}>
      <div className="p-4 text-center">
        <span className="mx-auto inline-block"><Avatar src={conv.avatar} kind={conv.kind} size={64} /></span>
        <h2 className="mt-2.5 text-base font-bold" style={{ color: "var(--ux-ink)" }}>{conv.name}</h2>
        <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>
          {[p.role, p.since].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          <div className="rounded-[12px] p-2.5" style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
            <b className="block text-base font-bold tracking-[-0.02em]" style={{ color: "var(--ux-ink)" }}>{p.orders ?? 0}</b>
            <i className="mt-0.5 block text-2xs not-italic" style={{ color: "var(--ux-muted)" }}>orders</i>
          </div>
          <div className="rounded-[12px] p-2.5" style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
            <b className="block text-base font-bold tracking-[-0.02em]" style={{ color: "var(--ux-ink)" }}>
              {formatMoney(p.spent_minor ?? 0)}
            </b>
            <i className="mt-0.5 block text-2xs not-italic" style={{ color: "var(--ux-muted)" }}>spent with you</i>
          </div>
        </div>
      </div>

      <div className="border-t p-3.5" style={{ borderColor: "var(--ux-line)" }}>
        <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ux-faint)" }}>{tr("messages.doNext")}</h3>
        {/* Each of these does the thing it names. "Send her an order" opens the
            shop, the other two write the message and star the thread — nothing
            here is a label over an empty handler. */}
        <Link href="/app/documents"
              className="ux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-xsm font-semibold"
              style={{ color: "var(--ux-ink-2)" }}>
          <Icons.Package className="h-[15px] w-[15px]" />{tr("messages.sendHerAnOrder")}</Link>
        <button type="button"
                onClick={() => onDraft(`Namaste ${first}, here is what I make and what it costs:\n\n· Cotton kurta — ₹280\n· Silk dupatta — ₹640\n· Blouse stitching — ₹180\n\nTell me what you would like and by when.`)}
                className="ux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-xsm font-semibold"
                style={{ color: "var(--ux-ink-2)" }}>
          <Icons.Tag className="h-[15px] w-[15px]" />{tr("messages.shareYourPriceList")}</button>
        <button type="button" onClick={onStar} aria-pressed={conv.starred}
                className="ux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-xsm font-semibold"
                style={{ color: conv.starred ? "var(--ux-amber-ink)" : "var(--ux-ink-2)" }}>
          <Icons.Star className="h-[15px] w-[15px]" fill={conv.starred ? "currentColor" : "none"} />
          {conv.starred ? tr("messages.aGoodBuyer")
              : tr("messages.markAsAGoodBuyer")}
        </button>
      </div>

      {shots.length > 0 && (
        <div className="border-t p-3.5" style={{ borderColor: "var(--ux-line)" }}>
          <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ux-faint)" }}>{tr("messages.sharedHere")}</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {shots.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" decoding="async" key={i} src={m.file!.url} alt="" className="aspect-square w-full rounded-[8px] object-cover" />
            ))}
          </div>
        </div>
      )}

      <div className="border-t p-3.5" style={{ borderColor: "var(--ux-line)" }}>
        <h3 className="mb-2 text-2xs font-bold uppercase tracking-[0.16em]" style={{ color: "var(--ux-faint)" }}>{tr("messages.ifSomethingFeelsWrong")}</h3>
        <Link href="/app/safety"
              className="ux-row flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2.5 text-start text-xsm font-semibold"
              style={{ color: "var(--ux-ink-2)" }}>
          <Icons.Flag className="h-[15px] w-[15px]" style={{ color: "var(--ux-pink-ink)" }} />{tr("messages.reportThisPerson2")}</Link>
      </div>
    </aside>
  );
}
