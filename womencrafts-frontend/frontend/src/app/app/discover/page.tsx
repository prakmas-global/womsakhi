"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, I, Skeleton, v } from "@/components/ux/kit";
import { useMeFacts } from "@/services/me.repository";
import { nextStep } from "@/services/journey";
import {
  LIFE_STAGES, readLifeStage, stageBy, weightFor, writeLifeStage, type LifeStageId,
} from "@/services/life-stage";
import { useDiscoverRails } from "@/components/ux/discovery/data";
import { useT } from "@/i18n";

import { Head, PickCard, WomanCard } from "./for-you-views";

/** The lenses across the top. `all` is not a filter — it is the absence of one. */
const LENSES = [
  { id: "all",   label: "Everything",     icon: "Sparkles" },
  { id: "women", label: "Women like you", icon: "Users" },
  { id: "work",  label: "Work",           icon: "Briefcase" },
  { id: "learn", label: "Learn",          icon: "BookOpen" },
  { id: "earn",  label: "Earn",           icon: "IndianRupee" },
  { id: "near",  label: "Near you",       icon: "MapPin" },
] as const;

type Lens = (typeof LENSES)[number]["id"];

/**
 * For you — for when she does not know what to ask.
 *
 * ── Why this is not the search page ─────────────────────────────────────────
 * Search serves a question she already has. On a platform this wide, most women
 * most of the time do not have one — they have a situation. This is the surface
 * for that, and it is why it earns a place in the primary navigation while
 * search stays a control in the header.
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
export default function DiscoverPage() {
  const tr = useT();
  const [lens, setLens] = useState<Lens>("all");
  const [saved, setSaved] = useState<string[]>([]);

  /**
   * The one thing that would move her forward.
   *
   * `null` until the server has answered, and `null` again if it could not.
   * The step used to be computed from a fixture — five invented listings, a
   * fabricated earnings total — so this card confidently told every woman the
   * same thing about her own situation. A missing card is a smaller failure
   * than a wrong instruction, so nothing is drawn here unless it came from her
   * own record.
   */
  const { data: facts, source } = useMeFacts();
  const step = useMemo(() => (facts ? nextStep(facts) : null), [facts]);

  /**
   * Her life stage, read on the client because it lives in a cookie she can
   * change. Null is a normal state — the page works without it, just less
   * pointedly.
   */
  const [life, setLife] = useState<LifeStageId | null>(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => setLife(readLifeStage()), []);

  const pickLife = useCallback((id: LifeStageId | null) => {
    writeLifeStage(id); setLife(id); setAsking(false);
  }, []);

  const stage = useMemo(() => (life ? stageBy(life) : null), [life]);
  const save = useCallback((id: string) => {
    setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  /*
    The rails, from the server.

    They were three constants — `FOR_YOU`, `CROSSINGS`, `NEARBY_WOMEN` — whose
    whole point was a `because:` line explaining why each card had reached her.
    Every one of those reasons was invented: "You charge ₹280 for blouses.
    Women near you charge up to ₹600" (she has never entered a price, and
    nothing records what women near her charge), "You have finished 87 orders"
    (she has three), "Six women you have sold to are already in it", "2 km
    away". A fabricated reason is worse than no reason: it is the app telling
    her it knows her, out of facts about her life that it made up.
  */
  const rails = useDiscoverRails();

  /** Weighted, never filtered — a woman on a break can still see a big contract. */
  const forYou = useMemo(() => {
    const { work, learn, circles } = rails.data;
    const pool =
      lens === "work" || lens === "earn" ? work
      : lens === "learn" ? learn
      : lens === "near" || lens === "women" ? circles
      : [...work, ...learn, ...circles];
    /*
      The life stage is the one piece of personalisation that is real: she
      picked it herself on this screen and it is stored on her device. Sorting
      by it is her preference applied, not a claim about her.
    */
    return [...pool].sort((a, b) => weightFor(life, b.kind) - weightFor(life, a.kind));
  }, [lens, life, rails.data]);

  const showWomen = lens === "all" || lens === "women" || lens === "near";

  return (
    <HomeShell active="/app/discover">
      <div className="flex flex-col gap-6">

        {/* ── Header: who this is for, and a way to sharpen it ──────────── */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px_260px]">
          <header className="min-w-0">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("discover.forYou")}</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-[1.15] tracking-[-0.02em]"
                style={{ color: v("--ux-ink") }}>{tr("discover.thingsWorthALook")}</h1>
            <p className="mt-1.5 max-w-[52ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>{tr("discover.notTheMostPopularThingsThe")}</p>
          </header>

          {/* The promise of the page, said once. */}
          <div className="relative hidden overflow-hidden rounded-[16px] p-5 xl:block"
               style={{ background: "linear-gradient(120deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/art/scene-woman-planning-board.webp" alt="" loading="lazy" decoding="async"
                 className="pointer-events-none absolute -bottom-3 -end-3 h-[132px] w-[132px] object-contain" />
            <p className="text-base font-semibold" style={{ color: v("--ux-ink-2") }}>{tr("discover.smallSteps")}</p>
            <p className="text-lg font-extrabold" style={{ color: v("--ux-brand") }}>{tr("discover.bigPossibilities")}</p>
            <p className="mt-2 w-[60%] text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{tr("discover.opportunitiesPeopleAndResourcesCho")}</p>
          </div>

          {/* Her year, as a control she can change — never a survey she must
              finish before the page works. */}
          <Card pad={16}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>
                  {stage ? stage.label : "Tell us about this year"}
                </p>
                <p className="mt-1 text-xs leading-snug" style={{ color: v("--ux-muted") }}>
                  {stage ? stage.shapes : "Get suggestions that fit your situation"}
                </p>
              </div>
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]"
                    style={{ background: v(stage ? stage.tint : "--ux-brand-tint-2") }}>
                <I name={stage ? stage.icon : "Target"} className="h-[16px] w-[16px]"
                   style={{ color: v(stage ? stage.ink : "--ux-brand") }} />
              </span>
            </div>
            <div className="mt-3">
              <Btn size="sm" full onClick={() => setAsking((a) => !a)}>
                {stage ? tr("discover.changeIt")
              : tr("discover.updateNow")}
              </Btn>
            </div>
          </Card>
        </div>

        {asking && (
          <Card pad={20}>
            <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{tr("discover.whatIsClosestToWhereYou")}</p>
            <p className="mt-1 max-w-[54ch] text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
              This only changes what gets shown first. Nothing is hidden from you, and you can
              change it whenever it stops being true.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                    <span className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{s.label}</span>
                  </span>
                  <span className="mt-1 block text-xs leading-snug" style={{ color: v("--ux-muted") }}>
                    {s.detail}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn size="sm" variant="ghost" onClick={() => pickLife(null)}>{tr("discover.noneOfThese")}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setAsking(false)}>{tr("discover.notNow")}</Btn>
            </div>
          </Card>
        )}

        {/* ── Lenses ────────────────────────────────────────────────────── */}
        <div className="ux-noscroll flex items-center gap-2 overflow-x-auto">
          {LENSES.map((l) => {
            const on = lens === l.id;
            return (
              <button key={l.id} type="button" onClick={() => setLens(l.id)} aria-pressed={on}
                      className="ux-press ux-sq flex min-h-[42px] shrink-0 items-center gap-2 rounded-[12px] border px-4 text-xsm font-semibold"
                      style={{
                        borderColor: v(on ? "--ux-brand" : "--ux-line"),
                        background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                        color: v(on ? "--ux-brand" : "--ux-ink-2"),
                      }}>
                <I name={l.icon} className="h-[15px] w-[15px]" />
                {l.label}
              </button>
            );
          })}
        </div>

        {/* ── The one thing that would move her forward ─────────────────── */}
        {lens === "all" && !step && source === "loading" && (
          <div className="rounded-[18px] p-6 sm:p-7"
               style={{ background: "linear-gradient(115deg, var(--ux-fill), var(--ux-fill-2))" }}>
            <div className="max-w-[52ch] space-y-3">
              <Skeleton w={110} h={11} />
              <Skeleton w="70%" h={26} r={9} />
              <Skeleton w="90%" h={13} />
              <Skeleton w={170} h={40} r={12} />
            </div>
          </div>
        )}

        {lens === "all" && step && (
          <div className="relative overflow-hidden rounded-[18px] p-6 sm:p-7"
               style={{ background: "linear-gradient(115deg, var(--ux-fill), var(--ux-fill-2))" }}>
            {/* Decorative, and deliberately so: the wireframe puts a picture of
                the outcome here. Inventing three named sub-steps to fill the
                space would be writing product that does not exist. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ux/art/scene-woman-reading-document.webp" alt="" loading="lazy" decoding="async"
                 aria-hidden
                 className="pointer-events-none absolute -bottom-4 end-6 hidden h-[190px] w-[190px] object-contain lg:block" />
            <div className="relative max-w-[52ch]">
              <p className="text-2xs font-extrabold uppercase tracking-[0.2em]"
                 style={{ color: v("--ux-on-brand-2") }}>{tr("discover.yourNextStep")}</p>
              <h2 className="mt-2 text-2xl font-extrabold leading-[1.15] tracking-[-0.02em]"
                  style={{ color: v("--ux-on-brand") }}>
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: v("--ux-on-brand-2") }}>
                {step.because}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Btn href={step.href} variant="on-brand" icon={step.icon} iconEnd="ArrowRight">
                  {step.cta}
                </Btn>
                {step.mins !== undefined && (
                  <span className="flex items-center gap-1.5 text-xsm font-semibold"
                        style={{ color: v("--ux-on-brand-2") }}>
                    <Icons.Clock className="h-[15px] w-[15px]" />
                    About {step.mins} min
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Women near her ───────────────────────────────────────────── */}
        {showWomen && (
          <section>
            <Head icon="UserRoundCheck" title={tr("discover.womenNearYouAStepAhead")}
                  sub={tr("discover.sameTradeSameAreaYouCan")} href="/app/mentors" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {rails.data.women.map((i) => (
                <WomanCard key={i.id} i={i} />
              ))}
            </div>
          </section>
        )}

        {/*
          Removed: "What you already know, used differently — same skill,
          better paid, women near you". Three cross-trade suggestions with an
          invented reason each, and a heading that promised a comparison to
          women nearby. Nothing in this database knows what anyone nearby
          charges, and `/app/shop/pricing` now says so in as many words — so
          the app was contradicting itself one tap apart.
        */}
        {/* ── Picked from something she actually did ───────────────────── */}
        <section>
          <Head icon="Zap" title={tr("discover.pickedBecauseOfSomethingYouDid")}
                sub={stage ? stage.shapes : "Not because it is popular"}
                href="/app/explore" count={forYou.length} />
          {forYou.length === 0 ? (
            <Card>
              <EmptyState icon="Compass" title={tr("discover.nothingUnderThisFilterYet")}
                          body="Try another filter — or look at the women near you, which is where most work here actually comes from."
                          action={<Btn size="sm" variant="outline" onClick={() => setLens("all")}>{tr("discover.showEverything")}</Btn>} />
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {forYou.map((i) => (
                <PickCard key={i.id} i={i} saved={saved.includes(i.id)} onSave={() => save(i.id)} />
              ))}
            </div>
          )}
        </section>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[1rem] w-[1rem] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nobody pays to appear here, and this page has a bottom — it does not scroll forever.
              If something is shown to you, the reason is written on it.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
