import Link from "next/link";

import "@/app/ux/tokens.css";
import "./public.css";

/**
 * The pages anyone can read without an account.
 *
 * Terms, privacy, who we are, how to reach us. These are read by a woman
 * deciding whether to hand over her phone number and a photograph of her
 * Aadhaar card, and by the payment provider and app stores deciding whether to
 * deal with us at all — so they are deliberately plain, scannable and free of
 * anything that needs a login to make sense.
 *
 * On `--ux-*`, like the member app, so the front of the house and the inside
 * are recognisably one product. Its own `.ux` scope because these sit outside
 * `(auth)`, `/app` and `/learning`, which are the three layouts that carry the
 * token sheet.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ux min-h-screen" style={{ background: "var(--ux-canvas)" }}>
      <header
        className="sticky top-0 z-20 backdrop-blur"
        style={{ background: "color-mix(in srgb, var(--ux-surface) 88%, transparent)", borderBottom: "1px solid var(--ux-line)" }}
      >
        <div className="mx-auto flex max-w-[880px] items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/signin" className="flex items-center gap-2.5" aria-label="WomSakhi">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/brand/womsakhi-mark.webp" alt="" aria-hidden className="h-8 w-8 object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/brand/womsakhi-wordmark.webp" alt="WomSakhi" className="h-[19px] object-contain" />
          </Link>
          <nav className="flex items-center gap-1">
            {[
              ["About", "/about"],
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
              ["Contact", "/contact"],
            ].map(([label, href]) => (
              <Link
                key={href} href={href}
                className="ux-sq rounded-[8px] px-2.5 py-2 text-[0.8125rem] font-medium"
                style={{ color: "var(--ux-muted)" }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-10 sm:py-14">{children}</main>

      <footer style={{ borderTop: "1px solid var(--ux-line)" }}>
        <div className="mx-auto flex max-w-[880px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[0.75rem]"
             style={{ color: "var(--ux-faint)" }}>
          <p>© {new Date().getFullYear()} WomSakhi. Women only, and free to join.</p>
          <Link href="/signin" className="font-semibold" style={{ color: "var(--ux-brand)" }}>
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}
