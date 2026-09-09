"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, IconTile, Pill, Progress, SectionHead, v } from "@/components/ux/kit";
import { WISHES, wishesDone, type Wish } from "@/components/ux/life/data";
import { useT } from "@/i18n";

/**
 * If something happens to me.
 *
 * ── The moment nobody builds for ────────────────────────────────────────────
 * Widowhood, divorce, abandonment, a hospital stay. These are the moments a
 * woman's economic identity disappears: accounts she cannot access, papers in
 * someone else's name, a shop that simply stops, a savings pot where her months
 * are lost because nobody knew she was in it. It happens to an enormous number
 * of women and **no platform anywhere prepares for it.**
 *
 * ── The design problem, and the answer ──────────────────────────────────────
 * This screen could very easily be morbid, and a morbid screen does not get
 * filled in. So it is framed as *leaving instructions* rather than as death —
 * six plain questions a woman can answer in five minutes, mostly about where
 * things are. Nothing about wills, nothing about probate, no legal language.
 *
 * The most valuable answer is the least dramatic one: **where the papers are.**
 *
 * ── The safety problem this screen creates, and how it is handled ───────────
 * This is the one module in the build that can put a woman in danger, and that
 * is not a hypothetical. A study exploiting the timing of India's inheritance
 * reforms found that strengthening women's property rights **increased
 * wife-beating**; a companion paper found it increased female foeticide. Asking
 * a woman to write down what is in her name is therefore not a neutral act.
 *
 * Compounding it: roughly **18% of Indian women who use mobile internet do so
 * on a borrowed phone**, India ranks third in the world for stalkerware, and an
 * app-store download record survives deleting the app.
 *
 * So three things are non-negotiable here. The property question is **last and
 * optional**, and says why. There is a **hide control that blanks every answer
 * on the screen in one tap** — because the realistic threat is someone walking
 * up behind her, not a hacker. And the copy never implies she is preparing to
 * leave anyone, because in the femicide literature estrangement is the peak-risk
 * moment and this screen must not read like a first step towards it.
 */
export default function InCasePage() {
  const tr = useT();
  const [wishes, setWishes] = useState<Wish[]>(WISHES);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  /**
   * Answers are covered until she asks for them. The threat model here is not a
   * hacker — it is a husband or a son picking up the phone she is holding.
   */
  const [covered, setCovered] = useState(true);

  const done = useMemo(() => wishesDone(wishes), [wishes]);
  const pct = Math.round((done / wishes.length) * 100);

  // Cover again whenever she leaves — the state must not survive a return trip.
  useEffect(() => () => setCovered(true), []);

  const save = useCallback((id: string) => {
    const text = draft.trim();
    if (!text) { setEditing(null); return; }
    setWishes((r) => r.map((w) => (w.id === id ? { ...w, answer: text } : w)));
    setEditing(null);
    setDraft("");
    setNote("Written down. Only the person you name can ever be shown this.");
  }, [draft]);

  return (
    <HomeShell active="/app/incase">
      <div className="flex flex-col gap-5">

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("incase.ifSomethingHappens")}</p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("incase.ifYouAreNotThereTo")}</h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            A week in hospital, a move, or worse. Six plain questions, answered once, so nobody has
            to guess and nothing you built simply stops.
          </p>
        </header>

        <Card pad={20} style={{ background: v("--ux-tint-violet"), borderColor: "transparent" }}>
          <div className="flex flex-wrap items-center gap-4">
            <IconTile icon="ShieldCheck" tint="--ux-surface" ink="--ux-violet" size={46} radius={13} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>
                {done} of {wishes.length} answered
              </p>
              <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Nobody sees any of this while you are here. Not your circle, not your family,
                not us.
              </p>
              <div className="mt-3"><Progress pct={pct} tone="--ux-violet" track="--ux-surface" /></div>
            </div>
            <Btn size="sm" variant="outline" icon={covered ? "Eye" : "EyeOff"}
                 onClick={() => setCovered((c) => !c)}>
              {covered ? "Show answers" : "Cover"}
            </Btn>
          </div>
          <div className="mt-3.5 flex items-start gap-2.5 border-t pt-3.5"
               style={{ borderColor: v("--ux-line") }}>
            <I name="EyeOff" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Your answers stay covered until you tap to see them, and they cover themselves again
              when you leave this screen. If someone is beside you, they see nothing.
            </p>
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title={tr("incase.theSixQuestions")} sub={tr("incase.answerWhatYouWantSkipWhat")}
                       icon="ListChecks" chip={`${done}/${wishes.length}`} />
          <div className="flex flex-col gap-2.5">
            {wishes.map((w) => (
              <Card key={w.id} pad={16}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={w.icon}
                            tint={w.answer ? "--ux-tint-green" : "--ux-surface-2"}
                            ink={w.answer ? "--ux-green-ink" : "--ux-muted"} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{w.question}</p>
                      {w.answer && <Pill tone="green" size="sm">Written</Pill>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{w.why}</p>

                    {w.answer && editing !== w.id && (
                      <p className="mt-2.5 rounded-[12px] px-3 py-2.5 text-xsm font-semibold"
                         style={{ background: v("--ux-surface-2"),
                                  color: v(covered ? "--ux-muted" : "--ux-ink") }}>
                        {covered ? "••••••••••" : w.answer}
                      </p>
                    )}

                    {editing === w.id && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") save(w.id); }}
                          placeholder={tr("incase.inYourOwnWords")}
                          aria-label={w.question}
                          className="ux-sq min-w-0 flex-1 rounded-[12px] border px-3 py-2.5 text-xsm outline-none"
                          style={{ borderColor: v("--ux-brand"), background: v("--ux-surface"), color: v("--ux-ink") }}
                        />
                        <Btn size="sm" onClick={() => save(w.id)}>Save</Btn>
                        <Btn size="sm" variant="ghost" onClick={() => { setEditing(null); setDraft(""); }}>Cancel</Btn>
                      </div>
                    )}
                  </div>
                  {editing !== w.id && (
                    <Btn size="sm" variant={w.answer ? "ghost" : "outline"}
                         onClick={() => { setEditing(w.id); setDraft(w.answer ?? ""); }}>
                      {w.answer ? "Change" : "Answer"}
                    </Btn>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Lock" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              This is not a will and it does not decide who owns anything — it just means the people
              who love you are not searching an almirah at the worst moment of their lives.
              If you want a will, that is a different and worthwhile thing, and we can point you to
              free legal help.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
