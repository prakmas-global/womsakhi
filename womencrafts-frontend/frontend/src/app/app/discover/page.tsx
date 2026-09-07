"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, IconTile, SectionHead, v } from "@/components/ux/kit";
import { NextStepCard } from "@/components/ux/journey/NextStepCard";
import { readJourneyState } from "@/services/me.repository";
import { nextStep } from "@/services/journey";
import {
  LIFE_STAGES, readLifeStage, stageBy, weightFor, writeLifeStage, type LifeStageId,
} from "@/services/life-stage";
import {
  CROSSINGS, FOR_YOU, NEARBY_WOMEN, type DiscoverItem,
} from "@/components/ux/discovery/data";

/**
 * Discover — for when she does not know what to ask.
 *
 * ── Why this is not the search page ─────────────────────────────────────────
 * Search serves a question she already has. On a platform this wide, most women
 * most of the time do not have one — they have a situation. Discover is the
 * surface for that, and it is why it earns a place in the primary navigation
 * while search stays a control in the header.
 *
 * ── Why it is not a feed ────────────────────────────────────────────────────
 * An endless scroll of other women's wins is a comparison machine. What the
 * evidence supports for this user base is narrower and duller: seeing *a named
 * woman like her doing one specific thing*. So every row is anchored to a
 * person, a distance, or a stated reason — and there is a bottom to the page.
 *
 * ── Every card says why it is here ──────────────────────────────────────────
 * "Recommended for you" without a reason is indistinguishable from an
 * advertisement, and a woman with limited digital experience has no way to tell
 * them apart. If a reason cannot be written, the row does not ship.
 */

type Lens = "all" | "women" | "work" | "learn";

export default function DiscoverPage() {
  const router = useRouter();
  const [lens, setLens] = useState<Lens>("all");
  const [saved, setSaved] = useState<string[]>([]);

  const state = useMemo(() => readJourneyState(), []);
  const step = useMemo(() => nextStep(state), [state]);

  /**
   * Her life stage, read on the client because it lives in a cookie she can
   * change. Null is a normal state — the page works without it, just less
   * pointedly.
   */
  const [life, setLife] = useState<LifeStageId | null>(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => setLife(readLifeStage()), []);

  const pickLife = useCallback((id: LifeStageId | null) => {
    setLife(id); writeLifeStage(id); setAsking(false);
  }, []);

  const stage = useMemo(() => stageBy(life), [life]);

  const save = useCallback((id: string) => {
    setSaved((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  }, []);

  const forYou = useMemo(() => {
    let rows = FOR_YOU;
    if (lens === "work") rows = rows.filter((i) => i.kind === "opportunity");
    else if (lens === "learn") rows = rows.filter((i) => i.kind === "course");
    else if (lens === "women") return [];

    // Weighted, never filtered. A woman on a break who wants to look at big
    // contracts must still be able to — the ordering puts the likely thing
    // first, it does not decide what she is allowed to want.
    if (!life) return rows;
    return [...rows].sort((a, b) => weightFor(life, b.kind) - weightFor(life, a.kind));
  }, [lens, life]);

  const showWomen = lens === "all" || lens === "women";
  const showCross = lens === "all" || lens === "learn" || lens === "work";

  return (
    <HomeShell active="/app/discover">
      <div className="flex flex-col gap-5">

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Discover
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Things worth knowing about
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            Not the most popular things — the ones that have something to do with you. Everything
            below says why it is here.
          </p>
        </header>

        {/*
          What kind of year she is having.

          Shown as a quiet line she can change, not a survey she must complete
          before the page works — and "none of these" is a real answer, because
          seven categories cannot hold every woman's situation and a forced
          choice produces a wrong one rather than no one.
        */}
        {!asking ? (
          <button type="button" onClick={() => setAsking(true)}
                  className="ux-press ux-sq flex w-fit items-center gap-2 rounded-[12px] px-3.5 py-2.5 text-left"
                  style={{ background: v(stage ? stage.tint : "--ux-surface-2") }}>
            <I name={stage ? stage.icon : "UserRoundCog"} className="h-[1rem] w-[1rem]"
               style={{ color: v(stage ? stage.ink : "--ux-muted") }} />
            <span className="text-[0.8125rem] font-semibold" style={{ color: v("--ux-ink") }}>
              {stage ? stage.label : "Tell us what kind of year you are having"}
            </span>
            <span className="text-[0.75rem]" style={{ color: v("--ux-muted") }}>
              {stage ? "change" : "so this page is about you"}
            </span>
          </button>
        ) : (
          <Card pad={20}>
            <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>
              What is closest to where you are?
            </p>
            <p className="mt-1 max-w-[54ch] text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              This only changes what gets shown first. Nothing is hidden from you, and you can
              change it whenever it stops being true.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {LIFE_STAGES.map((s) => (
                <button key={s.id} type="button" onClick={() => pickLife(s.id)}
                        aria-pressed={life === s.id}
                        className="ux-press ux-sq rounded-[12px] border p-3.5 text-left"
                        style={{
                          borderColor: v(life === s.id ? "--ux-fill" : "--ux-line"),
                          background: v(life === s.id ? "--ux-brand-tint" : "--ux-surface"),
                        }}>
                  <span className="flex items-center gap-2">
                    <I name={s.icon} className="h-[1rem] w-[1rem]" style={{ color: v(s.ink) }} />
                    <span className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{s.label}</span>
                  </span>
                  <span className="mt-1 block text-[0.75rem] leading-snug" style={{ color: v("--ux-muted") }}>
                    {s.detail}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn size="sm" variant="ghost" onClick={() => pickLife(null)}>None of these</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setAsking(false)}>Not now</Btn>
            </div>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Chip icon="LayoutGrid" selected={lens === "all"} onClick={() => setLens("all")}>Everything</Chip>
          <Chip icon="Users" selected={lens === "women"} onClick={() => setLens("women")}>Women like you</Chip>
          <Chip icon="Briefcase" selected={lens === "work"} onClick={() => setLens("work")}>Work</Chip>
          <Chip icon="BookOpen" selected={lens === "learn"} onClick={() => setLens("learn")}>Learn</Chip>
        </div>

        {lens === "all" && <NextStepCard step={step} compact />}

        {showWomen && (
          <div>
            <SectionHead title="Women near you, a step ahead"
                         sub="Same trade, same area — you can message any of them" icon="UserRoundCheck" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {NEARBY_WOMEN.map((i) => (
                <Row key={i.id} i={i} saved={saved.includes(i.id)}
                     onSave={() => save(i.id)} onOpen={() => router.push(i.href)} />
              ))}
            </div>
          </div>
        )}

        {showCross && (
          <div>
            <SectionHead title="What you already know, used differently"
                         sub="Same skill, better paid — women near you made these moves" icon="TrendingUp" />
            <div className="grid gap-3 sm:grid-cols-2">
              {CROSSINGS.map((i) => (
                <Row key={i.id} i={i} saved={saved.includes(i.id)}
                     onSave={() => save(i.id)} onOpen={() => router.push(i.href)} />
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionHead title="Picked because of something you did"
                       sub={stage ? stage.shapes : "Not because it is popular"}
                       icon="Sparkles" chip={String(forYou.length)} />
          {forYou.length === 0 ? (
            <Card>
              <EmptyState icon="Compass" title="Nothing under this filter yet"
                          body="Try another filter — or look at the women near you, which is where most work here actually comes from."
                          action={<Btn size="sm" variant="outline" onClick={() => setLens("all")}>Show everything</Btn>} />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {forYou.map((i) => (
                <Row key={i.id} i={i} saved={saved.includes(i.id)}
                     onSave={() => save(i.id)} onOpen={() => router.push(i.href)} />
              ))}
            </div>
          )}
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[1rem] w-[1rem] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nobody pays to appear here, and this page has a bottom — it does not scroll forever.
              If something is shown to you, the reason is written on it.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}

/** One recommendation, with its reason. */
function Row({ i, saved, onSave, onOpen }: {
  i: DiscoverItem; saved: boolean; onSave: () => void; onOpen: () => void;
}) {
  return (
    <Card pad={0} style={{ overflow: "hidden" }}>
      <button type="button" onClick={onOpen} className="ux-press flex w-full items-start gap-3.5 p-4 text-left">
        <IconTile icon={i.icon} tint={i.tint} ink={i.ink} size={44} radius={12} />
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-bold leading-snug" style={{ color: v("--ux-ink") }}>{i.title}</p>
          <p className="mt-0.5 text-[0.75rem] leading-relaxed" style={{ color: v("--ux-muted") }}>{i.detail}</p>

          {/* The reason. This is the part that makes it not an advertisement. */}
          <p className="mt-2 flex items-start gap-1.5 rounded-[8px] px-2.5 py-2 text-[0.75rem] leading-snug"
             style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
            <I name="Sparkles" className="mt-[2px] h-[0.6875rem] w-[0.6875rem] shrink-0" />
            {i.because}
          </p>
          <p className="mt-2 text-[0.6875rem] font-semibold" style={{ color: v("--ux-faint") }}>{i.meta}</p>
        </div>
      </button>
      <div className="flex gap-2 border-t px-4 py-3" style={{ borderColor: v("--ux-line") }}>
        <Btn size="sm" full onClick={onOpen}>
          {i.kind === "woman" ? "See her" : i.kind === "circle" ? "See the circle" : "Have a look"}
        </Btn>
        <Btn size="sm" variant={saved ? "soft" : "ghost"} icon="Bookmark" onClick={onSave}>
          {saved ? "Saved" : "Save"}
        </Btn>
      </div>
    </Card>
  );
}
