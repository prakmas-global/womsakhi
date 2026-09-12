"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import { apiSearch, type ApiSearchAnswer, type ApiSearchHit } from "@/lib/me-api";
import { searchPages } from "./nav-search";
import { useTheme } from "@/context/ThemeContext";
import { useT } from "@/i18n";
import { useNotifications } from "@/components/ux/live";
import { useToast } from "@/design-system/feedback/ToastProvider";
import { SPEECH_UNSUPPORTED, speechFailure, speechSupported, type SpeechFailure } from "@/lib/speech";

/**
 * The search that opens over the page.
 *
 * ── Hers first ─────────────────────────────────────────────────────────────
 * Results come back in three lists — what is hers, what she can do, and the
 * shared catalogue — and they are shown in that order. Before this, `/search`
 * only ever looked at the catalogue: typing the name of the woman who had just
 * ordered from her returned nothing, and a box that answers "nothing" to a
 * real question is one people stop opening.
 *
 * ── Typed scopes ───────────────────────────────────────────────────────────
 * A leading `/ @ ₹ # >` narrows the list without reaching for the mouse.
 * Cheaper than a menu, and visible in the rail so nobody has to be told.
 *
 * ── Keyboard-first ─────────────────────────────────────────────────────────
 * ⌘K opens, arrows move, Enter goes, Tab cycles the scope, Escape closes.
 * A search only usable with a mouse is one most people give up on.
 */

type Group = "mine" | "do" | "app";

const GROUP_NAME: Record<Group, string> = {
  mine: "Yours",
  do: "Do something",
  app: "On WomSakhi",
};

/** Icon and colour per kind. The server names the kind; the look lives here. */
const LOOK: Record<string, { icon: string; tint: string; ink: string }> = {
  person:      { icon: "UserRound",     tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  booking:     { icon: "CalendarCheck", tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  doc:         { icon: "FileText",      tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  certificate: { icon: "Award",         tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  enrolment:   { icon: "GraduationCap", tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  money:       { icon: "Wallet",        tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  work:        { icon: "Briefcase",     tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  course:      { icon: "GraduationCap", tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  mentor:      { icon: "UserRoundCheck",tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  event:       { icon: "CalendarDays",  tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  service:     { icon: "Sparkles",      tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  scheme:      { icon: "Landmark",      tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  health:      { icon: "HeartPulse",    tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  right:       { icon: "Scale",         tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
  cover:       { icon: "ShieldCheck",   tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
  do:          { icon: "Zap",           tint: "--ux-tint-pink",   ink: "--ux-pink-ink" },
};
const look = (k: string) => LOOK[k] ?? { icon: "Circle", tint: "--ux-tint-violet", ink: "--ux-violet-ink" };

/**
 * The colour of a figure follows its direction, not its kind.
 *
 * Every money row took the "money" green, so "−₹500 DEBIT" — a payment going
 * out of her wallet — was painted in the same colour as money arriving. On a
 * screen she scans rather than reads, that is the one thing the colour is
 * there to tell her, and it was telling her the opposite.
 */
const amountInk = (h: ApiSearchHit) =>
  h.amount.startsWith("+") ? "--ux-green-ink"
  : h.amount.startsWith("\u2212") || h.amount.startsWith("-") ? "--ux-ink-2"
  : "--ux-ink";

/** A leading character is a scope. */
const PREFIX: Record<string, string> = {
  "/": "mine", "@": "people", "₹": "money", "#": "circle", ">": "do",
};
const SCOPES = [
  { id: "all",    label: "Everything", key: "" },
  { id: "mine",   label: "Yours",      key: "/" },
  { id: "people", label: "People",     key: "@" },
  { id: "money",  label: "Money",      key: "₹" },
  { id: "circle", label: "Circles",    key: "#" },
  { id: "do",     label: "Do something", key: ">" },
] as const;

const inScope = (h: ApiSearchHit, scope: string) => {
  switch (scope) {
    case "mine":   return h.group === "mine";
    case "people": return h.kind === "person" || h.kind === "mentor";
    case "money":  return h.kind === "money" || h.kind === "scheme" || !!h.amount;
    case "circle": return h.kind === "person" && h.tag.toLowerCase() === "circle";
    case "do":     return h.group === "do";
    default:       return true;
  }
};

function Ico({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={1.9} />;
}

/** Marks the matched run, so she can see why a row is here. */
function Mark({ text, q }: { text: string; q: string }) {
  const t = q.trim();
  if (!t) return <>{text}</>;
  const at = text.toLowerCase().indexOf(t.toLowerCase());
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-extrabold" style={{ color: "var(--ux-brand)" }}>
        {text.slice(at, at + t.length)}
      </mark>
      {text.slice(at + t.length)}
    </>
  );
}

const RECENT_KEY = "womsakhi.search.recent";

/** Kinds that are actually asking something of her, rather than telling her. */
const WAITING = new Set(["booking", "event", "message", "mentorship", "safety"]);

/**
 * Shown until she has a history of her own — in the words she would use,
 * including the Hindi ones, so the box teaches what it understands.
 */
const SUGGESTED = ["mudra loan", "cotton kurta", "silai course", "Meera Joshi", "kamai"];

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { isDark } = useTheme();
  const t = useT();
  const toast = useToast();
  const [raw, setRaw] = useState("");
  const [scope, setScope] = useState<string>("all");
  const [hits, setHits] = useState<ApiSearchHit[]>([]);
  const [answer, setAnswer] = useState<ApiSearchAnswer | null>(null);
  const [took, setTook] = useState(0);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hearing, setHearing] = useState(false);
  const [speech, setSpeech] = useState(false);

  // Typing is the real barrier for a member who reads slowly — speaking is
  // the difference between using search and never opening it. Offered only
  // where the browser actually has recognition, rather than showing a button
  // that does nothing.
  useEffect(() => { setSpeech(speechSupported()); }, []);

  /* The same silence, fixed the same way everywhere — see `@/lib/speech`. */
  const sayWhy = useCallback((f: SpeechFailure | null) => {
    if (!f) return;                   // `aborted` — she pressed stop.
    const opts = { description: f.description };
    if (f.tone === "danger") toast.error(f.title, opts);
    else if (f.tone === "warn") toast.warn(f.title, opts);
    else toast.info(f.title, opts);
  }, [toast]);

  const listen = useCallback(() => {
    const w = window as unknown as Record<string, unknown>;
    const Rec = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      (new () => { lang: string; interimResults: boolean; start: () => void;
                   onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
                   onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null }) | undefined;
    if (!Rec) { sayWhy(SPEECH_UNSUPPORTED); return; }
    const r = new Rec();
    // Hindi first, since that is what she speaks; the server understands both.
    r.lang = "hi-IN";
    r.interimResults = true;
    r.onresult = (e) => {
      const said = Array.from({ length: e.results.length },
        (_, i) => e.results[i][0].transcript).join(" ").trim();
      if (said) setRaw(said);
    };
    r.onerror = (e) => { setHearing(false); sayWhy(speechFailure(e?.error)); };
    r.onend = () => { setHearing(false); inputRef.current?.focus(); };
    setHearing(true);
    // `start()` throws on a double press and on an insecure origin, and no
    // `onerror` ever arrives to explain either.
    try { r.start(); } catch { setHearing(false); sayWhy(speechFailure("unknown")); }
  }, [sayWhy]);

  /** A leading prefix sets the scope and is not part of the query. */
  const prefix = PREFIX[raw[0] ?? ""] ?? null;
  const q = (prefix ? raw.slice(1) : raw).trim();
  const activeScope = prefix ?? scope;

  useEffect(() => {
    if (!open) return;
    setRaw(""); setScope("all"); setCursor(0); setHits([]); setAnswer(null);
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 5)); }
    catch { setRecent([]); }
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Debounced, and every older request is abandoned — otherwise a slow reply
  // for "ne" can land after "neha" and overwrite the newer results.
  useEffect(() => {
    if (!open || q.length < 2) { setHits([]); setAnswer(null); setBusy(false); return; }
    const ac = new AbortController();
    setBusy(true);
    // A new search starts at the top; a reply arriving never moves her. Doing
    // this the other way round meant an arrow pressed while a request was in
    // flight was quietly undone a moment later.
    setCursor(0);
    const t = setTimeout(() => {
      apiSearch(q, ac.signal)
        .then((r) => { setHits(r.hits); setAnswer(r.answer); setTook(r.took_ms); })
        .catch(() => { /* aborted, or offline — the empty state covers both */ })
        .finally(() => setBusy(false));
    }, 160);
    return () => { ac.abort(); clearTimeout(t); };
  }, [q, open]);

  /**
   * Server results, plus the app's own screens.
   *
   * The API indexes content — courses, circles, people, schemes. It does not
   * know the app has pages, so a woman who knew there was a screen about what
   * she is owed could not reach it by typing "owed". Page matches are computed
   * here from the navigation, appear instantly (no round trip), and are
   * appended rather than interleaved so a real record always outranks a link
   * to the screen that lists them.
   *
   * Deduplicated by href: if the server already returned a hit pointing at the
   * same screen, its version wins — it knows how many are in there.
   */
  const merged = useMemo(() => {
    const pages = searchPages(q, 6, (k) => t(k as Parameters<typeof t>[0])).map((p) =>
      // Show the screen by the name she reads it under in the rail.
      p.k ? { ...p, title: t(`${p.k}.label` as Parameters<typeof t>[0]) } : p,
    );
    if (!pages.length) return hits;
    const taken = new Set(hits.map((h) => h.href));
    const fresh = pages.filter((p) => !taken.has(p.href));
    if (!fresh.length) return hits;

    // A page whose TITLE starts with what she typed goes first. Appending
    // unconditionally meant typing "money traps" returned four loosely-related
    // courses and pushed the screen actually called Money Traps off the end of
    // the list. Everything else still sorts behind the server's results, which
    // know about her own records.
    // Matched per word, not against the whole title: "goals" should promote
    // "My goals", and a title-prefix test alone never would.
    const q0 = q.toLowerCase();
    const strong = (t: string) =>
      t.toLowerCase().split(/[^a-z0-9]+/).some((w) => w && w.startsWith(q0.split(/\s+/)[0]));
    const exact = fresh.filter((p) => strong(p.title));
    const rest = fresh.filter((p) => !strong(p.title));
    return [...exact, ...hits, ...rest];
  }, [hits, q, t]);

  const shown = useMemo(() => merged.filter((h) => inScope(h, activeScope)), [merged, activeScope]);
  const grouped = useMemo(() => {
    /**
     * Her own records first — except when a screen is named the thing she typed.
     *
     * The order was fixed at mine → do → app, so typing "goals" returned six
     * loosely-matching beauty courses and put the screen actually called
     * "My goals" seventh. A fixed order is right when relevance is comparable
     * and wrong when one result is obviously the answer, so the app group is
     * promoted only when it holds a word-for-word title match.
     */
    const q0 = q.trim().toLowerCase().split(/\s+/)[0];
    const named = q0.length > 2 && shown.some((h) =>
      h.group === "app" &&
      h.title.toLowerCase().split(/[^a-z0-9]+/).some((w) => w && w.startsWith(q0)));

    const order: Group[] = named
      ? (["app", "mine", "do"] as Group[])
      : (["mine", "do", "app"] as Group[]);

    const out: [Group, ApiSearchHit[]][] = [];
    for (const g of order) {
      const rows = shown.filter((h) => h.group === g);
      if (rows.length) out.push([g, rows]);
    }
    return out;
  }, [shown, q]);
  const flat = useMemo(() => grouped.flatMap(([, rows]) => rows), [grouped]);

  const remember = useCallback((term: string) => {
    if (term.length < 2) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }, [recent]);

  const go = useCallback((h: ApiSearchHit) => {
    remember(q);
    // Navigate first, close second. Closing unmounts the portal this handler
    // is running inside, and a `router.push` issued after that unmount is
    // dropped — the panel would shut and the page would never change, which
    // reads as a search whose results are not clickable.
    router.push(h.href);
    onClose();
  }, [q, remember, onClose, router]);

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    // With nothing to move through, an arrow is not a move — it used to fold
    // the cursor back to 0, so a key pressed while results were still loading
    // silently threw away where she was.
    if (e.key === "ArrowDown" && flat.length) { setCursor((c) => (c + 1) % flat.length); e.preventDefault(); }
    if (e.key === "ArrowUp" && flat.length)   { setCursor((c) => (c - 1 + flat.length) % flat.length); e.preventDefault(); }
    if (e.key === "Enter" && flat[cursor]) { go(flat[cursor]); e.preventDefault(); }
    if (e.key === "Tab") {
      const at = SCOPES.findIndex((s) => s.id === activeScope);
      const next = SCOPES[(at + (e.shiftKey ? -1 : 1) + SCOPES.length) % SCOPES.length];
      if (prefix) setRaw(q);            // a typed prefix loses to the Tab choice
      setScope(next.id); setCursor(0);
      e.preventDefault();
      // preventDefault alone did not reliably hold the caret here: focus moved
      // on to the scope chips, so the next Enter pressed a chip instead of
      // opening the selected result — Tab, then Enter, silently did nothing.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  // Narrowing the scope can leave the cursor past the end of a shorter list.
  useEffect(() => {
    if (cursor > 0 && cursor >= flat.length) setCursor(flat.length ? flat.length - 1 : 0);
  }, [flat.length, cursor]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  /**
   * The keys belong to the palette, not to the text box.
   *
   * `onKeyDown` on the input only works while the caret is in the input — so
   * the moment she clicked a scope chip, or a row, or anywhere else in the
   * panel, the arrows and Enter stopped doing anything. Listening while the
   * dialog is open means the footer's promise holds wherever focus happens
   * to be.
   */
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => handleKey(e);
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  });

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // The portal mounts on <body>, which is OUTSIDE the `.ux` wrapper every
    // token is scoped to — so `var(--ux-surface)` resolved to nothing and the
    // panel rendered with no background at all: the page showed straight
    // through it. Carrying the scope (and the dark variant, which the
    // stylesheet also exposes as `.ux.dark`) is what makes the tokens resolve.
    <div className={`ux${isDark ? " dark" : ""}`}>
    <div className="fixed inset-0 z-[80] grid items-start justify-items-center px-5 pb-5 pt-[9vh] max-[620px]:items-stretch max-[620px]:p-0"
         style={{ background: "var(--ux-scrim)", backdropFilter: "blur(3px)" }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Search WomSakhi"
           className="flex w-full max-w-[720px] flex-col overflow-hidden rounded-[20px] max-[620px]:h-[100dvh] max-[620px]:max-w-none max-[620px]:rounded-none"
           style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line-strong)",
                    boxShadow: "var(--ux-shadow-pop)", maxHeight: "78vh" }}>

        {/* the field */}
        <div className="flex items-center gap-3 px-[20px] py-4" style={{ borderBottom: "1px solid var(--ux-line)" }}>
          <Icons.Search className="h-[19px] w-[19px] shrink-0" style={{ color: "var(--ux-faint)" }} strokeWidth={2.2} />
          {prefix && (
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold"
                  style={{ background: "var(--ux-tint-violet)", color: "var(--ux-violet-ink)" }}>
              {SCOPES.find((s) => s.id === prefix)?.label}
            </span>
          )}
          <input ref={inputRef} value={raw} onChange={(e) => setRaw(e.target.value)}
                 role="combobox" aria-expanded aria-controls="search-results" autoComplete="off" spellCheck={false}
                 placeholder="Search anything, or type ₹ @ # >"
                 className="min-w-0 flex-1 border-0 bg-transparent text-base font-medium tracking-[-0.01em] outline-none"
                 style={{ color: "var(--ux-ink)" }} />
          {busy && <Icons.Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "var(--ux-faint)" }} />}
          {speech && (
            <button type="button" onClick={listen} aria-label="Search by speaking"
                    title="Speak instead of typing"
                    className="ux-press grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[12px]"
                    style={hearing
                      ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                          color: "var(--ux-on-brand)" }
                      : { background: "var(--ux-tint-violet)", color: "var(--ux-violet-ink)" }}>
              <Icons.Mic className="h-[17px] w-[17px]" />
            </button>
          )}
          <button type="button" onClick={onClose}
                  className="ux-press shrink-0 rounded-md px-[8px] py-1 text-2xs font-bold"
                  style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-faint)" }}>ESC</button>
        </div>

        {/* scopes */}
        <div className="flex gap-1.5 overflow-x-auto px-[20px] py-2.5"
             style={{ borderBottom: "1px solid var(--ux-line)", scrollbarWidth: "none" }}>
          {SCOPES.map((s) => {
            const on = activeScope === s.id;
            return (
              <button key={s.id} type="button"
                      onClick={() => { if (prefix) setRaw(q); setScope(s.id); setCursor(0); inputRef.current?.focus(); }}
                      className="ux-press flex min-h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold"
                      style={on
                        ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                            border: "1px solid transparent", color: "var(--ux-on-brand)" }
                        : { border: "1px solid var(--ux-line)", color: "var(--ux-ink-2)" }}>
                {s.key && <kbd className="text-2xs font-extrabold opacity-75">{s.key}</kbd>}
                {s.label}
              </button>
            );
          })}
        </div>

        {/* results */}
        <div id="search-results" ref={listRef} role="listbox" aria-label="Results" className="flex-1 overflow-y-auto py-2">
          {q.length < 2 ? (
            <Resting recent={recent} cursor={cursor} setCursor={setCursor}
                     onPick={(t) => { setRaw(t); inputRef.current?.focus(); }}
                     onGo={(href) => { router.push(href); onClose(); }} />
          ) : (
            <>
              {answer && <Answer a={answer} onGo={() => { remember(q); router.push(answer.href); onClose(); }} />}

              {grouped.map(([g, rows]) => (
                <div key={g}>
                  <div className="flex items-center gap-2.5 px-[20px] pb-1.5 pt-3 text-2xs font-extrabold uppercase tracking-[0.15em]"
                       style={{ color: "var(--ux-faint)" }}>
                    {GROUP_NAME[g]}
                    <span className="ms-auto text-2xs font-bold normal-case tracking-normal">{rows.length}</span>
                  </div>
                  {rows.map((h) => {
                    const i = flat.indexOf(h);
                    const l = look(h.kind);
                    const on = i === cursor;
                    return (
                      <button key={`${h.kind}-${h.id}`} type="button" role="option" aria-selected={on}
                              onMouseMove={() => setCursor(i)} onClick={() => go(h)}
                              className="flex w-full items-center gap-3 px-[20px] py-2.5 text-start"
                              style={{ borderInlineStart: `2px solid ${on ? "var(--ux-rib-3)" : "transparent"}`,
                                       background: on ? "var(--ux-surface-2)" : "transparent" }}>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px]"
                              style={{ background: `var(${l.tint})`, color: `var(${l.ink})` }}>
                          <Ico name={l.icon} className="h-[17px] w-[17px]" />
                        </span>
                        {/* Title and detail share a line, as in the design: the
                            detail is context for the title, not a second fact,
                            and stacking them made every row two lines tall and
                            halved how much fits without scrolling. */}
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold"
                              style={{ color: "var(--ux-ink)" }}>
                          <Mark text={h.title} q={q} />
                          {h.sub && (
                            <span className="ms-2 font-normal" style={{ color: "var(--ux-faint)" }}>{h.sub}</span>
                          )}
                        </span>
                        {h.amount && (
                          <b className="shrink-0 text-xsm font-extrabold tabular-nums"
                             style={{ color: `var(${amountInk(h)})` }}>
                            {h.amount}
                          </b>
                        )}
                        {h.tag && (
                          <span className="shrink-0 rounded-full px-2.5 py-1 text-2xs font-extrabold uppercase tracking-[0.04em]"
                                style={{ background: `var(${l.tint})`, color: `var(${l.ink})` }}>{h.tag}</span>
                        )}
                        <span className="shrink-0 text-2xs font-bold"
                              style={{ color: "var(--ux-faint)", opacity: on ? 1 : 0 }}>
                          {h.group === "do" ? "Run ↵" : "Open ↵"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}

              {!busy && !answer && flat.length === 0 && (
                <div className="px-[20px] py-9 text-center">
                  <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
                    Nothing matches “{q}”.
                  </p>
                  <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-faint)" }}>
                    Try a name, an amount, or press <Kbd>&gt;</Kbd> to do something instead.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* the keys, always visible */}
        <div className="flex items-center gap-3.5 px-[20px] py-2.5 text-2xs"
             style={{ borderTop: "1px solid var(--ux-line)", background: "var(--ux-surface-2)", color: "var(--ux-faint)" }}>
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
          <span className="hidden items-center gap-1.5 sm:flex"><Kbd>⇥</Kbd> scope</span>
          {q.length >= 2 && !busy && (
            <span className="ms-auto tabular-nums">
              {flat.length + (answer ? 1 : 0)} result{flat.length + (answer ? 1 : 0) === 1 ? "" : "s"} in{" "}
              <b style={{ color: "var(--ux-green-ink)" }}>{took}ms</b>
            </span>
          )}
        </div>
      </div>
    </div>
    </div>,
    document.body,
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[8px] px-[4px] py-[2px] text-2xs font-bold"
         style={{ border: "1px solid var(--ux-line-strong)", borderBottomWidth: 2,
                  background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
      {children}
    </kbd>
  );
}

/** An answer, where the question has one. A list of links is a worse reply. */
function Answer({ a, onGo }: { a: ApiSearchAnswer; onGo: () => void }) {
  return (
    <div className="mx-[20px] mb-1 mt-2.5 rounded-[16px] p-4"
         style={{ background: "linear-gradient(140deg, var(--ux-tint-violet), var(--ux-surface-2))",
                  border: "1px solid var(--ux-line-strong)" }}>
      <span className="flex items-center gap-1.5 text-2xs font-extrabold uppercase tracking-[0.14em]"
            style={{ color: "var(--ux-violet-ink)" }}>
        <Icons.Wallet className="h-[13px] w-[13px]" /> {a.label}
      </span>
      <p className="my-1 text-2xlm font-extrabold tracking-[-0.03em] tabular-nums" style={{ color: "var(--ux-ink)" }}>
        {a.value}
      </p>
      <p className="m-0 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{a.detail}</p>
      {a.action && (
        <button type="button" onClick={onGo}
                className="ux-press mt-3 rounded-[8px] px-3 py-2 text-xs font-bold"
                style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                         color: "var(--ux-on-brand)" }}>
          {a.action}
        </button>
      )}
    </div>
  );
}

/**
 * What she sees before typing.
 *
 * A blank panel wastes the one moment she is definitely looking, and a list of
 * links to places she can already reach from the rail wastes it almost as
 * badly. This is what is actually waiting on her — her own unread, urgent
 * rows, with the same shape and the same left-bar highlight as a result.
 */
function Resting({
  recent, onPick, onGo, cursor, setCursor,
}: {
  recent: string[]; onPick: (t: string) => void; onGo: (href: string) => void;
  cursor: number; setCursor: (n: number) => void;
}) {
  const { data: notifications } = useNotifications();

  // The same alert three times is one thing waiting on her, not three. Search
  // results are deduped server-side; these are not, so it happens here.
  const waiting = notifications
    .filter((n) => n.unread && WAITING.has(n.kind))
    .filter((n, i, all) => all.findIndex((o) => o.title === n.title) === i)
    .slice(0, 3);

  return (
    <>
      {waiting.length > 0 && (
        <>
          <div className="flex items-center gap-2.5 px-[20px] pb-1.5 pt-3 text-2xs font-extrabold uppercase tracking-[0.15em]"
               style={{ color: "var(--ux-faint)" }}>
            Waiting on you
            <span className="ms-auto text-2xs font-bold normal-case tracking-normal">{waiting.length}</span>
          </div>
          {waiting.map((n, i) => {
            const l = look(n.kind === "safety" ? "do" : n.kind);
            const on = i === cursor;
            return (
              <button key={n.id} type="button" role="option" aria-selected={on}
                      onMouseMove={() => setCursor(i)} onClick={() => onGo(n.href ?? "/app/notifications")}
                      className="flex w-full items-center gap-3 px-[20px] py-2.5 text-start"
                      style={{ borderInlineStart: `2px solid ${on ? "var(--ux-rib-3)" : "transparent"}`,
                               background: on ? "var(--ux-surface-2)" : "transparent" }}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px]"
                      style={{ background: `var(${l.tint})`, color: `var(${l.ink})` }}>
                  <Ico name={l.icon} className="h-[17px] w-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {n.title}
                    {n.body && (
                      <span className="ms-2 font-normal" style={{ color: "var(--ux-faint)" }}>{n.body}</span>
                    )}
                  </span>
                </span>
                <span className="shrink-0 text-2xs font-bold"
                      style={{ color: "var(--ux-faint)", opacity: on ? 1 : 0 }}>Open ↵</span>
              </button>
            );
          })}
        </>
      )}

      <div className="px-[20px] pb-1.5 pt-4 text-2xs font-extrabold uppercase tracking-[0.15em]"
           style={{ color: "var(--ux-faint)" }}>You searched before</div>
      <div className="flex flex-wrap gap-1.5 px-[20px] pb-3.5">
        {(recent.length ? recent : SUGGESTED).map((r) => (
          <button key={r} type="button" onClick={() => onPick(r)}
                  className="ux-press min-h-[34px] rounded-full px-3.5 text-xs font-semibold"
                  style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>{r}</button>
        ))}
      </div>
    </>
  );
}

/**
 * The default export is what `next/dynamic` loads.
 *
 * This whole file is a lazy chunk: `Shell` mounts it only once ⌘K has been
 * pressed, so nothing below is downloaded until she asks to search. The key
 * that opens it is listened for by `useSearchHotkey`, which deliberately lives
 * in its own always-loaded file — a hotkey inside the chunk it is meant to
 * fetch would never fire.
 */
export default SearchPalette;
