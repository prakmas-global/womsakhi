"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { COMPANIONS } from "@/components/ux/haq/data";
import { LESSONS, type Lesson } from "@/components/ux/together/data";

/**
 * Learn it from her — and learn it beside a friend.
 *
 * ── The finding that shaped this whole screen ───────────────────────────────
 * Classroom business training has an unimpressive record: a meta-analysis of 28
 * randomised trials found sales up 5.6%, no job creation, and practices adopted
 * then reverted within months. Mentoring gains in one Kenyan study vanished once
 * the mentors stopped being paid.
 *
 * But one design worked. Business training for customers of India's largest
 * women's bank raised business activity, loan take-up and household income
 * **only for women trained alongside a friend** — with the strongest effects
 * among women subject to restrictive mobility norms.
 *
 * So a woman cannot sign up alone here. It is not a gimmick or a growth hack:
 * it is the condition under which the intervention has ever been shown to work,
 * and it happens to also be the growth mechanism. Both at once is rare.
 *
 * ── And the teacher is paid ─────────────────────────────────────────────────
 * In care hours rather than rupees, which keeps it inside the circle's own
 * economy — and which is worth more than cash to a woman who needs two hours
 * free on a Thursday.
 */
export default function LearnPage() {
  const router = useRouter();
  const [joined, setJoined] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const learners = useMemo(() => LESSONS.reduce((n, l) => n + l.learners, 0), []);
  const mine = useMemo(() => Object.keys(joined).length, [joined]);

  const join = useCallback((lessonId: string, withWho: string) => {
    setJoined((j) => ({ ...j, [lessonId]: withWho }));
    setPicking(null);
    const l = LESSONS.find((x) => x.id === lessonId);
    setNote(`You and ${withWho} are learning "${l?.what.toLowerCase()}" together. ${l?.from} has been told.`);
  }, []);

  return (
    <HomeShell active="/app/together">
      <div className="flex flex-col gap-5">
        <button type="button" onClick={() => router.push("/app/together")}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to Together
        </button>

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Learn from her
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Taught by a woman who does it
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            Not a course. One woman showing four others the thing she is actually good at — and
            you come with a friend, because that is the part that makes it stick.
          </p>
        </header>

        <Card pad={20} style={{ background: v("--ux-brand-tint"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3.5">
            <IconTile icon="Users" tint="--ux-surface" ink="--ux-brand" size={44} radius={13} />
            <div className="min-w-0">
              <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>
                You cannot sign up on your own — on purpose
              </p>
              <p className="mt-1.5 max-w-[54ch] text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Women taught alongside a friend kept what they learned and earned more from it.
                Women taught alone mostly went back to how they worked before. So bring someone.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat value={String(learners)} label="Women learning right now"
                  icon="GraduationCap" tint="--ux-tint-blue" ink="--ux-blue-ink" />
            <Stat value={String(mine)} label="You have joined" icon="Check"
                  tint="--ux-tint-green" ink="--ux-green-ink" />
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
          <SectionHead title="What women near you are teaching" icon="GraduationCap"
                       chip={String(LESSONS.length)} />
          <div className="flex flex-col gap-3">
            {LESSONS.map((l) => {
              const partner = joined[l.id];
              return (
                <Card key={l.id} pad={16}>
                  <div className="flex flex-wrap items-start gap-3.5">
                    <IconTile icon={l.icon} tint={l.tint} ink={l.ink} size={44} radius={13} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[1rem] font-bold leading-snug" style={{ color: v("--ux-ink") }}>{l.what}</p>
                        {partner && <Pill tone="green" size="sm">With {partner}</Pill>}
                      </div>
                      <p className="mt-1 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>
                        {l.from} teaches it · {l.learners} learning · she is paid {l.paysIn}
                      </p>
                    </div>
                  </div>

                  {picking === l.id ? (
                    <div className="mt-3.5">
                      <p className="mb-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-ink-2") }}>
                        Who will come with you?
                      </p>
                      <div className="flex flex-col gap-2">
                        {COMPANIONS.map((c) => (
                          <button key={c.id} type="button" onClick={() => join(l.id, c.name)}
                                  className="ux-press ux-sq flex items-center gap-3 rounded-[12px] border p-3 text-left"
                                  style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                            <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[0.8125rem] font-bold"
                                  style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                              {c.name.charAt(0)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.8125rem] font-semibold" style={{ color: v("--ux-ink") }}>{c.name}</p>
                              <p className="text-[0.75rem]" style={{ color: v("--ux-muted") }}>{c.circle}</p>
                            </div>
                            <I name="ArrowRight" className="h-[15px] w-[15px]" style={{ color: v("--ux-faint") }} />
                          </button>
                        ))}
                      </div>
                      <Btn size="sm" variant="ghost" full className="mt-2" onClick={() => setPicking(null)}>
                        Not now
                      </Btn>
                    </div>
                  ) : (
                    <Btn size="sm" full className="mt-3.5" disabled={!!partner}
                         variant={partner ? "ghost" : "primary"}
                         onClick={() => setPicking(l.id)}>
                      {partner ? `Going with ${partner}` : "Join, with a friend"}
                    </Btn>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Know something worth teaching? Four women learning from you is four care hours back —
              time off, not a certificate.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
