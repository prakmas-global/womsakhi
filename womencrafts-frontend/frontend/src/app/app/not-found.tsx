import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I } from "@/components/ux/kit";

/**
 * A page inside the app that does not exist.
 *
 * Kept inside the shell on purpose. A bad link is not a reason to throw away
 * her navigation — the rail and search stay, so the recovery is one tap and
 * she never has to reach for the browser's back button.
 *
 * The copy names what happened without blaming her: a link went stale, not
 * "you typed it wrong".
 */
export default function NotFound() {
  return (
    <HomeShell bare>
      <div className="mx-auto max-w-[520px] py-6">
        <Card pad={28}>
          <div className="flex flex-col items-center text-center">
            <span className="grid h-[62px] w-[62px] place-items-center rounded-full"
                  style={{ background: "var(--ux-tint-lilac)" }}>
              <I name="Compass" className="h-[28px] w-[28px]"
                 style={{ color: "var(--ux-brand)" }} sw={1.8} />
            </span>

            <h1 className="mt-4 text-lg font-bold" style={{ color: "var(--ux-ink)" }}>
              This page has moved
            </h1>
            <p className="mt-1.5 max-w-[38ch] text-sm leading-relaxed"
               style={{ color: "var(--ux-muted)" }}>
              The link you followed points somewhere that is no longer here. Nothing is wrong
              with your account, and nothing has been lost.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Btn href="/app" icon="Home">Go to Home</Btn>
              <Btn href="/app/search" variant="outline" icon="Search">Search the app</Btn>
            </div>

            <p className="mt-4 text-xs" style={{ color: "var(--ux-muted)" }}>
              Still stuck? <Link href="/app/help" className="underline"
                                 style={{ color: "var(--ux-brand)" }}>Get help</Link>
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
