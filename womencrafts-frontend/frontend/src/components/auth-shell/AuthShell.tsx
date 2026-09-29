"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { getImageProps } from "next/image";

import { rememberPreSignInChoice, useI18n } from "@/i18n";
import { authSans, authSerif } from "./fonts";
import { AuthIcon, type AuthIconName } from "./icons";
import { websiteUrl } from "@/lib/site";
import "./auth-shell.css";

export type AuthPhoto = "signin" | "join" | "email" | "review" | "approved" | "upload" | "camera" | "plain";

interface Pic { src: string; w: number; h: number }

/**
 * Every photo, its web crop (the approved `object-position` for the split
 * panel) and its phone band: the band height, how tall the picture is drawn
 * inside it, how far it is pulled up, and its position — all in design units
 * (1u = one pixel of the approved 258-px phone frame), copied from the mockup.
 * `band` swaps in a wider picture for the phone header (sign-in uses the
 * terrace of five on phones, the three generations on the web).
 */
const PHOTOS: Record<Exclude<AuthPhoto, "plain">, {
  web: Pic; band?: Pic; webPos: string;
  mh: number; mih: number; moff: number; mpos: string; mtop: number; tpos?: string;
}> = {
  signin: { web: { src: "/ux/auth/signin.webp", w: 1122, h: 1402 }, band: { src: "/ux/auth/signin-band.webp", w: 1448, h: 1086 },
    webPos: "50% 40%", mh: 262, mih: 262, moff: 0, mpos: "30% 0%", mtop: 170, tpos: "30% 30%" },
  join: { web: { src: "/ux/auth/join.webp", w: 1448, h: 1086 }, webPos: "22% 50%", mh: 224, mih: 264, moff: 0, mpos: "21% 0%", mtop: 184, tpos: "21% 30%" },
  email: { web: { src: "/ux/auth/email.webp", w: 1448, h: 1086 }, webPos: "30% 50%", mh: 214, mih: 236, moff: 0, mpos: "22% 0%", mtop: 176, tpos: "22% 30%" },
  review: { web: { src: "/ux/auth/review.webp", w: 870, h: 1086 }, webPos: "46% 50%", mh: 214, mih: 362, moff: -16, mpos: "0% 0%", mtop: 176, tpos: "0% 22%" },
  approved: { web: { src: "/ux/auth/approved.webp", w: 1448, h: 1086 }, webPos: "48% 50%", mh: 300, mih: 322, moff: 0, mpos: "47% 0%", mtop: 262, tpos: "47% 20%" },
  upload: { web: { src: "/ux/auth/upload.webp", w: 620, h: 1086 }, webPos: "52% 50%", mh: 214, mih: 452, moff: -29, mpos: "50% 0%", mtop: 176, tpos: "50% 22%" },
  camera: { web: { src: "/ux/auth/camera.webp", w: 700, h: 886 }, webPos: "30% 40%", mh: 214, mih: 327, moff: -20, mpos: "30% 0%", mtop: 176, tpos: "30% 25%" },
};

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

/** The photo, art-directed: one `<picture>`, so a phone never downloads the web crop. */
function Photo({ photo }: { photo: Exclude<AuthPhoto, "plain"> }) {
  const p = PHOTOS[photo];
  const common = { alt: "", quality: 75, fetchPriority: "high" as const, loading: "eager" as const };
  const { props: { srcSet: webSet, ...rest } } = getImageProps({
    ...common, src: p.web.src, width: p.web.w, height: p.web.h, sizes: "(min-width: 1024px) 52vw, (orientation: landscape) and (max-height: 540px) 40vw, 100vw",
  });
  const bandSet = p.band
    ? getImageProps({ ...common, src: p.band.src, width: p.band.w, height: p.band.h, sizes: "(orientation: landscape) and (max-height: 540px) 40vw, 100vw" }).props.srcSet
    : undefined;
  return (
    <picture>
      {bandSet && <source media="(max-width: 1023.98px)" srcSet={bandSet} />}
      <source srcSet={webSet} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative; alt="" comes from getImageProps */}
      <img {...rest} className="wsa-img" />
    </picture>
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

const TRUST: { icon: "shield" | "check" | "lock"; text: string }[] = [
  { icon: "shield", text: "Women only" },
  { icon: "check", text: "Every member verified" },
  { icon: "lock", text: "Number stays private" },
];

export function TrustChips() {
  return (
    <ul className="wsa-trust" aria-label="Why WomSakhi is safe">
      {TRUST.map((c) => <li key={c.text}><AuthIcon name={c.icon} />{c.text}</li>)}
    </ul>
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
 * The one layout every auth screen sits in (sign-in, join, verify, staff).
 *
 *  ≥1024 px  the approved split: the journey's photo (43 %) with a caption
 *            card | cream side with the full logo, the white card, the footer.
 *  640–1023  the photo becomes a wide header band fading into cream, the card
 *            (web width) overlapping it, the wordmark on a white pill.
 *   <640     the phone frames: the same band, the card edge to edge minus
 *            10u, thumb-sized controls, safe areas respected.
 *
 * Everything is sized in design units (`--u`), so each breakpoint is the
 * approved frame scaled, not re-invented. `photo="plain"` swaps the photo for
 * a white panel with the logo (staff, refusals): on the web it can carry a
 * `tag`, the caption as a heading, and `aside` rows under it.
 */
export function AuthShell({
  photo,
  caption,
  children,
  footer,
  showTrust = false,
  tag,
  aside,
  screen,
  flow,
}: {
  photo: AuthPhoto;
  caption?: { title: string; text: string };
  children: ReactNode;
  footer?: ReactNode;
  showTrust?: boolean;
  /** Plain panel only: a small label such as "Staff" (web panel and phone header). */
  tag?: string;
  /** Plain panel only: extra content under the caption on the web (feature rows). */
  aside?: ReactNode;
  /** Stable visual hook for a screen-specific composition. It never affects auth state or behaviour. */
  screen?: string;
  /** Shared visual family for screens that use the same responsive shell. */
  flow?: string;
}) {
  const [panel, setPanel] = useState<InfoPanel | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useKeepFormInView(rootRef);
  const plain = photo === "plain";
  const usesHorizontalWordmark = flow === "member-signin" || flow === "member-join" || flow === "member-verify";
  const p = plain ? null : PHOTOS[photo];
  const vars = p
    ? ({ "--mh": p.mh, "--mih": p.mih, "--moff": p.moff, "--mpos": p.mpos, "--mtop": p.mtop, "--wpos": p.webPos, "--tpos": p.tpos ?? p.mpos } as React.CSSProperties)
    : undefined;

  return (
    <div
      ref={rootRef}
      className={`wsa ${authSerif.variable} ${authSans.variable}${plain ? " wsa-plain" : " wsa-photo-led"}`}
      data-photo={photo}
      data-screen={screen}
      data-flow={flow}
      style={vars}
    >
      {plain ? (
        <>
          <header className="wsa-top">
            <Link href="/signin" className="wsa-top-mark" aria-label="WomSakhi">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ux/auth/wordmark.webp" alt="WomSakhi" width={720} height={144} />
            </Link>
            {tag && <span className="wsa-top-tag">{tag}</span>}
          </header>
          <aside className="wsa-info" aria-label={caption?.title ?? "WomSakhi"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/auth/logo.webp" alt="WomSakhi — Stronger women, brighter tomorrows" className="wsa-info-lock" width={800} height={817} />
            {tag && <span className="wsa-tag">{tag}</span>}
            {caption && (
              <>
                <h2>{caption.title}</h2>
                <div className="wsa-rg" />
                <p>{caption.text}</p>
              </>
            )}
            {aside}
          </aside>
        </>
      ) : (
        <div className="wsa-photo" aria-hidden={!caption}>
          <div className="wsa-photo-frame"><Photo photo={photo as Exclude<AuthPhoto, "plain">} /></div>
          <div className="wsa-pill">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/auth/wordmark.webp" alt="WomSakhi" width={720} height={144} />
          </div>
          {caption && (
            <div className="wsa-cap">
              <b>{caption.title}</b>
              <span>{caption.text}</span>
            </div>
          )}
        </div>
      )}

      <main className="wsa-side">
        {!plain && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={usesHorizontalWordmark ? "/ux/auth/wordmark.webp" : "/ux/auth/logo.webp"}
            alt="WomSakhi — Stronger women, brighter tomorrows"
            className="wsa-lock"
            width={usesHorizontalWordmark ? 720 : 800}
            height={usesHorizontalWordmark ? 144 : 817}
          />
        )}
        <section className="wsa-card" key={panel ?? "content"}>
          {panel ? <InformationPanel panel={panel} onBack={() => setPanel(null)} /> : children}
          {!panel && showTrust && <TrustChips />}
        </section>
        {footer}
        <footer className="wsa-foot">
          <button type="button" aria-pressed={panel === "privacy"} onClick={() => setPanel("privacy")}>Privacy</button>
          <button type="button" aria-pressed={panel === "terms"} onClick={() => setPanel("terms")}>Terms</button>
          <button type="button" aria-pressed={panel === "help"} onClick={() => setPanel("help")}>Help</button>
          <button type="button" aria-pressed={panel === "contact"} onClick={() => setPanel("contact")}>Contact</button>
          <LanguageSwitch />
        </footer>
      </main>
    </div>
  );
}

export default AuthShell;
