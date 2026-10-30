"use client";

import { useCallback } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, I, IconTile, Pill, ScreenSkeleton, SectionHead, v } from "@/components/ux/kit";
import { useBusiness } from "@/components/ux/business";
import { useApplications } from "@/components/ux/growth";
import { useCertificates } from "@/components/ux/live";
import { apiMyPrograms, type Enrollment } from "@/lib/growth-api";
import {
  apiMyImpact, apiMyPortfolio,
  apiMyVerifiedSkills, type Impact, type PortfolioItem, type VerifiedSkillRow,
} from "@/lib/portfolio-api";
import { apiMyWorkProfile, type ProfileSkill, type WorkProfile } from "@/lib/work-api";
import { WorkGallery } from "@/components/ux/work/WorkGallery";
import { useResource } from "@/lib/use-resource";

/**
 * The profile tabs — every one of them hers.
 *
 * These were fixtures: "Blouse stitching, 11 years — 87 finished, 11 buyers
 * came back", a boutique job in Jaipur, a mother who was unwell, "Women you
 * taught: 4". Every member's profile showed the same invented woman, on the
 * screen a buyer or an employer reads before trusting her. Now:
 *
 *   Skills         My work profile (levels, verified, who can see them) and
 *                  the skill tests she passed
 *   Experience     how long she has done each skill, what she did on WomSakhi
 *                  (orders delivered, work offered, courses taught), and what
 *                  she learned (certificates, courses in progress)
 *   What you made  her portfolio — photos she adds, each shown or kept private
 *   Helping others counted from real records (routes/portfolio.py `impact`)
 *   Documents      where her papers actually live
 */

const workProfile = (s: AbortSignal) => apiMyWorkProfile(s).catch(() => null);

/* ── skills ───────────────────────────────────────────────────────────────── */

function byCategory(skills: ProfileSkill[]) {
  const m = new Map<string, ProfileSkill[]>();
  for (const s of skills) m.set(s.category_name, [...(m.get(s.category_name) ?? []), s]);
  return [...m.entries()];
}

const LEVEL: Record<string, string> = { learning: "Learning", "1-2": "1–2 years", "3-5": "3–5 years", "5+": "5+ years" };

export function SkillsTab() {
  const prof = useResource(useCallback((s: AbortSignal) => workProfile(s), []), null as WorkProfile | null);
  const tests = useResource(useCallback((s: AbortSignal) => apiMyVerifiedSkills(s).catch(() => []), []), [] as VerifiedSkillRow[]);
  if (prof.source === "loading") return <ScreenSkeleton shape="list" />;
  const skills = prof.data?.skills ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHead title="What you can do" sub="From My work profile — how long, and who can see it" icon="Sparkles" />
        {skills.length ? (
          <div className="flex flex-col gap-3">
            {byCategory(skills).map(([cat, list]) => (
              <Card key={cat} pad={16}>
                <p className="text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>{cat}</p>
                <ul className="mt-2 divide-y" style={{ borderColor: v("--ux-line") }}>
                  {list.map((s) => (
                    <li key={s.key} className="flex flex-wrap items-center gap-2 py-2.5">
                      <span className="min-w-0 flex-1 text-sm font-bold" style={{ color: v("--ux-ink") }}>{s.name}</span>
                      {s.level && <Pill tone="neutral" size="sm">{LEVEL[s.level] ?? s.level}</Pill>}
                      {s.verified && <Pill tone="green" size="sm">Verified</Pill>}
                      <span className="inline-flex items-center gap-1 text-2xs font-semibold"
                            style={{ color: v(s.visible ? "--ux-brand" : "--ux-muted") }}>
                        {s.visible ? <Icons.Eye className="h-[12px] w-[12px]" /> : <Icons.EyeOff className="h-[12px] w-[12px]" />}
                        {s.visible ? "People hiring can find you" : "Only you"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
            <div><Btn href="/app/work/profile" size="sm" variant="outline" icon="Pencil">Edit my skills</Btn></div>
          </div>
        ) : (
          <Card>
            <EmptyState icon="Sparkles" title="No skills added yet"
                        body="Pick what you can do — tailoring, cooking, beauty, teaching — in a minute, mostly by tapping. Work that needs it finds you."
                        action={<Btn href="/app/work/profile" size="sm" variant="primary" iconEnd="ArrowRight">Add my skills</Btn>} />
          </Card>
        )}
      </div>

      <div>
        <SectionHead title="Skills you proved" sub="Tests you passed on WomSakhi — anyone can check the certificate" icon="BadgeCheck" />
        {tests.data.length ? (
          <Card pad={0} style={{ overflow: "hidden" }}>
            {tests.data.map((t, i) => (
              <div key={t.code || t.title} className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                   style={{ borderTop: i ? `1px solid ${v("--ux-line")}` : "none" }}>
                <IconTile icon="BadgeCheck" tint="--ux-tint-green" ink="--ux-green-ink" size={36} radius={10} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{t.title}</p>
                  <p className="text-xs" style={{ color: v("--ux-muted") }}>{t.skill} · passed with {t.score}%</p>
                </div>
                {t.code && <Btn size="sm" variant="ghost" href={`/verify/${t.code}`} icon="ExternalLink">Certificate</Btn>}
              </div>
            ))}
          </Card>
        ) : (
          <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                A passed skill test puts a green &ldquo;Verified&rdquo; badge on your profile, your shop and your job applications.
              </p>
              <Btn href="/app/assess" size="sm" variant="soft" iconEnd="ArrowRight">Take a test</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── experience ───────────────────────────────────────────────────────────── */

export function ExperienceTab() {
  const prof = useResource(useCallback((s: AbortSignal) => workProfile(s), []), null as WorkProfile | null);
  const { data: certs } = useCertificates();
  const courses = useResource(useCallback((s: AbortSignal) => apiMyPrograms(s).catch(() => []), []), [] as Enrollment[]);
  const impact = useResource(useCallback((s: AbortSignal) => apiMyImpact(s).catch(() => null), []), null as Impact | null);
  const { data: biz } = useBusiness();
  const { data: apps } = useApplications();

  const levelled = (prof.data?.skills ?? []).filter((s) => s.level);
  const delivered = biz.orders.filter((o) => o.state === "Done").length;
  const offers = apps.filter((a) => a.stage === "Offer");
  const learning = courses.data.filter((c) => c.status === "active");

  const done = [
    delivered > 0 && { icon: "Package", text: `${delivered} ${delivered === 1 ? "order" : "orders"} delivered from your shop`, href: "/app/documents" },
    ...offers.map((o) => ({ icon: "Briefcase", text: `Offered work: ${o.title}${o.org ? ` — ${o.org}` : ""}`, href: "/app/applications" })),
    impact.data?.courses && { icon: "Presentation", text: `Teaches ${impact.data.courses} ${impact.data.courses === 1 ? "course" : "courses"} — ${impact.data.learners} learners`, href: "/app/teach" },
    impact.data?.mentoring_sessions && { icon: "HeartHandshake", text: `${impact.data.mentoring_sessions} mentoring sessions given`, href: "/app/mentoring" },
  ].filter(Boolean) as { icon: string; text: string; href: string }[];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHead title="How long you have done it" sub="The experience you set on each skill" icon="Briefcase" />
        {levelled.length ? (
          <Card pad={0} style={{ overflow: "hidden" }}>
            {levelled.map((s, i) => (
              <div key={s.key} className="flex items-center gap-3 px-5 py-3.5" style={{ borderTop: i ? `1px solid ${v("--ux-line")}` : "none" }}>
                <span className="min-w-0 flex-1 text-sm font-bold" style={{ color: v("--ux-ink") }}>{s.name}</span>
                <Pill tone={s.level === "learning" ? "neutral" : "brand"} size="sm">{LEVEL[s.level]}</Pill>
                {s.verified && <Icons.BadgeCheck className="h-[16px] w-[16px]" style={{ color: v("--ux-green-ink") }} />}
              </div>
            ))}
          </Card>
        ) : (
          <Card pad={16}>
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-xsm" style={{ color: v("--ux-muted") }}>
                Tap how long you have done each skill on My work profile — Learning, 1–2, 3–5 or 5+ years.
              </p>
              <Btn href="/app/work/profile" size="sm" variant="soft" iconEnd="ArrowRight">Set it</Btn>
            </div>
          </Card>
        )}
      </div>

      <div>
        <SectionHead title="What you did on WomSakhi" sub="Counted from your shop, your applications and your teaching" icon="CheckCircle2" />
        {done.length ? (
          <Card pad={0} style={{ overflow: "hidden" }}>
            {done.map((d, i) => (
              <a key={d.text} href={d.href} className="ux-hov flex items-center gap-3 px-5 py-3.5"
                 style={{ borderTop: i ? `1px solid ${v("--ux-line")}` : "none" }}>
                <IconTile icon={d.icon} tint="--ux-tint-violet" ink="--ux-violet-ink" size={34} radius={10} />
                <span className="min-w-0 flex-1 text-xsm font-semibold" style={{ color: v("--ux-ink") }}>{d.text}</span>
                <Icons.ChevronRight className="h-4 w-4" style={{ color: v("--ux-faint") }} />
              </a>
            ))}
          </Card>
        ) : (
          <Card pad={16}>
            <p className="text-xsm" style={{ color: v("--ux-muted") }}>
              Nothing yet. Orders you deliver, work you are offered and courses you teach appear here by themselves.
            </p>
          </Card>
        )}
      </div>

      <div>
        <SectionHead title="What you learned" sub="Certificates you earned and courses you are taking" icon="GraduationCap" />
        {certs.length || learning.length ? (
          <Card pad={0} style={{ overflow: "hidden" }}>
            {certs.map((c, i) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3.5 px-5 py-3.5"
                   style={{ borderTop: i ? `1px solid ${v("--ux-line")}` : "none" }}>
                <span className="grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-[12px]"
                      style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
                  <I name="Award" className="h-[1rem] w-[1rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.title}</p>
                  <p className="text-xs" style={{ color: v("--ux-muted") }}>WomSakhi · {c.issued} · {c.code}</p>
                </div>
                <Btn size="sm" variant="ghost" href={`/verify/${c.code}`} icon="ExternalLink">Check</Btn>
              </div>
            ))}
            {learning.map((c, i) => (
              <a key={c.id} href={`/app/programs/${c.program_id}`} className="ux-hov flex items-center gap-3.5 px-5 py-3.5"
                 style={{ borderTop: certs.length || i ? `1px solid ${v("--ux-line")}` : "none" }}>
                <span className="grid h-[2.25rem] w-[2.25rem] shrink-0 place-items-center rounded-[12px]"
                      style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>
                  <I name="BookOpen" className="h-[1rem] w-[1rem]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.program_name}</p>
                  <p className="text-xs" style={{ color: v("--ux-muted") }}>In progress · {Math.round(c.progress || 0)}%</p>
                </div>
              </a>
            ))}
          </Card>
        ) : (
          <Card pad={16}>
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-xsm" style={{ color: v("--ux-muted") }}>
                Finish a course or pass a skill test and the certificate appears here — with a code anyone can check.
              </p>
              <Btn href="/app/programs" size="sm" variant="soft" iconEnd="ArrowRight">Find a course</Btn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── portfolio ────────────────────────────────────────────────────────────── */

/** "What you made" — the same gallery My work profile shows (components/ux/work/WorkGallery.tsx). */
export function PortfolioTab() {
  const items = useResource(useCallback((s: AbortSignal) => apiMyPortfolio(s), []), [] as PortfolioItem[]);
  const prof = useResource(useCallback((s: AbortSignal) => workProfile(s), []), null as WorkProfile | null);
  return (
    <WorkGallery items={items.data} loading={items.source === "loading"} onChanged={items.refetch}
                 skills={prof.data?.skills ?? []} title="Work you can show someone" />
  );
}

/* ── contribution ─────────────────────────────────────────────────────────── */

export function ContributionTab() {
  const res = useResource(useCallback((s: AbortSignal) => apiMyImpact(s), []), null as Impact | null);
  if (res.source === "loading") return <ScreenSkeleton shape="list" />;
  const m = res.data;
  if (!m) {
    return <Card><EmptyState icon="WifiOff" title="This did not load" body="Check your connection and try again."
                             action={<Btn size="sm" onClick={res.refetch}>Try again</Btn>} /></Card>;
  }

  const rows = [
    { icon: "GraduationCap", tint: "--ux-tint-violet", ink: "--ux-violet", value: m.learners,
      label: "Women learning from your courses", detail: m.courses ? `${m.courses} ${m.courses === 1 ? "course" : "courses"} · ${m.finished_course} finished` : "",
      empty: "Teach what you know", href: "/app/teach" },
    { icon: "HeartHandshake", tint: "--ux-tint-pink", ink: "--ux-pink-ink", value: m.mentees,
      label: "Women you mentored", detail: m.mentoring_sessions ? `${m.mentoring_sessions} sessions given` : "",
      empty: "Become a mentor", href: "/app/mentoring" },
    { icon: "CheckCircle2", tint: "--ux-tint-green", ink: "--ux-green-ink", value: m.verified_answers,
      label: "Answers marked right by a teacher", detail: m.answers ? `${m.answers} answers in course questions` : "",
      empty: "Answer a question in a course", href: "/app/programs" },
    { icon: "UsersRound", tint: "--ux-tint-blue", ink: "--ux-blue-ink", value: m.circle_members,
      label: "Women in circles you host", detail: m.circles_hosted ? `${m.circles_hosted} ${m.circles_hosted === 1 ? "circle" : "circles"}` : "",
      empty: "Start a circle", href: "/app/circles/new" },
    { icon: "Briefcase", tint: "--ux-tint-amber", ink: "--ux-amber-ink", value: m.women_hired,
      label: "Women you offered work to", detail: "",
      empty: "Post a job", href: "/app/work/post" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card pad={0} style={{ overflow: "hidden" }}>
        <div className="px-6 py-7" style={{ background: `linear-gradient(140deg, ${v("--ux-tint-pink")}, ${v("--ux-surface")})` }}>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] lg:text-2xs" style={{ color: v("--ux-pink-ink") }}>
            Women helping women
          </p>
          <p className="mt-2 text-[clamp(1.5rem,3vw,2.25rem)] font-extrabold leading-tight tracking-[-0.03em]" style={{ color: v("--ux-ink") }}>
            {m.women_helped
              ? `${m.women_helped} ${m.women_helped === 1 ? "woman is" : "women are"} further along because of you`
              : "Your first woman helped is one step away"}
          </p>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            Counted from what really happened on WomSakhi — learners, mentoring, work you offered. Each woman once.
            There is no score and no ranking.
          </p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.label} pad={16}>
            <div className="flex items-center gap-3.5">
              <IconTile icon={r.icon} tint={r.tint} ink={r.ink} size={42} />
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>{r.value}</p>
                <p className="mt-1 text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>{r.label}</p>
                {r.detail ? (
                  <p className="text-xs" style={{ color: v("--ux-muted") }}>{r.detail}</p>
                ) : r.value === 0 ? (
                  <a href={r.href} className="text-xs font-bold" style={{ color: v("--ux-brand") }}>{r.empty} →</a>
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ── documents ────────────────────────────────────────────────────────────── */

/** Where her papers really are — two places, named for what they hold. */
export function DocumentsTab() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        { href: "/app/haq/papers", icon: "IdCard", title: "My papers", tint: "--ux-tint-blue", ink: "--ux-blue-ink",
          body: "Aadhaar, ration card, bank passbook and the other papers schemes ask for — kept once, used everywhere." },
        { href: "/app/documents/vault", icon: "FileText", title: "My shop papers", tint: "--ux-tint-amber", ink: "--ux-amber-ink",
          body: "Food licence, Udyam registration and the other papers your shop needs." },
      ].map((d) => (
        <a key={d.href} href={d.href} className="ux-card ux-hov flex items-start gap-3.5 p-4">
          <IconTile icon={d.icon} tint={d.tint} ink={d.ink} size={42} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{d.title}</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{d.body}</p>
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color: v("--ux-brand") }}>
              Open <Icons.ArrowRight className="h-3.5 w-3.5" />
            </p>
          </div>
        </a>
      ))}
      <p className="text-2xs sm:col-span-2" style={{ color: v("--ux-faint") }}>
        Your papers are never shown on your profile. Only you can open them.
      </p>
    </div>
  );
}
