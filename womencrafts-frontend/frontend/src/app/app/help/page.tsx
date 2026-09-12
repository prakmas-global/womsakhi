"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { useResource } from "@/lib/use-resource";
import { apiHelplines, apiRaiseAlert, type Helpline } from "@/lib/safety-api";
import { apiSendMessage } from "@/lib/member-api";
import { useT } from "@/i18n";
import { ListGroup, ListRow } from "@/components/ux/mobile/ListRow";
import { useToast } from "@/design-system/feedback/ToastProvider";
import { SPEECH_UNSUPPORTED, speechFailure, speechSupported, type SpeechFailure } from "@/lib/speech";

/**
 * Help.
 *
 * ── The order is the design ────────────────────────────────────────────────
 * A help page usually assumes mild confusion. This one assumes she might be in
 * trouble, so it is ordered by urgency rather than by how the company is
 * organised: the alert sits above the heading, the helplines are one tap away
 * and work without credit, and the answers come after both.
 *
 * ── Three things this page knows about its reader ─────────────────────────
 * She may not read quickly — so she can speak instead of typing, and the
 * topics are named in the words she would use ("My money", not "Payments").
 * She may have no credit — so the numbers that are free from any phone say so.
 * She may not be alone with her phone — so there is a way to make this screen
 * look like something else, immediately.
 */

const HOLD_MS = 1500;

/** What she would say is wrong, not what the org is divided into. */
const TOPICS = [
  { id: "money",  icon: "wallet", tint: "--ux-tint-green",  ink: "--ux-green-ink",
    title: "My money", sub: "Not arrived, wrong amount, or stuck", href: "/app/wallet" },
  { id: "work",   icon: "brief",  tint: "--ux-tint-blue",   ink: "--ux-blue-ink",
    title: "Work I applied for", sub: "No reply, or something went wrong", href: "/app/applications" },
  { id: "shop",   icon: "store",  tint: "--ux-tint-amber",  ink: "--ux-amber-ink",
    title: "My shop", sub: "An order, a buyer, or a return", href: "/app/shop" },
  { id: "circle", icon: "users",  tint: "--ux-tint-pink",   ink: "--ux-pink-ink",
    title: "My circle", sub: "A round, a payment, or a member", href: "/app/circles" },
  { id: "course", icon: "cap",    tint: "--ux-tint-violet", ink: "--ux-violet-ink",
    title: "A course", sub: "Lessons, certificates, or a class", href: "/app/programs" },
  { id: "abuse",  icon: "scale",  tint: "--ux-danger-tint", ink: "--ux-danger-solid",
    title: "Someone is treating me badly", sub: "At work, at home, or online", href: "/app/safety" },
] as const;

/**
 * Answers, written as answers.
 *
 * Each one carries the number that settles it — "three working days", "after
 * seven days we release it anyway" — because "contact support" is not an
 * answer, it is the absence of one.
 */
const ANSWERS = [
  { id: "a1", topic: "money", q: "My money has not come",
    kw: "money paisa payment bank withdraw kamai nahi aaya",
    a: "Money you take out reaches most banks the next working day, and always within three. Until the buyer confirms delivery — usually three days — it sits as pending and is not yours to withdraw yet. If it has been more than three working days, tell us and we will trace it with the bank." },
  { id: "a2", topic: "shop", q: "The buyer has not paid me",
    kw: "buyer paid order grahak payment shop",
    a: "You are paid when the buyer confirms delivery, not when you post. If she has not confirmed after three days, we remind her twice. After seven days we release the money to you anyway — you do not lose it because she forgot." },
  { id: "a3", topic: "money", q: "Someone is asking me for an OTP",
    kw: "otp password fraud scam cheat thug security",
    a: "Stop. We never ask for an OTP or a password — not on a call, not in a message, not ever. Anyone who does is not from WomSakhi. Do not read it out. Tell us who asked and we will block them." },
  { id: "a4", topic: "circle", q: "I want to leave my savings circle",
    kw: "circle leave quit savings bachat round pot",
    a: "You can leave once your turn has passed and you owe nothing. If your turn has not come yet, leaving means the others carry your share, so we ask you to tell the circle first. Nobody can remove you without telling you." },
  { id: "a5", topic: "course", q: "How do I get my certificate?",
    kw: "certificate course learn class complete lesson",
    a: "Finish every lesson and the certificate appears the same day under Certificates. It has your name and a code an employer can check. If a lesson will not mark itself done, open it once more with a signal and it catches up." },
  { id: "a6", topic: "abuse", q: "Someone at work is behaving badly with me",
    kw: "harassment badly work boss touch bad treating abuse",
    a: "This is not something you have to handle alone. Tell us and a woman from our team calls you, in your language, the same day. Nothing is shared with the employer unless you say so. You can also call 181 at any hour — free, from any phone." },
];

/* ── icons: a soft filled body under a crisp stroke ─────────────────────── */

const ART: Record<string, [string, string]> = {
  wallet: ['<path d="M3 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
           '<path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6"/><path d="M16.5 12.5h.01"/>'],
  brief:  ['<rect x="3" y="8" width="18" height="12" rx="2.5"/>',
           '<rect x="2.5" y="7.5" width="19" height="13" rx="2.5"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M2.5 12.5h19"/>'],
  cap:    ['<path d="M12 5 2.5 9 12 13l9.5-4Z"/>',
           '<path d="M22 9 12 5 2 9l10 4 10-4Z"/><path d="M6 11v4.6c0 1.6 2.7 2.9 6 2.9s6-1.3 6-2.9V11"/><path d="M21 9.5V15"/>'],
  store:  ['<path d="M4.5 10h15v9a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1Z"/>',
           '<path d="M3.2 9.4 4.6 4.6A1 1 0 0 1 5.6 4h12.8a1 1 0 0 1 1 .6l1.4 4.8a2.6 2.6 0 0 1-5 .9 2.6 2.6 0 0 1-4.8 0 2.6 2.6 0 0 1-4.8 0 2.6 2.6 0 0 1-5-.9Z"/><path d="M5 12.5V20h14v-7.5"/><path d="M9.5 20v-4.5h5V20"/>'],
  users:  ['<circle cx="12" cy="9.5" r="3.6"/>',
           '<circle cx="12" cy="9.5" r="3.9"/><path d="M5 20.5a7.2 7.2 0 0 1 14 0"/>'],
  scale:  ['<path d="M4.5 12.5 7.5 7l3 5.5a3 3 0 0 1-6 0ZM13.5 12.5 16.5 7l3 5.5a3 3 0 0 1-6 0Z"/>',
           '<path d="M12 3.5v17M7.5 6.5h9M6.5 20.5h11"/><path d="m4 12.5 3.5-6 3.5 6a3.5 3.5 0 0 1-7 0ZM13 12.5l3.5-6 3.5 6a3.5 3.5 0 0 1-7 0Z"/>'],
};

/** The soft shape carries the colour; the stroke carries the meaning. */
function Duo({ name, className }: { name: string; className?: string }) {
  const [body, line] = ART[name] ?? ART.wallet;
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <g fill="currentColor" opacity={0.17} dangerouslySetInnerHTML={{ __html: body }} />
      <g stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
         dangerouslySetInnerHTML={{ __html: line }} />
    </svg>
  );
}

export default function HelpPage() {
  const tr = useT();
  const { data: helplines } = useResource(
    useCallback(() => apiHelplines(), []), [] as Helpline[]);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [helped, setHelped] = useState<Set<string>>(new Set());
  const [veiled, setVeiled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const personRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return ANSWERS;
    return ANSWERS.filter((x) => `${x.q} ${x.kw} ${x.a}`.toLowerCase().includes(t));
  }, [q]);

  /* ── the disguise ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!veiled) return;
    const prev = document.title;
    document.title = "Weather";
    const off = (e: KeyboardEvent) => { if (e.key === "Escape") setVeiled(false); };
    window.addEventListener("keydown", off);
    return () => { window.removeEventListener("keydown", off); document.title = prev; };
  }, [veiled]);

  if (veiled) return <Veil onBack={() => setVeiled(false)} />;

  return (
    <HomeShell active="/app/help">
      <div className="flex flex-col">
        <Alert />

        <header className="mb-1">
          <p className="text-[12px] lg:text-2xs font-extrabold uppercase tracking-[0.2em]"
             style={{ color: "var(--ux-brand)" }}>Help</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.625rem,3.6vw,2.5rem)] font-extrabold leading-[1.06] tracking-[-0.04em]"
              style={{ color: "var(--ux-ink)" }}>{tr("help.whatHasGoneWrong")}</h1>
          <p className="mt-2.5 max-w-[56ch] text-[15px] leading-relaxed lg:text-sm" style={{ color: "var(--ux-ink-2)" }}>
            Ask in your own words, in any language — or pick what it is about. If you would rather
            talk to a person, that is on this page too.
          </p>
        </header>

        <Ask value={q} onChange={setQ} inputRef={inputRef} />

        <div className="grid items-start gap-[24px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0">
        <Head>{tr("help.whatIsItAbout")}</Head>
        {/* On a phone the grid below is one column, which turns eight bordered
            tiles into eight floating cards with a gutter between each. One
            grouped list, hairlines inside, is the same eight destinations in
            roughly half the height. */}
        <div className="mb-7 lg:hidden">
          <ListGroup>
            {TOPICS.map((t) => (
              /* `avatar`, not `icon`: these six are this page's own duotone
                 drawings, not names in `ux/icons`, and one of them is tinted
                 with `--ux-danger-tint`, which is not one of `ListRow`'s six
                 named tints either. The tile is handed over whole. */
              <ListRow key={t.id} href={t.href} title={t.title} subtitle={t.sub}
                       avatar={
                         <span aria-hidden="true"
                               className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[var(--ux-r-sm)]"
                               style={{ color: `var(${t.ink})`, background: `var(${t.tint})` }}>
                           <Duo name={t.icon} className="h-[19px] w-[19px]" />
                         </span>
                       } />
            ))}
          </ListGroup>
        </div>
        <div className="mb-7 hidden gap-3 lg:grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))" }}>
          {TOPICS.map((t) => (
            <Link key={t.id} href={t.href}
                  className="ux-press ux-lit ux-tile-lit flex items-start gap-3.5 rounded-[16px] p-[16px] text-start transition-transform hover:-translate-y-[3px]"
                  style={{ border: "1px solid var(--ux-line)",
                           ["--ux-wash" as string]: `color-mix(in srgb, var(${t.ink}) 9%, transparent)` }}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
                    style={{ color: `var(${t.ink})`,
                             background: `linear-gradient(150deg, var(${t.tint}), color-mix(in srgb, var(${t.tint}) 52%, var(--ux-surface)))`,
                             boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)" }}>
                <Duo name={t.icon} className="h-[21px] w-[21px]" />
              </span>
              <span className="min-w-0">
                <b className="block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{t.title}</b>
                <span className="mt-0.5 block text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>
                  {t.sub}
                </span>
              </span>
            </Link>
          ))}
        </div>

        <Head>
          Answers
          {q.trim() && (
            <span className="ms-2 font-bold normal-case tracking-normal" style={{ color: "var(--ux-muted)" }}>
              · {rows.length} for “{q.trim()}”
            </span>
          )}
        </Head>

        <div className="ux-lit mb-7 overflow-hidden rounded-[20px]" style={{ border: "1px solid var(--ux-line)" }}>
          {rows.length === 0 ? (
            <div className="px-[20px] py-8 text-center text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("help.noAnswerHereForThatYet")}<br />
              Use <b style={{ color: "var(--ux-ink)" }}>{tr("help.messageHer")}</b> below and it goes straight to the team.
            </div>
          ) : rows.map((x, i) => {
            const on = open === x.id;
            return (
              <div key={x.id} style={i ? { borderTop: "1px solid var(--ux-line)" } : undefined}>
                <button type="button" aria-expanded={on}
                        onClick={() => setOpen(on ? null : x.id)}
                        className="ux-press flex w-full items-center gap-3 px-[16px] py-[16px] text-start text-[15px] font-semibold tracking-[-0.01em] lg:px-[20px] lg:text-sm"
                        style={{ color: "var(--ux-ink)" }}>
                  <Mark text={x.q} q={q} />
                  <Icons.ChevronRight className="ms-auto h-4 w-4 shrink-0 transition-transform"
                                      style={{ color: "var(--ux-faint)",
                                               transform: on ? "rotate(90deg)" : undefined }} />
                </button>
                {on && (
                  <div className="pb-4 pe-[19px] ps-[50px] text-xsm leading-[1.65]"
                       style={{ color: "var(--ux-ink-2)" }}>
                    {x.a}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"
                         style={{ color: "var(--ux-muted)" }}>
                      {helped.has(x.id) ? "Good. Glad that sorted it." : (
                        <>{tr("help.didThisHelp")}<button type="button" onClick={() => setHelped((s) => new Set(s).add(x.id))}
                                  className="ux-press min-h-[34px] rounded-[8px] px-3 text-xs font-bold"
                                  style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                            Yes
                          </button>
                          <button type="button"
                                  onClick={() => personRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                                  className="ux-press min-h-[34px] rounded-[8px] px-3 text-xs font-bold"
                                  style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>{tr("help.noTalkToAPerson")}</button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Person innerRef={personRef} />
          </main>

          <aside className="flex flex-col gap-4">
            <Numbers lines={helplines} />
            <LeaveFast onLeave={() => setVeiled(true)} />
            <Never />
          </aside>
        </div>
      </div>
    </HomeShell>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[12px] lg:text-2xs font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--ux-faint)" }}>
      {children}
    </h2>
  );
}

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

/* ── the alert ──────────────────────────────────────────────────────────── */

function Alert() {
  const tr = useT();
  const [held, setHeld] = useState(0);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const raf = useRef(0);
  const from = useRef(0);

  const send = useCallback(async () => {
    setSent(true);
    try {
      // Where she is, if the phone will say — the alert goes either way.
      const where = await new Promise<string>((ok) => {
        if (!navigator.geolocation) return ok("");
        navigator.geolocation.getCurrentPosition(
          (p) => ok(`${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`),
          () => ok(""), { timeout: 4000 });
      });
      await apiRaiseAlert({ location: where });
    } catch { setFailed(true); }
  }, []);

  const tick = useCallback(() => {
    const p = Math.min(1, (performance.now() - from.current) / HOLD_MS);
    setHeld(p);
    if (p >= 1) { void send(); return; }
    raf.current = requestAnimationFrame(tick);
  }, [send]);

  const start = () => {
    if (sent) return;
    from.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  const stop = () => {
    if (sent) return;
    cancelAnimationFrame(raf.current);
    setHeld(0);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    /*
      `flex-wrap` with a `shrink-0` button does not wrap on a phone — the row
      still fits, so the WORDS take what is left. Measured at 390px: the text
      column was 88px wide and "Something is happening right now" rendered one
      word per line, eleven lines deep, with the button floating in the middle
      of it. On a phone this is a column: icon and words, then the button full
      width underneath, which is also where a thumb can hold it for a second
      and a half without covering what it is about to do.
    */
    <section className="ux-sq mb-6 flex flex-col items-start gap-3 overflow-hidden rounded-[20px] px-4 py-4
                        sm:flex-row sm:flex-wrap sm:items-center sm:gap-[20px] sm:px-5 sm:py-[20px]"
             style={{ border: "1px solid color-mix(in srgb, var(--ux-danger-solid) 55%, transparent)",
                      background: "linear-gradient(100deg, var(--ux-danger-tint), var(--ux-surface) 62%)",
                      boxShadow: "0 18px 44px -26px var(--ux-danger-solid), var(--ux-shadow-card), inset 0 1px 0 var(--ux-sheen)" }}>
      <span className="ux-beat grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[14px] sm:h-[52px] sm:w-[52px] sm:rounded-[16px]"
            style={{ background: "linear-gradient(150deg, var(--ux-danger-solid), color-mix(in srgb, var(--ux-danger-solid) 64%, #000))",
                     color: "var(--ux-on-brand)" }}>
        <Icons.TriangleAlert className="h-[22px] w-[22px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <p className="text-base font-extrabold tracking-[-0.01em]" style={{ color: "var(--ux-ink)" }}>
          {sent ? (failed ? tr("help.couldNotSendCall")
              : tr("help.sentYourPeopleKnow")) : "Something is happening right now"}
        </p>
        <p className="mt-0.5 text-[13px] leading-snug sm:text-xsm" style={{ color: "var(--ux-ink-2)" }}>
          {sent
            ? (failed
                ? tr("help.theAlertDidNotReachUs")
              : tr("help.theyCanSeeWhereYouAre"))
            : "Your people are told where you are. Nothing is sent until you finish holding."}
        </p>
      </div>
      <button type="button" disabled={sent}
              onPointerDown={(e) => { e.preventDefault(); start(); }}
              onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
              aria-label={tr("help.pressAndHoldForOneAnd")}
              className="relative flex min-h-[50px] w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-[14px] px-6 text-[16px] font-extrabold tracking-[-0.005em] transition-transform active:scale-[0.985] sm:w-auto sm:rounded-[12px] sm:text-sm"
              style={{ background: sent && !failed
                         ? "var(--ux-green-ink)"
                         : "linear-gradient(150deg, var(--ux-danger-solid), color-mix(in srgb, var(--ux-danger-solid) 72%, #000))",
                       color: "var(--ux-on-brand)",
                       boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 12px 26px -12px var(--ux-danger-solid)" }}>
        {/* The bar is the promise: nothing leaves until it is full. */}
        <i className="absolute inset-y-0 start-0 block"
           style={{ width: `${held * 100}%`, background: "rgba(255,255,255,0.28)" }} />
        <span className="relative">
          {sent ? (failed ? "Try 181" : "Sent") : held > 0 ? tr("help.keepHolding")
              : tr("help.holdToSendAnAlert")}
        </span>
      </button>
    </section>
  );
}

/* ── ask ────────────────────────────────────────────────────────────────── */

function Ask({
  value, onChange, inputRef,
}: { value: string; onChange: (v: string) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const tr = useT();
  const toast = useToast();
  const [hearing, setHearing] = useState(false);
  const [speech, setSpeech] = useState(false);

  useEffect(() => { setSpeech(speechSupported()); }, []);

  /* A microphone that fails in silence is the same bug on every screen that
     has one — see `@/lib/speech`. This is a help page: if the one control
     offered to a woman who cannot read the rest of it does nothing when
     pressed, she has no way left to ask. */
  const sayWhy = (f: SpeechFailure | null) => {
    if (!f) return;                   // `aborted` — she pressed stop.
    const opts = { description: f.description };
    if (f.tone === "danger") toast.error(f.title, opts);
    else if (f.tone === "warn") toast.warn(f.title, opts);
    else toast.info(f.title, opts);
  };

  const listen = () => {
    const w = window as unknown as Record<string, unknown>;
    const Rec = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      (new () => { lang: string; interimResults: boolean; start: () => void;
                   onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
                   onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null }) | undefined;
    if (!Rec) { sayWhy(SPEECH_UNSUPPORTED); return; }
    const r = new Rec();
    r.lang = "hi-IN";                 // what she speaks; the answers match either way
    r.interimResults = true;
    r.onresult = (e) => {
      const said = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript)
        .join(" ").trim();
      if (said) onChange(said);
    };
    r.onerror = (e) => { setHearing(false); sayWhy(speechFailure(e?.error)); };
    r.onend = () => { setHearing(false); inputRef.current?.focus(); };
    setHearing(true);
    // `start()` throws on a double press and on an insecure origin, and no
    // `onerror` ever arrives to explain either.
    try { r.start(); } catch { setHearing(false); sayWhy(speechFailure("unknown")); }
  };

  return (
    <>
      <div className="ux-lit mb-[8px] mt-[20px] flex items-center gap-3 rounded-[16px] py-1.5 pe-1.5 ps-[18px]"
           style={{ border: "1px solid var(--ux-line-strong)" }}>
        <Icons.Search className="h-[19px] w-[19px] shrink-0" strokeWidth={2.2} style={{ color: "var(--ux-faint)" }} />
        <input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)}
               placeholder={tr("help.myMoneyHasNotCome")}
               aria-label={tr("help.askWhatHasGoneWrong")}
               className="min-w-0 flex-1 border-0 bg-transparent py-3 text-base outline-none"
               style={{ color: "var(--ux-ink)" }} />
        {speech && (
          <button type="button" onClick={listen} aria-label={tr("help.askBySpeaking")}
                  className="ux-press grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[12px] transition-transform hover:-translate-y-px"
                  style={hearing
                    ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
                    : { background: "linear-gradient(150deg, var(--ux-tint-violet), color-mix(in srgb, var(--ux-tint-violet) 55%, var(--ux-surface)))",
                        color: "var(--ux-violet-ink)", boxShadow: "inset 0 1px 0 var(--ux-sheen)" }}>
            <Icons.Mic className="h-[19px] w-[19px]" />
          </button>
        )}
      </div>
      <p className="mb-6 ms-0.5 text-xs" style={{ color: "var(--ux-faint)" }}>
        {speech
          ? tr("help.youCanSpeakInsteadOfTyping")
              : tr("help.typeInAnyLanguageHindiTelugu")}
      </p>
    </>
  );
}

/* ── a person ───────────────────────────────────────────────────────────── */

function Person({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) {
  const tr = useT();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const message = async () => {
    setBusy(true); setFailed(false);
    try {
      await apiSendMessage("I need help — sent from the Help screen.");
      setSent(true);
    } catch { setFailed(true); }
    finally { setBusy(false); }
  };

  return (
    <section ref={innerRef}
             className="relative flex flex-wrap items-center gap-[20px] overflow-hidden rounded-[20px] p-[24px]"
             style={{ background: "linear-gradient(140deg, var(--ux-tint-violet), var(--ux-surface) 68%)",
                      border: "1px solid var(--ux-line-strong)",
                      boxShadow: "var(--ux-shadow-card), inset 0 1px 0 var(--ux-sheen)" }}>
      <span aria-hidden className="pointer-events-none absolute -end-14 -top-14 h-[220px] w-[220px] rounded-full"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--ux-brand) 16%, transparent), transparent 70%)" }} />
      <div className="relative min-w-0 flex-1">
        <h2 className="text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>
          {sent ? tr("help.sheHasYourMessage")
              : tr("help.stillStuckTalkToAPerson")}
        </h2>
        <p className="mt-1 text-xsm" style={{ color: "var(--ux-ink-2)" }}>
          {sent
            ? tr("help.someoneFromTheTeamWillReply")
              : tr("help.someoneAnswersInAboutMinutesAm")}
        </p>
        {failed && (
          <p className="mt-1 text-xsm font-semibold" style={{ color: "var(--ux-danger-solid)" }}>{tr("help.thatDidNotSendTryAgain")}</p>
        )}
      </div>
      <div className="relative flex flex-wrap gap-2">
        {sent ? (
          <Link href="/app/messages"
                className="ux-press flex min-h-[48px] items-center gap-2 rounded-[12px] px-5 text-xsm font-bold"
                style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                         color: "var(--ux-on-brand)" }}>{tr("help.openMessages")}<Icons.ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" onClick={message} disabled={busy}
                  className="ux-press flex min-h-[48px] items-center gap-2 rounded-[12px] px-5 text-xsm font-bold disabled:opacity-60"
                  style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                           color: "var(--ux-on-brand)",
                           boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }}>
            <Icons.MessageCircle className="h-4 w-4" /> {busy ? "Sending…" : "Message her"}
          </button>
        )}
        <a href="tel:181"
           className="ux-press flex min-h-[48px] items-center gap-2 rounded-[12px] px-5 text-xsm font-bold"
           style={{ border: "1px solid var(--ux-line-strong)", background: "var(--ux-surface)",
                    color: "var(--ux-ink-2)", boxShadow: "inset 0 1px 0 var(--ux-sheen)" }}>
          <Icons.Phone className="h-4 w-4" /> Call
        </a>
      </div>
    </section>
  );
}

/* ── the rail cards ─────────────────────────────────────────────────────── */

function Numbers({ lines }: { lines: Helpline[] }) {
  const tr = useT();
  // Four is what fits without scrolling; the rest live on the safety screen.
  const shown = lines.slice(0, 4);
  return (
    <section className="ux-lit rounded-[20px] p-[20px]" style={{ border: "1px solid var(--ux-line)" }}>
      <h2 className="flex items-center gap-2 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>
        <Icons.Phone className="h-[17px] w-[17px]" style={{ color: "var(--ux-brand)" }} />{tr("help.numbersThatAlwaysWork")}</h2>
      <p className="mb-3 mt-1 flex flex-wrap items-center gap-2 text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("help.freeFromAnyPhone")}<span className="rounded-full px-2.5 py-1 text-[12px] lg:text-2xs font-extrabold uppercase tracking-[0.04em]"
              style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>{tr("help.noCreditNeeded")}</span>
      </p>
      {shown.length === 0 ? (
        <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>{tr("help.couldNotLoadThese")}<a href="tel:181" style={{ color: "var(--ux-brand)" }}>{tr("help.call")}</a> — it always works.
        </p>
      ) : shown.map((h) => (
        <div key={h.number}
             className="mb-2 flex items-center gap-3 rounded-[12px] p-[12px] transition-transform last:mb-0 hover:translate-x-0.5"
             style={{ border: "1px solid var(--ux-line)", background: "var(--ux-surface)" }}>
          <b className="min-w-[78px] text-xl font-extrabold tabular-nums tracking-[-0.03em]"
             style={{ color: "var(--ux-ink)" }}>{h.number}</b>
          <span className="min-w-0 flex-1 text-xs leading-snug" style={{ color: "var(--ux-muted)" }}>
            {h.name}
          </span>
          <a href={`tel:${h.number}`}
             className="ux-press flex min-h-[38px] shrink-0 items-center rounded-[12px] px-[16px] text-xs font-extrabold"
             style={{ background: "linear-gradient(150deg, var(--ux-tint-green), color-mix(in srgb, var(--ux-tint-green) 60%, var(--ux-surface)))",
                      color: "var(--ux-green-ink)", boxShadow: "inset 0 1px 0 var(--ux-sheen)" }}>
            Call
          </a>
        </div>
      ))}
    </section>
  );
}

function LeaveFast({ onLeave }: { onLeave: () => void }) {
  const tr = useT();
  return (
    <section className="rounded-[20px] p-[20px]"
             style={{ background: "var(--ux-surface-2)", border: "1px dashed var(--ux-line-strong)" }}>
      <h2 className="flex items-center gap-2 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>
        <Icons.LogOut className="h-[17px] w-[17px]" style={{ color: "var(--ux-faint)" }} />{tr("help.leaveThisPageFast")}</h2>
      <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("help.ifSomeoneWalksInThisTurns")}</p>
      <button type="button" onClick={onLeave}
              className="ux-press mt-3 min-h-[44px] w-full rounded-[12px] text-xsm font-bold transition-colors"
              style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>{tr("help.showTheWeatherInstead")}</button>
    </section>
  );
}

function Never() {
  const tr = useT();
  const lines = [
    "We never ask for an OTP or your password.",
    "We never show your number to a buyer or an employer.",
    "We never share where you are unless you start an alert.",
  ];
  return (
    <section className="ux-lit rounded-[20px] p-[20px]" style={{ border: "1px solid var(--ux-line)" }}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>
        <Icons.ShieldCheck className="h-[17px] w-[17px]" style={{ color: "var(--ux-brand)" }} />{tr("help.whatWeNeverDo")}</h2>
      {lines.map((l) => (
        <p key={l} className="mb-2.5 flex gap-2.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          <Icons.Check className="mt-0.5 h-[15px] w-[15px] shrink-0" strokeWidth={2.6}
                       style={{ color: "var(--ux-green-ink)" }} />
          {l}
        </p>
      ))}
    </section>
  );
}

/**
 * The disguise.
 *
 * Deliberately dull and deliberately not themed — it has to look like a
 * different app, not like this one wearing a hat.
 */
function Veil({ onBack }: { onBack: () => void }) {
  const tr = useT();
  return (
    <div className="fixed inset-0 z-[100] overflow-auto p-10"
         style={{ background: "var(--ux-veil-bg)", color: "var(--ux-veil-ink)" }}>
      <h2 className="m-0 text-xl font-semibold">{tr("help.weatherHyderabad")}</h2>
      <p className="mt-3 text-base">32°C, partly cloudy. Light rain expected after 6 PM.</p>
      <p className="mt-1 text-base">{tr("help.tomorrowCWednesdayCThursdayC")}</p>
      <button type="button" onClick={onBack} className="mt-6 text-xs underline" style={{ color: "var(--ux-veil-hint)" }}>{tr("help.pressEscapeToGoBack")}</button>
    </div>
  );
}
