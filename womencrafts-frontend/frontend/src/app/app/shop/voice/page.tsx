"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { VOICE_LANGS, VOICE_SAMPLES } from "@/components/ux/eight/data";

/**
 * Say it, don't type it.
 *
 * ── The shape of this screen is the argument ────────────────────────────────
 * Adult female literacy in the rural sample behind this research was 36%
 * against 71% for men, so a form excludes two-thirds of the women this is for.
 * A form with a microphone bolted on is still a form. So there is no form here
 * at all: one button that fills the screen, then **her own sentence quoted back
 * to her**, then the listing written as a sentence with the numbers tappable.
 *
 * She never sees a labelled field. She sees what she said, and what it became.
 *
 * ── Why the AI is kept on a very short leash ────────────────────────────────
 * A trial of 640 Kenyan entrepreneurs given a GPT-4 business mentor found high
 * performers gained ~15% while low performers did ~8–10% **worse**. AI closes
 * gaps on tight, checkable tasks and widens them where judgment is needed. So
 * it does exactly one tight job — turn a sentence into a listing — and offers
 * no advice, no pricing opinion, no "tips to sell more". Anything it is unsure
 * about is marked and she is asked, rather than guessed at silently.
 */

type Phase = "idle" | "listening" | "heard";

export default function VoicePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [lang, setLang] = useState("Hindi");
  const [which, setWhich] = useState(0);
  const [draft, setDraft] = useState(VOICE_SAMPLES[0]);
  const [editing, setEditing] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [published, setPublished] = useState(false);
  const [photo, setPhoto] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // A waveform that responds to nothing is a lie, but a still microphone reads
  // as broken. This animates only while listening, and stops the moment it does.
  useEffect(() => {
    if (phase === "listening") {
      timer.current = setInterval(() => setTick((t) => t + 1), 110);
      const done = setTimeout(() => {
        const next = VOICE_SAMPLES[which % VOICE_SAMPLES.length];
        setDraft(next);
        setPhase("heard");
      }, 2400);
      return () => { clearTimeout(done); if (timer.current) clearInterval(timer.current); };
    }
    if (timer.current) clearInterval(timer.current);
  }, [phase, which]);

  const listen = useCallback(() => {
    setPublished(false);
    setPhase("listening");
    setWhich((w) => w + 1);
  }, []);

  const bar = (i: number) => {
    const seed = Math.sin((tick + i * 3) * 0.9) * 0.5 + 0.5;
    return phase === "listening" ? 18 + seed * 46 : 6;
  };

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">
        <Back to="/app/shop" label="Back to your shops" />

        {/* The whole screen is the button, until she has spoken. */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          <div className="flex flex-col items-center px-6 py-10 text-center"
               style={{ background: `linear-gradient(160deg, ${v("--ux-brand-tint")}, ${v("--ux-surface")})` }}>
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
              Add something to sell
            </p>
            <h1 className="mt-2.5 max-w-[16ch] text-[clamp(1.625rem,4vw,2.375rem)] font-extrabold leading-[1.08] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              {phase === "listening" ? "Go on, I am listening" : "Just say what you sell"}
            </h1>
            <p className="mt-2.5 max-w-[34ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              In your own words, in your own language. Say the thing and the price — that is enough.
            </p>

            {/* Waveform */}
            <div className="mt-7 flex h-[70px] items-center justify-center gap-[4px]">
              {Array.from({ length: 15 }).map((_, i) => (
                <span key={i} className="w-[5px] rounded-full"
                      style={{
                        height: bar(i),
                        background: v(phase === "listening" ? "--ux-brand" : "--ux-line-strong"),
                        transition: "height var(--ux-t-fast) linear",
                      }} />
              ))}
            </div>

            <button
              type="button"
              onClick={listen}
              disabled={phase === "listening"}
              aria-label={phase === "listening" ? "Listening" : "Press and speak"}
              className="ux-press mt-7 grid h-[104px] w-[104px] place-items-center rounded-full"
              style={{
                background: v(phase === "listening" ? "--ux-danger-solid" : "--ux-fill"),
                color: v("--ux-on-brand"),
                boxShadow: v("--ux-shadow-glow"),
              }}
            >
              <I name={phase === "listening" ? "Square" : "Mic"} className="h-[42px] w-[42px]" sw={1.7} />
            </button>
            <p className="mt-3.5 text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>
              {phase === "listening" ? "Listening…" : "Press and speak"}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-1.5">
              {VOICE_LANGS.map((l) => (
                <button key={l} type="button" onClick={() => setLang(l)}
                        className="ux-press rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={{
                          background: v(lang === l ? "--ux-fill" : "--ux-surface"),
                          color: v(lang === l ? "--ux-on-brand" : "--ux-ink-2"),
                          border: `1px solid ${v(lang === l ? "--ux-fill" : "--ux-line")}`,
                        }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {phase === "heard" && (
          <>
            {/* Her own words, quoted back. This is the trust move. */}
            <Card pad={20}>
              <p className="text-2xs font-extrabold uppercase tracking-[0.14em]" style={{ color: v("--ux-muted") }}>
                What I heard you say
              </p>
              <p className="mt-2.5 border-l-2 pl-4 text-lg font-semibold italic leading-relaxed"
                 style={{ borderColor: v("--ux-brand"), color: v("--ux-ink") }}>
                &ldquo;{draft.heardText}&rdquo;
              </p>
              <p className="mt-2.5 text-xs" style={{ color: v("--ux-muted") }}>
                {draft.lang} · not right? <button type="button" onClick={listen}
                  className="font-bold underline" style={{ color: v("--ux-brand") }}>say it again</button>
              </p>
            </Card>

            {/* The listing, written as a sentence. Every number is tappable. */}
            <Card pad={20}>
              <p className="text-2xs font-extrabold uppercase tracking-[0.14em]" style={{ color: v("--ux-brand") }}>
                So your listing says
              </p>
              <p className="mt-3 text-lg leading-[1.7]" style={{ color: v("--ux-ink") }}>
                You sell{" "}
                <Editable value={draft.title} unsure={draft.unsure.includes("title")}
                          open={editing === "title"} onOpen={() => setEditing("title")}
                          onSave={(t) => { setDraft({ ...draft, title: t }); setEditing(null); }} />
                {" "}for{" "}
                <Editable value={formatRupees(draft.price)} unsure={draft.unsure.includes("price")}
                          open={editing === "price"} onOpen={() => setEditing("price")}
                          onSave={(t) => {
                            const n = Number(t.replace(/[^0-9]/g, "")) * 100;
                            setDraft({ ...draft, price: n || draft.price, unsure: draft.unsure.filter((u) => u !== "price") });
                            setEditing(null);
                          }} />
                {" "}{draft.unit}.{" "}
                <Editable value={draft.detail} unsure={draft.unsure.includes("detail")}
                          open={editing === "detail"} onOpen={() => setEditing("detail")}
                          onSave={(t) => { setDraft({ ...draft, detail: t }); setEditing(null); }} />
                .
              </p>

              {draft.unsure.length > 0 && (
                <p className="mt-4 flex items-start gap-2 rounded-[12px] px-3.5 py-3 text-xsm leading-relaxed"
                   style={{ background: v("--ux-tint-amber"), color: v("--ux-ink-2") }}>
                  <I name="AlertTriangle" className="mt-[2px] h-[15px] w-[15px] shrink-0"
                     style={{ color: v("--ux-amber-ink") }} />
                  I was not sure about the price — it is underlined above. Tap it and check before
                  this goes out.
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <Btn icon="Check" disabled={published} onClick={() => setPublished(true)}>
                  {published ? "It is in your shop" : "Yes, that is right"}
                </Btn>
                <Btn variant="outline" icon="Mic" onClick={listen}>Say it differently</Btn>
                <Btn variant="ghost" icon="Camera"
                     onClick={() => setPhoto(true)}>{photo ? "Photo added" : "Add a photo"}</Btn>
              </div>
            </Card>

            {published && (
              <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
                <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
                  <I name="CheckCircle2" className="h-[16px] w-[16px]" />
                  Added. Nothing was published until you said it was right.
                </p>
              </Card>
            )}
          </>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nothing goes into your shop until you have read it back and said yes. If a word came
              out wrong, tap it — you are correcting a sentence, not filling a form.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

/** A word in a sentence she can tap to correct. Not a labelled input. */
function Editable({ value, unsure, open, onOpen, onSave }: {
  value: string; unsure: boolean; open: boolean; onOpen: () => void; onSave: (t: string) => void;
}) {
  const [t, setT] = useState(value);
  useEffect(() => setT(value), [value, open]);

  if (open) {
    return (
      <input
        autoFocus value={t}
        onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSave(t); }}
        onBlur={() => onSave(t)}
        aria-label="Correct this"
        className="ux-sq rounded-[8px] border-2 px-2 py-0.5 text-lg font-bold outline-none"
        style={{ borderColor: v("--ux-brand"), background: v("--ux-surface"),
                 color: v("--ux-ink"), width: `${Math.max(6, t.length + 2)}ch` }}
      />
    );
  }
  return (
    <button type="button" onClick={onOpen}
            className="ux-press rounded-[8px] px-1.5 font-extrabold"
            style={{
              color: v("--ux-brand"),
              background: v(unsure ? "--ux-tint-amber" : "--ux-brand-tint"),
              textDecoration: unsure ? "underline wavy" : "none",
              textDecorationColor: unsure ? v("--ux-amber-ink") : undefined,
              textUnderlineOffset: "4px",
            }}>
      {value}
    </button>
  );
}
