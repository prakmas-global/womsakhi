"use client";

import { Shell } from "../Shell";
import { Btn } from "../kit";
import { useMe } from "../me";
import { useChrome } from "../chrome";

/**
 * The one Shell, mounted in the layout so it survives every navigation.
 *
 * It reads what the current screen asked for — its rail, whether it wants the
 * full width, whether it wants the profile footer — from the register in
 * `ux/chrome.tsx`, rather than being handed props by a page that a layout
 * cannot see.
 */
export function ChromeShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const { rail, wide, bare, name } = useChrome();

  return (
    <Shell
      user={{ name: name ?? me.first, avatar: me.avatar, unread: me.unread }}
      sidebarFooter={bare ? undefined : (
        <div className="rounded-[12px] p-4" style={{ background: "var(--ux-brand-900)" }}>
          <p className="text-sm font-semibold text-white">Complete Your Profile</p>
          <p className="mt-1 text-xs" style={{ color: "var(--ux-on-brand-2)" }}>{me.profilePct}% completed</p>
          <div className="mt-2.5 h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-on-brand-track)" }}>
            <div className="h-full rounded-full"
                 style={{ width: `${me.profilePct}%`, background: "var(--ux-on-brand-fill)",
                          transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
          </div>
          <div className="mt-3">
            <Btn href="/app/profile" variant="primary" size="sm" full iconEnd="ArrowRight">Complete Now</Btn>
          </div>
        </div>
      )}
      rail={rail}
      wide={wide}
    >
      {children}
    </Shell>
  );
}
