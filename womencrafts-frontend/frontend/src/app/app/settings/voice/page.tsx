"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import { useDevicePref } from "@/lib/use-device-pref";

import { IconTile } from "@/components/ux/kit";
import { Card, SectionHead, SettingsPage, Toggle } from "@/components/ux/settings/Frame";
import { VOICE_CAN, VOICE_LANGS } from "@/components/ux/more/data";

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
  const [on, setOn] = useDevicePref("voice.on", true);
  const [wake, setWake] = useDevicePref("voice.wake", true);
  const [readOut, setReadOut] = useDevicePref("voice.readOut", true);
  const [lang, setLang] = useState("hi");

  return (
    <SettingsPage
      title="Voice"
      sub="Talk to Sakhi instead of typing. Useful when your hands are busy, or when reading is slow."
    >
      <Card>
        <Toggle
          on={on} onChange={setOn}
          label="Use voice"
          whenOn="The microphone button appears wherever Sakhi does."
          whenOff="Sakhi is typing only. Nothing listens."
        />
      </Card>

      {on && (
        <>
          <Card>
            <SectionHead title="What language she listens in"
                         sub="The same one she replies and speaks in" />
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
                    <span className="block text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>{l.name}</span>
                    <span className="mt-0.5 block text-[0.6875rem]" style={{ color: "var(--ux-muted)" }}>
                      {l.ready ? l.en : "Coming soon"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionHead title="Things you can say" sub="Out loud, in your own words — these are examples, not commands" />
            <ul className="ux-stagger space-y-3">
              {VOICE_CAN.map((v, i) => (
                <li key={v.id} className="ux-hov flex items-start gap-3" style={{ ["--i" as string]: i }}>
                  <IconTile icon={v.icon} tint="--ux-tint-lilac" ink="--ux-brand" size={36} radius={10} />
                  <div className="min-w-0">
                    <p className="text-[0.8125rem] font-medium" style={{ color: "var(--ux-ink)" }}>{v.say}</p>
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{v.does}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionHead title="How it behaves" />
            <div className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
              <Toggle
                on={wake} onChange={setWake}
                label="Listen only when you press"
                whenOn="Nothing is recorded until you hold the microphone button."
                whenOff="Sakhi listens for her name. Some members find this uncomfortable."
              />
              <Toggle
                on={readOut} onChange={setReadOut}
                label="Read replies out loud"
                whenOn="She speaks her answer as well as showing it."
                whenOff="She writes her answer. Nothing is spoken."
              />
            </div>
            <p className="mt-3.5 flex items-start gap-2.5 rounded-[12px] p-3 text-[0.75rem] leading-relaxed"
               style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
              <Icons.Lock className="mt-[1px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-brand)" }} />
              What you say is turned into text and then deleted. No recording of your voice is kept.
            </p>
          </Card>
        </>
      )}
    </SettingsPage>
  );
}
