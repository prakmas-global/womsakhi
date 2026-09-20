"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, DemoNote, EmptyState, I, IconTile, v } from "@/components/ux/kit";
import type { ApiCircleDetail, ApiCircleMember } from "@/lib/growth-api";
import { members as niceCount, readPost, topicOf } from "@/components/ux/circle/data";

/* ------------------------------------------------------------------ */
/*  The banner                                                         */
/* ------------------------------------------------------------------ */

export function CircleBanner({ c, posts, events }: {
  c: ApiCircleDetail;
  /** How many posts actually came back. The circle's own `post_count` is
   *  stale on the server — it said 5 above a feed of 26 — and a number the
   *  reader can disprove by scrolling is worse than no number. */
  posts: number;
  events: number;
}) {
  const t = topicOf(c.topic);
  const shownPosts = Math.max(posts, c.post_count);

  /** Four short claims a reader can check, in the wireframe's order. */
  const tags = [
    t.label,
    c.is_savings ? "Savings circle" : "Skill building",
    c.is_private ? "Members only" : "Small business",
    "Women only",
  ];

  return (
    <section className="relative mb-4 overflow-hidden rounded-[20px]"
             style={{ background: "linear-gradient(102deg, var(--ux-brand-tint) 0%, var(--ux-tint-lilac) 62%, var(--ux-tint-pink) 100%)",
                      border: "1px solid var(--ux-line)" }}>
      <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-start gap-4 p-6 sm:p-7">
          <span className="grid h-[60px] w-[60px] shrink-0 place-items-center overflow-hidden rounded-[16px]"
                style={{ background: "linear-gradient(140deg, var(--ux-fill), var(--ux-fill-2))",
                         color: v("--ux-on-brand") }}>
            <I name={c.is_private ? "Lock" : t.icon} className="h-[26px] w-[26px]" sw={2} />
          </span>

          <div className="min-w-0">
            <h1 className="text-2xlm font-extrabold leading-tight tracking-[-0.02em]" style={{ color: v("--ux-ink") }}>
              {c.name}
            </h1>
            {c.desc && (
              <p className="mt-2 max-w-[440px] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                {c.desc}
              </p>
            )}

            <p className="mt-3.5 flex flex-wrap gap-2">
              {tags.map((x) => (
                <span key={x} className="rounded-full px-3 py-1.5 text-[12px] lg:text-2xs font-semibold"
                      style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                  {x}
                </span>
              ))}
            </p>

            <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold"
               style={{ color: v("--ux-ink-2") }}>
              <Meta icon="Users">{niceCount(c.member_count)} {c.member_count === 1 ? "member" : "members"}</Meta>
              <Meta icon="FileText">{shownPosts} {shownPosts === 1 ? "post" : "posts"}</Meta>
              <Meta icon="CalendarDays">{events} {events === 1 ? "event" : "events"}</Meta>
              <Meta icon={c.is_private ? "Lock" : "Globe"}>
                {c.is_private ? "Private circle" : "Online community"}
              </Meta>
            </p>
          </div>
        </div>

        <div className="relative hidden lg:block">
          {c.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.cover} alt="" aria-hidden loading="lazy" decoding="async"
                 className="h-full w-[260px] object-cover xl:w-[320px]"
                 style={{ maskImage: "linear-gradient(100deg, transparent, #000 28%)",
                          WebkitMaskImage: "linear-gradient(100deg, transparent, #000 28%)" }} />
          ) : (
            <p className="flex h-full w-[210px] items-center justify-end pe-7 text-end text-lg font-bold italic leading-[1.3] xl:w-[270px]"
               style={{ color: v("--ux-brand"), fontFamily: "var(--font-display)" }}>
              Learn.<br />Share.<br />Grow together.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Meta({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <I name={icon} className="h-[14px] w-[14px]" style={{ color: v("--ux-brand") }} />
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Invite, Joined, and the rest                                       */
/* ------------------------------------------------------------------ */

export function CircleActions({ joined, busy, onJoin, onLeave, onInvite, onSoon, menu, onMenu }: {
  joined: boolean; busy: boolean;
  /** Which menu is open: the Joined one, the "…" one, or neither. */
  menu: "joined" | "more" | null;
  onMenu: (m: "joined" | "more" | null) => void;
  onJoin: () => void; onLeave: () => void; onInvite: () => void;
  onSoon: (msg: string) => void;
}) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="flex-1"><Btn full variant="outline" icon="UserPlus" onClick={onInvite}>Invite</Btn></span>

      {joined ? (
        <div className="relative flex-1">
          <Btn full icon="Check" iconEnd={menu === "joined" ? "ChevronUp" : "ChevronDown"}
               disabled={busy} onClick={() => onMenu(menu === "joined" ? null : "joined")}>
            Joined
          </Btn>
          {menu === "joined" && (
            /* Leaving is one press behind a menu on purpose: it is easy to do
               by accident from a list, and hard to undo in a private circle. */
            <Menu>
              <MenuRow icon="BellOff" onClick={() => onSoon("Muting a circle is on the way. For now it stays quiet unless somebody replies to you.")}>
                Mute this circle
              </MenuRow>
              <MenuRow icon="LogOut" danger onClick={onLeave}>Leave this circle</MenuRow>
            </Menu>
          )}
        </div>
      ) : (
        <span className="flex-1">
          <Btn full icon="Plus" disabled={busy} onClick={onJoin}>Join</Btn>
        </span>
      )}

      <div className="relative">
        <button type="button" aria-label="More" aria-expanded={menu === "more"}
                onClick={() => onMenu(menu === "more" ? null : "more")}
                className="ux-press ux-sq grid h-[42px] w-[42px] place-items-center rounded-[12px]"
                style={{ border: `1px solid ${v("--ux-line-strong")}`, background: v("--ux-surface"),
                         color: v("--ux-ink-2") }}>
          <Icons.MoreHorizontal className="h-[17px] w-[17px]" />
        </button>
        {menu === "more" && (
          <Menu>
            <MenuRow icon="Share2" onClick={onInvite}>Copy the circle link</MenuRow>
            <MenuRow icon="Flag" onClick={() => onSoon("Thank you. Reporting a circle is on the way — until then, tell us through Help and a person will read it.")}>
              Report this circle
            </MenuRow>
          </Menu>
        )}
      </div>
    </div>
  );
}

function Menu({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute end-0 top-[calc(100%+6px)] z-[var(--ux-z-dropdown)] w-[236px] overflow-hidden rounded-[12px]"
         style={{ background: v("--ux-surface"), border: "1px solid var(--ux-line)",
                  boxShadow: "var(--ux-shadow-pop)" }}>
      {children}
    </div>
  );
}

function MenuRow({ icon, children, onClick, danger }: {
  icon: string; children: React.ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
            className="ux-hov ux-sq flex w-full items-center gap-2.5 px-4 py-3 text-start text-xsm font-semibold"
            style={{ color: v(danger ? "--ux-danger-solid" : "--ux-ink-2") }}>
      <I name={icon} className="h-[15px] w-[15px]" />
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  The tab row                                                        */
/* ------------------------------------------------------------------ */

export function UnderTabs({ items, active, onChange }: {
  items: readonly string[]; active: string; onChange: (t: string) => void;
}) {
  return (
    <div role="tablist" className="ux-noscroll mb-4 flex gap-1 overflow-x-auto border-b"
         style={{ borderColor: v("--ux-line") }}>
      {items.map((t) => {
        const on = t === active;
        return (
          <button key={t} role="tab" type="button" aria-selected={on} onClick={() => onChange(t)}
                  className="ux-press ux-sq relative shrink-0 px-4 pb-3 pt-2 text-xsm font-bold"
                  style={{ color: v(on ? "--ux-brand" : "--ux-muted") }}>
            {t}
            {on && (
              <span aria-hidden className="absolute inset-x-3 bottom-[-1px] h-[2.5px] rounded-full"
                    style={{ background: v("--ux-brand") }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Saying something                                                   */
/* ------------------------------------------------------------------ */

export const COMPOSER_EXTRAS = [
  { id: "photo",    icon: "ImagePlus",    label: "Photo/Video",     soon: "Photos in a post are on the way. For now, describe it — women here answer words." },
  { id: "poll",     icon: "BarChart3",    label: "Poll",            soon: "Polls are on the way. For now, ask the question and count the replies." },
  { id: "event",    icon: "CalendarDays", label: "Event",           soon: "A circle cannot hold its own event yet. Melas and workshops are under Events." },
  { id: "file",     icon: "Paperclip",    label: "File",            soon: "Attachments are on the way. A link in the post works today." },
  { id: "question", icon: "HelpCircle",   label: "Ask a question",  soon: "" },
] as const;

export function Composer({ value, onChange, onPost, busy, avatar, name, onSoon, joined }: {
  value: string; onChange: (s: string) => void; onPost: () => void;
  busy: boolean; avatar: string; name: string; joined: boolean;
  onSoon: (msg: string) => void;
}) {
  return (
    <Card className="mb-4">
      <div className="flex items-start gap-3">
        <span className="grid h-[40px] w-[40px] shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold"
              style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {avatar ? <img src={avatar} alt="" aria-hidden className="h-full w-full object-cover" />
                  : name.slice(0, 1).toUpperCase()}
        </span>
        <textarea
          value={value}
          rows={value.length > 90 ? 4 : 2}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Share something with your circle"
          placeholder={joined ? "Share something with your circle…" : "Join the circle to write in it"}
          disabled={!joined}
          className="ux-sq min-h-[52px] w-full rounded-[14px] border px-3.5 py-3 text-xsm leading-relaxed outline-none"
          style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1">
        {COMPOSER_EXTRAS.map((x) => (
          <button
            key={x.id}
            type="button"
            disabled={!joined}
            onClick={() => {
              // "Ask a question" is real: a `#question` tag is what the
              // Questions filter reads, so this writes the tag for her.
              if (!x.soon) onChange(value.includes("#question") ? value : `${value}${value ? " " : ""}#question `);
              else onSoon(x.soon);
            }}
            className="ux-press ux-sq flex min-h-[36px] items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-semibold"
            style={{ color: v(x.soon ? "--ux-muted" : "--ux-brand"), opacity: joined ? 1 : 0.5 }}
          >
            <I name={x.icon} className="h-[15px] w-[15px]" />
            {x.label}
          </button>
        ))}
        <span className="ms-auto">
          <Btn disabled={!joined || busy || !value.trim()} loading={busy} onClick={onPost}>Post</Btn>
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  One post                                                           */
/* ------------------------------------------------------------------ */

export interface CircleFeedPost {
  id: string; author: string; avatar: string; when: string; body: string;
  image: string; likes: number; liked: boolean; replies: number;
  mine: boolean; pinned: boolean; kind: string | null;
}

export function CirclePostCard({ p, saved, busy, menu, onMenu, onLike, onSave, onShare, onSoon }: {
  p: CircleFeedPost; saved: boolean; busy: boolean;
  menu: boolean; onMenu: (open: boolean) => void;
  onLike: (p: CircleFeedPost) => void;
  onSave: (p: CircleFeedPost) => void;
  onShare: (p: CircleFeedPost) => void;
  onSoon: (msg: string) => void;
}) {
  const { title, rest, tags } = readPost(p.body);
  return (
    // `id` so a copied "#<post>" link lands on the post and not on the top of
    // the circle. `scrollMarginTop` keeps it out from under the fixed top bar.
    <Card id={p.id} className="mb-3.5"
          style={{ scrollMarginTop: "calc(var(--ux-topbar-h) + 16px)" }}>
      <div className="flex items-start gap-3">
        <span className="grid h-[40px] w-[40px] shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold"
              style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.avatar ? <img src={p.avatar} alt="" aria-hidden loading="lazy" decoding="async"
                           className="h-full w-full object-cover" />
                    : p.author.slice(0, 1).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <b className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>{p.author}</b>
              <span className="text-[12px] lg:text-2xs" style={{ color: v("--ux-muted") }}>{p.when}</span>
              {p.pinned && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[12px] lg:text-3xs font-extrabold"
                      style={{ background: v("--ux-tint-amber"), color: v("--ux-amber-ink") }}>
                  <Icons.Pin className="h-[10px] w-[10px]" /> Pinned
                </span>
              )}
              {p.kind && (
                <span className="rounded-full px-2.5 py-[3px] text-[12px] lg:text-3xs font-extrabold"
                      style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                  {p.kind}
                </span>
              )}
            </p>

            <div className="relative shrink-0">
              <button type="button" aria-label="More about this post" aria-expanded={menu}
                      onClick={() => onMenu(!menu)}
                      className="ux-press ux-sq grid h-[30px] w-[30px] place-items-center rounded-[8px]"
                      style={{ color: v("--ux-faint") }}>
                <Icons.MoreVertical className="h-[16px] w-[16px]" />
              </button>
              {menu && (
                <Menu>
                  <MenuRow icon="Bookmark" onClick={() => { onSave(p); onMenu(false); }}>
                    {saved ? "Remove from saved" : "Save this post"}
                  </MenuRow>
                  <MenuRow icon="Share2" onClick={() => { onShare(p); onMenu(false); }}>Copy its link</MenuRow>
                  <MenuRow icon="Flag" danger onClick={() => {
                    onMenu(false);
                    onSoon(p.mine
                      ? "Deleting your own post is on the way."
                      : "Thank you. Reporting a post is on the way — until then tell us through Help and a person will read it.");
                  }}>
                    {p.mine ? "Delete this post" : "Report this post"}
                  </MenuRow>
                </Menu>
              )}
            </div>
          </div>

          {title && (
            <p className="mt-2 text-smd font-extrabold leading-snug" style={{ color: v("--ux-ink") }}>{title}</p>
          )}
          {rest && (
            <p className="mt-1.5 whitespace-pre-line text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {rest}
            </p>
          )}

          {p.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" loading="lazy" decoding="async"
                 className="mt-3 max-h-[320px] w-full rounded-[12px] object-cover"
                 style={{ background: v("--ux-media-bed") }} />
          )}

          {tags.length > 0 && (
            <p className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full px-2.5 py-1 text-[12px] lg:text-3xs font-semibold"
                      style={{ background: v("--ux-surface-2"), color: v("--ux-brand") }}>
                  #{t}
                </span>
              ))}
            </p>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-1 border-t pt-3"
               style={{ borderColor: v("--ux-line") }}>
            <PostAct icon="Heart" label={String(p.likes)} on={p.liked} tone="--ux-pink-ink"
                     disabled={busy} onClick={() => onLike(p)} />
            <PostAct icon="MessageCircle" label={String(p.replies)} />
            <PostAct icon="Bookmark" label="Save" on={saved} tone="--ux-brand" onClick={() => onSave(p)} />
            <PostAct icon="Share2" label="Share" onClick={() => onShare(p)} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function PostAct({ icon, label, onClick, on, tone = "--ux-muted", disabled }: {
  icon: string; label: string; onClick?: () => void; on?: boolean; tone?: string; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || !onClick} aria-pressed={on}
            className="ux-press ux-sq flex min-h-[36px] items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-semibold"
            style={{ color: v(on ? tone : "--ux-muted"), opacity: disabled ? 0.6 : 1 }}>
      <I name={icon} className="h-[15px] w-[15px]" sw={on ? 2.6 : 1.9} />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: what this circle is                                          */
/* ------------------------------------------------------------------ */

export function AboutCircle({ c, posts, onEdit }: {
  c: ApiCircleDetail; posts: number; onEdit: () => void;
}) {
  const t = topicOf(c.topic);
  const facts = [
    { k: "What it is about", val: t.label,                                   icon: "Tag",      tint: "--ux-brand-tint-2", ink: "--ux-brand" },
    { k: "Who can come in",  val: c.is_private ? "Members only" : "Anyone",  icon: "Lock",     tint: "--ux-tint-violet",  ink: "--ux-violet-ink" },
    { k: "Members",          val: niceCount(c.member_count),                 icon: "Users",    tint: "--ux-tint-blue",    ink: "--ux-blue-ink" },
    { k: "Posts",            val: String(Math.max(posts, c.post_count)),     icon: "FileText", tint: "--ux-tint-green",   ink: "--ux-green-ink" },
  ];
  return (
    <Card>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>About this circle</h2>
        <button type="button" onClick={onEdit}
                className="ux-sq -me-2 flex min-h-[36px] items-center rounded-[10px] px-2 text-xs font-bold"
                style={{ color: v("--ux-brand") }}>
          Edit
        </button>
      </div>
      {c.desc && (
        <p className="text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>{c.desc}</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {facts.map((f) => (
          <div key={f.k} className="rounded-[12px] p-2.5" style={{ border: "1px solid var(--ux-line)" }}>
            <IconTile icon={f.icon} tint={f.tint} ink={f.ink} size={28} radius={8} />
            <span className="mt-2 block text-[12px] lg:text-3xs font-semibold" style={{ color: v("--ux-muted") }}>{f.k}</span>
            <b className="mt-0.5 block truncate text-xs font-bold" style={{ color: v("--ux-ink") }}>{f.val}</b>
          </div>
        ))}
      </div>
      {c.guidelines && (
        <div className="mt-4 rounded-[12px] p-3.5" style={{ background: v("--ux-surface-2") }}>
          <p className="flex items-center gap-1.5 text-[12px] lg:text-2xs font-extrabold" style={{ color: v("--ux-ink") }}>
            <Icons.ShieldCheck className="h-[13px] w-[13px]" style={{ color: v("--ux-green-ink") }} />
            The one rule here
          </p>
          <p className="mt-1 text-[12px] lg:text-2xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>{c.guidelines}</p>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: who is in it                                                 */
/* ------------------------------------------------------------------ */

export function MembersCard({ count, people, onAll }: {
  count: number; people: ApiCircleMember[]; onAll: () => void;
}) {
  // With no member list the server still sends a count. Six invented faces
  // would be a claim about who is in the room; six unnamed marks are not.
  const anon = Math.max(0, Math.min(6, count) - people.length);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>
          Members ({niceCount(count)})
        </h2>
        <button type="button" onClick={onAll}
                className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
                style={{ color: v("--ux-brand") }}>
          View all <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </button>
      </div>

      <div className="flex items-center">
        {people.slice(0, 6).map((m, i) => (
          <span key={m.name} title={m.name}
                className="grid h-[36px] w-[36px] shrink-0 place-items-center overflow-hidden rounded-full text-[12px] lg:text-2xs font-bold"
                style={{ marginInlineStart: i ? -10 : 0, border: `2px solid ${v("--ux-surface")}`,
                         background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.avatar ? <img src={m.avatar} alt="" aria-hidden loading="lazy" decoding="async"
                             className="h-full w-full object-cover" />
                      : m.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
        {Array.from({ length: anon }).map((_, i) => (
          <span key={`anon-${i}`} aria-hidden
                className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
                style={{ marginInlineStart: people.length || i ? -10 : 0,
                         border: `2px solid ${v("--ux-surface")}`,
                         background: v("--ux-surface-2"), color: v("--ux-faint") }}>
            <Icons.UserRound className="h-[16px] w-[16px]" />
          </span>
        ))}
        {count > people.length + anon && (
          <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full text-[12px] lg:text-2xs font-bold"
                style={{ marginInlineStart: -10, border: `2px solid ${v("--ux-surface")}`,
                         background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
            +{niceCount(count - people.length - anon)}
          </span>
        )}
      </div>

      <p className="mt-2.5 text-[12px] lg:text-2xs leading-relaxed" style={{ color: v("--ux-muted") }}>
        {people.length > 0
          ? `${people.slice(0, 2).map((m) => m.name.split(" ")[0]).join(", ")}${count > 2 ? ` and ${niceCount(count - 2)} more` : ""}`
          : "Their names are theirs to share — you will see them as they post."}
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: what is coming up                                            */
/* ------------------------------------------------------------------ */

export interface RailEvent {
  id: string; title: string; day: string; month: string;
  when: string; going: boolean; taken: number; href: string;
}

export function EventsRail({ rows, busy, onGo }: {
  rows: RailEvent[]; busy: string | null; onGo: (e: RailEvent) => void;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>Upcoming events</h2>
        <Link href="/app/events" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          View all <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
          Nothing on the calendar just now.
        </p>
      ) : (
        <div className="space-y-3.5">
          {rows.map((e) => (
            <div key={e.id} className="flex items-start gap-3">
              <span className="grid w-[46px] shrink-0 place-items-center rounded-[12px] py-1.5"
                    style={{ background: v("--ux-brand-tint") }}>
                <span className="text-[12px] lg:text-3xs font-extrabold uppercase tracking-[0.08em]" style={{ color: v("--ux-brand") }}>
                  {e.month}
                </span>
                <span className="text-lg font-extrabold leading-none" style={{ color: v("--ux-brand") }}>{e.day}</span>
              </span>
              <span className="min-w-0 flex-1">
                <Link href={e.href} className="ux-sq block text-xsm font-bold leading-snug" style={{ color: v("--ux-ink") }}>
                  {e.title}
                </Link>
                <span className="mt-1 flex items-center gap-1.5 text-[12px] lg:text-2xs" style={{ color: v("--ux-muted") }}>
                  <Icons.CalendarDays className="h-[12px] w-[12px]" />{e.when}
                </span>
                <span className="mt-2 flex items-center gap-2">
                  {e.taken > 0 && (
                    <span className="text-[12px] lg:text-2xs font-semibold" style={{ color: v("--ux-faint") }}>
                      +{e.taken} going
                    </span>
                  )}
                  <Btn size="sm" variant={e.going ? "outline" : "soft"} disabled={busy === e.id}
                       onClick={() => onGo(e)}>
                    {e.going ? "You are going" : "Join"}
                  </Btn>
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* These are WomSakhi's, not this circle's — saying so is the difference
          between an invitation and a false claim about who is running it. */}
      <p className="mt-3.5 border-t pt-3 text-[12px] lg:text-2xs leading-relaxed"
         style={{ borderColor: v("--ux-line"), color: v("--ux-faint") }}>
        Open to every woman on WomSakhi. A circle cannot hold its own event yet.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: things worth keeping                                         */
/* ------------------------------------------------------------------ */

/** What this card is drawn around. There is no files endpoint yet. */
export const EXAMPLE_RESOURCES = [
  { id: "r1", name: "Blouse measurement guide", kind: "PDF", size: "2.4 MB", tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  { id: "r2", name: "Fabric types cheat sheet", kind: "PDF", size: "1.1 MB", tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  { id: "r3", name: "Pricing your work",        kind: "XLS", size: "850 KB", tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  { id: "r4", name: "Beginner tools list",      kind: "PDF", size: "1.3 MB", tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
];

export function ResourcesRail({ onSoon }: { onSoon: (msg: string) => void }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>Popular resources</h2>
        <button type="button"
                onClick={() => onSoon("A circle's shared files are on the way. Until then, put a link in a post — everyone in the circle can open it.")}
                className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
                style={{ color: v("--ux-brand") }}>
          View all <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </button>
      </div>

      <DemoNote what="These four files" />

      <div className="space-y-1">
        {EXAMPLE_RESOURCES.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 rounded-[10px] px-1 py-2">
            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]"
                  style={{ background: v(r.tint), color: v(r.ink) }}>
              <Icons.FileText className="h-[16px] w-[16px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold" style={{ color: v("--ux-ink") }}>
                {r.name} ({r.kind})
              </span>
              <span className="mt-0.5 block text-[12px] lg:text-3xs" style={{ color: v("--ux-muted") }}>{r.size}</span>
            </span>
            <button type="button" aria-label={`Download ${r.name}`}
                    onClick={() => onSoon("There is no file behind this one yet — the shelf is built, nothing is on it.")}
                    className="ux-press ux-sq grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[8px]"
                    style={{ color: v("--ux-faint") }}>
              <Icons.Download className="h-[15px] w-[15px]" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  A tab with nothing behind it yet                                   */
/* ------------------------------------------------------------------ */

export function NotBuiltYet({ icon, title, body, action }: {
  icon: string; title: string; body: string; action?: React.ReactNode;
}) {
  return (
    <Card>
      <EmptyState icon={icon} title={title} body={body} action={action} />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: the pot, when this circle is one                             */
/* ------------------------------------------------------------------ */

export function PotCard({ id, monthlyLabel, round, paid, total, youPaid, whoseTurn }: {
  id: string; monthlyLabel: string; round: number;
  paid: number; total: number; youPaid: boolean; whoseTurn: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconTile icon="Coins" tint="--ux-tint-amber" ink="--ux-amber-ink" size={38} radius={11} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>The pot</h2>
          <p className="mt-0.5 text-[12px] lg:text-2xs" style={{ color: v("--ux-muted") }}>
            {monthlyLabel} a month · round {round}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs" style={{ color: v("--ux-ink-2") }}>
        {paid} of {total} have paid this round{whoseTurn ? `, and it is ${whoseTurn}'s turn` : ""}.
      </p>
      <div className="mt-3.5">
        <Btn size="sm" full variant={youPaid ? "outline" : "primary"}
             href={`/app/circles/${id}${youPaid ? "" : "/pay"}`}>
          {youPaid ? "You have paid — see the pot" : "Pay this month"}
        </Btn>
      </div>
    </Card>
  );
}
