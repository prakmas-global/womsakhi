"use client";

import { Shell } from "../Shell";
import { useT } from "@/i18n";
import { Btn } from "../kit";
import { useMe } from "../me";
import { useShell } from "../ShellProvider";
import { useChrome } from "../chrome";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The one Shell, mounted in the layout so it survives every navigation.
 *
 * It reads what the current screen asked for — its rail, whether it wants the
 * full width, whether it wants the profile footer — from the register in
 * `ux/chrome.tsx`, rather than being handed props by a page that a layout
 * cannot see.
 */
export function ChromeShell({ children }: { children: React.ReactNode }) {
  const tr = useT();
  const me = useMe();
  /*
    Her profile, as the server counts it — five stored fields.

    This card read `me.profilePct`, which is `completion_rate` off
    /me/progress: the furthest-along PROGRAMME, a different number about a
    different thing. It said 100 for a woman whose profile was 20% filled, so
    77 of her screens carried "Complete Your Profile · 100% completed ·
    Complete Now" — a nag that could never be satisfied, next to a figure that
    said it already was.
  */
  const shell = useShell();
  const profilePct = shell.data?.profile_pct ?? me.profilePct;
  const { rail, wide, bare, fit, name, immersive } = useChrome();
  const pathname = usePathname();

  // The shell survives route changes, so its content scroller does too. Reset
  // only the page viewport; the sidebar keeps its own useful scroll position.
  useEffect(() => {
    document.getElementById("ux-scroll")?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return (
    <Shell
      user={{ name: name ?? me.first, avatar: me.avatar, unread: me.unread }}
      sidebarFooter={bare ? undefined : (pathname === "/app/circle" || profilePct >= 100) ? (
        <div className="relative overflow-hidden rounded-[8px] px-4 py-5" style={{ minHeight: 168, background: "linear-gradient(135deg, #ffe7f1, #f8cce7)" }}>
          <img src="/ux/art/circle-dashboard-leaves.webp" alt="" width={150} height={190}
               style={{ width: 150, height: 190, maxWidth: 150 }}
               className="pointer-events-none absolute -bottom-14 -right-12 object-contain" />
          <p className="relative max-w-[140px] font-serif text-xl italic leading-tight" style={{ color: "#8b2b66" }}>{tr("chromeShell.aKinderStrongerWorldForWomen")}</p>
          <Btn href="/app/refer" variant="primary" size="sm" iconEnd="ArrowRight">{tr("chromeShell.inviteAFriend")}</Btn>
        </div>
      ) : (
        <div className="rounded-[12px] p-4" style={{ background: "var(--ux-brand-900)" }}>
          <p className="text-sm font-semibold text-white">{tr("chromeShell.completeYourProfile")}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--ux-on-brand-2)" }}>{profilePct}% completed</p>
          <div className="mt-2.5 h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-on-brand-track)" }}>
            <div className="h-full rounded-full"
                 style={{ width: `${profilePct}%`, background: "var(--ux-on-brand-fill)",
                          transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
          </div>
          <div className="mt-3">
            <Btn href="/app/profile" variant="primary" size="sm" full iconEnd="ArrowRight">{tr("chromeShell.completeNow")}</Btn>
          </div>
        </div>
      )}
      rail={rail}
      wide={wide}
      fit={fit}
      immersive={immersive}
    >
      {children}
    </Shell>
  );
}
