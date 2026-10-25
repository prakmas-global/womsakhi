import "@/app/ux/tokens.css";

/**
 * Pages opened from a link a member shared — a course, a story, a circle
 * invite. No session, no WomSakhi nav: the person opening it was sent it by
 * someone she knows, and the page is about that thing, then one way in.
 */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ux min-h-screen" style={{ background: "var(--ux-canvas)" }}>
      <header className="mx-auto flex max-w-[620px] items-center gap-2 px-4 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.png" alt="" width={28} height={28} className="h-7 w-7 rounded-[8px]" />
        <span className="text-sm font-extrabold tracking-tight" style={{ color: "var(--ux-brand)" }}>WomSakhi</span>
      </header>
      <main className="mx-auto max-w-[620px] px-4 py-5 sm:py-7">{children}</main>
      <footer className="mx-auto max-w-[620px] px-4 pb-10">
        <p className="text-center text-xs leading-relaxed" style={{ color: "var(--ux-faint)" }}>
          WomSakhi is where women learn, earn and look out for each other. Shared with you by a member.
        </p>
      </footer>
    </div>
  );
}
