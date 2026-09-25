"use client";

import { useCallback, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, SourceNote, v } from "@/components/ux/kit";
import { EYEBROW, GROUP, GROUP_ROW, Section } from "@/components/ux/earn/phone";
import { useResource } from "@/lib/use-resource";
import { apiEditGuards, apiGuards, type Guards } from "@/lib/vault-api";
import { useT } from "@/i18n";

/**
 * The four guards, in the order they matter on a shared handset. The words
 * live here rather than on the server because they are copy, not data — the
 * server stores four booleans and nothing else.
 */
const GUARD_COPY: { key: keyof Guards; label: string; note: string; icon: string }[] = [
  { key: "hide_amount", icon: "EyeOff", label: "Keep the amount hidden",
    note: "Tap to see it. It hides again when you leave the screen." },
  { key: "pin_to_move", icon: "KeyRound", label: "Ask for the PIN before money moves",
    note: "Anyone can look. Only you can take." },
  { key: "quiet_notifications", icon: "BellOff", label: "No amounts in notifications",
    note: "A message says a payment arrived, never how much." },
  { key: "quick_exit", icon: "DoorOpen", label: "Quick exit",
    note: "Press and hold the back arrow to jump to the home screen." },
];

/**
 * Who can see your money.
 *
 * Treated as product, not as a settings page nobody opens — and every default
 * is the private one. GSMA names safety and security as a top barrier to
 * women's further use of mobile internet, and the handset is very often not
 * hers: in Pakistan only 48% of women who use mobile internet on someone
 * else's phone use it daily, against 94% of those who own theirs.
 *
 * The framing matters too. Other products treat this as *hiding*, which is
 * furtive and makes her the one doing something wrong. This screen treats it
 * as *choosing what to show* — the same mechanism, told in a way she can
 * repeat out loud to the person holding the phone.
 */
export default function PrivacyPage() {
  const tr = useT();
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const guards = useResource<Guards>(
    useCallback((s) => apiGuards(s), []),
    { hide_amount: true, pin_to_move: true, quiet_notifications: true, quick_exit: false },
  );

  /**
   * Saved on the server, not in component state. This screen used to flip a
   * local boolean and say "On" — she would set the guards, leave, and come
   * back to find every one of them reset, having believed for the whole time
   * that her balance was hidden on a phone she shares.
   */
  const toggle = useCallback(async (key: keyof Guards, label: string, next: boolean) => {
    setBusy(key); setErr(null);
    try {
      await apiEditGuards({ [key]: next });
      setNote(next ? `On — ${label.toLowerCase()}.` : `Off. ${label} is no longer protecting you.`);
      guards.refetch();
    } catch {
      setErr("That did not save. It is unchanged.");
    } finally { setBusy(null); }
  }, [guards]);

  return (
    <HomeShell active="/app/vault">
      <div className="flex flex-col gap-6 lg:gap-5">
        <Back to="/app/vault" label={tr("vaultPrivacy.backToYourLocker")} />

        <header>
          <p className={EYEBROW}>{tr("vaultPrivacy.whoCanSee")}</p>
          <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("vaultPrivacy.youDecideWhatShows")}</h1>
          <p className="mt-1.5 max-w-[54ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Phones get shared. That is normal, and it should not cost you your privacy.
            All of this is on already — turn any of it off if you would rather.
          </p>
        </header>

        <SourceNote source={guards.source} what="these settings" />

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px] shrink-0" />{note}
            </p>
          </Card>
        )}
        {err && (
          <Card pad={16} style={{ background: v("--ux-danger-tint"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-danger-ink") }}>
              <I name="AlertTriangle" className="h-[16px] w-[16px] shrink-0" />{err}
            </p>
          </Card>
        )}

        <div>
          <Section title={tr("vaultPrivacy.onThisPhone")} icon="ShieldCheck" />
          <div className={`flex flex-col gap-2.5 ${GROUP}`}>
            {GUARD_COPY.map((g) => {
              const on = guards.data[g.key];
              return (
              <Card key={g.key} pad={16} className={GROUP_ROW}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={g.icon}
                            tint={on ? "--ux-tint-violet" : "--ux-surface-2"}
                            ink={on ? "--ux-violet" : "--ux-muted"} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{g.label}</p>
                    <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>{g.note}</p>
                  </div>
                  <button
                    type="button" role="switch" aria-checked={on} disabled={busy === g.key}
                    aria-label={`${on ? tr("vaultPrivacy.turnOff")
              : tr("vaultPrivacy.turnOn")}: ${g.label}`}
                    onClick={() => toggle(g.key, g.label, !on)}
                    className="ux-press relative grid h-[28px] w-[50px] shrink-0 place-items-center rounded-full max-lg:-my-2 max-lg:h-[44px]">
                    {/* The track is drawn inside the button rather than being it. The app's
                        44px tap floor stretched a 28px switch into a 50x44 slab
                        with its knob stuck to the top; now the target is 44px
                        and the switch is still a switch. */}
                    <span className="relative h-[28px] w-[50px] rounded-full transition-colors"
                          style={{ background: v(on ? "--ux-brand" : "--ux-line-strong") }}>
                      <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full"
                            style={{ left: on ? 25 : 3, background: v("--ux-surface"),
                                     transition: "left var(--ux-t) var(--ux-ease-out)" }} />
                    </span>
                  </button>
                </div>
              </Card>
              );
            })}
          </div>
        </div>

        <Card pad={20} style={{ background: v("--ux-tint-pink"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3.5">
            <IconTile icon="Users" tint="--ux-surface" ink="--ux-pink-ink" size={42} />
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{tr("vaultPrivacy.whatYourCircleCanSee")}</p>
              <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Only whether you have paid into the pot this round. Never your balance, never your
                pockets, never what you earned. Your circle vouches for you — it does not audit you.
              </p>
              <Btn size="sm" variant="outline" className="mt-3" href="/app/circles">{tr("vaultPrivacy.seeYourCircle")}</Btn>
            </div>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
