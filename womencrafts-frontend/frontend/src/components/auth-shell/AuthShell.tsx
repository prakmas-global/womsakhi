"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { getImageProps } from "next/image";

import { rememberPreSignInChoice, useI18n } from "@/i18n";
import { authSans, authSerif } from "./fonts";
import { AuthIcon, type AuthIconName } from "./icons";
import { websiteUrl } from "@/lib/site";
import "./auth-shell.css";

/** Which photo fills the visual side. "plain" is the logo's moving gradient instead. */
export type AuthPhoto = "signin" | "join" | "email" | "review" | "approved" | "upload" | "camera" | "plain";

interface Pic { src: string; w: number; h: number }

/**
 * Each journey photo, with its crop on the web (the left half, full height)
 * and on the phone band. `band` swaps in a wider picture for the band where
 * the portrait one would be all forehead.
 */
const PHOTOS: Record<Exclude<AuthPhoto, "plain">, { web: Pic; band?: Pic; webPos: string; bandPos: string }> = {
  // The wide terrace of five on every screen: it fills a laptop without cropping faces.
  signin: { web: { src: "/ux/auth/signin-band.webp", w: 1448, h: 1086 }, webPos: "40% 35%", bandPos: "30% 30%" },
  join: { web: { src: "/ux/auth/join.webp", w: 1448, h: 1086 }, webPos: "22% 50%", bandPos: "21% 30%" },
  email: { web: { src: "/ux/auth/email.webp", w: 1448, h: 1086 }, webPos: "30% 50%", bandPos: "22% 30%" },
  review: { web: { src: "/ux/auth/review.webp", w: 870, h: 1086 }, webPos: "46% 50%", bandPos: "0% 22%" },
  approved: { web: { src: "/ux/auth/approved.webp", w: 1448, h: 1086 }, webPos: "48% 50%", bandPos: "47% 20%" },
  upload: { web: { src: "/ux/auth/upload.webp", w: 620, h: 1086 }, webPos: "52% 50%", bandPos: "50% 22%" },
  camera: { web: { src: "/ux/auth/camera.webp", w: 700, h: 886 }, webPos: "30% 40%", bandPos: "30% 25%" },
};

/** The photo, art-directed: one `<picture>`, so a phone never downloads the web crop. */
function Photo({ photo }: { photo: Exclude<AuthPhoto, "plain"> }) {
  const p = PHOTOS[photo];
  const common = { alt: "", quality: 75, fetchPriority: "high" as const, loading: "eager" as const };
  const { props: { srcSet: webSet, ...rest } } = getImageProps({
    ...common, src: p.web.src, width: p.web.w, height: p.web.h, sizes: "(min-width: 1024px) 55vw, 100vw",
  });
  const bandSet = p.band
    ? getImageProps({ ...common, src: p.band.src, width: p.band.w, height: p.band.h, sizes: "100vw" }).props.srcSet
    : undefined;
  // A portrait photo cannot fill a wide screen without cutting faces: on a
  // laptop it stands on the left, sharp, over a blurred copy filling the rest.
  const portrait = p.web.h > p.web.w;
  return (
    <>
      {portrait && <span className="wsa-img-bed" style={{ backgroundImage: `url(${rest.src})` }} aria-hidden />}
      <picture>
        {bandSet && <source media="(max-width: 1023.98px)" srcSet={bandSet} />}
        <source srcSet={webSet} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative; alt="" comes from getImageProps */}
        <img {...rest} className={`wsa-img${portrait ? " is-portrait" : ""}`} />
      </picture>
    </>
  );
}

/**
 * On a laptop the sign-in photo becomes a slow slideshow of the community —
 * every slide stacked, cross-faded every few seconds. Phones (data) and
 * reduced motion keep the one photo.
 */
const SLIDES: Exclude<AuthPhoto, "plain">[] = ["signin", "join", "approved", "email"];  // all landscape
const SLIDE_MS = 7000;
const SLIDE_QUERY = "(min-width: 1024px) and (prefers-reduced-motion: no-preference)";

function subscribeSlides(change: () => void) {
  const mq = window.matchMedia(SLIDE_QUERY);
  mq.addEventListener("change", change);
  return () => mq.removeEventListener("change", change);
}

function Slideshow() {
  const run = useSyncExternalStore(subscribeSlides, () => window.matchMedia(SLIDE_QUERY).matches, () => false);
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t = window.setInterval(() => setAt((i) => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => window.clearInterval(t);
  }, [run]);
  return (
    <>
      {(run ? SLIDES : SLIDES.slice(0, 1)).map((p, i) => (
        <div key={p} className={`wsa-photo wsa-slide${i === (run ? at : 0) ? " is-on" : ""}`}
          style={{ "--wpos": PHOTOS[p].webPos, "--bpos": PHOTOS[p].bandPos } as React.CSSProperties}>
          <Photo photo={p} />
        </div>
      ))}
    </>
  );
}

type InfoPanel = "terms" | "privacy" | "help" | "contact";

const INFO: Record<InfoPanel, {
  title: string;
  eyebrow: string;
  intro: string;
  icon: AuthIconName;
  points: string[];
  action?: { label: string; href: string; icon: AuthIconName };
  secondary?: { label: string; href: string };
}> = {
  terms: {
    title: "Terms of use",
    eyebrow: "Clear and respectful",
    icon: "file",
    intro: "A clear agreement for using WomSakhi safely and respectfully.",
    points: [
      "Use accurate account information and never share your sign-in codes.",
      "Treat every member with dignity. Harassment, fraud, and exploitation are not allowed.",
      "Opportunities must be honest, lawful, and transparent about payment and expectations.",
      "We may restrict accounts that put members or the community at risk.",
    ],
    action: { label: "Read the full terms", href: websiteUrl("/terms"), icon: "file" },
  },
  privacy: {
    title: "Your privacy",
    eyebrow: "Private by design",
    icon: "shield",
    intro: "Your information belongs to you. We collect only what is needed to run and protect your account.",
    points: [
      "There are no passwords. You sign in with a one-time code sent to your mobile or email.",
      "Private identity documents are limited to authorised review team members.",
      "We do not sell your personal information or phone number.",
      "You can request access, correction, or deletion of your account information.",
    ],
    action: { label: "Read the privacy policy", href: websiteUrl("/privacy"), icon: "shield" },
  },
  help: {
    title: "Need help?",
    eyebrow: "Real people, ready to help",
    icon: "support",
    intro: "We will help you get back into your account or answer questions about joining.",
    points: [
      "Sign in with a code sent to your mobile or email — there is no password to forget.",
      "Check your Spam or Promotions folder if an email code does not arrive within a minute.",
      "Never share a one-time code with anyone, even someone who says they work at WomSakhi.",
    ],
    action: { label: "Email support", href: "mailto:hello@womsakhi.com", icon: "mail" },
    secondary: { label: "Visit contact centre", href: websiteUrl("/contact") },
  },
  contact: {
    title: "Contact WomSakhi",
    eyebrow: "We are listening",
    icon: "msg",
    intro: "A real person can help with account access, safety, verification, or general questions.",
    points: ["Email us at hello@womsakhi.com", "Include the email address or mobile number used for your account.", "For your safety, never send a one-time code."],
    action: { label: "Write to WomSakhi", href: "mailto:hello@womsakhi.com", icon: "mail" },
    secondary: { label: "Open contact centre", href: websiteUrl("/contact") },
  },
};

/** Website pages open in a new tab, so her sign-in progress here is kept. */
const isWebsite = (href: string) => /^https?:\/\//.test(href);
const away = (href: string) => (isWebsite(href) ? { target: "_blank", rel: "noopener noreferrer" } : {});

function InformationPanel({ panel, onBack }: { panel: InfoPanel; onBack: () => void }) {
  const info = INFO[panel];
  return (
    <div className="wsa-infoview" data-info={panel} role="region" aria-live="polite" aria-label={info.title}>
      <button type="button" className="wsa-back" onClick={onBack}><AuthIcon name="back" /> Back</button>
      <header className="wsa-infohero">
        <span className="wsa-infoicon"><AuthIcon name={info.icon} /></span>
        <div>
          <span className="wsa-infokicker">{info.eyebrow}</span>
          <h1 className="wsa-t">{info.title}</h1>
        </div>
      </header>
      <p className="wsa-s">{info.intro}</p>
      <ul className="wsa-points">
        {info.points.map((point) => (
          <li key={point}><span className="wsa-pointicon"><AuthIcon name="check" /></span><span>{point}</span></li>
        ))}
      </ul>
      {info.action && (
        <a className="wsa-infoaction" href={info.action.href} {...away(info.action.href)}>
          <AuthIcon name={info.action.icon} />
          <span>{info.action.label}{isWebsite(info.action.href) && <span className="sr-only"> (opens the WomSakhi website in a new tab)</span>}</span>
          <AuthIcon name={isWebsite(info.action.href) ? "external" : "arrow"} />
        </a>
      )}
      {info.secondary && (
        <a className="wsa-infosecondary" href={info.secondary.href} {...away(info.secondary.href)}>
          {info.secondary.label}
          <span className="sr-only"> (opens the WomSakhi website in a new tab)</span>
          <AuthIcon name="external" />
        </a>
      )}
    </div>
  );
}

/**
 * When the phone's keyboard opens (or she taps a field), keep the field she is
 * typing in AND the button that sends it on screen: scroll just enough to
 * bring the primary button above the keyboard, never so far that the field
 * itself leaves the top. Nothing moves on page load (an autofocused field
 * with no keyboard up keeps the photo in view), and nothing moves when both
 * are already visible.
 */
function useKeepFormInView(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const vv = window.visualViewport;
    let timer = 0;
    const fit = () => {
      const field = document.activeElement as HTMLElement | null;
      if (!field || !el.contains(field) || !field.matches("input, textarea, select")) return;
      const box = (field.closest(".wsa-in, .wsa-phone, .ac-phone, .auth-code") ?? field).getBoundingClientRect();
      const scope = field.closest("form") ?? field.closest(".ac, .wsa-card") ?? el;
      const go = Array.from(scope.querySelectorAll<HTMLElement>(".wsa-go, .ac-go"))
        .find((b) => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().top >= box.top);
      const top = vv ? vv.offsetTop : 0;
      const bottom = top + (vv ? vv.height : window.innerHeight);
      const want = (go ? go.getBoundingClientRect().bottom : box.bottom) + 12;
      let delta = want - bottom;
      if (delta <= 0) {
        if (box.top < top + 8) delta = box.top - top - 8;
        else return;
      } else {
        delta = Math.min(delta, box.top - top - 8);
      }
      if (Math.abs(delta) < 2) return;
      let smooth = true;
      try { smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* old engines */ }
      window.scrollBy({ top: delta, behavior: smooth ? "smooth" : "auto" });
    };
    const soon = () => { window.clearTimeout(timer); timer = window.setTimeout(fit, 260); };
    el.addEventListener("focusin", soon);
    vv?.addEventListener("resize", soon);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("focusin", soon);
      vv?.removeEventListener("resize", soon);
    };
  }, [root]);
}

const TRUST: { icon: "shield" | "check" | "lock"; text: string; sub: string }[] = [
  { icon: "shield", text: "Women only", sub: "A safe space" },
  { icon: "check", text: "Verified", sub: "By a real person" },
  { icon: "lock", text: "Private", sub: "Your number stays yours" },
];

export function TrustChips() {
  return (
    <ul className="wsa-trust" aria-label="Why WomSakhi is safe">
      {TRUST.map((c) => (
        <li key={c.text}>
          <span className="wsa-trust-ic"><AuthIcon name={c.icon} /></span>
          <b>{c.text}</b>
          <small>{c.sub}</small>
        </li>
      ))}
    </ul>
  );
}

/** Two frosted badges that drift over the photo on the web — what the community promises. */
function FloatingBadges() {
  return (
    <div className="wsa-floats" aria-hidden>
      <span className="wsa-float wsa-float-a">
        <span className="wsa-float-ic"><AuthIcon name="shield" /></span>
        <span><b>Women-only community</b><small>Every member checked by a real person</small></span>
      </span>
      <span className="wsa-float wsa-float-b">
        <span className="wsa-float-ic is-gold"><AuthIcon name="check" /></span>
        <span><b>Learn · Work · Earn</b><small>From home, at your pace</small></span>
      </span>
    </div>
  );
}

function LanguageSwitch() {
  const { locale, setLocale } = useI18n();
  const choose = (code: string) => {
    setLocale(code as Parameters<typeof setLocale>[0]);
    rememberPreSignInChoice(code);
  };
  return (
    <span className="wsa-lang">
      <button type="button" lang="hi" aria-pressed={locale === "hi"} onClick={() => choose("hi")}>हिन्दी</button>
      <span aria-hidden> · </span>
      <button type="button" lang="en" aria-pressed={locale === "en"} onClick={() => choose("en")}>English</button>
    </span>
  );
}


/**
 * The one layout every auth screen sits in (sign-in, verification, confirm
 * mobile, staff invite, the no-password notice, route errors).
 *
 * Full screen, no margins. On a laptop: the journey's photo fills the left
 * half top to bottom with its caption, and the form fills the right half —
 * logo and language at the top, the step centred, the links at the foot. On
 * a phone: the photo is a band with the logo on frosted glass, and the form
 * is a sheet rising over it to the bottom of the screen.
 *
 * `photo="plain"` (staff, refusals) shows the logo's moving gradient instead.
 * `stepKey` re-keys the step so its content rises in when the step changes;
 * a new photo cross-fades in on its own.
 */
export function AuthShell({
  photo = "signin",
  caption,
  children,
  footer,
  showTrust = false,
  tag,
  aside,
  screen,
  flow,
  stepKey,
}: {
  photo?: AuthPhoto;
  /** Over the photo on the web (a heading and a line). */
  caption?: { title: string; text: string };
  children: ReactNode;
  /** Rendered under the step, outside it (the reCAPTCHA host). */
  footer?: ReactNode;
  showTrust?: boolean;
  /** A small label such as "Staff", by the logo and on the caption. */
  tag?: string;
  /** Extra rows under the caption on the web (the staff panel). */
  aside?: ReactNode;
  /** Stable visual hook for a screen-specific composition. It never affects auth state or behaviour. */
  screen?: string;
  /** Shared visual family for screens that use the same shell. */
  flow?: string;
  /** Changes when the step changes, so the new step animates in. */
  stepKey?: string;
}) {
  const [panel, setPanel] = useState<InfoPanel | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useKeepFormInView(rootRef);
  const plain = photo === "plain";
  const p = plain ? null : PHOTOS[photo];
  const vars = p ? ({ "--wpos": p.webPos, "--bpos": p.bandPos } as React.CSSProperties) : undefined;

  return (
    <div
      ref={rootRef}
      className={`wsa ${authSerif.variable} ${authSans.variable}${plain ? " wsa-plain" : ""}`}
      data-photo={photo}
      data-screen={screen}
      data-flow={flow}
      style={vars}
    >
      <aside className="wsa-visual" aria-label={caption?.title} aria-hidden={!caption || undefined}>
        {plain ? (
          <>
            <div className="wsa-mesh" />
            <div className="wsa-mesh-mark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ux/brand/womsakhi-emblem.webp" alt="" width={600} height={373} />
            </div>
          </>
        ) : (
          <>
            {photo === "signin"
              ? <><Slideshow /><FloatingBadges /></>
              : <div className="wsa-photo" key={photo}><Photo photo={photo as Exclude<AuthPhoto, "plain">} /></div>}
          </>
        )}
        <div className="wsa-pill">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/brand/wordmark-brand.png" alt="WomSakhi" width={720} height={144} />
          {tag && <span className="wsa-tag">{tag}</span>}
        </div>
        {caption && (
          <div className="wsa-cap">
            {tag && <span className="wsa-tag">{tag}</span>}
            <h2>{caption.title}</h2>
            <p>{caption.text}</p>
            {aside}
          </div>
        )}
      </aside>

      <main className="wsa-main">
        <div className="wsa-aurora" aria-hidden />
        <header className="wsa-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/brand/wordmark-brand.png" alt="WomSakhi" width={720} height={144} />
          {tag && <span className="wsa-tag">{tag}</span>}
          <LanguageSwitch />
        </header>
        <section className="wsa-card" key={panel ?? stepKey ?? "content"}>
          {panel ? <InformationPanel panel={panel} onBack={() => setPanel(null)} /> : children}
          {!panel && showTrust && <TrustChips />}
        </section>
        {footer}
        <footer className="wsa-foot">
          <nav aria-label="About WomSakhi">
            <button type="button" aria-pressed={panel === "privacy"} onClick={() => setPanel("privacy")}>Privacy</button>
            <button type="button" aria-pressed={panel === "terms"} onClick={() => setPanel("terms")}>Terms</button>
            <button type="button" aria-pressed={panel === "help"} onClick={() => setPanel("help")}>Help</button>
            <button type="button" aria-pressed={panel === "contact"} onClick={() => setPanel("contact")}>Contact</button>
          </nav>
          <LanguageSwitch />
        </footer>
      </main>
    </div>
  );
}

export default AuthShell;
