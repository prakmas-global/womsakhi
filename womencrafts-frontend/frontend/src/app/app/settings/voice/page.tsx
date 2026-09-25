"use client";

import { useCallback } from "react";

import { useDevicePref } from "@/lib/use-device-pref";

import { IconTile } from "@/components/ux/kit";
import { SettingsPage, Toggle } from "@/components/ux/settings/Frame";
import { ListRow } from "@/components/ux/mobile/ListRow";
import { PhoneRow } from "@/components/ux/PhoneParts";
import { Group } from "../_parts/Group";
import { VOICE_CAN as RAW_VOICE_CAN, VOICE_LANGS as RAW_VOICE_LANGS } from "@/components/ux/more/data";
import { useResource } from "@/lib/use-resource";
import { apiSetVoicePrefs, apiVoicePrefs, type VoicePrefs } from "@/lib/life-api";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";

/**
 * Voice Mode.
 *
 * This screen configures voice; it does not implement it. Sakhi's speech
 * pipeline is deliberately untouched — she gets her own pass at the end.
 *
 * Voice is not a convenience here. A member who reads slowly, or whose hands
 * are covered in dough or thread, cannot use a form. The examples are written
 * as things she would actually say out loud, because the hardest part of voice
 * is not the listening — it is knowing what you are allowed to ask for.
 */
export default function VoiceSettings() {
  const VOICE_CAN = useTranslated(RAW_VOICE_CAN);
  const VOICE_LANGS = useTranslated(RAW_VOICE_LANGS);
  const tr = useT();
  const [on, setOn] = useDevicePref("voice.on", true);
  const [wake, setWake] = useDevicePref("voice.wake", true);
  const [readOut, setReadOut] = useDevicePref("voice.readOut", true);
  /**
   * The speech language, on the account rather than in component state — it
   * is the same preference `/app/voice` sets, and the two screens disagreeing
   * about which language reads her screen would be worse than either.
   *
   * The three toggles above stay device-local through `useDevicePref`: whether
   * the microphone appears is about this handset, not about her.
   */
  const saved = useResource<VoicePrefs>(
    useCallback((sig: AbortSignal) => apiVoicePrefs(sig), []),
    { on: [], lang: "hi", read_money: false },
  );
  const lang = saved.data.lang;
  const setLang = useCallback((code: string) => {
    void apiSetVoicePrefs({ ...saved.data, lang: code }).then(() => saved.refetch()).catch(() => {});
  }, [saved]);

  return (
    <SettingsPage
      title="Voice"
      sub={tr("settingsVoice.talkToSakhiInsteadOfTyping")}
    >
      <Group>
        <Toggle
          on={on} onChange={setOn}
          label={tr("settingsVoice.useVoice")}
          whenOn="The microphone button appears wherever Sakhi does."
          whenOff="Sakhi is typing only. Nothing listens."
        />
      </Group>

      {on && (
        <>
          {/* A phone lists the languages as rows with a checkmark; the
              three-up grid of tiles is the desktop's shape. */}
          <Group
            title={tr("settingsVoice.whatLanguageSheListensIn")}
            sub={tr("settingsVoice.theSameOneSheRepliesAnd")}
            inset="flush"
            phone={VOICE_LANGS.map((l) => (
              <ListRow
                key={l.code}
                title={l.name}
                subtitle={l.ready ? l.en : "Coming soon"}
                selected={lang === l.code}
                disabled={!l.ready}
                onClick={() => l.ready && setLang(l.code)}
              />
            ))}
          >
            <div className="ux-deck grid grid-cols-3 gap-2.5">
              {VOICE_LANGS.map((l, i) => {
                const sel = lang === l.code;
                return (
                  <button
                    key={l.code}
                    onClick={() => l.ready && setLang(l.code)}
                    aria-pressed={sel}
                    disabled={!l.ready}
                    className="ux-i ux-sq rounded-[12px] border p-3 text-start"
                    style={{
                      borderColor: sel ? "var(--ux-brand)" : "var(--ux-line)",
                      background: sel ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                      opacity: l.ready ? 1 : 0.55,
                      ["--i" as string]: i,
                    }}
                  >
                    {/* Her language in her own script — not transliterated. */}
                    <span className="block text-base font-semibold" style={{ color: "var(--ux-ink)" }}>{l.name}</span>
                    <span className="mt-0.5 block text-[12px] lg:text-2xs" style={{ color: "var(--ux-muted)" }}>
                      {l.ready ? l.en : "Coming soon"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Group>

          <Group
            title={tr("settingsVoice.thingsYouCanSay")}
            sub={tr("settingsVoice.outLoudInYourOwnWords")}
            inset="flush"
            phone={VOICE_CAN.map((v) => (
              <PhoneRow key={v.id} icon={v.icon} tint="--ux-tint-lilac" ink="--ux-brand"
                        title={v.say} meta={v.does} />
            ))}
          >
            <ul className="ux-stagger space-y-3">
              {VOICE_CAN.map((v, i) => (
                <li key={v.id} className="ux-hov flex items-start gap-3" style={{ ["--i" as string]: i }}>
                  <IconTile icon={v.icon} tint="--ux-tint-lilac" ink="--ux-brand" size={36} radius={10} />
                  <div className="min-w-0">
                    <p className="text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{v.say}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>{v.does}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Group>

          <Group title={tr("settingsVoice.howItBehaves")} noteIcon="Lock"
                 note={tr("settingsVoice.whatYouSayIsTurnedInto")}>
            <div className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
              <Toggle
                on={wake} onChange={setWake}
                label={tr("settingsVoice.listenOnlyWhenYouPress")}
                whenOn="Nothing is recorded until you hold the microphone button."
                whenOff="Sakhi listens for her name. Some members find this uncomfortable."
              />
              <Toggle
                on={readOut} onChange={setReadOut}
                label={tr("settingsVoice.readRepliesOutLoud")}
                whenOn="She speaks her answer as well as showing it."
                whenOff="She writes her answer. Nothing is spoken."
              />
            </div>
          </Group>
        </>
      )}
    </SettingsPage>
  );
}
