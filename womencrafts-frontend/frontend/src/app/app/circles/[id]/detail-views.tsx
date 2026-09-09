"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, I, IconTile, v } from "@/components/ux/kit";
import type { ApiCircleDetail, ApiCircleMember } from "@/lib/growth-api";
import { members as niceCount, readPost, topicOf } from "@/components/ux/circle/data";

/* ------------------------------------------------------------------ */
/*  The banner                                                         */
/* ------------------------------------------------------------------ */

export function CircleBanner({ c, posts, onInvite }: {
  c: ApiCircleDetail;
  /** How many posts actually came back. The circle's own `post_count` is
   *  stale on the server — it said 5 above a feed of 26 — and a number the
   *  reader can disprove by scrolling is worse than no number. */
  posts: number;
  onInvite: () => void;
}) {
  const shownPosts = Math.max(posts, c.post_count);
  const t = topicOf(c.topic);
  return (
    <section className="relative mb-4 overflow-hidden rounded-[20px]"
             style={{ background: "linear-gradient(102deg, var(--ux-brand-tint) 0%, var(--ux-tint-lilac) 62%, var(--ux-tint-pink) 100%)",
                      border: "1px solid var(--ux-line)" }}>
      <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-start gap-4 p-6 sm:p-7">
          {/* The circle's own square, the way it appears everywhere else. */}
          <span className="grid h-[64px] w-[64px] shrink-0 place-items-center overflow-hidden rounded-[18px]"
                style={{ background: "linear-gradient(140deg, var(--ux-fill), var(--ux-fill-2))",
                         color: v("--ux-on-brand") }}>
            <I name={c.is_private ? "Lock" : t.icon} className="h-[27px] w-[27px]" sw={2} />
          </span>

          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold leading-tight tracking-[-0.02em]" style={{ color: v("--ux-ink") }}>
              {c.name}
            </h1>
            {c.desc && (
              <p className="mt-2 max-w-[460px] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                {c.desc}
              </p>
            )}

            <p className="mt-3 flex flex-wrap gap-1.5">
              <Tag>{t.label}</Tag>
              {c.is_savings && <Tag>Savings circle</Tag>}
              <Tag>{c.is_private ? "Members only" : "Anyone can join"}</Tag>
            </p>

            <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold"
               style={{ color: v("--ux-ink-2") }}>
              <Meta icon="Users">{niceCount(c.member_count)} {c.member_count === 1 ? "member" : "members"}</Meta>
              <Meta icon="FileText">{shownPosts} {shownPosts === 1 ? "post" : "posts"}</Meta>
              <Meta icon={c.is_private ? "Lock" : "Globe"}>
                {c.is_private ? "Private circle" : "Open to all women"}
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
            // No cover: her own words, set the way the banner's script line is.
            <p className="flex h-full w-[240px] items-center justify-end pe-7 text-end text-lg font-bold italic leading-[1.3] xl:w-[300px]"
               style={{ color: v("--ux-brand"), fontFamily: "var(--font-display)" }}>
              Learn.<br />Share.<br />Grow together.
            </p>
          )}
          {c.cover && (
            <button type="button" onClick={onInvite}
                    className="ux-press ux-sq absolute end-5 top-5 rounded-full px-3 py-1.5 text-2xs font-bold"
                    style={{ background: v("--ux-surface"), color: v("--ux-brand") }}>
              Share this circle
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-2xs font-semibold"
          style={{ background: v("--ux-surface"), color: v("--ux-ink-2") }}>
      {children}
    </span>
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
/*  Join, invite, and the way out                                      */
/* ------------------------------------------------------------------ */

export function CircleActions({ joined, busy, onJoin, onLeave, onInvite, menuOpen, onMenu }: {
  joined: boolean; busy: boolean; menuOpen: boolean;
  onJoin: () => void; onLeave: () => void; onInvite: () => void; onMenu: (b: boolean) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <Btn variant="outline" icon="UserPlus" onClick={onInvite}>Invite</Btn>

      {joined ? (
        <div className="relative">
          <Btn icon="Check" iconEnd={menuOpen ? "ChevronUp" : "ChevronDown"}
               disabled={busy} onClick={() => onMenu(!menuOpen)}>
            Joined
          </Btn>
          {menuOpen && (
            /* Leaving is one press behind a menu on purpose: it is easy to do
               by accident from a list, and hard to undo in a private circle. */
            <div className="absolute end-0 top-[calc(100%+6px)] z-[var(--ux-z-dropdown)] w-[220px] overflow-hidden rounded-[12px]"
                 style={{ background: v("--ux-surface"), border: "1px solid var(--ux-line)",
                          boxShadow: "var(--ux-shadow-pop)" }}>
              <button type="button" onClick={onLeave} disabled={busy}
                      className="ux-hov ux-sq flex w-full items-center gap-2.5 px-4 py-3 text-start text-xsm font-semibold"
                      style={{ color: v("--ux-danger-solid") }}>
                <Icons.LogOut className="h-[15px] w-[15px]" />
                Leave this circle
              </button>
            </div>
          )}
        </div>
      ) : (
        <Btn icon="Plus" disabled={busy} onClick={onJoin}>Join this circle</Btn>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Saying something                                                   */
/* ------------------------------------------------------------------ */

export const COMPOSER_EXTRAS = [
  { id: "photo",    icon: "ImagePlus",  label: "Photo",     soon: "Photos in a post are on the way. For now, describe it — women here answer words." },
  { id: "poll",     icon: "BarChart3",  label: "Poll",      soon: "Polls are on the way. For now, ask the question and count the replies." },
  { id: "event",    icon: "CalendarDays", label: "Event",   soon: "Events live under Events for now, not inside a circle." },
  { id: "file",     icon: "Paperclip",  label: "File",      soon: "Attachments are on the way." },
  { id: "question", icon: "HelpCircle", label: "Ask a question", soon: "" },
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

export function CirclePostCard({ p, saved, busy, onLike, onSave, onShare }: {
  p: CircleFeedPost; saved: boolean; busy: boolean;
  onLike: (p: CircleFeedPost) => void;
  onSave: (p: CircleFeedPost) => void;
  onShare: (p: CircleFeedPost) => void;
}) {
  const { title, rest, tags } = readPost(p.body);
  return (
    <Card className="mb-3.5">
      <div className="flex items-start gap-3">
        <span className="grid h-[40px] w-[40px] shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold"
              style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.avatar ? <img src={p.avatar} alt="" aria-hidden loading="lazy" decoding="async"
                           className="h-full w-full object-cover" />
                    : p.author.slice(0, 1).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>{p.author}</b>
            <span className="text-2xs" style={{ color: v("--ux-muted") }}>{p.when}</span>
            {p.pinned && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-3xs font-extrabold"
                    style={{ background: v("--ux-tint-amber"), color: v("--ux-amber-ink") }}>
                <Icons.Pin className="h-[10px] w-[10px]" /> Pinned
              </span>
            )}
            {p.kind && (
              <span className="rounded-full px-2 py-[3px] text-3xs font-extrabold"
                    style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                {p.kind}
              </span>
            )}
          </p>

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
                 className="mt-3 max-h-[300px] w-full rounded-[12px] object-cover"
                 style={{ background: v("--ux-media-bed") }} />
          )}

          {tags.length > 0 && (
            <p className="mt-2.5 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full px-2.5 py-1 text-3xs font-semibold"
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

export function AboutCircle({ c, posts }: { c: ApiCircleDetail; posts: number }) {
  const t = topicOf(c.topic);
  const facts = [
    { k: "What it is about", val: t.label,                                    icon: "Tag",       tint: "--ux-brand-tint-2", ink: "--ux-brand" },
    { k: "Who can come in",  val: c.is_private ? "Members only" : "Anyone",   icon: "Lock",      tint: "--ux-tint-violet",  ink: "--ux-violet-ink" },
    { k: "Members",          val: niceCount(c.member_count),                  icon: "Users",     tint: "--ux-tint-blue",    ink: "--ux-blue-ink" },
    { k: "Posts",            val: String(Math.max(posts, c.post_count)),      icon: "FileText",  tint: "--ux-tint-green",   ink: "--ux-green-ink" },
  ];
  return (
    <Card>
      <h2 className="mb-2.5 text-base font-extrabold" style={{ color: v("--ux-ink") }}>About this circle</h2>
      {c.desc && (
        <p className="text-xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>{c.desc}</p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {facts.map((f) => (
          <div key={f.k} className="rounded-[12px] p-2.5" style={{ border: "1px solid var(--ux-line)" }}>
            <IconTile icon={f.icon} tint={f.tint} ink={f.ink} size={28} radius={8} />
            <span className="mt-2 block text-3xs font-semibold" style={{ color: v("--ux-muted") }}>{f.k}</span>
            <b className="mt-0.5 block truncate text-xs font-bold" style={{ color: v("--ux-ink") }}>{f.val}</b>
          </div>
        ))}
      </div>
      {c.guidelines && (
        <div className="mt-4 rounded-[12px] p-3.5" style={{ background: v("--ux-surface-2") }}>
          <p className="flex items-center gap-1.5 text-2xs font-extrabold" style={{ color: v("--ux-ink") }}>
            <Icons.ShieldCheck className="h-[13px] w-[13px]" style={{ color: v("--ux-green-ink") }} />
            The one rule here
          </p>
          <p className="mt-1 text-2xs leading-relaxed" style={{ color: v("--ux-ink-2") }}>{c.guidelines}</p>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: who is in it                                                 */
/* ------------------------------------------------------------------ */

export function MembersCard({ count, people }: { count: number; people: ApiCircleMember[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>
          Members ({niceCount(count)})
        </h2>
      </div>

      {people.length > 0 ? (
        <>
          <div className="flex items-center">
            {people.slice(0, 6).map((m, i) => (
              <span key={m.name} title={m.name}
                    className="grid h-[34px] w-[34px] shrink-0 place-items-center overflow-hidden rounded-full text-2xs font-bold"
                    style={{ marginInlineStart: i ? -10 : 0, border: `2px solid ${v("--ux-surface")}`,
                             background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.avatar ? <img src={m.avatar} alt="" aria-hidden loading="lazy" decoding="async"
                                 className="h-full w-full object-cover" />
                          : m.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
            {count > people.length && (
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                    style={{ marginInlineStart: -10, border: `2px solid ${v("--ux-surface")}`,
                             background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                +{niceCount(count - people.length)}
              </span>
            )}
          </div>
          <p className="mt-2.5 text-2xs" style={{ color: v("--ux-muted") }}>
            {people.slice(0, 2).map((m) => m.name.split(" ")[0]).join(", ")}
            {count > 2 ? ` and ${niceCount(count - 2)} more` : ""}
          </p>
        </>
      ) : (
        /* The server sends a count but no list for a circle that is not a
           savings circle. Six invented faces would be a lie about who is in
           the room, so it says the number and stops. */
        <p className="text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
          {niceCount(count)} women are in this circle. Their names are theirs to share —
          you will see them as they post.
        </p>
      )}
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
          <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>
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

export function CircleEventsRail() {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>Events</h2>
        <Link href="/app/events" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          All events <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </Link>
      </div>
      {/* Events belong to WomSakhi, not to a circle — showing the whole
          programme here would claim this circle is running it. */}
      <p className="text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
        This circle has no meets of its own yet. Workshops and melas open to everyone are
        under Events.
      </p>
    </Card>
  );
}
