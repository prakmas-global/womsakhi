"use client";

import { useState } from "react";
import * as Icons from "lucide-react";

import {
  ActionBtn, Btn, Card, Chip, EmptyState, IconTile,
  SectionHead, SourceNote, Tabs, copy, plural, printCertificate
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useMe } from "@/components/ux/me";

import { CourseCard, ResumeCard } from "@/components/ux/learning/parts";
import {
  ACHIEVEMENTS, CATEGORIES, SKILLS, STREAK,
} from "@/components/ux/learning/data";
import { useLearning } from "@/components/ux/growth";
import { useCertificates } from "@/components/ux/live";

// "Paths" is gone. It showed four learning paths from a constant — "Career
// Growth Path · 8 courses · 32 lessons · 60% complete" — with progress nothing
// had measured, and every row linked to `/ux/learning/paths/{id}`, a route
// that never existed in this app. There is no learning-path feature on the
// server at all, so the tab is removed rather than left claiming one.
const TABS = ["Keep going", "Explore", "Finished"] as const;

/**
 * Learning — what she is part-way through, and what to take next.
 *
 * "Keep going" is the default tab, not "Explore". A course abandoned at 60% is
 * worth more to her than a fifth course started, and a catalogue on open
 * quietly suggests otherwise.
 */
export default function LearningPage() {
  const { data: learning, source } = useLearning();
  const CONTINUING = learning.continuing;
  const TOP_PICKS = learning.picks;
  const { data: CERTIFICATES } = useCertificates();
  const ME = useMe();
  const [tab, setTab] = useState<string>("Keep going");
  const [cat, setCat] = useState("All");

  // No `useMemo`, and `TOP_PICKS` was missing from its dependency list — so
  // this was computed once from the mock fallback and never again, and the
  // course list showed invented courses for the whole session. The compiler
  // memoizes this component itself.
  const picks = cat === "All" ? TOP_PICKS : TOP_PICKS.filter((c) => c.category === cat);

  /**
   * The categories come from the courses, not from a hand-written list.
   *
   * The fixed list offered "Money", which had no courses behind it — a chip
   * whose only possible outcome was an empty state. Deriving it makes a dead
   * filter structurally impossible, and keeps the chips honest once this is
   * reading real catalogue data.
   */
  const categories = (() => {
    const counts = new Map<string, number>();
    for (const c of TOP_PICKS) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    return ["All", ...CATEGORIES.filter((c) => c !== "All" && counts.has(c))];
  })();

  const avg = Math.round(CONTINUING.reduce((a, c) => a + (c.pct ?? 0), 0) / CONTINUING.length);
  const hoursLeft = CONTINUING.reduce((a, c) => a + Math.round((parseInt(c.hours ?? "0") * (100 - (c.pct ?? 0))) / 100), 0);

  return (
    <HomeShell
      active="/app/programs"
      rail={
        <div className="space-y-[15px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="Your week" sub={`${STREAK.days}-day streak`} />
            <div className="flex items-center justify-between">
              {STREAK.marks.map((on, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className="ux-pop grid h-[30px] w-[30px] place-items-center rounded-full text-[11px] font-semibold"
                        style={{
                          background: on ? "var(--ux-brand-600)" : "var(--ux-surface-2)",
                          color: on ? "#fff" : "var(--ux-faint)",
                          ["--i" as string]: i,
                        }}>
                    {on ? <Icons.Check className="h-[13px] w-[13px]" strokeWidth={3} /> : "·"}
                  </span>
                  <span className="text-[9.5px]" style={{ color: "var(--ux-faint)" }}>
                    {["M", "T", "W", "T", "F", "S", "S"][i]}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3.5 text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Fifteen minutes today keeps it going. About {hoursLeft} hours left across everything you started.
            </p>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="Skills you are building" />
            <ul className="ux-stagger space-y-2.5">
              {SKILLS.slice(0, 5).map((s) => (
                <li key={s.name} className="ux-hov flex items-center gap-3">
                  <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={34} radius={10} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--ux-ink-2)" }}>
                    {s.name}
                  </span>
                  <span className="shrink-0 text-[11px]" style={{ color: "var(--ux-faint)" }}>{s.level}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="What you have earned" action="See all" onAction={() => setTab("Finished")} />
            <div className="ux-stagger space-y-2.5">
              {ACHIEVEMENTS.slice(0, 3).map((a, i) => (
                <div key={a.name} className="ux-hov flex items-center gap-3">
                  <span className="ux-metal ux-sq grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[11px]">
                    <Icons.Award className="ux-ico h-[17px] w-[17px]" strokeWidth={1.9}
                                 style={{ ["--i" as string]: i }} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium" style={{ color: "var(--ux-ink)" }}>{a.name}</p>
                    <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--ux-muted)" }}>{a.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      }
    >
      <div className="mb-[18px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Learning</h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
            {CONTINUING.length} {plural("course", CONTINUING.length)} on the go, {avg}% through on average.
          </p>

      <SourceNote source={source} what="courses" />
        </div>
        <Tabs items={[...TABS]} active={tab} onChange={setTab} />
      </div>

      {tab === "Keep going" && (
        CONTINUING.length ? (
          <div className="ux-deck ux-stagger space-y-[13px]">
            {CONTINUING.map((c) => <ResumeCard key={c.id} c={c} />)}
          </div>
        ) : (
          <Card>
            <EmptyState icon="BookOpen" title="Nothing started yet"
                        body="Pick something from Explore and it will wait for you here."
                        action={<Btn onClick={() => setTab("Explore")} variant="primary">Explore courses</Btn>} />
          </Card>
        )
      )}

      {tab === "Explore" && (
        <>
          <div className="mb-[15px] flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>{c}</Chip>
            ))}
          </div>
          {picks.length ? (
            <div className="ux-deck grid grid-cols-3 gap-[15px]">
              {picks.map((c) => <CourseCard key={c.id} c={c} />)}
            </div>
          ) : (
            <Card>
              <EmptyState icon="SearchX" title={`Nothing in ${cat} yet`}
                          body="More is added every month. Try another subject in the meantime."
                          action={<Btn onClick={() => setCat("All")} variant="soft">Show everything</Btn>} />
            </Card>
          )}
        </>
      )}

      {tab === "Finished" && (
        CERTIFICATES.length ? (
          <div className="ux-deck grid grid-cols-2 gap-[15px]">
            {CERTIFICATES.map((c, i) => (
              <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <span className="ux-metal ux-sq grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[12px]">
                    <Icons.Award className="ux-ico h-[21px] w-[21px]" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>{c.title}</h3>
                    <p className="mt-1 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>
                      Issued {c.issued} · {c.code}
                    </p>
                  </div>
                </div>
                <div className="mt-3.5 flex gap-2 border-t pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
                  <ActionBtn variant="outline" size="sm" icon="Download" doneIcon="Printer"
                             done="Choose “Save as PDF”" act={() => printCertificate({
                               name: ME.name, programme: c.title, issued: c.issued, code: c.code,
                             })}>
                    Download
                  </ActionBtn>
                  <ActionBtn variant="soft" size="sm" icon="Share2" doneIcon="Copy" done="Link copied"
                             act={() => copy(`https://womsakhi.in/verify/${c.code}`, "Link copied — anyone can check it", "Copy the code instead")}>
                    Share
                  </ActionBtn>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="Award" title="No certificates yet"
                        body="Finish a course and the certificate lands here, ready to share."
                        action={<Btn onClick={() => setTab("Keep going")} variant="primary">Keep going</Btn>} />
          </Card>
        )
      )}
    </HomeShell>
  );
}
