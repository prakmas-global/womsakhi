"use client";

import { useEffect, useState } from "react";

import styles from "./gallery.module.css";

type Card = { state: string; label: string; href: string; code?: string };
type Group = { title: string; route: string; note?: string; cards: Card[] };

const q = (route: string, state: string) => `${route}?preview=${state}`;

const GROUPS: Group[] = [
  {
    title: "Sign in",
    route: "/signin",
    cards: [
      { state: "phone", code: "A1", label: "Mobile number", href: q("/signin", "phone") },
      { state: "sms", code: "A2", label: "SMS code", href: q("/signin", "sms") },
      { state: "sms-wrong", code: "A3", label: "Wrong SMS code", href: q("/signin", "sms-wrong") },
      { state: "email", code: "A4", label: "Email", href: q("/signin", "email") },
      { state: "code", code: "A5", label: "Email code", href: q("/signin", "code") },
      { state: "sms-busy", code: "A6", label: "SMS busy, email instead", href: q("/signin", "sms-busy") },
      { state: "setup", code: "D1", label: "Staff: set up authenticator", href: q("/signin", "setup") },
      { state: "recovery", code: "D2", label: "Staff: recovery codes", href: q("/signin", "recovery") },
      { state: "mfa", code: "D3", label: "Staff: authenticator code", href: q("/signin", "mfa") },
    ],
  },
  {
    title: "Join",
    route: "/signup",
    cards: [
      { state: "contact", code: "B1", label: "Mobile and email", href: q("/signup", "contact") },
      { state: "code", code: "B2", label: "Email code", href: q("/signup", "code") },
      { state: "about", code: "B3", label: "Name and declaration", href: q("/signup", "about") },
    ],
  },
  {
    title: "Phone",
    route: "/app/phone",
    cards: [
      { state: "enter", code: "B4", label: "Add your mobile", href: q("/app/phone", "enter") },
      { state: "confirm", code: "B4", label: "Confirm by SMS code", href: q("/app/phone", "confirm") },
      { state: "sms-out", code: "B4", label: "SMS unavailable today", href: q("/app/phone", "sms-out") },
    ],
  },
  {
    title: "Verify",
    route: "/app/verify",
    cards: [
      { state: "upload", code: "C1", label: "Selfie and ID, nothing added", href: q("/app/verify", "upload") },
      { state: "picked", code: "C1", label: "Both photos added", href: q("/app/verify", "picked") },
      { state: "in-review", code: "C2", label: "In review", href: q("/app/verify", "in-review") },
      { state: "in-review-24h", code: "C3", label: "In review, past 24 h", href: q("/app/verify", "in-review-24h") },
      { state: "needs-info", code: "C4", label: "Asked to fix a photo", href: q("/app/verify", "needs-info") },
      { state: "rejected-locked", code: "C5", label: "Rejected, reapply later", href: q("/app/verify", "rejected-locked") },
      { state: "rejected-can-reapply", code: "C5", label: "Rejected, can reapply", href: q("/app/verify", "rejected-can-reapply") },
      { state: "approved", code: "C6", label: "Approved, welcome", href: q("/app/verify", "approved") },
    ],
  },
  {
    title: "Staff invite",
    route: "/accept-invite",
    cards: [
      { state: "valid", label: "Invitation", href: q("/accept-invite", "valid") },
      { state: "invalid", label: "Invitation no longer valid", href: q("/accept-invite", "invalid") },
      { state: "accepted", label: "Accepted", href: q("/accept-invite", "accepted") },
      { state: "incomplete", label: "Link missing its code", href: q("/accept-invite", "incomplete") },
    ],
  },
  {
    title: "Devices",
    route: "/app/settings/security",
    note: "Drawn without the app's top bar and rail: those need a real session.",
    cards: [{ state: "devices", code: "E1", label: "Signed-in devices", href: q("/app/settings/security", "devices") }],
  },
  {
    title: "App handoff",
    route: "/h",
    cards: [
      { state: "opening", label: "Opening WomSakhi", href: q("/h", "opening") },
      { state: "expired", label: "Link expired", href: q("/h", "expired") },
    ],
  },
  {
    title: "Old password pages",
    route: "/forgot-password, /reset-password",
    note: "Static notices for links emailed before passwords were removed. No preview needed.",
    cards: [
      { state: "forgot-password", label: "Forgot password", href: "/forgot-password" },
      { state: "reset-password", label: "Reset password", href: "/reset-password" },
    ],
  },
  {
    title: "Splash",
    route: "/signin",
    note: "Plays on app open: open in a new tab.",
    cards: [{ state: "splash", code: "S1", label: "Splash, then sign in", href: "/signin" }],
  },
];

const WIDTHS = [
  { key: "phone", label: "Phone", w: 390, h: 844, thumb: 216 },
  { key: "tablet", label: "Tablet", w: 820, h: 1180, thumb: 300 },
  { key: "desktop", label: "Desktop", w: 1440, h: 900, thumb: 400 },
] as const;

export function Gallery() {
  const [size, setSize] = useState<(typeof WIDTHS)[number]>(WIDTHS[0]);
  const scale = size.thumb / size.w;
  const total = GROUPS.reduce((n, g) => n + g.cards.length, 0);

  /*
    Every thumbnail is a live screen, and several put the cursor in a field as
    they load; the browser then scrolls the gallery to that thumbnail. A page
    whose address points at an element (#gallery) skips that autofocus, so the
    address gets one before any thumbnail loads. (The screens' own focus calls
    are switched off inside a gallery frame, in lib/auth-preview.)
  */
  const [framesOn, setFramesOn] = useState(false);
  useEffect(() => {
    if (window.location.hash !== "#gallery") window.location.replace("#gallery");
    const t = window.setTimeout(() => setFramesOn(true));
    return () => window.clearTimeout(t);
  }, []);


  return (
    <main id="gallery" className={styles.page}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Local preview · not in production</p>
          <h1 className={styles.title}>Auth screens</h1>
          <p className={styles.sub}>
            {total} states. Each opens the real page with <code>?preview=</code>: sample data, no API calls, no sign-in.
          </p>
        </div>
        <div className={styles.switch} role="radiogroup" aria-label="Thumbnail width">
          {WIDTHS.map((s) => (
            <button key={s.key} type="button" role="radio" aria-checked={size.key === s.key} onClick={() => setSize(s)}>
              {s.label} <span>{s.w}</span>
            </button>
          ))}
        </div>
      </header>

      {GROUPS.map((g) => (
        <section key={g.title} className={styles.group} aria-labelledby={`g-${g.title}`}>
          <div className={styles.groupHead}>
            <h2 id={`g-${g.title}`}>{g.title}</h2>
            <code>{g.route}</code>
          </div>
          {g.note && <p className={styles.note}>{g.note}</p>}
          <ul className={styles.grid} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size.thumb + 26}px, 1fr))` }}>
            {g.cards.map((c) => (
              <li key={c.href} className={styles.card}>
                <a href={c.href} target="_blank" rel="noopener" className={styles.thumb}
                   style={{ width: size.thumb, height: Math.round(size.h * scale) }} aria-label={`Open ${c.label}`}>
                  {framesOn && <iframe
                    src={c.href}
                    title={`${g.title}: ${c.label}`}
                    loading="lazy"
                    tabIndex={-1}
                    style={{ width: size.w, height: size.h, transform: `scale(${scale})` }}
                  />}
                </a>
                <div className={styles.meta}>
                  <div>
                    <b>{c.code ? <span className={styles.code}>{c.code}</span> : null}{c.label}</b>
                    <small>{c.href}</small>
                  </div>
                  <a href={c.href} target="_blank" rel="noopener" className={styles.open}>Open</a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
