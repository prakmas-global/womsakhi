"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn } from "@/components/ux/kit";
import { ScreenHead } from "@/components/ux/learning/native";
import * as Icons from "@/components/ux/icons";
import { RangoliArt, countOf } from "@/components/ux/games/RangoliArt";
import { DESIGNS, designOf, levelOf, seedAt, type Design } from "@/components/ux/games/rangoli-designs";
import {
  listMade, listSaved, loadFills, recent, removeSaved, type Fills, type SavedRangoli,
} from "@/components/ux/games/rangoli-store";

/**
 * Rangoli designs — choose one to colour.
 *
 * A library of 100: the hand-made designs, then the app's own designs drawn
 * from fixed seeds (components/ux/games/rangoli-designs.ts) — the same ones on
 * every phone — shown twelve at a time. Designs she has started sit on top,
 * and the ones she kept with "Save design" are under My rangolis.
 * Everything is drawn here, in the app; nothing is fetched from anywhere.
 * Opening a design goes to /app/health/games/rangoli/<id>.
 */

const BASE = "/app/health/games/rangoli";
const PAGE = 12;
const LEVELS = ["All", "Easy", "Calm", "Detailed"] as const;
type Level = (typeof LEVELS)[number];
/** How far she had scrolled the list and which level she picked, kept for "Back to designs". */
const VIEW = "womsakhi.rangoli.view";

const genId = (i: number) => `g${seedAt(i).toString(36)}`;
/** The whole library: 100 designs in all, the hand-made ones first. */
const LIBRARY_SIZE = 100;
const APP_DESIGNS: Design[] = Array.from({ length: LIBRARY_SIZE - DESIGNS.length }, (_, i) => designOf(genId(i))!);
const when = (at: number) => new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Card({ d, fills, href, foot, onRemove }: {
  d: Design; fills: Fills; href: string; foot?: string; onRemove?: () => void;
}) {
  const n = countOf(d, fills), total = d.segs.length;
  return (
    <article className="ux-card ux-hov relative flex flex-col gap-1.5 overflow-hidden p-2" data-rangoli-card={d.id}>
      <Link href={href} className="absolute inset-0 z-[1] rounded-[inherit]" aria-label={`Colour ${d.name}: ${levelOf(d)}, ${total} pieces${n ? `, ${n} coloured` : ""}`} />
      <RangoliArt design={d} fills={fills} className="block aspect-square w-full rounded-[12px]" />
      <b className="truncate px-1 text-[13.5px] leading-tight" style={{ color: "var(--ux-ink)" }}>{d.name}</b>
      <span className="truncate px-1 text-[11.5px] leading-tight tabular-nums" style={{ color: "var(--ux-muted)" }}>
        {foot ?? `${levelOf(d)} · ${n ? `${n}/${total} coloured` : `${total} pieces`}`}
      </span>
      <span className="mx-1 mb-1 block h-[5px] overflow-hidden rounded-full" style={{ background: n ? "var(--ux-tint-pink)" : "transparent" }} aria-hidden>
        <i className="block h-full rounded-full" style={{ width: `${(n / total) * 100}%`, background: "var(--ux-brand)" }} />
      </span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${d.name} from My rangolis`}
                className="ux-press absolute end-3 top-3 z-[2] grid h-8 w-8 place-items-center rounded-full"
                style={{ background: "rgba(255,255,255,.92)", color: "var(--ux-muted)", boxShadow: "var(--ux-shadow-sm)" }}>
          <Icons.Trash2 className="h-4 w-4" />
        </button>
      )}
    </article>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>{children}</div>;
}

function Head({ id, title, sub, action }: { id: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] font-extrabold" style={{ color: "var(--ux-ink)" }}>{title}</h2>
        {sub && <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export default function RangoliDesigns() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState<{ id: string; fills: Fills }[]>([]);
  const [progress, setProgress] = useState<Record<string, Fills>>({});
  const [saved, setSaved] = useState<SavedRangoli[]>([]);
  const [made, setMade] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE);
  const [level, setLevel] = useState<Level>("All");

  // Everything she keeps is in this browser: read it after the first paint.
  useEffect(() => {
    const t = window.setTimeout(() => {
      // Links from before designs had their own page: ?design=<id> opens that design.
      const old = new URLSearchParams(window.location.search).get("design");
      if (old && designOf(old)) { router.replace(`${BASE}/${old}`); return; }
      const r = recent().filter((x) => designOf(x.id)).sort((a, b) => b.at - a.at);
      const fills = Object.fromEntries(r.map((x) => [x.id, loadFills(x.id)]));
      setStarted(r.map((x) => ({ id: x.id, fills: fills[x.id] })));
      setProgress(fills);
      setSaved(listSaved().filter((x) => designOf(x.id)));
      setMade(listMade().filter((id) => designOf(id)));
      try {
        const v = JSON.parse(sessionStorage.getItem(VIEW) || "{}") as { shown?: number; level?: Level };
        if (v.shown) setShown(Math.min(APP_DESIGNS.length, v.shown));
        if (v.level && LEVELS.includes(v.level)) setLevel(v.level);
      } catch { /* fine */ }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [router]);

  const remember = (next: { shown?: number; level?: Level }) => {
    try { sessionStorage.setItem(VIEW, JSON.stringify({ shown, level, ...next })); } catch { /* fine */ }
  };
  const more = () => { setShown(shown + PAGE); remember({ shown: shown + PAGE }); };
  const pickLevel = (l: Level) => { setLevel(l); remember({ level: l }); };
  const remove = (sid: string) => {
    removeSaved(sid);
    setSaved((x) => x.filter((s) => s.sid !== sid));
  };

  const fits = (d: Design) => level === "All" || levelOf(d) === level;
  // The app's designs at the level she picked; `shown` of them on the page.
  const matching = useMemo(() => APP_DESIGNS.filter((d) => level === "All" || levelOf(d) === level), [level]);
  const app = matching.slice(0, shown);
  const left = matching.length - app.length;
  const featured = DESIGNS.filter(fits);
  const mine = made.map((id) => designOf(id)!).filter((d) => d && fits(d));

  return (
    <HomeShell active="/app/health/games">
      <Back to="/app/health/games" label="Games & Stress Relief" className="mb-3" />
      <ScreenHead title="Rangoli designs"
                  sub={`${LIBRARY_SIZE} designs to choose from, all drawn right here in the app. Pick one and start colouring.`} />

      <div className="flex flex-col gap-8" data-rangoli-gallery>
        {ready && started.length > 0 && (
          <section aria-labelledby="rg-continue">
            <Head id="rg-continue" title="Continue colouring" sub="Your colouring is kept on this phone, just as you left it." />
            <Grid>
              {started.slice(0, 8).map(({ id, fills }) => {
                const d = designOf(id)!;
                return <Card key={id} d={d} fills={fills} href={`${BASE}/${id}`} />;
              })}
            </Grid>
          </section>
        )}

        <div role="group" aria-label="Show designs that are" className="flex flex-wrap items-center gap-2">
          <span className="me-1 text-sm font-bold" style={{ color: "var(--ux-ink-2)" }}>Show</span>
          {LEVELS.map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => pickLevel(l)}
                    className="ux-press min-h-[38px] rounded-full border-[1.5px] px-3.5 text-[13px] font-bold"
                    style={level === l ? { borderColor: "var(--ux-brand)", background: "var(--ux-tint-pink)", color: "var(--ux-ink)" }
                                       : { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
              {l === "All" ? "All designs" : l}
            </button>
          ))}
          <span className="ms-auto text-xs" style={{ color: "var(--ux-muted)" }}>Easy: up to 30 pieces · Calm: up to 60 · Detailed: more</span>
        </div>

        <section aria-labelledby="rg-featured">
          <Head id="rg-featured" title="Favourite designs" sub="Classic patterns, from a simple bloom to a pulli kolam." />
          {featured.length ? (
            <Grid>{featured.map((d) => <Card key={d.id} d={d} fills={progress[d.id] ?? {}} href={`${BASE}/${d.id}`} />)}</Grid>
          ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No {level.toLowerCase()} designs here. Try another level.</p>}
        </section>

        {mine.length > 0 && (
          <section aria-labelledby="rg-mine">
            <Head id="rg-mine" title="Designs you made" sub="New designs you made earlier — still here to colour." />
            <Grid>{mine.map((d) => <Card key={d.id} d={d} fills={progress[d.id] ?? {}} href={`${BASE}/${d.id}`} />)}</Grid>
          </section>
        )}

        <section aria-labelledby="rg-app">
          <Head id="rg-app" title="More designs to colour"
                sub={`${matching.length} ${level === "All" ? "" : `${level.toLowerCase()} `}designs drawn by the app, each one different.`} />
          <Grid>{app.map((d) => <Card key={d.id} d={d} fills={progress[d.id] ?? {}} href={`${BASE}/${d.id}`} />)}</Grid>
          {!app.length && <p className="text-sm" style={{ color: "var(--ux-muted)" }}>None of these is {level.toLowerCase()} — pick another level.</p>}
          {left > 0 && (
            <div className="mt-4 flex justify-center">
              <Btn variant="outline" icon="Plus" onClick={more}>Show {Math.min(PAGE, left)} more · {left} left</Btn>
            </div>
          )}
        </section>

        {ready && saved.length > 0 && (
          <section aria-labelledby="rg-saved">
            <Head id="rg-saved" title="My rangolis" sub="Designs you kept with “Save design”. Open one to carry on from it." />
            <Grid>
              {saved.map((sv) => {
                const d = designOf(sv.id)!;
                return <Card key={sv.sid} d={d} fills={sv.fills} href={`${BASE}/${sv.id}?saved=${sv.sid}`}
                             foot={`Saved ${when(sv.at)} · ${countOf(d, sv.fills)}/${d.segs.length}`} onRemove={() => remove(sv.sid)} />;
              })}
            </Grid>
          </section>
        )}
      </div>
    </HomeShell>
  );
}
