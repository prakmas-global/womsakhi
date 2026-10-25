"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Avatar, Btn, Sheet } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import {
  REPORT_REASONS, apiAddComment, apiComments, apiDeleteComment, apiDeletePost, apiEditPost, apiLikePost,
  apiReportPost, profileHref, type Audience, type FeedComment, type FeedPost,
} from "@/lib/social-api";

/** Tap one instead of typing. */
const QUICK_REPLIES = ["Congratulations! 🎉", "So proud of you ❤️", "Thank you for sharing", "I can help with this", "Following this 👀"];
const LONG = 280;

function AudienceIcon({ a }: { a: Audience }) {
  const I = a === "everyone" ? Icons.Globe : Icons.Users;
  return <I aria-label={a === "everyone" ? "Everyone" : "Only friends"} className="h-3 w-3" />;
}

function Photos({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  const n = Math.min(urls.length, 4);
  const cls = n === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div className={`mt-3 grid gap-1 overflow-hidden rounded-[14px] ${cls}`}>
      {urls.slice(0, 4).map((u, i) => (
        <a key={u + i} href={u} target="_blank" rel="noreferrer"
           className={`block overflow-hidden ${n === 3 && i === 0 ? "row-span-2" : ""}`}
           style={{ background: "var(--ux-surface-2)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" loading="lazy" decoding="async"
               className={`h-full w-full object-cover ${n === 1 ? "max-h-[460px]" : n === 3 && i === 0 ? "aspect-[3/4]" : "aspect-square"}`} />
        </a>
      ))}
    </div>
  );
}

function Comments({ post, onCount }: { post: FeedPost; onCount: (d: number) => void }) {
  const [rows, setRows] = useState<FeedComment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    apiComments(post.id, ctl.signal).then(setRows).catch(() => setRows([]));
    return () => ctl.abort();
  }, [post.id]);

  const send = async (t = text) => {
    const body = t.trim();
    if (!body) return;
    setBusy(true);
    try {
      const c = await apiAddComment(post.id, body);
      setRows((r) => [...(r ?? []), c]);
      setText("");
      onCount(1);
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: FeedComment) => {
    try {
      await apiDeleteComment(c.id);
      setRows((r) => (r ?? []).filter((x) => x.id !== c.id));
      onCount(-1);
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    }
  };

  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--ux-line)" }} data-comments>
      {rows === null && <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Loading comments…</p>}
      <ul className="space-y-2.5">
        {rows?.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <Link href={profileHref(c.author)} className="shrink-0"><Avatar src={c.author.avatar} name={c.author.name} size={32} /></Link>
            <div className="min-w-0 flex-1">
              <div className="inline-block max-w-full rounded-[14px] px-3 py-2" style={{ background: "var(--ux-surface-2)" }}>
                <Link href={profileHref(c.author)} className="block text-xs font-bold" style={{ color: "var(--ux-ink)" }}>{c.author.name}</Link>
                <p className="whitespace-pre-wrap text-xsm [overflow-wrap:anywhere]" style={{ color: "var(--ux-ink-2)" }}>{c.text}</p>
              </div>
              <div className="mt-0.5 flex gap-3 ps-3 text-2xs" style={{ color: "var(--ux-muted)" }}>
                <span>{c.when}</span>
                {c.can_delete && <button type="button" className="font-bold" onClick={() => remove(c)}>Delete</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {QUICK_REPLIES.map((q) => (
          <button key={q} type="button" disabled={busy} onClick={() => send(q)}
                  className="ux-press min-h-[32px] shrink-0 rounded-full border px-3 text-xs font-semibold"
                  style={{ borderColor: "var(--ux-line)", color: "var(--ux-ink-2)", background: "var(--ux-surface)" }}>
            {q}
          </button>
        ))}
      </div>
      <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000}
               aria-label="Write a comment" placeholder="Write a comment…"
               className="min-h-[40px] min-w-0 flex-1 rounded-full border px-4 text-xsm outline-none"
               style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
        <button type="submit" aria-label="Send comment" disabled={busy || !text.trim()}
                className="ux-press grid h-10 w-10 shrink-0 place-items-center rounded-full disabled:opacity-40"
                style={{ background: "var(--ux-brand)", color: "var(--ux-ink-on-brand)" }}>
          <Icons.Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/** One post in the feed, Facebook-style: who, when, for whom; words, photos; like, comment, share. */
export function PostCard({ post: initial, onRemoved }: { post: FeedPost; onRemoved?: (id: string) => void }) {
  const [post, setPost] = useState(initial);
  const [open, setOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const long = post.text.length > LONG;

  const like = async () => {
    const was = post;
    // Optimistic: the heart answers the tap, the server's count settles it.
    setPost((p) => ({ ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }));
    try {
      const s = await apiLikePost(post.id);
      setPost((p) => ({ ...p, liked_by_me: s.liked, like_count: s.like_count }));
    } catch (e) {
      setPost(was);
      toast(apiErrorMessage(e), { tone: "error" });
    }
  };

  const share = async () => {
    const line = `${post.author.name} on WomSakhi: “${post.text.slice(0, 200)}”`;
    try {
      if (navigator.share) await navigator.share({ text: line });
      else { await navigator.clipboard.writeText(line); toast("Copied — paste it anywhere", { tone: "success" }); }
    } catch { /* she closed the share sheet */ }
  };

  const setAudience = async (a: Audience) => {
    setMenu(false);
    try {
      const p = await apiEditPost(post.id, { audience: a });
      setPost(p);
      toast(a === "everyone" ? "Now everyone can see this post" : "Now only your friends can see this post", { tone: "success" });
    } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
  };

  const remove = async () => {
    setMenu(false);
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await apiDeletePost(post.id);
      toast("Post deleted", { tone: "success" });
      onRemoved?.(post.id);
    } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
  };

  const sendReport = async (reason: string) => {
    try {
      const r = await apiReportPost(post.id, reason);
      setReport(false);
      toast(r.message, { tone: "success" });
      onRemoved?.(post.id);
    } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
  };

  return (
    <article className="ux-card" style={{ padding: 16 }} data-post={post.id}>
      <header className="flex items-start gap-3">
        <Link href={profileHref(post.author)} className="shrink-0"><Avatar src={post.author.avatar} name={post.author.name} size={44} /></Link>
        <div className="min-w-0 flex-1">
          <Link href={profileHref(post.author)} className="flex items-center gap-1 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
            <span className="truncate">{post.author.name}</span>
            {post.author.verified && <Icons.BadgeCheck className="h-4 w-4 shrink-0" style={{ color: "var(--ux-blue)" }} />}
          </Link>
          {/* "@priya.sews" only when the name above is not already that. */}
          <p className="flex min-w-0 items-center gap-x-1.5 overflow-hidden whitespace-nowrap text-2xs" style={{ color: "var(--ux-muted)" }}>
            {post.author.username && post.author.username !== post.author.name && <><span className="truncate">@{post.author.username}</span><span aria-hidden>·</span></>}
            <span>{post.when}</span><span aria-hidden>·</span><AudienceIcon a={post.audience} />
            {post.from_circle && <><span aria-hidden>·</span><span className="truncate">from {post.from_circle}</span></>}
          </p>
        </div>
        <div className="relative">
          <button type="button" aria-label="Post options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}
                  className="ux-press grid h-9 w-9 place-items-center rounded-full" style={{ color: "var(--ux-muted)" }}>
            <Icons.MoreHorizontal className="h-5 w-5" />
          </button>
          {menu && (
            <>
              <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
              <div role="menu" className="absolute end-0 top-10 z-20 w-[230px] overflow-hidden rounded-[14px] border py-1 shadow-lg"
                   style={{ background: "var(--ux-surface)", borderColor: "var(--ux-line)" }}>
                {post.mine ? (
                  <>
                    <MenuItem icon={post.audience === "everyone" ? "Users" : "Globe"}
                              onClick={() => setAudience(post.audience === "everyone" ? "friends" : "everyone")}>
                      {post.audience === "everyone" ? "Show only to friends" : "Show to everyone"}
                    </MenuItem>
                    <MenuItem icon="Trash2" danger onClick={remove}>Delete post</MenuItem>
                  </>
                ) : (
                  <MenuItem icon="Flag" onClick={() => { setMenu(false); setReport(true); }}>Report post</MenuItem>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {post.text && (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed [overflow-wrap:anywhere] lg:text-sm" style={{ color: "var(--ux-ink)" }}>
          {long && !more ? `${post.text.slice(0, LONG).trimEnd()}… ` : post.text}
          {long && !more && (
            <button type="button" onClick={() => setMore(true)} className="font-bold" style={{ color: "var(--ux-brand)" }}>See more</button>
          )}
        </p>
      )}
      <Photos urls={post.photos} />

      {(post.like_count > 0 || post.comment_count > 0) && (
        <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--ux-muted)" }}>
          <span className="inline-flex items-center gap-1">
            {post.like_count > 0 && (
              <><span className="grid h-[18px] w-[18px] place-items-center rounded-full" style={{ background: "var(--ux-brand)" }}>
                <Icons.Heart className="h-2.5 w-2.5" style={{ color: "#fff", fill: "#fff" }} />
              </span>{post.like_count}</>
            )}
          </span>
          {post.comment_count > 0 && (
            <button type="button" onClick={() => setOpen(true)}>
              {post.comment_count} {post.comment_count === 1 ? "comment" : "comments"}
            </button>
          )}
        </div>
      )}

      <div className="mt-2 grid grid-cols-3 gap-1 border-t pt-1.5" style={{ borderColor: "var(--ux-line)" }}>
        <Action icon="Heart" on={post.liked_by_me} onClick={like} label={post.liked_by_me ? "Liked" : "Like"} />
        <Action icon="MessageCircle" onClick={() => setOpen((o) => !o)} label="Comment" />
        <Action icon="Share2" onClick={share} label="Share" />
      </div>

      {open && <Comments post={post} onCount={(d) => setPost((p) => ({ ...p, comment_count: Math.max(0, p.comment_count + d) }))} />}

      <Sheet open={report} onClose={() => setReport(false)} title="Report this post" icon="Flag"
             description="Tell us what is wrong. You will not see this post again, and our team will look at it.">
        <div className="grid gap-2">
          {REPORT_REASONS.map((r) => (
            <Btn key={r} variant="outline" full onClick={() => sendReport(r)}>{r}</Btn>
          ))}
        </div>
      </Sheet>
    </article>
  );
}

function Action({ icon, label, on, onClick }: { icon: string; label: string; on?: boolean; onClick: () => void }) {
  const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[icon];
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
            className="ux-press ux-hov flex min-h-[40px] items-center justify-center gap-1.5 rounded-[10px] text-xsm font-semibold"
            style={{ color: on ? "var(--ux-brand)" : "var(--ux-ink-2)" }}>
      <I className="h-[18px] w-[18px]" style={on && icon === "Heart" ? { fill: "var(--ux-brand)" } : undefined} />
      {label}
    </button>
  );
}

function MenuItem({ icon, children, onClick, danger }: { icon: string; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon];
  return (
    <button type="button" role="menuitem" onClick={onClick}
            className="ux-hov flex min-h-[42px] w-full items-center gap-2.5 px-3.5 text-start text-xsm font-semibold"
            style={{ color: danger ? "var(--ux-danger-ink)" : "var(--ux-ink)" }}>
      <I className="h-4 w-4" />{children}
    </button>
  );
}
