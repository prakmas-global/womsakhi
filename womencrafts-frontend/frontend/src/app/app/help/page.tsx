"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { useResource } from "@/lib/use-resource";
import { apiHelplines, apiRaiseAlert, type Helpline } from "@/lib/safety-api";
import { apiSendMessage } from "@/lib/member-api";

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
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]"
             style={{ color: "var(--ux-brand)" }}>Help</p>
          <h1 className="mt-2 text-[clamp(1.625rem,3.6vw,2.5rem)] font-extrabold leading-[1.06] tracking-[-0.04em]"
              style={{ color: "var(--ux-ink)" }}>
            What has gone wrong?
          </h1>
          <p className="mt-2.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            Ask in your own words, in any language — or pick what it is about. If you would rather
            talk to a person, that is on this page too.
          </p>
        </header>

        <Ask value={q} onChange={setQ} inputRef={inputRef} />

        <div className="grid items-start gap-[24px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0">
        <Head>What is it about</Head>
        <div className="mb-7 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(232px, 1fr))" }}>
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
                <b className="block text-[0.875rem] font-bold" style={{ color: "var(--ux-ink)" }}>{t.title}</b>
                <span className="mt-0.5 block text-[0.75rem] leading-snug" style={{ color: "var(--ux-muted)" }}>
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
            <div className="px-[20px] py-8 text-center text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
              No answer here for that yet — a person can help.<br />
              Use <b style={{ color: "var(--ux-ink)" }}>Message her</b> below and it goes straight to the team.
            </div>
          ) : rows.map((x, i) => {
            const on = open === x.id;
            return (
              <div key={x.id} style={i ? { borderTop: "1px solid var(--ux-line)" } : undefined}>
                <button type="button" aria-expanded={on}
                        onClick={() => setOpen(on ? null : x.id)}
                        className="ux-press flex w-full items-center gap-3 px-[20px] py-[16px] text-start text-[0.875rem] font-semibold tracking-[-0.01em]"
                        style={{ color: "var(--ux-ink)" }}>
                  <Mark text={x.q} q={q} />
                  <Icons.ChevronRight className="ms-auto h-4 w-4 shrink-0 transition-transform"
                                      style={{ color: "var(--ux-faint)",
                                               transform: on ? "rotate(90deg)" : undefined }} />
                </button>
                {on && (
                  <div className="pb-4 pe-[19px] ps-[50px] text-[0.8125rem] leading-[1.65]"
                       style={{ color: "var(--ux-ink-2)" }}>
                    {x.a}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.75rem]"
                         style={{ color: "var(--ux-muted)" }}>
                      {helped.has(x.id) ? "Good. Glad that sorted it." : (
                        <>
                          Did this help?
                          <button type="button" onClick={() => setHelped((s) => new Set(s).add(x.id))}
                                  className="ux-press min-h-[34px] rounded-[8px] px-3 text-[0.75rem] font-bold"
                                  style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                            Yes
                          </button>
                          <button type="button"
                                  onClick={() => personRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                                  className="ux-press min-h-[34px] rounded-[8px] px-3 text-[0.75rem] font-bold"
                                  style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                            No, talk to a person
                          </button>
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
    <h2 className="mb-3 text-[0.6875rem] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--ux-faint)" }}>
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
    <section className="ux-sq mb-6 flex flex-wrap items-center gap-[20px] overflow-hidden rounded-[20px] px-5 py-[20px]"
             style={{ border: "1px solid color-mix(in srgb, var(--ux-danger-solid) 55%, transparent)",
                      background: "linear-gradient(100deg, var(--ux-danger-tint), var(--ux-surface) 62%)",
                      boxShadow: "0 18px 44px -26px var(--ux-danger-solid), var(--ux-shadow-card), inset 0 1px 0 var(--ux-sheen)" }}>
      <span className="ux-beat grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[16px]"
            style={{ background: "linear-gradient(150deg, var(--ux-danger-solid), color-mix(in srgb, var(--ux-danger-solid) 64%, #000))",
                     color: "#fff" }}>
        <Icons.TriangleAlert className="h-[22px] w-[22px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[1rem] font-extrabold tracking-[-0.01em]" style={{ color: "var(--ux-ink)" }}>
          {sent ? (failed ? "Could not send — call 181" : "Sent. Your people know.") : "Something is happening right now"}
        </p>
        <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--ux-ink-2)" }}>
          {sent
            ? (failed
                ? "The alert did not reach us. The helplines below work without credit."
                : "They can see where you are while this alert is open.")
            : "Your people are told where you are. Nothing is sent until you finish holding."}
        </p>
      </div>
      <button type="button" disabled={sent}
              onPointerDown={(e) => { e.preventDefault(); start(); }}
              onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
              aria-label="Press and hold for one and a half seconds to send an alert"
              className="relative flex min-h-[50px] shrink-0 items-center gap-2 overflow-hidden rounded-[12px] px-6 text-[0.875rem] font-extrabold tracking-[-0.005em] transition-transform active:scale-[0.985]"
              style={{ background: sent && !failed
                         ? "var(--ux-green-ink)"
                         : "linear-gradient(150deg, var(--ux-danger-solid), color-mix(in srgb, var(--ux-danger-solid) 72%, #000))",
                       color: "#fff",
                       boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 12px 26px -12px var(--ux-danger-solid)" }}>
        {/* The bar is the promise: nothing leaves until it is full. */}
        <i className="absolute inset-y-0 start-0 block"
           style={{ width: `${held * 100}%`, background: "rgba(255,255,255,0.28)" }} />
        <span className="relative">
          {sent ? (failed ? "Try 181" : "Sent") : held > 0 ? "Keep holding…" : "Hold to send an alert"}
        </span>
      </button>
    </section>
  );
}

/* ── ask ────────────────────────────────────────────────────────────────── */

function Ask({
  value, onChange, inputRef,
}: { value: string; onChange: (v: string) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [hearing, setHearing] = useState(false);
  const [speech, setSpeech] = useState(false);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setSpeech(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const listen = () => {
    const w = window as unknown as Record<string, unknown>;
    const Rec = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      (new () => { lang: string; interimResults: boolean; start: () => void;
                   onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
                   onerror: (() => void) | null; onend: (() => void) | null }) | undefined;
    if (!Rec) return;
    const r = new Rec();
    r.lang = "hi-IN";                 // what she speaks; the answers match either way
    r.interimResults = true;
    r.onresult = (e) => {
      const said = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript)
        .join(" ").trim();
      if (said) onChange(said);
    };
    r.onerror = () => setHearing(false);
    r.onend = () => { setHearing(false); inputRef.current?.focus(); };
    setHearing(true);
    r.start();
  };

  return (
    <>
      <div className="ux-lit mb-[8px] mt-[20px] flex items-center gap-3 rounded-[16px] py-1.5 pe-1.5 ps-[18px]"
           style={{ border: "1px solid var(--ux-line-strong)" }}>
        <Icons.Search className="h-[19px] w-[19px] shrink-0" strokeWidth={2.2} style={{ color: "var(--ux-faint)" }} />
        <input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)}
               placeholder="My money has not come · मेरा पैसा नहीं आया"
               aria-label="Ask what has gone wrong"
               className="min-w-0 flex-1 border-0 bg-transparent py-3 text-[1rem] outline-none"
               style={{ color: "var(--ux-ink)" }} />
        {speech && (
          <button type="button" onClick={listen} aria-label="Ask by speaking"
                  className="ux-press grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[12px] transition-transform hover:-translate-y-px"
                  style={hearing
                    ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))", color: "var(--ux-on-brand)" }
                    : { background: "linear-gradient(150deg, var(--ux-tint-violet), color-mix(in srgb, var(--ux-tint-violet) 55%, var(--ux-surface)))",
                        color: "var(--ux-violet-ink)", boxShadow: "inset 0 1px 0 var(--ux-sheen)" }}>
            <Icons.Mic className="h-[19px] w-[19px]" />
          </button>
        )}
      </div>
      <p className="mb-6 ms-0.5 text-[0.75rem]" style={{ color: "var(--ux-faint)" }}>
        {speech
          ? "You can speak instead of typing. Hindi, Telugu, Tamil, Bangla and English all work."
          : "Type in any language — Hindi, Telugu, Tamil, Bangla and English all work."}
      </p>
    </>
  );
}

/* ── a person ───────────────────────────────────────────────────────────── */

function Person({ innerRef }: { innerRef: React.RefObject<HTMLDivElement | null> }) {
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
        <h2 className="text-[1rem] font-extrabold" style={{ color: "var(--ux-ink)" }}>
          {sent ? "She has your message." : "Still stuck? Talk to a person."}
        </h2>
        <p className="mt-1 text-[0.8125rem]" style={{ color: "var(--ux-ink-2)" }}>
          {sent
            ? "Someone from the team will reply in Messages. You do not have to wait here."
            : "Someone answers in about 4 minutes, 9 AM to 9 PM. She speaks Hindi and Telugu."}
        </p>
        {failed && (
          <p className="mt-1 text-[0.8125rem] font-semibold" style={{ color: "var(--ux-danger-solid)" }}>
            That did not send. Try again, or call 181 — it is free.
          </p>
        )}
      </div>
      <div className="relative flex flex-wrap gap-2">
        {sent ? (
          <Link href="/app/messages"
                className="ux-press flex min-h-[48px] items-center gap-2 rounded-[12px] px-5 text-[0.8125rem] font-bold"
                style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                         color: "var(--ux-on-brand)" }}>
            Open Messages <Icons.ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" onClick={message} disabled={busy}
                  className="ux-press flex min-h-[48px] items-center gap-2 rounded-[12px] px-5 text-[0.8125rem] font-bold disabled:opacity-60"
                  style={{ background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                           color: "var(--ux-on-brand)",
                           boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }}>
            <Icons.MessageCircle className="h-4 w-4" /> {busy ? "Sending…" : "Message her"}
          </button>
        )}
        <a href="tel:181"
           className="ux-press flex min-h-[48px] items-center gap-2 rounded-[12px] px-5 text-[0.8125rem] font-bold"
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
  // Four is what fits without scrolling; the rest live on the safety screen.
  const shown = lines.slice(0, 4);
  return (
    <section className="ux-lit rounded-[20px] p-[20px]" style={{ border: "1px solid var(--ux-line)" }}>
      <h2 className="flex items-center gap-2 text-[0.875rem] font-extrabold" style={{ color: "var(--ux-ink)" }}>
        <Icons.Phone className="h-[17px] w-[17px]" style={{ color: "var(--ux-brand)" }} />
        Numbers that always work
      </h2>
      <p className="mb-3 mt-1 flex flex-wrap items-center gap-2 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
        Free from any phone.
        <span className="rounded-full px-2.5 py-1 text-[0.6875rem] font-extrabold uppercase tracking-[0.04em]"
              style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
          No credit needed
        </span>
      </p>
      {shown.length === 0 ? (
        <p className="text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
          Could not load these. <a href="tel:181" style={{ color: "var(--ux-brand)" }}>Call 181</a> — it always works.
        </p>
      ) : shown.map((h) => (
        <div key={h.number}
             className="mb-2 flex items-center gap-3 rounded-[12px] p-[12px] transition-transform last:mb-0 hover:translate-x-0.5"
             style={{ border: "1px solid var(--ux-line)", background: "var(--ux-surface)" }}>
          <b className="min-w-[78px] text-[1.25rem] font-extrabold tabular-nums tracking-[-0.03em]"
             style={{ color: "var(--ux-ink)" }}>{h.number}</b>
          <span className="min-w-0 flex-1 text-[0.75rem] leading-snug" style={{ color: "var(--ux-muted)" }}>
            {h.name}
          </span>
          <a href={`tel:${h.number}`}
             className="ux-press flex min-h-[38px] shrink-0 items-center rounded-[12px] px-[16px] text-[0.75rem] font-extrabold"
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
  return (
    <section className="rounded-[20px] p-[20px]"
             style={{ background: "var(--ux-surface-2)", border: "1px dashed var(--ux-line-strong)" }}>
      <h2 className="flex items-center gap-2 text-[0.875rem] font-extrabold" style={{ color: "var(--ux-ink)" }}>
        <Icons.LogOut className="h-[17px] w-[17px]" style={{ color: "var(--ux-faint)" }} />
        Leave this page fast
      </h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
        If someone walks in, this turns into a weather page straight away. Press Escape to come back.
      </p>
      <button type="button" onClick={onLeave}
              className="ux-press mt-3 min-h-[44px] w-full rounded-[12px] text-[0.8125rem] font-bold transition-colors"
              style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
        Show the weather instead
      </button>
    </section>
  );
}

function Never() {
  const lines = [
    "We never ask for an OTP or your password.",
    "We never show your number to a buyer or an employer.",
    "We never share where you are unless you start an alert.",
  ];
  return (
    <section className="ux-lit rounded-[20px] p-[20px]" style={{ border: "1px solid var(--ux-line)" }}>
      <h2 className="mb-3 flex items-center gap-2 text-[0.875rem] font-extrabold" style={{ color: "var(--ux-ink)" }}>
        <Icons.ShieldCheck className="h-[17px] w-[17px]" style={{ color: "var(--ux-brand)" }} />
        What we never do
      </h2>
      {lines.map((l) => (
        <p key={l} className="mb-2.5 flex gap-2.5 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
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
  return (
    <div className="fixed inset-0 z-[100] overflow-auto p-10"
         style={{ background: "#ffffff", color: "#222" }}>
      <h2 className="m-0 text-[1.25rem] font-semibold">Weather — Hyderabad</h2>
      <p className="mt-3 text-[1rem]">32°C, partly cloudy. Light rain expected after 6 PM.</p>
      <p className="mt-1 text-[1rem]">Tomorrow 29°C · Wednesday 31°C · Thursday 30°C</p>
      <button type="button" onClick={onBack} className="mt-6 text-[0.75rem] underline" style={{ color: "#888" }}>
        Press Escape to go back.
      </button>
    </div>
  );
}
