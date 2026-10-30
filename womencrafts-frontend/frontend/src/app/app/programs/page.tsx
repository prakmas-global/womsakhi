"use client";

import { JourneyTrail } from "@/components/ux/home/JourneyTrail";

import { useState, useSyncExternalStore } from "react";
import * as Icons from "@/components/ux/icons";

import {
  ActionBtn, Btn, Card, Chip, EmptyState,
  SectionHead, SourceNote, copy, plural, printCertificate
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useMe } from "@/components/ux/me";

import { CourseCard, ResumeCard } from "@/components/ux/learning/parts";
import { ChipRow, ScreenHead, Segments } from "@/components/ux/learning/native";
import { ListGroup, ListRow } from "@/components/ux/mobile/ListRow";
import { useLearning } from "@/components/ux/growth";
import { useCertificates } from "@/components/ux/live";
import { AlsoHere } from "@/components/ux/AlsoHere";
import { COPY } from "@/components/ux/copy";
import { useT } from "@/i18n";
import { PicTiles, pictureOr, useMasterPictures } from "@/components/ux/media/MasterPictures";

// "Paths" is gone. It showed four learning paths from a constant — "Career
// Growth Path · 8 courses · 32 lessons · 60% complete" — with progress nothing
// had measured, and every row linked to `/ux/learning/paths/{id}`, a route
// that never existed in this app. There is no learning-path feature on the
// server at all, so the tab is removed rather than left claiming one.
const TABS = ["All courses", "Keep going", "Finished"] as const;

const ALSO = [
  { href: "/app/assess", label: "Test your skills", note: "Twenty minutes on your phone, and a result an employer can check.", icon: "BadgeCheck" },
  { href: "/app/library", label: "Teach and learn", note: "Swap a skill with another woman — teach one, learn one.", icon: "RefreshCw" },
  { href: "/app/digital", label: "Phone basics", note: "Six steps, from the very start. Free, and at your own pace.", icon: "Smartphone" },
] as const;

/**
 * Learning — what she is part-way through, and what to take next.
 *
 * "All courses" is every live course in Learn — from the WomSakhi team and
 * from other members — including the ones she is taking (with her progress).
 * Her own courses are not here: a catalogue is for learning, and she manages
 * what she teaches in Earn → Create a course (with "See it as a learner").
 * "Keep going" is what she is part-way through; "Finished" is her certificates.
 */
export default function LearningPage() {
  const tr = useT();
  const { data: learning, source } = useLearning();
  const CONTINUING = learning.continuing;
  const ALL = learning.all.filter((c) => !c.mine);
  const { data: CERTIFICATES } = useCertificates();
  const ME = useMe();
  const [tab, setTab] = useState<string>("All courses");
  const [chosenCategory, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  /*
    `?cat=A,B&path=Name` — a learning path from the Learn home (Career & Jobs,
    Money & Finance…) is a group of categories. The path tiles used to link
    here with no filter at all, so every path opened the same full list.
    Read as an external store so the server and first client render agree.
  */
  const catPics = useMasterPictures("course_categories");
  const masterCats = catPics.labels;
  const linked = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  const cat = chosenCategory ?? (new URLSearchParams(linked).get("price") === "free" ? "Free" : "All");
  const [pathOff, setPathOff] = useState(false);
  const pathCats = pathOff ? [] : (new URLSearchParams(linked).get("cat") || "").split(",").map((x) => x.trim()).filter(Boolean);
  const pathName = new URLSearchParams(linked).get("path") || pathCats.join(", ");

  // The categories come from the courses themselves — never a chip that can
  // only lead to an empty list — in the order staff set them (Masters → Course
  // categories); a course still in an older category comes after. "Free" and
  // "Paid" come first.
  const present = new Set(ALL.map((c) => c.category));
  const ordered = [...masterCats.filter((c) => present.has(c)), ...Array.from(present).filter((c) => !masterCats.includes(c)).sort()];
  const categories = ["All", "Free", "Paid"];
  // A course with no cover of its own shows its category's picture. A cover
  // she chose from the app's library is hers too, though its path is /ux/.
  const pictured = (c: (typeof ALL)[number]) =>
    !c.ownCover && c.thumb.startsWith("/ux/") ? { ...c, thumb: pictureOr(null, [c.title], catPics.of(c.category)) } : c;
  const needle = q.trim().toLowerCase();
  const picks = ALL.filter((c) =>
    (!pathCats.length || pathCats.includes(c.category)) &&
    (cat === "All" || (cat === "Free" ? !c.priceMinor : cat === "Paid" ? !!c.priceMinor : c.category === cat))
    && (!needle || `${c.title} ${c.teacher ?? ""} ${c.category}`.toLowerCase().includes(needle)));

  const avg = CONTINUING.length ? Math.round(CONTINUING.reduce((a, c) => a + (c.pct ?? 0), 0) / CONTINUING.length) : 0;
  const yours = learning.all.filter((c) => c.mine).length;

  return (
    <HomeShell
      active="/app/programs"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="Your learning" />
            <div className="grid grid-cols-3 gap-2 text-center">
              {([
                [String(CONTINUING.length), "on the go"],
                [`${avg}%`, "average"],
                [String(CERTIFICATES.length), plural("certificate", CERTIFICATES.length)],
              ] as const).map(([v, l]) => (
                <div key={l} className="rounded-[12px] py-2.5" style={{ background: "var(--ux-surface-2)" }}>
                  <p className="text-lg font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>{v}</p>
                  <p className="text-2xs" style={{ color: "var(--ux-muted)" }}>{l}</p>
                </div>
              ))}
            </div>
            {learning.pending.length > 0 && (
              <p className="mt-3 text-xs" style={{ color: "var(--ux-orange-ink)" }}>
                {learning.pending.length} paid {plural("course", learning.pending.length)} waiting for the teacher to confirm your payment.
              </p>
            )}
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("programs.whatYouHaveEarned")} action={CERTIFICATES.length ? tr("circles.seeAll") : undefined} onAction={() => setTab("Finished")} />
            {CERTIFICATES.length ? (
              <div className="ux-stagger space-y-2.5">
                {CERTIFICATES.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="ux-metal ux-sq grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[12px]">
                      <Icons.Award className="ux-ico h-[17px] w-[17px]" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{c.title}</p>
                      <p className="mt-0.5 truncate text-2xs" style={{ color: "var(--ux-muted)" }}>Issued {c.issued}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xsm" style={{ color: "var(--ux-muted)" }}>Finish a course and your certificate appears here.</p>
            )}
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="Teach what you know" icon="Presentation" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              {yours ? `You teach ${yours} ${plural("course", yours)} here.` : "Make a course from what you do well — free, or at your price."}
            </p>
            <div className="mt-3"><Btn href="/app/teach" variant="soft" size="sm" iconEnd="ArrowRight">{yours ? "My courses" : "Create a course"}</Btn></div>
          </Card>
        </div>
      }
    >
      <JourneyTrail goal="learn" />
      <ScreenHead
        title="Courses"
        sub={`${ALL.length} ${plural("course", ALL.length)} from the WomSakhi team and from women who teach here.`}
        note={<SourceNote source={source} what="courses" />}
      >
        <Segments items={[...TABS]} active={tab} onChange={setTab} label={tr("programs.whichCourses")} />
      </ScreenHead>

      {tab === "Keep going" && (
        CONTINUING.length ? (
          <div className="ux-deck ux-stagger space-y-[12px]">
            {CONTINUING.map((c) => <ResumeCard key={c.id} c={c} />)}
          </div>
        ) : (
          <Card>
            <EmptyState icon="BookOpen" title={tr("programs.nothingStartedYet")}
                        body={tr("programs.pickSomethingFromExploreAndIt")}
                        action={<Btn onClick={() => setTab("All courses")} variant="primary">{tr("programs.exploreCourses")}</Btn>} />
          </Card>
        )
      )}

      {tab === "All courses" && (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses or teachers"
            aria-label="Search courses"
            className="ux-sq mb-3 min-h-[46px] w-full rounded-[12px] border px-4 text-xsm outline-none"
            style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
          />
          {pathCats.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[12px] px-3.5 py-2.5"
                 style={{ background: "var(--ux-brand-tint)" }}>
              <Icons.Route className="h-4 w-4" style={{ color: "var(--ux-brand)" }} />
              <span className="flex-1 text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>
                Learning path: {pathName}
              </span>
              <button type="button" onClick={() => setPathOff(true)}
                      className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--ux-brand)" }}>
                <Icons.X className="h-3.5 w-3.5" /> Show all courses
              </button>
            </div>
          )}
          <ChipRow className="mb-3">
            {categories.map((c) => (
              <Chip key={c} selected={cat === c} onClick={() => setCat(c)}>{c}</Chip>
            ))}
          </ChipRow>
          {/* Categories as pictures; tap again to show everything. */}
          {ordered.length > 0 && (
            <PicTiles className="mb-3" label="Course categories" value={cat}
                      onPick={(c) => setCat(cat === c ? "All" : c)}
                      tiles={ordered.map((c) => {
                        const n = ALL.filter((x) => x.category === c).length;
                        return { value: c, label: c, src: catPics.pic(c), sub: `${n} course${n === 1 ? "" : "s"}` };
                      })} />
          )}
          {picks.length ? (
            <>
              {/* The same card everywhere: two across on a phone, three from `lg`. */}
              <div className="ux-stagger grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-[16px]">
                {picks.map((c) => <CourseCard key={c.id} c={pictured(c)} />)}
              </div>
            </>
          ) : (
            <Card>
              <EmptyState icon="SearchX" title={needle ? `Nothing matches “${q.trim()}”` : `Nothing in ${cat} yet`}
                          body={tr("programs.moreIsAddedEveryMonthTry")}
                          action={<Btn onClick={() => { setCat("All"); setQ(""); }} variant="soft">{tr("programs.showEverything")}</Btn>} />
            </Card>
          )}
        </>
      )}

      {tab === "Finished" && (
        CERTIFICATES.length ? (
          <div className="ux-deck grid grid-cols-2 gap-[16px]">
            {CERTIFICATES.map((c, i) => (
              <Card key={c.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <span className="ux-metal ux-sq grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[12px]">
                    <Icons.Award className="ux-ico h-[21px] w-[21px]" strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{c.title}</h2>
                    <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>
                      Issued {c.issued} · {c.code}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t pt-4 lg:mt-3.5 lg:flex-row lg:pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
                  <ActionBtn variant="outline" size="sm" icon="Download" doneIcon="Printer"
                             done={COPY.saveAsPdf} act={() => printCertificate({
                               name: ME.name, programme: c.title, issued: c.issued, code: c.code,
                             })}>
                    Download
                  </ActionBtn>
                  <ActionBtn variant="soft" size="sm" icon="Share2" doneIcon="Copy" done={tr("programs.linkCopied")}
                             act={() => copy(`https://womsakhi.com/verify/${c.code}`, "Link copied — anyone can check it", "Copy the code instead")}>
                    Share
                  </ActionBtn>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="Award" title={tr("programs.noCertificatesYet")}
                        body={tr("programs.finishACourseAndTheCertificate")}
                        action={<Btn onClick={() => setTab("Keep going")} variant="primary">{tr("programs.keepGoing")}</Btn>} />
          </Card>
        )
      )}

      {/* Three more places in Learn: a grouped list on a phone, the shared
          `AlsoHere` cards from `lg`. */}
      <ListGroup className="mt-6 lg:hidden" title={tr("programs.alsoHere")}>
        {ALSO.map((a) => (
          <ListRow key={a.href} href={a.href} icon={a.icon} tint="violet" title={a.label} subtitle={a.note} />
        ))}
      </ListGroup>
      <div className="hidden lg:block"><AlsoHere items={ALSO} /></div>
    </HomeShell>
  );
}

const noSubscribe = () => () => {};
