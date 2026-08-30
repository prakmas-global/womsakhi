"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";

import { I, IconTile } from "./kit";
import { SEARCH_INDEX, SEARCH_SUGGESTED, type SearchHit } from "./home/data";
import { useDevicePref } from "@/lib/use-device-pref";
import { useSearch } from "./growth";

/**
 * The search that opens over the page.
 *
 * Everything here is keyboard-first: ⌘K / Ctrl+K opens it, arrows move,
 * Enter goes, Escape closes. A search you can only use with a mouse is a
 * search most people give up on.
 *
 * ── Why this asks the server ───────────────────────────────────────────
 * This palette is mounted on every signed-in screen, and until now it filtered
 * `SEARCH_INDEX` — eighteen rows written by hand months ago. `/app/search`
 * asks the server. So the same words typed in the two places answered
 * differently, and the palette was the one people reached first: it confidently
 * offered "Neha Verma" to a woman whose city has no Neha Verma, and found
 * nothing for the job posted this morning. Both now go through `useSearch`,
 * which is one request against `/search` — one index, one answer.
 */

/**
 * Ranks `SEARCH_INDEX` — the fixture the palette no longer uses.
 *
 * Kept only because `src/app/app/search/page.tsx` still names it in an import
 * it never calls. Delete that import and this function and `SEARCH_INDEX` can
 * both go; nothing else refers to either.
 */
export function matchHits(q: string): SearchHit[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  const words = t.split(/\s+/);
  return SEARCH_INDEX.map((h) => {
    const hay = `${h.title} ${h.sub} ${h.kind}`.toLowerCase();
    // Every word must appear, so "digital jaipur" doesn't match on "digital" alone.
    if (!words.every((w) => hay.includes(w))) return null;
    const title = h.title.toLowerCase();
    // Rank: title prefix beats title match beats a hit anywhere else.
    const score = title.startsWith(t) ? 0 : title.includes(t) ? 1 : 2;
    return { h, score };
  })
    .filter((x): x is { h: SearchHit; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.h);
}

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [recent, setRecent] = useDevicePref<string[]>("search.recent", []);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // `document` only exists after mount, and the first render is on the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const typed = q.trim();
  /**
   * The query, a beat after she stops typing.
   *
   * Filtering a constant cost nothing, so every keystroke did it. A request
   * costs something, and "digital marketing" typed at speed is seventeen
   * answers to questions she was still in the middle of asking. 180ms sits
   * under the ~250ms that starts to read as lag, and lands roughly one
   * request per word.
   */
  const settled = useDebounced(typed, 180);
  // A closed palette has no question worth a round trip.
  const { data: hits, source, error } = useSearch(open ? settled : "");

  const showing = typed.length > 0;
  // She has typed since the last answer arrived, so nothing on screen answers
  // what is in the box yet.
  const waiting = showing && (settled !== typed || source === "loading");
  // `useSearch` itself will not ask the server below two characters.
  const tooShort = showing && !waiting && settled.length < 2;
  // `useResource` answers a failed request with its fallback — here, an empty
  // list. Rendering that as "nothing matched" would tell her the search
  // succeeded and found nothing, when it never reached us at all.
  const failed = showing && !waiting && error !== null;

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSel(0);
    // A frame's delay: the element has to exist before it can take focus.
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open]);

  useEffect(() => setSel(0), [q]);

  /**
   * Remember what she searched for, newest first, five at most.
   *
   * Written when she acts on a result, not on every keystroke — a half-typed
   * word is not a search she made.
   */
  const remember = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setRecent([t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 5));
  }, [recent, setRecent]);

  const go = useCallback((href: string) => {
    remember(typed);
    onClose();
    router.push(href);
  }, [onClose, router, remember, typed]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (!showing) {
      if (e.key === "Enter" && q.trim()) { e.preventDefault(); go(`/app/search?q=${encodeURIComponent(q.trim())}`); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      // The last row is always "see all results", so index === length means that row.
      if (sel === hits.length || !hits.length) go(`/app/search?q=${encodeURIComponent(q.trim())}`);
      else go(hits[sel].href);
    }
  };

  // Keep the highlighted row inside the scroll box.
  useEffect(() => {
    listRef.current?.querySelector('[data-sel="1"]')?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  if (!open || !mounted) return null;

  /**
   * Rendered into <body>, not where it is written.
   *
   * The topbar carries a backdrop-filter, and an ancestor with one becomes the
   * containing block for `position: fixed` descendants — so the full-screen
   * scrim resolved against the topbar's 1536x75 box and dimmed only the strip
   * behind it, leaving the page underneath at full brightness with the palette
   * floating on top of it.
   */
  return createPortal(
    <div
      className="ux fixed inset-0 z-[120] flex justify-center px-4 pt-[12vh]"
      style={{ background: "var(--ux-scrim)", backdropFilter: "blur(6px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search WomSakhi"
        className="ux-sheet ux-slide-up relative h-fit w-full max-w-[640px] overflow-hidden rounded-[20px]"
        onKeyDown={onKey}
      >
        <div className="flex items-center gap-3 border-b px-4" style={{ borderColor: "var(--ux-line)", height: 56 }}>
          <Icons.Search className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-faint)" }} strokeWidth={2} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses, work, mentors, circles…"
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none"
            style={{ color: "var(--ux-ink)" }}
          />
          <button
            onClick={onClose}
            aria-label="Close search"
            className="ux-press grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px]"
            style={{ background: "var(--ux-surface-2)" }}
          >
            <Icons.X className="h-4 w-4" style={{ color: "var(--ux-muted)" }} />
          </button>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {!showing && (
            <>
              <Section title="Try searching for" />
              <div className="flex flex-wrap gap-2 px-2 pb-3">
                {SEARCH_SUGGESTED.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQ(s)}
                    className="ux-press ux-clay rounded-full px-3.5 py-[7px] text-[12.5px] font-medium"
                    style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {/* Her own recent searches, kept on this device.
                  This was a constant — "Tailoring orders", "Neha Verma",
                  "Mudra loan" — shown as her history to a woman who had never
                  searched anything, and one of the three was the name of a
                  mentor who does not exist. Recent searches belong to a device
                  rather than an account: the shared computer at a centre must
                  not show one woman's searches to the next. */}
              {recent.length > 0 && <Section title="Recent" />}
              {recent.map((s) => (
                <button
                  key={s}
                  onClick={() => setQ(s)}
                  className="ux-hov flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-start transition-colors hover:bg-[var(--ux-surface-2)]"
                >
                  <Icons.Clock className="ux-ico h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                  <span className="text-[13px]" style={{ color: "var(--ux-ink-2)" }}>{s}</span>
                </button>
              ))}
            </>
          )}

          {waiting && (
            <div className="flex items-center gap-2.5 px-2.5 py-4" aria-live="polite">
              <Icons.LoaderCircle className="h-[15px] w-[15px] shrink-0 animate-spin"
                                  style={{ color: "var(--ux-faint)" }} />
              <span className="text-[13px]" style={{ color: "var(--ux-muted)" }}>Searching…</span>
            </div>
          )}

          {tooShort && (
            <p className="px-2.5 py-4 text-[13px]" style={{ color: "var(--ux-muted)" }}>
              Keep typing — two letters or more.
            </p>
          )}

          {failed && (
            <div className="flex flex-col items-center px-6 py-8 text-center" aria-live="polite">
              <Icons.CloudOff className="h-[26px] w-[26px]" style={{ color: "var(--ux-faint)" }} />
              <p className="mt-3 text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                Search did not reach us
              </p>
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
                This is us, not your spelling. Try again in a moment.
              </p>
            </div>
          )}

          {showing && !waiting && !tooShort && !failed && hits.length === 0 && (
            <div className="flex flex-col items-center px-6 py-8 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ux/art/empty-magnifying-glass-blank-page.webp" alt="" className="h-[92px] w-[92px] object-contain" />
              <p className="mt-3 text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                {/* `settled`, not `q` — this names the words actually searched. */}
                Nothing matched “{settled}”
              </p>
              <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--ux-muted)" }}>
                Try a shorter word, or ask Sakhi — she can look for you.
              </p>
            </div>
          )}

          {showing && !waiting && !failed && hits.length > 0 && (
            <>
              {hits.map((h, i) => (
                <button
                  key={h.id}
                  data-sel={i === sel ? "1" : undefined}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(h.href)}
                  className="ux-hov flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-start"
                  style={{ background: i === sel ? "var(--ux-surface-2)" : "transparent" }}
                >
                  {h.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.img} alt="" className="h-[38px] w-[38px] shrink-0 rounded-[9px] object-cover"
                         style={{ background: `var(${h.tint})` }} />
                  ) : (
                    <IconTile icon={h.icon} tint={h.tint} ink={h.ink} size={38} radius={9} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                      {h.title}
                    </span>
                    <span className="block truncate text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{h.sub}</span>
                  </span>
                  <span className="shrink-0 rounded-full px-2 py-[3px] text-[10.5px] font-semibold"
                        style={{ background: `var(${h.tint})`, color: `var(${h.ink}-ink)` }}>
                    {h.kind}
                  </span>
                  {i === sel && (
                    <Icons.CornerDownLeft className="ux-pop h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-faint)" }} />
                  )}
                </button>
              ))}
              <button
                data-sel={sel === hits.length ? "1" : undefined}
                onMouseEnter={() => setSel(hits.length)}
                onClick={() => go(`/app/search?q=${encodeURIComponent(q.trim())}`)}
                className="ux-hov mt-1 flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2.5 text-[12.5px] font-semibold"
                style={{ background: sel === hits.length ? "var(--ux-surface-2)" : "transparent", color: "var(--ux-brand)" }}
              >
                <I name="ListFilter" className="ux-ico h-[15px] w-[15px]" />
                See all {hits.length} result{hits.length === 1 ? "" : "s"} for “{q.trim()}”
                <Icons.ArrowRight className="ux-arrow ms-auto h-[15px] w-[15px]" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 border-t px-4 py-2.5" style={{ borderColor: "var(--ux-line)" }}>
          {[["↑ ↓", "move"], ["↵", "open"], ["esc", "close"]].map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ux-faint)" }}>
              <kbd className="rounded-[5px] border px-1.5 py-[1px] font-sans text-[10.5px]"
                   style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}>{k}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title }: { title: string }) {
  return (
    <p className="px-2.5 pb-1.5 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.07em]"
       style={{ color: "var(--ux-faint)" }}>
      {title}
    </p>
  );
}

/**
 * `value`, but only once it has held still for `ms`.
 *
 * The timer is cleared and restarted on every change, so a burst of keystrokes
 * produces exactly one settled value at the end of it rather than one per key.
 */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/** Opens the palette on ⌘K / Ctrl+K anywhere in the app. */
export function useSearchHotkey(onOpen: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpen(); }
      else if (e.key === "/" && !isTyping(e.target)) { e.preventDefault(); onOpen(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onOpen]);
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}
