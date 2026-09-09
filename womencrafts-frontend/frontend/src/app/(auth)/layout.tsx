"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, ShieldCheck, Sun } from "lucide-react";

import AuthShowcase, { AuthShowcaseCompact } from "@/components/auth/AuthShowcase";
import { useTheme } from "@/context/ThemeContext";
import "./auth-tokens.css";

/**
 * The front door.
 *
 * One fixed composition — a violet night, lit magenta from the top right — with
 * two frosted panels floating on it. The scene is deliberately full-bleed and
 * the panels are deliberately inset: the background has to be visible around
 * and between them, or the page reads as two rectangles rather than as one lit
 * room, which is the whole of the effect.
 *
 * The form panel is a CARD, not a column. It sizes to its contents and centres
 * itself in the scene rather than stretching the height of the viewport, so a
 * four-field sign-in does not become a long empty trough on a large monitor.
 *
 * Fixed dark on purpose, and the one place in WomSakhi that ignores `--ux-*`.
 * There is no account yet, so there is no theme preference to honour; making
 * the first screen the same every time is worth more here than making it
 * adjustable. The toggle below still sets the theme she lands INSIDE.
 */

/** Sun/Moon pill, restyled for the glass — the shared one is built for light surfaces. */
function SceneThemeToggle() {
  const { isDark, setTheme } = useTheme();
  const seg = "grid h-10 w-10 place-items-center rounded-full transition";
  return (
    <div
      className="flex items-center gap-1 rounded-full p-1"
      style={{ background: "var(--a-well-2)", border: "1px solid var(--a-edge)" }}
      title="Light or dark"
    >
      <button
        type="button" aria-label="Light theme" aria-pressed={!isDark}
        onClick={() => setTheme("light")} className={seg}
        style={!isDark
          ? { background: "var(--a-glass-3)", color: "var(--a-ink)" }
          : { color: "var(--a-faint)" }}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button" aria-label="Dark theme" aria-pressed={isDark}
        onClick={() => setTheme("dark")} className={seg}
        style={isDark
          ? { background: "var(--a-violet-2)", color: "var(--ux-on-brand)" }
          : { color: "var(--a-faint)" }}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Petals at the edges of the frame, as in the reference. Purely decorative. */
function Petals() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg className="auth-drift absolute -start-16 top-[14%] h-[280px] w-[280px] opacity-[0.5]"
           viewBox="0 0 200 200" fill="none">
        <path d="M100 10c40 30 60 70 50 110-8 34-38 62-72 68 8-38-2-78-18-112C46 50 70 24 100 10z"
              fill="var(--a-violet)" opacity="0.5" />
        <path d="M60 40c34 26 52 62 44 98-6 30-32 54-62 60 6-34-2-70-16-100C18 74 36 52 60 40z"
              fill="var(--a-magenta)" opacity="0.32" />
      </svg>
      <svg className="auth-drift absolute -end-20 bottom-[8%] h-[320px] w-[320px] opacity-[0.42]"
           style={{ animationDelay: "-6s" }} viewBox="0 0 200 200" fill="none">
        <path d="M100 190c-40-30-60-70-50-110 8-34 38-62 72-68-8 38 2 78 18 112 14 26-10 52-40 66z"
              fill="var(--a-magenta)" opacity="0.5" />
      </svg>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Signing up is four fields and a consent notice; on a phone the strip does
  // not fit above it without pushing the button off the screen, and the whole
  // point of these sizes is that nothing has to be scrolled.
  const showStrip = usePathname() !== "/signup";

  // The scene was drawn as a violet night, so that is what a first-time visitor
  // should meet. `ThemeContext` defaults to light, which meant the toggle sat
  // on "light" while the page rendered dark and pressing it appeared to do
  // nothing. Setting the preference for real on a first visit makes the control
  // tell the truth: what is on screen is what the toggle says, and either way
  // is one press from the other. An existing choice is never overridden.
  const { setTheme } = useTheme();
  useEffect(() => {
    try {
      if (!window.localStorage.getItem("theme")) setTheme("dark");
    } catch { /* no storage — the light scene is a perfectly good fallback */ }
  }, [setTheme]);

  return (
    <div className="auth-scene auth-sky relative min-h-screen w-full overflow-hidden">
      <Petals />

      <div className="relative mx-auto flex min-h-screen max-w-[1560px] items-center justify-center px-4 sm:px-7 lg:px-10"
        style={{ paddingBlock: "clamp(0.5rem,2.4vh,2.125rem)" }}>
        <div className="flex w-full flex-col items-stretch lg:flex-row lg:items-center lg:gap-7"
          style={{ gap: "clamp(0.625rem,1.6vh,1.25rem)" }}>
          {/* Left — what this is, and who it is for. Its own panel. */}
          <div className="hidden lg:order-none lg:block lg:w-[59%] xl:w-[60%]">
            <AuthShowcase />
          </div>

          {/* Phones get a short strip of the panel — the full one is `lg:` only,
              and without it a phone opened on two bare fields with nothing
              saying what WomSakhi is.

              It sits BELOW the form (`order-2`): above it, the pitch pushed the
              email field off the first screen, so a woman coming back to sign
              in had to scroll past an advert to reach what she came for. On a
              laptop both panels are visible at once and the order is the
              reading order again. */}
          {showStrip && (
            <div className="auth-strip order-2 mx-auto w-full max-w-[520px] lg:hidden">
              <AuthShowcaseCompact />
            </div>
          )}

          {/* Right — the form. A card that sizes to its contents. */}
          <div className="order-1 mx-auto w-full max-w-[520px] lg:order-none lg:mx-0 lg:w-[41%] xl:w-[40%]">
            <div
              className="auth-panel relative rounded-[24px] px-6 sm:px-9"
              style={{ paddingBlock: "clamp(1rem,3vh,2.5rem)" }}
            >
              <div className="absolute end-6 top-6 sm:end-7 sm:top-7">
                <SceneThemeToggle />
              </div>
              {children}
              <div
                className="auth-note flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-center text-xs"
                style={{ color: "var(--a-faint)", marginTop: "clamp(0.875rem,2.4vh,1.75rem)" }}
              >
                {/* Hidden on a narrow screen. Of the two lines here this is
                    the reassurance and the other is the compliance link set —
                    on a phone that cannot fit both without scrolling, the one
                    a payment provider and an app store require is the one that
                    stays. */}
                <span className="hidden items-center gap-2 sm:flex">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Nobody at WomSakhi can read your password.
                </span>
                {/* Reachable from the front door, deliberately. A payment
                    provider and an app store both look for these here, and a
                    woman about to hand over a photo of her ID is entitled to
                    read what happens to it before she does. */}
                <span className="flex items-center gap-3">
                  <Link href="/terms" className="ux-hov underline-offset-2 hover:underline">Terms</Link>
                  <Link href="/privacy" className="ux-hov underline-offset-2 hover:underline">Privacy</Link>
                  <Link href="/contact" className="ux-hov underline-offset-2 hover:underline">Contact</Link>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
