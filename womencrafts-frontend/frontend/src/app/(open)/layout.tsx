import "@/app/ux/tokens.css";

/**
 * The open door — pages a customer opens without an account.
 *
 * Deliberately NOT the `(public)` layout. That one wears WomSakhi's header,
 * its About/Privacy nav and a "Sign in" call to action, which is right for a
 * woman deciding whether to join and wrong for a customer who was sent a link
 * to buy a blouse. Here the seller is the brand and WomSakhi is a footnote —
 * one line at the bottom saying who is standing behind the page.
 *
 * Its own `.ux` scope because these sit outside `(auth)`, `/app` and
 * `/learning`, the three layouts that carry the token sheet. And outside the
 * proxy matcher (`/dashboard`, `/app`, `/signin`, `/signup`), so no session is
 * ever required to read one.
 */
export default function OpenLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ux min-h-screen" style={{ background: "var(--ux-canvas)" }}>
      <main className="mx-auto max-w-[560px] px-4 py-6 sm:py-9">{children}</main>
      <footer className="mx-auto max-w-[560px] px-4 pb-10">
        <p className="text-center text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-faint)" }}>
          This page belongs to the woman named on it. WomSakhi does not hold the money and does not
          take a cut of what you pay her.
        </p>
      </footer>
    </div>
  );
}
