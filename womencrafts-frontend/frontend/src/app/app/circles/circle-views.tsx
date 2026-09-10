"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, IconTile, v } from "@/components/ux/kit";
import type { Circle } from "@/lib/community-api";
import { ALL_TOPICS, CIRCLE_ART, members, readPost, topicOf, type Topic } from "@/components/ux/circle/data";

/* ------------------------------------------------------------------ */
/*  The banner, and the box she types her question into                */
/* ------------------------------------------------------------------ */

export function CircleHero({ ask, onAsk, onStart }: {
  ask: string; onAsk: (s: string) => void; onStart: () => void;
}) {
  return (
    <section className="relative mb-4 overflow-hidden rounded-[20px]"
             style={{ background: "linear-gradient(102deg, var(--ux-brand-tint) 0%, var(--ux-tint-lilac) 55%, var(--ux-tint-pink) 100%)",
                      border: "1px solid var(--ux-line)" }}>
      {/*
        Two real columns, not a block with art absolutely positioned over it.
        The absolute version put the ask box behind the artwork at one width
        and the script line across a woman's face at another — the overlap was
        never visible in the file, only on the screen.
      */}
      <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="p-4 sm:p-7">
          {/* `text-4xl` is 36px — a desktop hero's size on a 390px screen,
              where iOS's own large title is 34 and this app's is 30. */}
          <h1 className="ux-screen-title text-[30px] font-extrabold leading-none tracking-[-0.03em] lg:text-4xl"
              style={{ color: v("--ux-ink") }}>
            Circle
          </h1>
          <p className="mt-2 max-w-[400px] text-[15px] leading-snug lg:mt-2.5 lg:text-smd" style={{ color: v("--ux-ink-2") }}>
            A safe, supportive space for women to connect, ask, share and grow — together.
          </p>

          <form className="mt-4 flex max-w-[440px] items-center gap-2 rounded-full py-1.5 pe-1.5 ps-4 lg:mt-5"
                style={{ background: v("--ux-surface"), border: "1px solid var(--ux-line)" }}
                onSubmit={(e) => { e.preventDefault(); onStart(); }}>
            <Icons.Search className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-faint") }} />
            {/*
              16px, and a placeholder short enough to finish. At 13px iOS zooms
              the app in on focus and does not zoom back; and the old placeholder
              — "What would you like to discuss?" — was cut off mid-word by the
              submit button at 390px, so what she actually read was "What would
              you like to disc".
            */}
            <input
              value={ask}
              onChange={(e) => onAsk(e.target.value)}
              aria-label="What would you like to discuss today?"
              placeholder="Ask the circle…"
              inputMode="text" enterKeyHint="go" autoComplete="off"
              className="min-h-[38px] w-full min-w-0 bg-transparent text-[16px] outline-none lg:text-xsm"
              style={{ color: v("--ux-ink") }}
            />
            <button type="submit" aria-label="Start this discussion"
                    className="ux-press ux-sq grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full lg:h-[36px] lg:w-[36px]"
                    style={{ background: "linear-gradient(96deg, var(--ux-fill), var(--ux-fill-2))",
                             color: v("--ux-on-brand") }}>
              <Icons.ArrowRight className="h-[16px] w-[16px] rtl:rotate-180" />
            </button>
          </form>
        </div>

        <div className="relative hidden lg:flex lg:items-end">
          {/*
            A whole scene, not a cut-out.

            The old art here was `scene-women-group-circle` — 700×417 of
            badly-matted cut-out, painted 358px wide, so it carried a white
            halo down every arm and three faces you could not focus on. This
            is a painted rectangle at 900px for a 290px slot, so the mask has
            to do the blending the alpha channel used to do badly: it dissolves
            BOTH edges, so the picture reads as a panel set into the band
            rather than a photograph with a scissored edge.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CIRCLE_ART.hero}
               alt="Five women sitting together in a circle, talking over cups of tea"
               loading="lazy" decoding="async" width={900} height={690}
               className="h-full w-[240px] object-cover object-top xl:w-[290px]"
               style={{ maskImage: "linear-gradient(100deg, transparent 0%, #000 32%, #000 78%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(100deg, transparent 0%, #000 32%, #000 78%, transparent 100%)" }} />
          <p className="hidden w-[152px] self-center pe-6 text-end text-smd font-bold italic leading-[1.35] xl:block"
             style={{ color: v("--ux-brand"), fontFamily: "var(--font-display)" }}>
            Real conversations,<br />brighter tomorrows
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  The topics, as one scrolling row                                   */
/* ------------------------------------------------------------------ */

export function TopicChips({ active, onPick, topics, counts }: {
  active: string; onPick: (label: string) => void;
  /** The topics that actually have circles, busiest first. */
  topics: Topic[];
  counts: Record<string, number>;
}) {
  const all = [{ id: "all", label: ALL_TOPICS, icon: "MessageCircle",
                 tint: "--ux-brand-tint-2", ink: "--ux-brand" } as Topic, ...topics];
  return (
    /* Bleeding to both screen edges is what tells a thumb the row keeps
       going; before, it stopped at the content margin and the last tile
       looked clipped rather than continued. */
    <div className="ux-noscroll -mx-[20px] mb-5 flex gap-2.5 overflow-x-auto px-[20px] pb-1 lg:mx-0 lg:px-0">
      {all.map((t) => {
        const on = active === t.label;
        return (
          <button key={t.id} type="button" onClick={() => onPick(t.label)} aria-pressed={on}
                  className="ux-press ux-sq flex min-h-[44px] min-w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-[14px] px-3.5 py-3"
                  style={{ background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                           border: `1px solid ${v(on ? "--ux-brand" : "--ux-line")}` }}>
            <IconTile icon={t.icon} tint={t.tint} ink={t.ink} size={32} radius={9} />
            <span className="whitespace-nowrap text-[12px] lg:text-2xs font-bold" style={{ color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
              {t.label}
            </span>
            {counts[t.label] !== undefined && (
              <span className="text-[12px] lg:text-3xs font-semibold" style={{ color: v("--ux-faint") }}>
                {counts[t.label]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  What everyone is reading                                           */
/* ------------------------------------------------------------------ */

export interface Trend {
  id: string; title: string; topic: Topic; replies: number; likes: number;
  faces: string[]; href: string;
}

export function Trending({ rows }: { rows: Trend[] }) {
  return (
    <Card className="mb-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-lg font-extrabold tracking-[-0.01em]"
            style={{ color: v("--ux-ink") }}>
          <I name="Flame" className="h-[19px] w-[19px]" style={{ color: v("--ux-orange-ink") }} />
          Trending discussions
        </h2>
        <Link href="/app/circles" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          See all <Icons.ArrowRight className="h-[13px] w-[13px]" />
        </Link>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {rows.map((r) => (
          <Link key={r.id} href={r.href} className="ux-hov ux-sq flex flex-col rounded-[14px] p-4"
                style={{ background: v(r.topic.tint) }}>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] lg:text-3xs font-extrabold"
                  style={{ background: v("--ux-surface"), color: v(r.topic.ink) }}>
              <I name={r.topic.icon} className="h-[11px] w-[11px]" />
              {r.topic.label}
            </span>
            <p className="mt-3 flex-1 text-smd font-extrabold leading-snug" style={{ color: v("--ux-ink") }}>
              {r.title}
            </p>
            <span className="mt-3.5 flex items-center gap-2">
              <Faces srcs={r.faces} />
              <span className="text-[12px] lg:text-2xs font-semibold" style={{ color: v("--ux-muted") }}>
                {r.replies} {r.replies === 1 ? "reply" : "replies"}
              </span>
              <span className="ms-auto flex items-center gap-1 text-[12px] lg:text-2xs font-extrabold"
                    style={{ color: v("--ux-pink-ink") }}>
                <Icons.Heart className="h-[13px] w-[13px]" />{r.likes}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

/** Overlapping avatars. Falls back to an initial when there is no photo. */
export function Faces({ srcs, size = 24 }: { srcs: string[]; size?: number }) {
  return (
    <span className="flex shrink-0 items-center">
      {srcs.slice(0, 3).map((s, i) => (
        <span key={i} className="grid shrink-0 place-items-center overflow-hidden rounded-full text-[12px] lg:text-3xs font-bold"
              style={{ width: size, height: size, marginInlineStart: i ? -8 : 0,
                       border: `2px solid ${v("--ux-surface")}`,
                       background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s ? <img src={s} alt="" aria-hidden loading="lazy" decoding="async"
                    className="h-full w-full object-cover" /> : "·"}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  One discussion in the feed                                         */
/* ------------------------------------------------------------------ */

export interface FeedPost {
  id: string;
  author: string;
  avatar: string;
  when: string;
  body: string;
  topic: Topic;
  likes: number;
  liked: boolean;
  replies: number;
  mine: boolean;
  href: string;
}

export function PostCard({ p, saved, onLike, onSave, onShare, busy }: {
  p: FeedPost; saved: boolean; busy: boolean;
  onLike: (p: FeedPost) => void;
  onSave: (p: FeedPost) => void;
  onShare: (p: FeedPost) => void;
}) {
  const { title, rest, tags } = readPost(p.body);
  return (
    <Card className="mb-3.5">
      <div className="flex items-start gap-3">
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center overflow-hidden rounded-full text-xs font-bold"
              style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.avatar ? <img src={p.avatar} alt="" aria-hidden loading="lazy" decoding="async"
                           className="h-full w-full object-cover" />
                    : p.author.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>{p.author}</b>
            <span className="text-[12px] lg:text-2xs" style={{ color: v("--ux-muted") }}>{p.when}</span>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[12px] lg:text-3xs font-extrabold"
                  style={{ background: v(p.topic.tint), color: v(p.topic.ink) }}>
              <I name={p.topic.icon} className="h-[10px] w-[10px]" />
              {p.topic.label}
            </span>
          </p>

          {title && (
            <Link href={p.href} className="ux-sq mt-2 block text-smd font-extrabold leading-snug"
                  style={{ color: v("--ux-ink") }}>
              {title}
            </Link>
          )}
          {rest && (
            <p className="mt-1.5 whitespace-pre-line text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {rest}
            </p>
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
            <Act icon="MessageCircle" label={String(p.replies)} href={p.href} />
            <Act icon={p.liked ? "Heart" : "Heart"} label={String(p.likes)}
                 on={p.liked} tone="--ux-pink-ink" disabled={busy}
                 onClick={() => onLike(p)} />
            <Act icon="Bookmark" label="Save" on={saved} tone="--ux-brand"
                 onClick={() => onSave(p)} />
            <Act icon="Share2" label="Share" onClick={() => onShare(p)} />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Act({ icon, label, onClick, href, on, tone = "--ux-muted", disabled }: {
  icon: string; label: string; onClick?: () => void; href?: string;
  on?: boolean; tone?: string; disabled?: boolean;
}) {
  const cls = "ux-press ux-sq flex min-h-[36px] items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-semibold";
  const style = { color: v(on ? tone : "--ux-muted") };
  const inner = (
    <>
      <I name={icon} className="h-[15px] w-[15px]" sw={on ? 2.6 : 1.9} />
      {label}
    </>
  );
  if (href) return <Link href={href} className={cls} style={style}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
            className={cls} style={{ ...style, opacity: disabled ? 0.6 : 1 }}>
      {inner}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: her own numbers                                              */
/* ------------------------------------------------------------------ */

export function MyCircle({ posts, likes, saved }: {
  posts: number; likes: number; saved: number;
}) {
  const cells = [
    { n: posts, label: "My posts",      icon: "Users",    tint: "--ux-brand-tint-2", ink: "--ux-brand" },
    { n: likes, label: "Likes received", icon: "Heart",   tint: "--ux-tint-pink",    ink: "--ux-pink-ink" },
    { n: saved, label: "Saved posts",   icon: "Bookmark", tint: "--ux-tint-blue",    ink: "--ux-blue-ink" },
  ];
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>My circle</h2>
        <Link href="/app/circles" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          View all <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cells.map((c) => (
          <div key={c.label} className="rounded-[12px] px-2 py-3 text-center"
               style={{ border: "1px solid var(--ux-line)" }}>
            <span className="mx-auto block w-fit"><IconTile icon={c.icon} tint={c.tint} ink={c.ink} size={28} radius={8} /></span>
            <b className="mt-2 block text-lg font-extrabold leading-none" style={{ color: v("--ux-ink") }}>{c.n}</b>
            <span className="mt-1 block text-[12px] lg:text-3xs font-semibold leading-tight" style={{ color: v("--ux-muted") }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: circles to join                                              */
/* ------------------------------------------------------------------ */

export function PopularGroups({ rows, busy, onJoin }: {
  rows: Circle[]; busy: string | null; onJoin: (c: Circle) => void;
}) {
  // "Popular circles" above five she is already in is a dead panel. When there
  // is nothing left to discover, the card says what it is actually showing.
  const anyOpen = rows.some((c) => !c.joined);
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>
          {anyOpen ? "Circles to join" : "Your circles"}
        </h2>
        <Link href="/app/circles" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          View all <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </Link>
      </div>
      <div className="space-y-2.5">
        {rows.map((c) => {
          const t = topicOf(c.topic);
          return (
            <div key={c.id} className="flex items-center gap-2.5">
              <Link href={`/app/circles/${c.id}`} className="ux-sq shrink-0">
                <span className="grid h-[40px] w-[40px] place-items-center overflow-hidden rounded-[11px]"
                      style={{ background: v(t.tint) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.cover ? <img src={c.cover} alt="" aria-hidden loading="lazy" decoding="async"
                                  className="h-full w-full object-cover" />
                           : <I name={t.icon} className="h-[17px] w-[17px]" style={{ color: v(t.ink) }} />}
                </span>
              </Link>
              <Link href={`/app/circles/${c.id}`} className="ux-sq min-w-0 flex-1">
                <span className="block truncate text-xsm font-bold" style={{ color: v("--ux-ink") }}>{c.name}</span>
                <span className="mt-0.5 block text-[12px] lg:text-2xs" style={{ color: v("--ux-muted") }}>
                  {members(c.member_count)} {c.member_count === 1 ? "member" : "members"}
                </span>
              </Link>
              <Btn size="sm" variant={c.joined ? "outline" : "soft"} disabled={busy === c.id}
                   onClick={() => onJoin(c)}>
                {c.joined ? "Open" : "Join"}
              </Btn>
            </div>
          );
        })}
      </div>
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

export function UpcomingEvents({ rows, busy, onGo }: {
  rows: RailEvent[]; busy: string | null; onGo: (e: RailEvent) => void;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>Coming up</h2>
        <Link href="/app/events" className="ux-sq -me-2 flex min-h-[36px] items-center gap-0.5 rounded-[10px] px-2 text-xs font-bold"
              style={{ color: v("--ux-brand") }}>
          View all <Icons.ArrowRight className="h-[12px] w-[12px]" />
        </Link>
      </div>
      <div className="space-y-3.5">
        {rows.map((e) => (
          <div key={e.id} className="flex items-start gap-3">
            <span className="grid w-[46px] shrink-0 place-items-center rounded-[11px] py-1.5"
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
                  {e.going ? "You are going — open it" : "Register"}
                </Btn>
              </span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Rail: the line at the bottom                                       */
/* ------------------------------------------------------------------ */

export function CircleQuote() {
  return (
    <figure className="relative overflow-hidden rounded-[16px] p-[18px]"
            style={{ background: "linear-gradient(150deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
      <I name="Quote" className="h-[18px] w-[18px]" style={{ color: v("--ux-brand") }} />
      <blockquote className="mt-2 text-smd font-bold leading-snug" style={{ color: v("--ux-ink") }}>
        When women support each other, incredible things happen.
      </blockquote>
      <figcaption className="mt-2 flex items-center gap-1.5 text-[12px] lg:text-2xs font-semibold" style={{ color: v("--ux-muted") }}>
        — WomSakhi <Icons.Heart className="h-[11px] w-[11px]" style={{ color: v("--ux-pink-ink") }} />
      </figcaption>
    </figure>
  );
}
