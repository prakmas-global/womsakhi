"use client";

import { JourneyTrail } from "@/components/ux/home/JourneyTrail";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, ScreenSkeleton } from "@/components/ux/kit";
import { Label } from "@/components/ux/kit/form";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { Fact, MediaCard } from "@/components/ux/media/MediaCard";
import { toast } from "@/components/ux/mobile/Toast";
import { useMe } from "@/components/ux/me";
import { CategoryTiles, SkillChip } from "@/components/ux/work/pictures";
import { skillArt } from "@/components/ux/work/skill-art";
import { WorkDone } from "@/components/ux/work/WorkDone";
import { strengthOf, type Step } from "@/components/ux/work/readiness";
import { useAction } from "@/lib/use-action";
import { useResource } from "@/lib/use-resource";
import {
  apiMyWorkHistory, apiMyWorkProfile, apiSaveWorkProfile, apiWorkTaxonomy,
  type ProfileSkill, type WorkCategory, type WorkDoneItem, type WorkProfile,
} from "@/lib/work-api";

/**
 * My work profile — the skills she can do, and, skill by skill, whether people
 * hiring may find her for it (backend: routes/work_talent.py).
 *
 * Almost all taps: a kind of work as a picture, then its skills as chips; a
 * level per skill as one tap; the eye beside each. The first visit is filled
 * from what she said when she joined — with every skill switched OFF, because
 * nobody asked her then whether to be findable, and silence is not a yes.
 *
 * The rail shows her card exactly as "Find people to hire" will, redrawn as she
 * taps, so "who sees what" is something she can look at rather than read.
 */

const MAX = 20;

/** A picture for each choice the server offers; an unknown one gets a dot. */
const WORK_TYPE_ICON: Record<string, string> = {
  "Full-time": "Briefcase", "Part-time": "Clock", "From home": "Home", "Per order": "Package",
};
const DAY_ICON: Record<string, string> = {
  Weekdays: "Calendar", Weekends: "CalendarCheck", Mornings: "Sunrise", Afternoons: "Sun", Evenings: "Moon",
};

const scrollTo = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/* ── Profile strength ─────────────────────────────────────────────────────── */

// The steps and their weights are shared with the Work dashboard (components/ux/work/readiness.ts).

function Ring({ pct, size = 104, className = "" }: { pct: number; size?: number; className?: string }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={`shrink-0 ${className}`} role="img"
         aria-label={`Profile ${pct}% ready`}>
      <defs>
        <linearGradient id="wp-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff7ac0" />
          <stop offset="100%" stopColor="#a99bff" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#wp-ring)" strokeWidth="10"
              strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: "stroke-dashoffset .9s var(--ux-ease-out)" }} />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill="#fff"
            style={{ font: "800 24px var(--ux-dashboard-font-display, inherit)" }}>{pct}%</text>
      <text x="50%" y="68%" textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,.72)"
            style={{ font: "600 10px inherit", letterSpacing: ".08em" }}>READY</text>
    </svg>
  );
}

/* ── One skill ────────────────────────────────────────────────────────────── */

/** Experience as a meter: more bars, longer at it. Tap the lit one to clear. */
function LevelMeter({ levels, value, name, onPick }: {
  levels: { key: string; label: string }[]; value: string; name: string; onPick: (key: string) => void;
}) {
  const at = levels.findIndex((l) => l.key === value);
  return (
    <div role="radiogroup" aria-label={`How long — ${name}`} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {levels.map((l, i) => {
        const on = i === at;
        return (
          <button key={l.key} type="button" role="radio" aria-checked={on} onClick={() => onPick(on ? "" : l.key)}
                  className="ux-press flex min-h-[40px] items-center justify-center gap-2 rounded-[10px] border px-2 text-xs font-semibold transition-colors"
                  style={{
                    borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                    background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                    color: on ? "var(--ux-brand)" : "var(--ux-ink-2)",
                  }}>
            <span aria-hidden className="flex items-end gap-[2px]">
              {levels.map((_, b) => (
                <span key={b} className="w-[3px] rounded-full transition-colors"
                      style={{ height: 5 + b * 3, background: b <= i && (on || at >= i) ? "var(--ux-brand)" : "var(--ux-line-strong)" }} />
              ))}
            </span>
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

function SkillCard({ s, levels, index, onLevel, onVisible, onRemove }: {
  s: ProfileSkill; levels: { key: string; label: string }[]; index: number;
  onLevel: (key: string) => void; onVisible: (v: boolean) => void; onRemove: () => void;
}) {
  return (
    <li className="ux-rise rounded-[16px] border p-3 transition-colors sm:p-3.5"
        style={{
          ["--i" as string]: index,
          borderColor: s.visible ? "color-mix(in oklab, var(--ux-green-ink) 32%, var(--ux-line))" : "var(--ux-line)",
          background: s.visible ? "color-mix(in oklab, var(--ux-tint-green) 45%, var(--ux-surface))" : "var(--ux-surface)",
        }}>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={skillArt(s)} alt="" loading="lazy" decoding="async"
             className="h-[52px] w-[52px] shrink-0 rounded-[12px] object-cover transition-[filter]"
             style={{ filter: s.visible ? "none" : "grayscale(.85) opacity(.75)" }} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
            {s.name}
            {s.verified && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold"
                    style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
                <Icons.BadgeCheck className="h-3 w-3" /> Verified
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs" style={{ color: s.level ? "var(--ux-muted)" : "var(--ux-amber-ink)" }}>
            {!s.level ? "How long have you done it?"
              : s.level === "learning" ? "Still learning"
                : `${levels.find((l) => l.key === s.level)?.label ?? ""} of experience`}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={s.visible} onClick={() => onVisible(!s.visible)}
                aria-label={`Show me for ${s.name}`}
                title={s.visible ? "People hiring can find you for this" : "Hidden — nobody hiring sees this"}
                className="ux-press inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-colors sm:px-3"
                style={s.visible
                  ? { background: "var(--ux-green-ink)", color: "var(--ux-on-green, #fff)" }
                  : { background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
          {s.visible ? <Icons.Eye className="h-4 w-4" /> : <Icons.EyeOff className="h-4 w-4" />}
          <span className="hidden sm:inline">{s.visible ? "Shown" : "Hidden"}</span>
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${s.name}`}
                className="ux-press grid h-9 w-9 shrink-0 place-items-center rounded-full"
                style={{ color: "var(--ux-muted)" }}>
          <Icons.X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3">
        <LevelMeter levels={levels} value={s.level} name={s.name} onPick={onLevel} />
      </div>
    </li>
  );
}

/* ── Choice tiles: kind of work, when free ───────────────────────────────── */

function Tiles({ options, value, icons, label, onPick }: {
  options: string[]; value: string[]; icons: Record<string, string>; label: string; onPick: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => onPick(o)}
                  className="ux-press relative flex min-h-[64px] flex-col items-start justify-between gap-2 rounded-[14px] border p-3 text-start text-xsm font-semibold transition-colors"
                  style={{
                    borderColor: on ? "var(--ux-brand)" : "var(--ux-line)",
                    background: on ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                    color: on ? "var(--ux-brand)" : "var(--ux-ink)",
                  }}>
            <I name={icons[o] ?? "Circle"} className="h-5 w-5" />
            {o}
            {on && (
              <span className="ux-pop absolute end-2 top-2 grid h-5 w-5 place-items-center rounded-full"
                    style={{ background: "var(--ux-brand)", color: "var(--ux-on-brand, #fff)" }}>
                <Icons.Check className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── The rail: her card, as hirers see it ────────────────────────────────── */

function PreviewRail({ first, avatar, verified, skills, levels, workTypes, days, area, city, steps, pct, jobsDone }: {
  first: string; avatar: string; verified: boolean; skills: ProfileSkill[]; levels: { key: string; label: string }[];
  workTypes: string[]; days: string[]; area: string; city: string; steps: Step[]; pct: number;
  /** Work she finished through WomSakhi that the poster confirmed — on her card, as in Find people. */
  jobsDone: number;
}) {
  const shown = skills.filter((s) => s.visible);
  const top = shown[0];
  const place = [area.trim(), city.trim()].filter(Boolean).join(" · ");
  const levelLabel = (k: string) => levels.find((l) => l.key === k)?.label ?? "";
  const left = steps.filter((s) => !s.done);
  return (
    <div id="wp-preview" className="space-y-4 scroll-mt-[96px]">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>
          <Icons.Eye className="h-3.5 w-3.5" /> How people hiring see you
        </p>
        <div className="relative">
          <div style={shown.length ? undefined : { filter: "grayscale(1)", opacity: 0.45 }} aria-hidden={!shown.length}>
            <MediaCard
              image={skillArt(top ?? skills[0] ?? { key: "you", name: "work", category: "", category_name: "" })}
              alt=""
              topLeft={shown.some((s) => s.verified) ? { text: "✓ Verified skill", tone: "green" } : top ? { text: top.name, tone: "light" } : null}
              topRight={top?.level ? { text: levelLabel(top.level), tone: "dark" } : null}
              overlay={jobsDone ? <><Icons.BadgeCheck className="h-[13px] w-[13px]" />{jobsDone} {jobsDone === 1 ? "job" : "jobs"} done through WomSakhi</>
                : shown.length > 1 ? <><Icons.Sparkles className="h-[13px] w-[13px]" />{shown.length} skills</> : null}
              title={first || "You"}
              subtitle={place || "Add your area and city"}
              avatar={{ src: avatar || undefined, name: first || "You" }}
              highlight={shown.length > 0}
              meta={<>
                {workTypes.length > 0 && <Fact icon="Briefcase">{workTypes.join(", ")}</Fact>}
                {days.length > 0 && <Fact icon="Clock">{days.join(", ")}</Fact>}
              </>}
              footer={
                <span className="flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-full text-xs font-bold"
                      style={{ background: "var(--ux-brand)", color: "var(--ux-on-brand, #fff)", opacity: 0.9 }}>
                  <Icons.MessageCircle className="h-4 w-4" /> Message
                </span>
              }
            >
              <div className="flex flex-wrap gap-1.5">
                {shown.slice(0, 6).map((s) => (
                  <span key={s.key} className="ux-pop inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold"
                        style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
                    {s.name}
                    {s.level && <span className="font-normal" style={{ color: "var(--ux-muted)" }}>· {levelLabel(s.level)}</span>}
                    {s.verified && <Icons.BadgeCheck className="h-3 w-3" style={{ color: "var(--ux-green-ink)" }} aria-label="Verified" />}
                  </span>
                ))}
                {shown.length > 6 && <span className="text-2xs" style={{ color: "var(--ux-muted)" }}>+{shown.length - 6} more</span>}
              </div>
            </MediaCard>
          </div>
          {!shown.length && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div className="rounded-[14px] px-4 py-3" style={{ background: "var(--ux-surface)", boxShadow: "var(--ux-shadow-pop)" }}>
                <Icons.EyeOff className="mx-auto h-5 w-5" style={{ color: "var(--ux-muted)" }} />
                <p className="mt-1.5 text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>Nobody can find you yet</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--ux-muted)" }}>Tap “Hidden” on a skill to show it.</p>
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-2xs" style={{ color: "var(--ux-muted)" }}>
          <Icons.Lock className="mt-[1px] h-3 w-3 shrink-0" />
          Your phone number is never on this card. People message you here; you decide whether to share it.
          {!verified && " Your card appears once your account is verified."}
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
            {left.length ? "Make your card stronger" : "Your card is complete"}
          </p>
          <span className="text-xs font-bold" style={{ color: "var(--ux-brand)" }}>{pct}%</span>
        </div>
        <ul className="mt-2.5 space-y-1">
          {steps.map((s) => (
            <li key={s.key}>
              <button type="button" onClick={() => scrollTo(s.to)} disabled={s.done}
                      className="ux-press flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-start text-xs enabled:hover:bg-[var(--ux-surface-2)]"
                      style={{ color: s.done ? "var(--ux-muted)" : "var(--ux-ink)" }}>
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                      style={s.done
                        ? { background: "var(--ux-green-ink)", color: "#fff" }
                        : { border: "1.5px dashed var(--ux-line-strong)" }}>
                  {s.done && <Icons.Check className="h-3 w-3" />}
                </span>
                <span className={`flex-1 ${s.done ? "line-through" : "font-semibold"}`}>{s.label}</span>
                {!s.done && <span className="text-2xs font-bold" style={{ color: "var(--ux-brand)" }}>+{s.weight}%</span>}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Link href="/app/work/find" className="ux-card ux-hov flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]"
              style={{ background: "var(--ux-tint-lilac)", color: "var(--ux-lilac-ink)" }}>
          <Icons.Search className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>Looking to hire?</span>
          <span className="block text-xs" style={{ color: "var(--ux-muted)" }}>Find women by skill near you</span>
        </span>
        <Icons.ChevronRight className="h-4 w-4" style={{ color: "var(--ux-muted)" }} />
      </Link>
    </div>
  );
}

/* ── The page ─────────────────────────────────────────────────────────────── */

export default function WorkProfilePage() {
  const me = useMe();
  const prof = useResource(useCallback((s: AbortSignal) => apiMyWorkProfile(s), []), null as WorkProfile | null);
  // Work she finished through WomSakhi — from Find work and from members' job posts.
  const history = useResource(useCallback((s: AbortSignal) => apiMyWorkHistory(s), []), { items: [], praise: [] } as { items: WorkDoneItem[]; praise: string[] });
  const jobsConfirmed = history.data.items.filter((w) => w.confirmed).length;
  const tax = useResource(useCallback((s: AbortSignal) => apiWorkTaxonomy(s), []), [] as WorkCategory[]);

  const [skills, setSkills] = useState<ProfileSkill[]>([]);
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [cat, setCat] = useState("");
  const [dirty, setDirty] = useState(false);

  // Server truth into the form, once per load — adjusted during render rather
  // than in an effect, so the first paint already shows her skills.
  const [loaded, setLoaded] = useState<WorkProfile | null>(null);
  if (prof.data && prof.data !== loaded) {
    const p = prof.data;
    setLoaded(p);
    setSkills(p.skills); setWorkTypes(p.work_types); setDays(p.days);
    setArea(p.area); setCity(p.city); setDirty(false);
  }

  const touch = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const category = tax.data.find((c) => c.key === cat);
  const offered = useMemo(
    () => (category ? [...category.skills].sort((a, b) => Number(b.popular) - Number(a.popular)) : []),
    [category],
  );
  const have = new Set(skills.map((s) => s.key));
  const pickedIn = (c: WorkCategory) => c.skills.filter((s) => have.has(s.key)).length;

  const addOrRemove = (key: string) => {
    if (!category) return;
    if (have.has(key)) { setSkills(skills.filter((s) => s.key !== key)); setDirty(true); return; }
    if (skills.length >= MAX) { toast(`Up to ${MAX} skills`, { tone: "error" }); return; }
    const opt = category.skills.find((s) => s.key === key)!;
    // She is choosing it now, so it is on; she can switch it off below.
    setSkills([...skills, {
      key, name: opt.name, category: category.key, category_name: category.name,
      level: "", visible: true, verified: false,
    }]);
    setDirty(true);
  };
  const patch = (key: string, over: Partial<ProfileSkill>) => {
    setSkills(skills.map((s) => (s.key === key ? { ...s, ...over } : s)));
    setDirty(true);
  };
  const showAll = (keys: string[], visible: boolean) => {
    setSkills(skills.map((s) => (keys.includes(s.key) ? { ...s, visible } : s)));
    setDirty(true);
  };

  const groups = useMemo(() => {
    const m = new Map<string, ProfileSkill[]>();
    for (const s of skills) m.set(s.category_name, [...(m.get(s.category_name) ?? []), s]);
    return [...m.entries()];
  }, [skills]);
  const shownFor = skills.filter((s) => s.visible).length;
  const steps = strengthOf(skills, workTypes, days, city);
  const pct = steps.reduce((n, s) => n + (s.done ? s.weight : 0), 0);
  const next = steps.find((s) => !s.done);

  const save = useAction(
    async () => {
      const got = await apiSaveWorkProfile({
        skills: skills.map((s) => ({ key: s.key, level: s.level, visible: s.visible })),
        work_types: workTypes, days, area: area.trim(), city: city.trim(),
      });
      setSkills(got.skills); setDirty(false);
      // Reload so `saved`, the banner and the "shown for" count are the
      // server's — the old data stays on screen while it comes back.
      prof.refetch();
      toast(pct === 100 ? "Saved — your card is complete" : "Saved", { tone: "success" });
    },
    { fallbackError: "That did not save. Check your connection and try again." },
  );

  const status = (prof.error as { response?: { status?: number } } | null)?.response?.status;
  if (prof.source === "loading") return <HomeShell><ScreenSkeleton shape="list" /></HomeShell>;
  if (!prof.data) {
    return (
      <HomeShell>
        <ScreenHead title="My work profile" />
        <Card>
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>
            {status === 403
              ? "Your work profile opens once your account is verified. We will tell you as soon as it is."
              : "Your work profile could not load. Check your connection and try again."}
          </p>
          {status !== 403 && <div className="mt-3"><Btn size="sm" variant="outline" onClick={prof.refetch}>Try again</Btn></div>}
        </Card>
      </HomeShell>
    );
  }
  const p = prof.data;
  const unsaved = dirty || !p.saved;

  const rail = (
    <PreviewRail first={me.first} avatar={me.avatar} verified={me.verified} skills={skills} levels={p.levels}
                 workTypes={workTypes} days={days} area={area} city={city} steps={steps} pct={pct} jobsDone={jobsConfirmed} />
  );

  const heroDetails = (
    <>
      <p className="mt-1.5 max-w-[520px] text-xs leading-relaxed" style={{ color: "rgba(255,255,255,.78)" }}>
        Pick the work you can do and switch on what you want to be found for.
        Verified members who are hiring see your first name, area and those skills — never your phone number.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { n: skills.length, l: skills.length === 1 ? "skill" : "skills", icon: "Sparkles" },
          { n: shownFor, l: "shown to hirers", icon: "Eye" },
          { n: skills.filter((s) => s.verified).length, l: "verified", icon: "BadgeCheck" },
          { n: jobsConfirmed, l: jobsConfirmed === 1 ? "job done" : "jobs done", icon: "Briefcase" },
        ].map((x) => (
          <span key={x.l} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.16)" }}>
            <I name={x.icon} className="h-3.5 w-3.5" />
            <b className="font-extrabold">{x.n}</b> {x.l}
          </span>
        ))}
      </div>
    </>
  );

  return (
    <HomeShell rail={rail}>
      <JourneyTrail goal="work" />
      {/* Where she stands, at a glance: how ready, how findable, what next. */}
      <section className="ux-aurora ux-grain ux-rise mb-[16px] rounded-[24px] p-5 sm:p-6"
               style={{ background: "var(--ux-deep)", color: "var(--ux-deep-ink)" }}>
        <div className="flex items-center gap-4 sm:items-start sm:gap-5">
          <Ring pct={pct} className="h-[84px] w-[84px] sm:h-[104px] sm:w-[104px]" />
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase tracking-[0.12em]" style={{ color: "var(--ux-deep-ink-2)" }}>
              My work profile
            </p>
            <h1 className="mt-1 text-[20px] font-extrabold leading-tight sm:text-[26px]">
              {pct === 100
                ? <><span className="ux-gradient-text">Ready to be hired</span>{me.first ? `, ${me.first}` : ""} ✨</>
                : shownFor
                  ? <>People hiring can find you for <span className="ux-gradient-text">{shownFor} {shownFor === 1 ? "skill" : "skills"}</span></>
                  : <>Let the right work <span className="ux-gradient-text">find you</span></>}
            </h1>
            <div className="hidden sm:block">{heroDetails}</div>
          </div>
        </div>
        <div className="sm:hidden">{heroDetails}</div>
        <div className="mt-5 flex flex-wrap gap-2">
          {next && (
            <button type="button" onClick={() => scrollTo(next.to)}
                    className="ux-press inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-xs font-bold"
                    style={{ background: "#fff", color: "#a3004f" }}>
              <Icons.Target className="h-4 w-4" /> Next: {next.label}
            </button>
          )}
          <button type="button" onClick={() => scrollTo("wp-preview")}
                  className="ux-press inline-flex min-h-[40px] items-center gap-2 rounded-full px-4 text-xs font-bold xl:hidden"
                  style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", color: "#fff" }}>
            <Icons.Eye className="h-4 w-4" /> See my card
          </button>
        </div>
      </section>

      {!p.saved && (
        <Card className="mb-[16px]" style={{ background: "var(--ux-tint-amber)" }}>
          <p className="flex items-start gap-2 text-xsm font-semibold" style={{ color: "var(--ux-amber-ink)" }}>
            <Icons.Info className="mt-[2px] h-4 w-4 shrink-0" />
            We filled this from what you told us when you joined. Check it and save.
          </p>
        </Card>
      )}

      {/* Add skills: a kind of work as a picture, then its skills as taps. */}
      <Card id="wp-add" className="mb-[16px] scroll-mt-[96px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>Add the work you can do</h2>
          <span className="text-2xs font-semibold" style={{ color: "var(--ux-faint)" }}>{skills.length} of {MAX} skills</span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--ux-surface-2)" }}>
          <div className="h-full rounded-full transition-[width] duration-500"
               style={{ width: `${(skills.length / MAX) * 100}%`, background: "var(--ux-brand)" }} />
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--ux-muted)" }}>Tap a kind of work to see its skills.</p>
        <div className="mt-2">
          <CategoryTiles cats={tax.data} value={cat} onPick={setCat} count={pickedIn} />
        </div>
        {category && (
          <div key={category.key} className="ux-fade mt-3 rounded-[14px] p-3" style={{ background: "var(--ux-surface-2)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--ux-ink-2)" }}>
              {category.name} — tap every skill you have
            </p>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`${category.name} skills`}>
              {offered.map((o, i) => (
                <SkillChip key={o.key} skill={o} cat={category} index={i} on={have.has(o.key)} onClick={() => addOrRemove(o.key)} />
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Her skills, by kind of work. */}
      <div id="wp-skills" className="scroll-mt-[96px]">
        {groups.length > 0 ? groups.map(([name, rows]) => {
          const on = rows.filter((s) => s.visible).length;
          const keys = rows.map((s) => s.key);
          return (
            <Card key={name} className="mb-[16px]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>{name}</h2>
                  <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
                    {on ? `${on} of ${rows.length} shown to people hiring` : "All hidden — nobody hiring sees these"}
                  </p>
                </div>
                <Btn size="sm" variant="outline" icon={on === rows.length ? "EyeOff" : "Eye"}
                     onClick={() => showAll(keys, on !== rows.length)}>
                  {on === rows.length ? "Hide all" : "Show all"}
                </Btn>
              </div>
              <ul className="mt-3 space-y-2.5">
                {rows.map((s, i) => (
                  <SkillCard key={s.key} s={s} levels={p.levels} index={i}
                             onLevel={(level) => patch(s.key, { level })}
                             onVisible={(visible) => patch(s.key, { visible })}
                             onRemove={() => { setSkills(skills.filter((x) => x.key !== s.key)); setDirty(true); }} />
                ))}
              </ul>
            </Card>
          );
        }) : (
          <Card className="mb-[16px]">
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full" style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
                <Icons.Sparkles className="h-6 w-6" />
              </span>
              <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>No skills yet</p>
              <p className="max-w-[340px] text-xs" style={{ color: "var(--ux-muted)" }}>
                Tap a kind of work above, then every skill you have. Each one becomes part of your card.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Work she finished through WomSakhi — what the next person hiring trusts most. */}
      <Card id="wp-work" className="mb-[16px] scroll-mt-[96px]">
        <WorkDone items={history.data.items} loading={history.source === "loading"} />
      </Card>

      {/* How and where she works. */}
      <Card id="wp-how" className="mb-[16px] scroll-mt-[96px]">
        <h2 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>How you like to work</h2>
        <div className="mt-3">
          <Label>Kind of work</Label>
          <Tiles options={p.work_type_options} value={workTypes} icons={WORK_TYPE_ICON} label="Kind of work"
                 onPick={(w) => touch(setWorkTypes)(toggleIn(workTypes, w))} />
        </div>
        <div className="mt-5">
          <Label>When you are free</Label>
          <Tiles options={p.day_options} value={days} icons={DAY_ICON} label="When you are free"
                 onPick={(d) => touch(setDays)(toggleIn(days, d))} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Area", hint: "optional", value: area, set: setArea, ph: "Your colony or locality" },
            { label: "City", hint: undefined, value: city, set: setCity, ph: "Your city or town" },
          ].map((f) => (
            <label key={f.label} className="block">
              <Label hint={f.hint}>{f.label}</Label>
              <span className="relative block">
                <Icons.MapPin className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--ux-muted)" }} />
                <input value={f.value} maxLength={80} onChange={(e) => touch(f.set)(e.target.value)}
                       placeholder={f.ph}
                       className="ux-sq min-h-[46px] w-full rounded-[12px] border ps-10 pe-4 text-xsm outline-none"
                       style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
              </span>
            </label>
          ))}
        </div>
      </Card>

      {/* Save, kept in reach while there is something to save; at rest it sits
          at the end of the form rather than covering a third of a phone.
          Solid, and clear of the Sakhi bubble in the corner. */}
      <div className={`${unsaved ? "sticky bottom-[84px] lg:bottom-4" : ""} z-10 lg:pe-[76px]`}>
        <Card style={{
          background: "var(--ux-surface)",
          boxShadow: unsaved
            ? "0 0 0 2px var(--ux-brand), 0 14px 34px -12px rgba(200,0,102,.35)"
            : "0 10px 30px -12px rgba(30,10,40,.28)",
        }}>
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-xs font-semibold"
               style={{ color: save.error ? "var(--ux-danger-ink)" : unsaved ? "var(--ux-ink)" : "var(--ux-green-ink)" }}>
              {save.error ? null : unsaved
                ? <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inset-0 animate-ping rounded-full opacity-60" style={{ background: "var(--ux-brand)" }} />
                    <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: "var(--ux-brand)" }} />
                  </span>
                : <Icons.Check className="h-4 w-4" />}
              <span className="min-w-0">
                {save.error || (unsaved
                  ? <><span className="sm:hidden">Not saved yet</span><span className="hidden sm:inline">You have changes that are not saved yet.</span></>
                  : "Everything is saved.")}
              </span>
            </p>
            <Btn variant="primary" icon="Check" loading={save.busy} disabled={!unsaved}
                 onClick={() => void save.run()}>
              <span className="sm:hidden">Save</span><span className="hidden sm:inline">Save my work profile</span>
            </Btn>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
