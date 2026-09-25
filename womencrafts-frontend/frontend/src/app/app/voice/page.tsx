"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { ReadAloud } from "@/components/ux/reach/ReadAloud";
import { VOICE_LANGUAGES as RAW_VOICE_LANGUAGES, VOICE_PREFS as RAW_VOICE_PREFS } from "@/components/ux/reach/data";
import { TEXT_SIZES, applyTextSize, readTextSize, type TextSize } from "@/components/ux/reach/text-size";
import { useResource } from "@/lib/use-resource";
import { apiSetVoicePrefs, apiVoicePrefs, type VoicePrefs } from "@/lib/life-api";
import { useT } from "@/i18n";
import { ListGroup, ListRow } from "@/components/ux/mobile/ListRow";
import { GroupLabel, PhoneRow, PhoneTitle } from "@/components/ux/PhoneParts";
import { useTranslated } from "@/i18n/data";

/**
 * The phone's specimen sizes for each text-size option: 15 and 13 (subhead
 * and footnote) scaled by the option's multiplier and landed on the phone
 * type scale — 1.15 × 15 is 17, 1.3 × 15 is 20. The desktop keeps its own
 * 14/12 base, which is the scale it is drawn on.
 */
const PHONE_SPECIMEN: Record<TextSize, [number, number]> = {
  normal: [15, 13],
  large: [17, 15],
  larger: [20, 17],
};

/** The places she can already speak instead of typing. Points at the real
 *  forms, not at a screen that pretended to listen — the microphone that
 *  works is the one on her own keyboard, and it works inside those forms. */
const SPEAK_HERE = [
  { icon: "Store", label: "Adding something to sell", href: "/app/documents/new", note: "Use the microphone on your keyboard" },
  { icon: "MessageCircle", label: "Replying to a buyer", href: "/app/messages", note: "Speak your message" },
  { icon: "Search", label: "Looking for something", href: "/app/search", note: "Say what you need" },
  { icon: "BookOpen", label: "Writing down a sale", href: "/app/books", note: "Say who bought and how much" },
];

/**
 * Reading and speaking — the accessibility layer the app was missing.
 *
 * ── The number that makes this a requirement, not a nicety ──────────────────
 * Adult female literacy in the rural sample behind this product was **36%**
 * against 71% for men. Voice listing solved one screen. The remaining routes
 * were text, which quietly means the app is for her literate daughter.
 *
 * ── This page demonstrates itself ───────────────────────────────────────────
 * A settings page about reading aloud that cannot be read aloud is a joke at
 * the user's expense. The speaker button here is the real component, wired to
 * this page's own content, so she hears exactly what she is turning on before
 * she turns it on.
 *
 * ── Money is off by default ─────────────────────────────────────────────────
 * Handsets are shared and rooms have other people in them. A screen that says
 * her earnings out loud is the same disclosure problem as the family-facing
 * view, so rupee amounts are stripped from anything spoken unless she asks for
 * them explicitly.
 */
export default function VoiceSettingsPage() {
  const VOICE_LANGUAGES = useTranslated(RAW_VOICE_LANGUAGES);
  const VOICE_PREFS = useTranslated(RAW_VOICE_PREFS);
  const tr = useT();
  const [size, setSize] = useState<TextSize>("normal");
  const [err, setErr] = useState<string | null>(null);

  // Text size is a device thing and already persists through `applyTextSize`.
  useEffect(() => setSize(readTextSize()), []);
  const pickSize = useCallback((s: TextSize) => { setSize(s); applyTextSize(s); }, []);

  /**
   * What gets read aloud, and in which language.
   *
   * These were React state: she would turn reading-aloud on, leave the
   * screen, and come back to find it off again — on the screen a woman who
   * cannot read the screen depends on.
   */
  const saved = useResource<VoicePrefs>(
    useCallback((sig: AbortSignal) => apiVoicePrefs(sig), []),
    { on: [], lang: "hi", read_money: false },
  );
  const onIds = useMemo(() => new Set(saved.data.on), [saved.data.on]);
  const prefs = useMemo(
    () => VOICE_PREFS.filter((p) => p.id !== "vp4").map((p) => ({ ...p, on: onIds.has(p.id) })),
    [VOICE_PREFS, onIds],
  );
  const lang = saved.data.lang;

  const save = useCallback(async (next: Partial<VoicePrefs>) => {
    setErr(null);
    try {
      await apiSetVoicePrefs({ ...saved.data, ...next });
      saved.refetch();
    } catch { setErr("That did not save."); }
  }, [saved]);

  const setLang = useCallback((code: string) => { void save({ lang: code }); }, [save]);

  const readsMoney = saved.data.read_money;
  const on = useMemo(() => prefs.filter((p) => p.on).length, [prefs]);
  const speech = useMemo(
    () => VOICE_LANGUAGES.find((l) => l.code === lang) ?? VOICE_LANGUAGES[0],
    [VOICE_LANGUAGES, lang],
  );

  const toggle = useCallback((id: string) => {
    const next = onIds.has(id)
      ? saved.data.on.filter((x) => x !== id)
      : [...saved.data.on, id];
    // `vp5` is the one that reads amounts out loud, and it is tracked
    // separately so the server can keep it off by default.
    void save({ on: next, read_money: next.includes("vp5") });
  }, [onIds, saved.data.on, save]);

  return (
    <HomeShell active="/app/voice">
      <div className="flex flex-col gap-5" id="voice-page">

        <PhoneTitle title={tr("voice.readingAndSpeaking")} sub={tr("voice.youDoNotHaveToRead")}
                    note={tr("voice.everyScreenCanBeReadOut")}>
          <div className="mt-3"><ReadAloud targetId="voice-page" lang={`${speech.code}-IN`} money={readsMoney} /></div>
        </PhoneTitle>
        <header className="hidden flex-wrap items-end gap-4 lg:flex">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("voice.readingAndSpeaking")}</p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("voice.youDoNotHaveToRead")}</h1>
            <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              Every screen can be read out to you, in your own language. Anywhere you would type,
              you can speak instead. Try it on this page first — press the button.
            </p>
          </div>
          <ReadAloud targetId="voice-page" lang={`${speech.code}-IN`} money={readsMoney} />
        </header>

        {/* Language first — it decides what the voice sounds like */}
        <div>
          <GroupLabel sub={tr("voice.theVoiceComesFromYourPhone")}>{tr("voice.whichLanguageShouldItSpeak")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("voice.whichLanguageShouldItSpeak")}
                         sub={tr("voice.theVoiceComesFromYourPhone")} icon="Languages" />
          </div>
          {/* One of several: on a phone, rows with a checkmark. */}
          <ListGroup className="lg:hidden">
            {VOICE_LANGUAGES.map((l) => (
              <ListRow key={l.code} title={l.label} subtitle={l.ready ? l.english : "coming"}
                       selected={lang === l.code} disabled={!l.ready}
                       onClick={() => l.ready && setLang(l.code)} />
            ))}
          </ListGroup>
          <div className="hidden lg:block">
          <Card pad={16}>
            <div className="flex flex-wrap gap-2">
              {VOICE_LANGUAGES.map((l) => (
                <button key={l.code} type="button" onClick={() => l.ready && setLang(l.code)}
                        disabled={!l.ready}
                        className="ux-press ux-sq rounded-[12px] px-3.5 py-2.5 text-left"
                        style={{
                          background: v(lang === l.code ? "--ux-fill" : "--ux-surface-2"),
                          color: v(lang === l.code ? "--ux-on-brand" : "--ux-ink"),
                          opacity: l.ready ? 1 : 0.45,
                        }}>
                  <p className="text-base font-bold leading-none">{l.label}</p>
                  <p className="mt-1 text-2xs" style={{ opacity: 0.75 }}>
                    {l.ready ? l.english : "coming"}
                  </p>
                </button>
              ))}
            </div>
          </Card>
          </div>
        </div>

        {/* Text size — a real control. This was a dead switch before. */}
        <div>
          <GroupLabel sub={tr("voice.changesEverythingEverywhereStraigh")}>{tr("voice.howBigShouldTheWordsBe")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("voice.howBigShouldTheWordsBe")}
                         sub={tr("voice.changesEverythingEverywhereStraigh")} icon="Type" />
          </div>
          {/*
            Three across at 390px clipped "Biggest" inside its own button. On a
            phone each option is a row, and each row is still set at its own
            scale — she reads the thing she is choosing — on the phone's steps.
          */}
          <ListGroup className="lg:hidden">
            {(Object.keys(TEXT_SIZES) as TextSize[]).map((k) => (
              <PhoneRow key={k} onClick={() => pickSize(k)} selected={size === k}
                        title={
                          <span className="font-bold leading-tight" style={{ fontSize: PHONE_SPECIMEN[k][0] }}>
                            {k === "normal" ? "Normal" : k === "large" ? "Bigger" : "Biggest"}
                          </span>
                        }>
                <span className="mt-1 block font-normal leading-snug"
                      style={{ fontSize: PHONE_SPECIMEN[k][1], color: v("--ux-muted") }}>{tr("voice.blouseStitching")}</span>
              </PhoneRow>
            ))}
          </ListGroup>
          <div className="hidden lg:block">
          <Card pad={16}>
            <div className="flex flex-wrap gap-2.5">
              {(Object.keys(TEXT_SIZES) as TextSize[]).map((k) => (
                <button key={k} type="button" onClick={() => pickSize(k)}
                        aria-pressed={size === k}
                        className="ux-press ux-sq flex-1 rounded-[12px] px-4 py-4 text-left"
                        style={{
                          background: v(size === k ? "--ux-fill" : "--ux-surface-2"),
                          color: v(size === k ? "--ux-on-brand" : "--ux-ink"),
                          border: `1px solid ${v(size === k ? "--ux-fill" : "--ux-line")}`,
                        }}>
                  {/* Each option is set at its own scale, so she is reading the
                      thing she is choosing rather than a label describing it. */}
                  <p className="font-bold leading-tight"
                     style={{ fontSize: `${14 * TEXT_SIZES[k]}px` }}>
                    {k === "normal" ? "Normal" : k === "large" ? "Bigger" : "Biggest"}
                  </p>
                  {/* 12, not 11. The sample is real text she has to read to
                      choose, and at the "Normal" setting the multiplier is 1 —
                      so an 11px base put this screen's only specimen below the
                      12px floor the rest of the app holds. The ratio between
                      the three options is what the preview is for, and 12 shows
                      it just as well. */}
                  <p className="mt-1 leading-snug" style={{ fontSize: `${12 * TEXT_SIZES[k]}px`, opacity: 0.8 }}>{tr("voice.blouseStitching")}</p>
                </button>
              ))}
            </div>
          </Card>
          </div>
        </div>

        <div>
          <GroupLabel sub={`${on} of ${prefs.length} turned on`}>{tr("voice.whatItShouldDo")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("voice.whatItShouldDo")} sub={`${on} of ${prefs.length} turned on`} icon="Settings2" />
          </div>
          <Card pad={0} style={{ overflow: "hidden" }}>
            {prefs.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3.5 px-5 py-4 max-lg:gap-3 max-lg:px-4 max-lg:py-3"
                   style={{ borderTop: i === 0 ? "none" : `1px solid ${v("--ux-line")}` }}>
                <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[12px]"
                      style={{ background: v(p.on ? "--ux-brand-tint" : "--ux-surface-2"),
                               color: v(p.on ? "--ux-brand" : "--ux-muted") }}>
                  <I name={p.icon} className="h-[17px] w-[17px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{p.label}</p>
                    {p.id === "vp5" && <Pill tone="orange" size="sm">Careful</Pill>}
                  </div>
                  <p className="mt-0.5 text-[13px] lg:text-xs" style={{ color: v("--ux-muted") }}>{p.detail}</p>
                </div>
                <button type="button" role="switch" aria-checked={p.on} aria-label={p.label}
                        onClick={() => toggle(p.id)}
                        /* On a phone the app gives every button a 44px minimum,
                           which stretched this 26px track into a 44px pill.
                           Exempt, and grown to 44 by a transparent border
                           instead — the switch keeps its shape, the target
                           keeps its size. Nothing changes from `lg`. */
                        className="ux-press ux-sq ux-tap-exempt relative -my-[9px] box-content h-[26px] w-[46px] shrink-0 rounded-full border-y-[9px] border-solid border-transparent bg-clip-padding lg:my-0 lg:border-y-0"
                        style={{ backgroundColor: v(p.on ? "--ux-green-ink" : "--ux-line-strong"),
                                 transition: "background var(--ux-t-fast) var(--ux-ease)" }}>
                  <span className="absolute top-[3px] h-[20px] w-[20px] rounded-full"
                        style={{ left: p.on ? 23 : 3, background: v("--ux-surface"),
                                 transition: "left var(--ux-t-fast) var(--ux-ease)" }} />
                </button>
              </div>
            ))}
          </Card>
        </div>

        {readsMoney && (
          <Card pad={16} style={{ background: v("--ux-tint-amber"), borderColor: "transparent" }}>
            <p className="flex items-start gap-2 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              <I name="AlertTriangle" className="mt-[2px] h-[15px] w-[15px] shrink-0"
                 style={{ color: v("--ux-amber-ink") }} />
              Your phone will now say rupee amounts out loud. If anyone else is in the room, they
              will hear what you earned. Turn this off before you hand the phone over.
            </p>
          </Card>
        )}

        <div>
          <GroupLabel>{tr("voice.whereYouCanAlreadySpeakInstead")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("voice.whereYouCanAlreadySpeakInstead")} icon="Mic" />
          </div>
          {/* Destinations: on a phone, one grouped list. */}
          <ListGroup className="lg:hidden">
            {SPEAK_HERE.map((x) => (
              <PhoneRow key={x.href} href={x.href} icon={x.icon} title={x.label} meta={x.note} />
            ))}
          </ListGroup>
          <div className="hidden gap-3 sm:grid-cols-2 lg:grid">
            {SPEAK_HERE.map((x) => (
              <Card key={x.href} pad={0} style={{ overflow: "hidden" }}>
                <a href={x.href} className="ux-press flex items-center gap-3.5 p-4">
                  <span className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px]"
                        style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                    <I name={x.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{x.label}</p>
                    <p className="text-xs" style={{ color: v("--ux-muted") }}>{x.note}</p>
                  </div>
                  <I name="ChevronRight" className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-faint") }} />
                </a>
              </Card>
            ))}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nothing ever reads out on its own — you press the button each time. The voice comes
              from your own phone, so nothing you look at is sent anywhere to be read.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
