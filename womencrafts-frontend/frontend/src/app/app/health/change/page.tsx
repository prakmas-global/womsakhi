"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, IconTile, SectionHead, Stat, v } from "@/components/ux/kit";
import { CHANGE_TOPICS } from "@/components/ux/wellness/data";

/**
 * The change — the segment nobody in India serves.
 *
 * ── The gap, in three numbers ───────────────────────────────────────────────
 * Indian women reach menopause at about **46.6 years**, roughly six years
 * earlier than American women — landing squarely on their peak earning years.
 * **80% have never taken anything for it and 0.8% are on hormones.** And in a
 * study of employed women aged 45–65 in Mysuru, **73.2% reported moderate to
 * severe symptoms and 40.4% had poor work ability**, with the damage
 * concentrated in unskilled, physically demanding work — which is this user.
 *
 * There is no Indian product for this and almost no Indian measurement of it.
 * NFHS-6 dropped the indicator entirely. It is the widest gap between plausible
 * impact and existing evidence in the whole health review.
 *
 * ── What this screen therefore is ───────────────────────────────────────────
 * Plain answers and other women — no tracking, no logging, no symptom diary.
 * The most useful thing it does is tell her the Western advice she will find
 * online is calibrated to a woman six years older than her.
 */
export default function ChangePage() {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>("cg1");
  const [note, setNote] = useState<string | null>(null);

  return (
    <HomeShell active="/app/health">
      <div className="flex flex-col gap-5">
        <Link href={"/app/health"}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to health
        </Link>

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Menopause
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Nobody told you it starts this early
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            In India it usually begins around 46 — about six years earlier than in the West.
            So most of what you will read online is written for a woman six years older than you.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value="46" label="The usual age here" icon="CalendarDays"
                  tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value="3 in 4" label="Have real symptoms" icon="Users"
                  tint="--ux-tint-pink" ink="--ux-pink-ink" />
            <Stat value="Fewer than 1%" label="Take anything for it" icon="Pill"
                  tint="--ux-tint-amber" ink="--ux-amber-ink" />
          </div>
          <div className="mt-4 flex items-start gap-2.5 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
            <I name="Info" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Four in ten women doing physical work said this had reduced what they could manage in
              a day. That is not weakness and it is not age — it is a thing with a name and,
              often, something that helps.
            </p>
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title="The questions women actually ask"
                       sub="Answers, not a diary" icon="MessageCircle" />
          <div className="flex flex-col gap-2.5">
            {CHANGE_TOPICS.map((t) => {
              const isOpen = open === t.id;
              return (
                <Card key={t.id} pad={0}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : t.id)}
                          aria-expanded={isOpen}
                          className="ux-press flex w-full items-center gap-3.5 p-4 text-left">
                    <IconTile icon={t.icon} tint="--ux-tint-violet" ink="--ux-violet" size={38} />
                    <p className="min-w-0 flex-1 text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{t.q}</p>
                    <I name={isOpen ? "ChevronUp" : "ChevronDown"} className="h-[17px] w-[17px] shrink-0"
                       style={{ color: v("--ux-muted") }} />
                  </button>
                  {isOpen && (
                    <p className="px-4 pb-4 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                      {t.a}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <Card pad={20} style={{ background: v("--ux-tint-violet"), borderColor: "transparent" }}>
          <div className="flex flex-wrap items-start gap-4">
            <IconTile icon="Users" tint="--ux-surface" ink="--ux-violet" size={46} radius={13} />
            <div className="min-w-0 flex-1">
              <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>
                Other women, going through it now
              </p>
              <p className="mt-1.5 max-w-[52ch] text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                A quiet room in your circle. Nobody outside it sees who is in there, and nothing you
                say is kept anywhere after you leave.
              </p>
            </div>
            <Btn onClick={() => setNote("You are in. Nine women, all around your age, and nothing said there leaves.")}>
              Join the room
            </Btn>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card pad={16}>
            <IconTile icon="Stethoscope" tint="--ux-tint-green" ink="--ux-green-ink" size={40} />
            <p className="mt-3 text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>Talking to a doctor</p>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              Most women are told "it is your age" and sent home. Go with the three things that
              bother you most, written down — it changes the conversation completely.
            </p>
            <Btn size="sm" variant="outline" full className="mt-3"
                 onClick={() => setNote("A short list you can hand over. Bring it with you.")}>
              Write my three things
            </Btn>
          </Card>
          <Card pad={16}>
            <IconTile icon="Briefcase" tint="--ux-tint-blue" ink="--ux-blue-ink" size={40} />
            <p className="mt-3 text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>Working through it</p>
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              Broken sleep and aching joints cost the most days. Cover for a bad day is already
              built — use it without explaining yourself to anyone.
            </p>
            <Btn size="sm" variant="outline" full className="mt-3" href="/app/health/cover">
              Arrange cover
            </Btn>
          </Card>
        </div>
      </div>
    </HomeShell>
  );
}
