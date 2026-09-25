"use client";

import * as Icons from "@/components/ux/icons";

import { SettingsPage } from "@/components/ux/settings/Frame";
import { Group } from "../_parts/Group";
import { useT } from "@/i18n";

/**
 * What actually works when the signal goes.
 *
 * ── Why this screen was rewritten ───────────────────────────────────────────
 * It used to be a download manager: six rows with megabyte figures, switches,
 * a running total, and green "Always kept" badges on her wallet balance, her
 * orders and the helpline numbers. None of it was real. `public/sw.js` refuses
 * every `/api/` path in `bucketFor`, deliberately and correctly — a cached
 * wallet balance is her money written to disk, and those responses vary on her
 * session cookie, so replaying one to the wrong person is a leak, not a
 * feature. Nothing she toggled changed anything, the sizes were invented, and
 * the three things promised "always kept" were the three things that were not
 * kept at all.
 *
 * A woman on a ₹99 pack deciding whether to trust this screen deserves the
 * true version, which is smaller and more useful: the app itself stays on her
 * phone, the numbers that matter in an emergency need no signal at all, and
 * anything about her own account needs a connection.
 *
 * ── What is actually true, and where each fact lives ────────────────────────
 *   · screens and pictures — `SHELL_PREFIXES` / `ART_PREFIXES` in sw.js,
 *     cached as she genuinely uses them, never pre-fetched
 *   · the helplines       — written into `OFFLINE_HTML` in sw.js, so they work
 *     with no cache, no session and no data
 *   · her own account     — needs a connection, and says so
 *
 * There is nothing to toggle here because there is nothing she can choose:
 * the caching is automatic and costs her nothing beyond the pages she already
 * opened. A switch that changes nothing is worse than no switch.
 */
export default function OfflineSettings() {
  const tr = useT();

  const works = [
    tr("settingsOffline.worksScreens"),
    tr("settingsOffline.worksHelplines"),
    tr("settingsOffline.worksWritten"),
  ];
  const needs = [
    tr("settingsOffline.needsMoney"),
    tr("settingsOffline.needsOrders"),
    tr("settingsOffline.needsCourses"),
  ];

  return (
    <SettingsPage
      title={tr("settingsOffline.workingWithoutSignal")}
      sub={tr("settingsOffline.whatStaysOnYourPhoneWhen")}
    >
      <Group title={tr("settingsOffline.whatStillWorksWithNoSignal")} icon="WifiOff" inset="form">
        <ul className="space-y-2.5">
          {works.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
      </Group>

      {/*
        Said plainly, and not hidden.

        The old screen implied the opposite — that her balance and orders were
        "always kept" — which is the kind of promise a woman only discovers is
        false at the moment she is relying on it.
      */}
      <Group title={tr("settingsOffline.whatNeedsASignal")} icon="Wifi" inset="form"
             noteIcon="RefreshCw" note={tr("settingsOffline.nothingIsLost")}>
        <ul className="space-y-2.5">
          {needs.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
              <Icons.Minus className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-faint)" }} strokeWidth={2.6} />
              {t}
            </li>
          ))}
        </ul>
      </Group>

      <Group title={tr("settingsOffline.whatItCostsYou")} icon="Smartphone" inset="form">
        <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          {tr("settingsOffline.costBody")}
        </p>
      </Group>
    </SettingsPage>
  );
}
