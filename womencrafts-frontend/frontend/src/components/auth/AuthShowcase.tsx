import { BarChart3, Heart, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";
import BrandReveal from "@/components/brand/BrandReveal";

const FEATURES = [
  { icon: Users, title: "Smart Management" },
  { icon: ShieldCheck, title: "Secure & Reliable" },
  { icon: BarChart3, title: "Real-time Insights" },
  { icon: Zap, title: "AI Powered Platform" },
];

/**
 * Left marketing panel shared by the Sign In and Forgot Password screens.
 * Features the real community artwork (/login-hero.png) inside a rounded,
 * softly-shadowed frame so its light background reads cleanly on both the light
 * and dark panel gradients.
 */
export default function AuthShowcase() {
  return (
    <div className="relative hidden h-full w-full overflow-hidden bg-linear-to-br from-violet-50 via-[var(--surface-inset)] to-[var(--surface-hover)] dark:from-[var(--background)] dark:via-[var(--surface-inset)] dark:to-[var(--surface-inset)] lg:flex lg:flex-col lg:justify-between lg:px-11 lg:py-9">
      {/* soft brand glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -top-10 h-64 w-64 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/10" />
        <div className="absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-violet-200/50 blur-3xl dark:bg-violet-500/10" />
        <Sparkles className="absolute right-16 top-36 h-4 w-4 text-violet-300 dark:text-violet-ink/50" aria-hidden />
        <Sparkles className="absolute left-14 top-24 h-3.5 w-3.5 text-violet-200 dark:text-violet-ink/40" aria-hidden />
      </div>

      {/* hero — the mark animating itself into being. This replaces the static
          lockup that stood here: the brand has a real reveal now, and a sign-in
          screen is the one place it is worth watching. It plays once and holds,
          and falls back to the frame it ends on. */}
      <div className="relative z-10">
        <BrandReveal className="w-full max-w-[420px]" />
        <h1 className="mt-6 font-display text-[2.3rem] font-extrabold leading-[1.12] tracking-tight text-ink">
          Empowering Women.
          <br />
          Building <span className="text-violet-ink">Futures.</span>{" "}
          <Heart className="inline h-4 w-4 align-middle text-brand-500" aria-hidden />
        </h1>
        <p className="mt-3 max-w-md text-smd leading-relaxed text-ink-subtle">
          Manage, empower and grow the WomSakhi community with smart tools and
          insights.
        </p>
      </div>

      {/* compact feature chips */}
      <div className="relative z-10 grid grid-cols-2 gap-2.5">
        {FEATURES.map(({ icon: Icon, title }) => (
          <div
            key={title}
            className="flex items-center gap-2.5 rounded-xl bg-white/60 px-3 py-2.5 ring-1 ring-white/60 dark:bg-white/4 dark:ring-white/10"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface shadow-sm ring-1 ring-violet-100 dark:bg-white/10 dark:ring-white/10">
              <Icon className="h-4 w-4 text-violet-ink" strokeWidth={2} />
            </span>
            <span className="text-xsm font-semibold text-ink-muted">
              {title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
