"use client";

import { useMemo, useState } from "react";

import { apiChangePassword, apiRequestDeletion, apiSignOutEverywhere } from "@/lib/member-api";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";

import { Btn } from "@/components/ux/kit";
import { Field, SettingsPage, TextInput } from "@/components/ux/settings/Frame";
import { phonePrimary, phoneSecondary } from "@/components/ux/PhoneParts";
import { Group } from "../_parts/Group";
import { useT } from "@/i18n";

/**
 * Password and sign-in.
 *
 * The list of where she is signed in comes BEFORE the password form. If
 * somebody else is in her account, seeing it is the urgent thing; changing a
 * password she does not suspect is compromised is not.
 *
 * Deleting an account is deliberately awkward: it asks her to type a word. A
 * one-tap delete beside a one-tap sign-out is how people lose everything.
 */
export default function SecuritySettings() {
  const tr = useT();
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [show, setShow] = useState(false);
  const [changed, setChanged] = useState(false);

  /**
   * Ends every session, including this one.
   *
   * A full page load rather than a router push: the token in the cookie is dead
   * the instant the server answers, so anything that keeps the current React
   * tree alive would spend the next few seconds 401ing on every request it
   * makes. `location.assign` throws the whole thing away, which is the correct
   * amount of state to keep after signing out everywhere — none.
   */
  const endEverywhere = useAction(
    async () => { await apiSignOutEverywhere(); window.location.assign("/signin"); },
    { fallbackError: "Could not end your sessions just now. Try again in a moment." },
  );

  const change = useAction(
    async () => { await apiChangePassword(pw.current, pw.next); },
    {
      onDone: () => { setChanged(true); setPw({ current: "", next: "", again: "" }); },
      fallbackError: "That did not go through. Your password has not changed — try again in a moment.",
    },
  );

  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [closed, setClosed] = useState(false);
  const close = useAction(
    async () => { await apiRequestDeletion("", confirm); },
    {
      onDone: () => setClosed(true),
      fallbackError: "That did not go through. Your account is untouched — try again in a moment.",
    },
  );


  /** Judged, and said out loud — a bar with no words teaches nothing. */
  const strength = useMemo(() => {
    const v = pw.next;
    if (!v) return null;
    let score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[^a-zA-Z0-9]/.test(v)) score++;
    if (/\d/.test(v) && /[a-zA-Z]/.test(v)) score++;
    return [
      { pct: 25, tone: "--ux-orange", word: "Too easy to guess", why: "Make it longer — length matters more than symbols." },
      { pct: 45, tone: "--ux-orange", word: "Weak", why: "Twelve characters would make this much harder to break." },
      { pct: 70, tone: "--ux-amber", word: "Alright", why: "Adding one more word would make it strong." },
      { pct: 88, tone: "--ux-green", word: "Strong", why: "Good. Three unrelated words are easier to remember than this." },
      { pct: 100, tone: "--ux-green", word: "Very strong", why: "Nobody is guessing this." },
    ][score];
  }, [pw.next]);

  const mismatch = pw.again.length > 0 && pw.next !== pw.again;
  const canChange = pw.current.length > 0 && pw.next.length >= 8 && !mismatch;

  return (
    <SettingsPage title={tr("settingsSecurity.passwordAndSignIn")} sub={tr("settingsSecurity.whereYouAreSignedInAnd")}>
      {/* Sessions first: if somebody else is in her account, that is the urgent
          thing on this page. */}
      {/*
        * This card used to list three devices from a constant, one of them
        * "An unknown phone · Safari on iPhone · Delhi · 3 weeks ago", with an
        * "End it" button that removed it from a local array.
        *
        * That is the worst fabrication in this app. This is the screen a woman
        * opens when she is afraid somebody else is in her account, and it told
        * every one of them that a stranger in Delhi had been. Some of the women
        * this is for have a real reason to fear exactly that, and a false alarm
        * here is not a cosmetic bug — it is a fright, and possibly a decision
        * made because of one.
        *
        * The app does not track sessions per member yet. The `sessions`
        * collection has no `user_id`; it is an admin device log. So the screen
        * says what is true, and offers the one thing that genuinely does end
        * other sessions: changing the password.
        */}
      <Group title={tr("settingsSecurity.whereYouAreSignedIn")} inset="form">
        <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          We do not yet keep a list of the devices you have signed in on, so we cannot show you one.
          We would rather tell you that than show you a list we made up.
        </p>
        <p className="mt-2.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          If you think somebody else has been in your account, end every session now. You will be
          signed out here too — that is what &ldquo;everywhere&rdquo; means, and it is the honest
          answer when the device somebody else is holding might be this one.
        </p>
        {/* This is new, and until now it was not possible at all.
            `token_version` existed on both sides and was inert because nothing
            put the claim in a token, so signing out on one phone never touched
            another — a woman whose account was open on a shared or borrowed
            device had no way to close it. */}
        <div className="mt-3.5">
          <Btn variant="outline" icon="LogOut" onClick={() => void endEverywhere.run()}
               disabled={endEverywhere.busy} className={phoneSecondary}>
            {endEverywhere.busy ? tr("settingsSecurity.endingEverySession")
              : tr("settingsSecurity.signOutEverywhere")}
          </Btn>
        </div>
        {endEverywhere.error && (
          <p role="alert" className="mt-2.5 text-xs" style={{ color: "var(--ux-orange-ink)" }}>
            {endEverywhere.error}
          </p>
        )}
      </Group>

      <Group title={tr("settingsSecurity.changeYourPassword")} inset="form">
        <div className="space-y-4">
          <Field label={tr("settingsSecurity.yourCurrentPassword")}>
            <TextInput type={show ? "text" : "password"} value={pw.current}
                       onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
          </Field>
          <Field label={tr("settingsSecurity.aNewPassword")} hint={tr("settingsSecurity.atLeastCharactersThreeUnrelatedWor")}>
            <TextInput type={show ? "text" : "password"} value={pw.next}
                       onChange={(e) => { setPw((p) => ({ ...p, next: e.target.value })); setChanged(false); }} />
          </Field>

          {strength && (
            <div>
              <div className="ux-sq h-[6px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-track)" }}>
                <div className="h-full rounded-full"
                     style={{ width: `${strength.pct}%`, background: `var(${strength.tone})`,
                              transition: "width var(--ux-t) var(--ux-ease-out)" }} />
              </div>
              {/* The word and the reason, not just a coloured bar. */}
              <p className="mt-1.5 text-xs">
                <span className="font-semibold" style={{ color: `var(${strength.tone}-ink)` }}>{strength.word}.</span>{" "}
                <span style={{ color: "var(--ux-muted)" }}>{strength.why}</span>
              </p>
            </div>
          )}

          <Field label={tr("settingsSecurity.typeItOnceMore")}>
            <TextInput type={show ? "text" : "password"} value={pw.again}
                       onChange={(e) => setPw((p) => ({ ...p, again: e.target.value }))} />
          </Field>
          {mismatch && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ux-orange-ink)" }}>
              <Icons.AlertCircle className="h-[14px] w-[14px]" />{tr("settingsSecurity.theseTwoDoNotMatch")}</p>
          )}

          {/* -my-1 py-1: the row was 18px tall, under the 24px anything
              clickable needs. The negative margin keeps the spacing. */}
          <label className="ux-hov -my-1 flex w-fit cursor-pointer items-center gap-2.5 py-1 text-xsm"
                 style={{ color: "var(--ux-ink-2)" }}>
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)}
                   className="h-[18px] w-[18px] cursor-pointer" />{tr("settingsSecurity.showWhatIAmTyping")}</label>
        </div>

        {/* On a phone the button is full width under its status line. */}
        <div className="mt-4 flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4" style={{ borderColor: "var(--ux-line)" }}>
          <p className="text-[13px] lg:text-xs"
             style={{ color: change.error ? "var(--ux-orange-ink)"
                            : changed ? "var(--ux-green-ink)" : "var(--ux-faint)" }}>
            {change.error ? change.error
              : changed ? tr("settingsSecurity.passwordChangedOtherDevicesHaveBee")
              : tr("settingsSecurity.changingItSignsYouOutEverywhere")}
          </p>
          <Btn variant="primary" icon={change.busy ? "Loader" : "Check"} className={phonePrimary}
               disabled={!canChange || change.busy}
               onClick={() => void change.run()}>
            {change.busy ? "Changing…" : "Change password"}
          </Btn>
        </div>
      </Group>

      <Group title={tr("settingsSecurity.closeYourAccount")} icon="AlertTriangle" inset="form"
             cardStyle={{ borderColor: "var(--ux-orange)" }}>
        <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          Your certificates, your shop and your order history go with it, and we cannot bring them back.
          Money still in your wallet is paid out first — that takes up to seven working days.
        </p>

        {deleting ? (
          <div className="ux-slide-up mt-4 rounded-[12px] p-3.5" style={{ background: "var(--ux-tint-orange)" }}>
            <p className="text-xsm" style={{ color: "var(--ux-ink-2)" }}>
              Type <strong style={{ color: "var(--ux-ink)" }}>CLOSE</strong> to confirm you mean it.
            </p>
            {/* Three controls do not fit across 390px; on a phone they stack. */}
            <div className="mt-2.5 flex flex-col gap-2.5 lg:flex-row lg:items-center">
              <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="CLOSE" />
              <Btn variant="outline" onClick={() => { setDeleting(false); setConfirm(""); }}>{tr("settingsSecurity.keepMyAccount")}</Btn>
              <Btn variant="primary" className={confirm === "CLOSE" ? "" : "pointer-events-none opacity-50"}
                   onClick={() => void close.run()}>{tr("settingsSecurity.closeIt")}</Btn>
            </div>
          </div>
        ) : closed ? (
          <div className="ux-slide-up mt-4 rounded-[12px] p-4" style={{ background: "var(--ux-surface-2)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("settingsSecurity.yourAccountClosesInDays")}</p>
            <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Nothing is deleted yet. Sign in any time in the next 30 days and it stops. Money still owed to
              you is paid out first — we will not close an account holding your earnings.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn variant="primary" size="sm" onClick={() => { setClosed(false); setDeleting(false); setConfirm(""); }}>{tr("settingsSecurity.keepMyAccountAfterAll")}</Btn>
              <Btn href="/app/wallet/withdraw" variant="outline" size="sm">{tr("settingsSecurity.withdrawWhatIAmOwed")}</Btn>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <Btn variant="outline" icon="Trash2" className={phoneSecondary} onClick={() => setDeleting(true)}>{tr("settingsSecurity.closeMyAccount")}</Btn>
          </div>
        )}
      </Group>
    </SettingsPage>
  );
}
