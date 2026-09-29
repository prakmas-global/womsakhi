"use client";

import { useCallback, useEffect, useState } from "react";

import { apiRequestDeletion } from "@/lib/member-api";
import {
  apiMyDevices, apiRemoveDevice, apiSignOutEverywhere, authError, type SignedInDevice,
} from "@/lib/auth-api";
import { useAction } from "@/lib/use-action";

import { AlertTriangle, Check, Laptop, RefreshCw, Smartphone, Trash2 } from "lucide-react";

import { SettingsPage, TextInput } from "@/components/ux/settings/Frame";
import "@/components/auth-cards";
import { useT } from "@/i18n";
import { PREVIEW_STATES, previewDevices, readPreview } from "@/lib/auth-preview";
import { PreviewPill } from "@/components/auth-shell/PreviewPill";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * Sign-in and devices.
 *
 * There is no password. She signs in with a code sent to her email, and each
 * device she signs in on is its own session, kept for 30 days. So this screen
 * is about WHERE she is signed in: every device, the one she is holding
 * marked, and a way to sign any other one out on the spot.
 *
 * The device list comes first. If somebody else is in her account, seeing it
 * is the urgent thing on this page.
 *
 * Deleting an account is deliberately awkward: it asks her to type a word. A
 * one-tap delete beside a one-tap sign-out is how people lose everything.
 */

/** "Active now", "5 min ago", "3 days ago" — the words a phone uses. */
function lastActive(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return "Active time not known";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 120) return "Active now";
  const m = Math.round(s / 60);
  if (m < 60) return `Active ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Active ${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `Active ${d} ${d === 1 ? "day" : "days"} ago`;
  return `Active ${new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

function deviceIcon(d: SignedInDevice): string {
  if (d.kind === "app") return "Smartphone";
  return /iphone|android|mobile|phone/i.test(d.label) ? "Smartphone" : "Monitor";
}

export default function SecuritySettings() {
  const tr = useT();

  const [devices, setDevices] = useState<SignedInDevice[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(0);
  const [removed, setRemoved] = useState("");
  const [asking, setAsking] = useState(false);
  /** Local-only `?preview=`: sample devices instead of the API (see lib/auth-preview). */
  const [preview, setPreview] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    if (AUTH_PREVIEW && readPreview(PREVIEW_STATES.security)) return;
    try {
      const list = await apiMyDevices();
      // The one she is holding first, then most recently used.
      list.sort((a, b) => Number(b.current) - Number(a.current)
        || new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime());
      setDevices(list);
      setNow(Date.now());
      setLoadError("");
    } catch (err) {
      setLoadError(authError(err, "Could not load your devices just now.").message);
    }
  }, []);

  useEffect(() => {
    if (AUTH_PREVIEW) {
      const p = readPreview(PREVIEW_STATES.security);
      if (p) {
        const t = window.setTimeout(() => { setPreview(p); setDevices(previewDevices()); setNow(Date.now()); });
        return () => window.clearTimeout(t);
      }
    }
    let alive = true;
    void (async () => {
      try {
        const list = await apiMyDevices();
        if (!alive) return;
        list.sort((a, b) => Number(b.current) - Number(a.current)
          || new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime());
        setDevices(list);
        setNow(Date.now());
      } catch (err) {
        if (alive) setLoadError(authError(err, "Could not load your devices just now.").message);
      }
    })();
    return () => { alive = false; };
  }, []);

  const remove = useAction(
    async (id: string, label: string) => {
      setRemoved("");
      if (AUTH_PREVIEW && preview) {
        setDevices((list) => list?.filter((d) => d.id !== id) ?? null);
        setRemoved(`Signed out ${label}.`);
        return;
      }
      const res = await apiRemoveDevice(id);
      setRemoved(res.message || `Signed out ${label}.`);
      await fetchDevices();
    },
    { fallbackError: "That device is still signed in. Try again in a moment." },
  );

  /**
   * Ends every session, including this one.
   *
   * A full page load rather than a router push: the session is dead the
   * instant the server answers, so anything that keeps the current React tree
   * alive would spend the next few seconds 401ing on every request it makes.
   */
  const endEverywhere = useAction(
    async () => {
      if (AUTH_PREVIEW && preview) return;
      await apiSignOutEverywhere();
      window.location.assign("/signin");
    },
    { fallbackError: "Could not end your sessions just now. Try again in a moment." },
  );

  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [closed, setClosed] = useState(false);
  const close = useAction(
    async () => { if (!(AUTH_PREVIEW && preview)) await apiRequestDeletion("", confirm); },
    {
      onDone: () => setClosed(true),
      fallbackError: "That did not go through. Your account is untouched — try again in a moment.",
    },
  );

  const others = devices?.filter((d) => !d.current).length ?? 0;

  return (
    <SettingsPage title="Sign-in and devices" sub="Where you are signed in, and how to sign out anywhere.">
      {/* E1 (Version 11): one card — how she signs in, every device, and the way out of all of them. */}
      <section className="ac ac-e1" aria-labelledby="devices-title">
        <h2 id="devices-title" className="sr-only">Signed-in devices</h2>
        <p className="ac-s">You sign in with a code. There&apos;s no password to remember.</p>

        {loadError ? (
          <>
            <p role="alert" className="ac-err">{loadError}</p>
            <button type="button" className="ac-btn ac-line sm" onClick={fetchDevices}><RefreshCw aria-hidden /> Try again</button>
          </>
        ) : devices === null ? (
          <div className="grid gap-[calc(11*var(--u))]" aria-busy="true" aria-label="Loading your devices">
            {[0, 1].map((i) => (
              <div key={i} className="ac-dev" aria-hidden>
                <span className="di" />
                <div><b className="ac-bone" /><small className="ac-bone short" /></div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="grid list-none gap-[calc(11*var(--u))] p-0" aria-label={others === 0 ? "Only this device is signed in." : `${others + 1} devices are signed in.`}>
            {devices.map((d) => {
              const Icon = deviceIcon(d) === "Smartphone" ? Smartphone : Laptop;
              const name = d.label || (d.kind === "app" ? "WomSakhi app" : "A web browser");
              return (
                <li key={d.id} className="ac-dev">
                  <span className="di" aria-hidden><Icon /></span>
                  <div>
                    <b>{name}</b>
                    <small>{d.current ? "Active now" : lastActive(d.last_used_at, now)}</small>
                  </div>
                  {d.current ? (
                    <span className="pill">This device</span>
                  ) : (
                    <button type="button" className="out" disabled={remove.busyWith === d.id}
                            aria-label={`Sign out ${name}`} onClick={() => remove.run(d.id, d.label)}>
                      {remove.busyWith === d.id ? "Signing out…" : "Sign out"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {(removed || remove.error) && (
          <p role="status" className={`ac-note ${remove.error ? "bad" : "ok"}`}>
            {remove.error ? <AlertTriangle aria-hidden /> : <Check aria-hidden />}<span>{remove.error || removed}</span>
          </p>
        )}

        {asking ? (
          <div className="ac-warn grid gap-[calc(8*var(--u))]" role="group" aria-label="Sign out everywhere">
            <b>
              {devices?.length === 1 ? "Sign out of this device?" : `Sign out of ${devices?.length === 2 ? "both devices" : devices ? `all ${devices.length} devices` : "every device"}, including this one?`}
            </b>
            <span>If you think somebody else has been in your account, this ends every session at once. You sign back in with a code.</span>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className="ac-btn ac-line sm" onClick={() => setAsking(false)}>Keep me signed in</button>
              <button type="button" className="ac-btn ac-danger sm" disabled={endEverywhere.busy} onClick={() => endEverywhere.run()}>
                {endEverywhere.busy ? tr("settingsSecurity.endingEverySession") : "Yes, sign out everywhere"}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="ac-btn ac-danger" onClick={() => setAsking(true)}>
            {tr("settingsSecurity.signOutEverywhere")}
          </button>
        )}
        {endEverywhere.error && <p role="alert" className="ac-err">{endEverywhere.error}</p>}
      </section>

      <section className="ac ac-e1" aria-labelledby="close-title">
        <h2 id="close-title" className="ac-t ac-t-sm">{tr("settingsSecurity.closeYourAccount")}</h2>
        <p className="ac-s">
          Your certificates, your shop and your order history go with it, and we cannot bring them back.
          Money still in your wallet is paid out first — that takes up to seven working days.
        </p>

        {deleting ? (
          <div className="ac-warn grid gap-[calc(8*var(--u))]">
            <span>
              Type <b>CLOSE</b> {tr("settingsSecurity.toConfirmYouMeanIt")}
            </span>
            {/* Three controls do not fit across 390px; on a phone they stack. */}
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
              <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="CLOSE" />
              <button type="button" className="ac-btn ac-line sm lg:w-auto" onClick={() => { setDeleting(false); setConfirm(""); }}>{tr("settingsSecurity.keepMyAccount")}</button>
              <button type="button" className="ac-btn ac-danger sm lg:w-auto" disabled={confirm !== "CLOSE" || close.busy}
                      onClick={() => void close.run()}>{tr("settingsSecurity.closeIt")}</button>
            </div>
            {close.error && <p role="alert" className="ac-err">{close.error}</p>}
          </div>
        ) : closed ? (
          <div className="ac-note grid">
            <div>
              <b>{tr("settingsSecurity.yourAccountClosesInDays")}</b>
              <p className="m-0 mt-1.5">
                Nothing is deleted yet. Sign in any time in the next 30 days and it stops. Money still owed to
                you is paid out first — we will not close an account holding your earnings.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="ac-btn ac-go sm w-auto" onClick={() => { setClosed(false); setDeleting(false); setConfirm(""); }}>{tr("settingsSecurity.keepMyAccountAfterAll")}</button>
                <a href="/app/wallet/withdraw" className="ac-btn ac-line sm w-auto">{tr("settingsSecurity.withdrawWhatIAmOwed")}</a>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="ac-btn ac-danger" onClick={() => setDeleting(true)}><Trash2 aria-hidden /> {tr("settingsSecurity.closeMyAccount")}</button>
        )}
      </section>
      {AUTH_PREVIEW && <PreviewPill state={preview} />}
    </SettingsPage>
  );
}
