"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, SectionHead, Stat, v } from "@/components/ux/kit";
import { CHANGE_TOPICS as RAW_RAW_CHANGE_TOPICS } from "@/components/ux/wellness/data";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { GroupLabel, PhoneTitle, phoneFull, phonePrimary } from "@/components/ux/PhoneParts";
import { useTranslated } from "@/i18n/data";

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
  const RAW_CHANGE_TOPICS = useTranslated(RAW_RAW_CHANGE_TOPICS);
  const CHANGE_TOPICS = useTranslated(RAW_CHANGE_TOPICS);
  const tr = useT();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>("cg1");
  const [note, setNote] = useState<string | null>(null);

  return (
    <HomeShell active="/app/health">
      <div className="flex flex-col gap-5">
        {/* The top bar carries the way back on a phone; this one is the desktop's. */}
        <div className="hidden lg:flex">
          <Back to="/app/health" label={tr("healthChange.backToHealth")} />
        </div>

        <PhoneTitle title="Menopause" sub={tr("healthChange.nobodyToldYouItStartsThis")}
                    note={tr("healthChange.inIndiaItUsuallyBeginsAround")} />
        <header className="hidden lg:block">
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Menopause
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("healthChange.nobodyToldYouItStartsThis")}</h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            In India it usually begins around 46 — about six years earlier than in the West.
            So most of what you will read online is written for a woman six years older than you.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value="46" label={tr("healthChange.theUsualAgeHere")} icon="CalendarDays"
                  tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value="3 in 4" label={tr("healthChange.haveRealSymptoms")} icon="Users"
                  tint="--ux-tint-pink" ink="--ux-pink-ink" />
            <Stat value="Fewer than 1%" label={tr("healthChange.takeAnythingForIt")} icon="Pill"
                  tint="--ux-tint-amber" ink="--ux-amber-ink" />
          </div>
          <div className="mt-4 flex items-start gap-2.5 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
            <I name="Info" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Four in ten women doing physical work said this had reduced what they could manage in
              a day. That is not weakness and it is not age — it is a thing with a name and,
              often, something that helps.
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
          <GroupLabel sub={tr("healthChange.answersNotADiary")}>{tr("healthChange.theQuestionsWomenActuallyAsk")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("healthChange.theQuestionsWomenActuallyAsk")}
                         sub={tr("healthChange.answersNotADiary")} icon="MessageCircle" />
          </div>
          {/* The questions as one grouped list, each opening in place. */}
          <ListGroup className="lg:hidden">
            {CHANGE_TOPICS.map((t) => {
              const isOpen = open === t.id;
              return (
                <div key={t.id} className="relative">
                  <button type="button" onClick={() => setOpen(isOpen ? null : t.id)} aria-expanded={isOpen}
                          className="flex min-h-[52px] w-full items-start gap-3 px-4 py-3 text-start active:bg-[var(--ux-surface-2)]">
                    <span aria-hidden className="mt-0.5 grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[var(--ux-r-sm)]"
                          style={{ background: v("--ux-tint-violet"), color: v("--ux-violet") }}>
                      <I name={t.icon} className="h-[17px] w-[17px]" />
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug" style={{ color: v("--ux-ink") }}>{t.q}</span>
                    <I name={isOpen ? "ChevronUp" : "ChevronDown"} className="mt-1 h-[17px] w-[17px] shrink-0"
                       style={{ color: v("--ux-muted") }} />
                  </button>
                  {isOpen && (
                    <p className="pb-4 pe-4 ps-[60px] text-[15px] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                      {t.a}
                    </p>
                  )}
                  <span data-ux-sep aria-hidden className="pointer-events-none absolute bottom-0 end-0 h-px"
                        style={{ insetInlineStart: 60, background: v("--ux-line") }} />
                </div>
              );
            })}
          </ListGroup>
          <div className="hidden flex-col gap-2.5 lg:flex">
            {CHANGE_TOPICS.map((t) => {
              const isOpen = open === t.id;
              return (
                <Card key={t.id} pad={0}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : t.id)}
                          aria-expanded={isOpen}
                          className="ux-press flex w-full items-center gap-3.5 p-4 text-left">
                    <IconTile icon={t.icon} tint="--ux-tint-violet" ink="--ux-violet" size={38} />
                    <p className="min-w-0 flex-1 text-sm font-bold" style={{ color: v("--ux-ink") }}>{t.q}</p>
                    <I name={isOpen ? "ChevronUp" : "ChevronDown"} className="h-[17px] w-[17px] shrink-0"
                       style={{ color: v("--ux-muted") }} />
                  </button>
                  {isOpen && (
                    <p className="px-4 pb-4 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
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
              <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{tr("healthChange.otherWomenGoingThroughItNow")}</p>
              <p className="mt-1.5 max-w-[52ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                A quiet room in your circle. Nobody outside it sees who is in there, and nothing you
                say is kept anywhere after you leave.
              </p>
            </div>
            <Btn className={phonePrimary} onClick={() => setNote("You are in. Nine women, all around your age, and nothing said there leaves.")}>{tr("healthChange.joinTheRoom")}</Btn>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card pad={16}>
            <IconTile icon="Stethoscope" tint="--ux-tint-green" ink="--ux-green-ink" size={40} />
            <p className="mt-3 text-sm font-bold" style={{ color: v("--ux-ink") }}>{tr("healthChange.talkingToADoctor")}</p>
            <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
              Most women are told &ldquo;it is your age&rdquo; and sent home. Go with the three things that
              bother you most, written down — it changes the conversation completely.
            </p>
            <Btn size="sm" variant="outline" full className={`mt-3 ${phoneFull}`}
                 onClick={() => setNote("A short list you can hand over. Bring it with you.")}>{tr("healthChange.writeMyThreeThings")}</Btn>
          </Card>
          <Card pad={16}>
            <IconTile icon="Briefcase" tint="--ux-tint-blue" ink="--ux-blue-ink" size={40} />
            <p className="mt-3 text-sm font-bold" style={{ color: v("--ux-ink") }}>{tr("healthChange.workingThroughIt")}</p>
            <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
              Broken sleep and aching joints cost the most days. Cover for a bad day is already
              built — use it without explaining yourself to anyone.
            </p>
            <Btn size="sm" variant="outline" full className={`mt-3 ${phoneFull}`} href="/app/health/cover">{tr("healthChange.arrangeCover")}</Btn>
          </Card>
        </div>
      </div>
    </HomeShell>
  );
}
