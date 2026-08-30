import { ChevronDown, Globe, ShieldCheck } from "lucide-react";
import AuthShowcase from "@/components/auth/AuthShowcase";
import { Brand } from "@/components/ux/Brand";
import { ThemeToggle } from "@/design-system";
import "@/app/ux/tokens.css";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-violet-100 via-[var(--surface-inset)] to-brand-50 p-4 dark:from-[var(--background)] dark:via-[var(--background)] dark:to-[var(--surface-inset)] sm:p-6 lg:p-8">
      {/* contained, rounded, softly-shadowed box floating on the canvas */}
      <div className="flex max-h-[94vh] w-full max-w-[1080px] overflow-hidden rounded-[2rem] bg-surface shadow-[0_40px_90px_-30px_rgba(90,60,150,0.45)] ring-1 ring-white/60 dark:ring-white/10">
        {/* Left — marketing showcase */}
        <div className="hidden lg:block lg:w-[46%]">
          <AuthShowcase />
        </div>

        {/* Right — form panel */}
        <div className="relative flex w-full flex-col overflow-y-auto bg-linear-to-b from-white to-[var(--surface)] dark:from-[var(--surface)] dark:to-[var(--surface-inset)] lg:w-[54%]">
          {/* The brand belongs on the panel she actually looks at. The showcase
              beside it is hidden below lg, and until now this side carried no
              mark at all on a phone-sized window.

              `ux` scopes the --ux-* tokens the lockup reads; its own background
              is cleared because this panel already has one. */}
          <div className="ux flex items-center justify-between gap-2.5 !bg-transparent px-6 pt-4 sm:px-8">
            <Brand size="md" href="/" />
            <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink-muted shadow-sm hover:bg-surface-hover"
            >
              <Globe className="h-4 w-4 text-ink-subtle" />
              English
              <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
            </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-4 sm:px-9">
            <div className="w-full max-w-md">{children}</div>
          </div>

          <div className="flex items-center justify-center gap-2 px-6 pb-4 text-center text-xsm text-ink-subtle">
            <ShieldCheck className="h-4 w-4 text-ink-subtle" />
            Your security is our priority. All data is encrypted and protected.
            <ShieldCheck className="h-4 w-4 text-violet-ink" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
