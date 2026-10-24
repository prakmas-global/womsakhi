import "@/app/ux/tokens.css";

/**
 * Certificate checks — `/verify/<code>`, opened by an employer or a buyer with
 * no account. Like `(open)` it needs no session and wears no WomSakhi nav, but
 * its footnote is about the certificate, not about money changing hands.
 */
export default function CheckLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ux min-h-screen" style={{ background: "var(--ux-canvas)" }}>
      <main className="mx-auto max-w-[560px] px-4 py-6 sm:py-9">{children}</main>
      <footer className="mx-auto max-w-[560px] px-4 pb-10">
        <p className="text-center text-xs leading-relaxed" style={{ color: "var(--ux-faint)" }}>
          Checked against WomSakhi&rsquo;s own records. Courses and skill tests are taken on WomSakhi by the
          woman named here.
        </p>
      </footer>
    </div>
  );
}
