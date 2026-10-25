"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn } from "@/components/ux/kit";
import { Cols, Empty, HealthFrame, I, Metric, MetricGrid, Panel, lastDays, useEntries, useHealthSettings } from "@/components/ux/health/kit";
import { MoodFace, lookOf } from "@/components/ux/health/mind/parts";
import { CATS, GAMES, gameName, type Game, type GameCat } from "@/components/ux/games/catalog";
import { apiMoodHistory } from "@/lib/engines-api";
import { fmtDay, today, type Entry } from "@/lib/health-api";

/**
 * Games & Stress Relief — a mindful break, one tap away.
 *
 * Tabs are the design's categories (All, Breathing, Focus, Puzzle,
 * Relaxation) and "Your activity". Each game saves its session when she
 * finishes (components/ux/games/GameFrame.tsx), with the mood she picked
 * after, so the activity tab can say how often a break left her calmer.
 * Favourites are kept in her health settings.
 */

const TABS = [{ id: "all", label: "All" }, ...CATS.map((c) => ({ id: c.id, label: c.label })), { id: "activity", label: "Your activity" }];

/** Which game to suggest, from how she said she feels today. */
const SUGGEST: Record<string, string> = {
  anxious: "breathe", angry: "bubbles", irritable: "bubbles", low: "garden", sad: "garden", tired: "garden",
  unwell: "breathe", good: "numbers", happy: "puzzle", calm: "pairs",
};

export default function GamesHub() {
  const sessions = useEntries("game");
  const { settings, save } = useHealthSettings();
  const [mood, setMood] = useState("");

  useEffect(() => {
    const ctl = new AbortController();
    apiMoodHistory(1, ctl.signal).then((d) => setMood(d.find((x) => x.date === today())?.mood || "")).catch(() => undefined);
    return () => ctl.abort();
  }, []);

  const favs = settings.favoriteGames;
  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    void save({ favoriteGames: next }, favs.includes(id) ? "Removed from favourites" : "Added to favourites");
  };
  const suggest = GAMES.find((g) => g.id === (SUGGEST[mood] || "breathe")) ?? GAMES[0];

  return (
    <HealthFrame active="/app/health/games" hue="amber" icon="Gamepad2" eyebrow="Games & Stress Relief"
                 title="Take a mindful break"
                 sub="Small, quiet games for a heavy moment. Every game works with one tap, and nothing counts against you."
                 art="/ux/art/scene-women-celebrating.webp" tabs={TABS}
                 actions={<Btn icon="Play" href={suggest.href}>Start playing</Btn>}>
      {(tab) => {
        if (tab === "activity") return <Activity sessions={sessions.rows} loading={sessions.loading} favs={favs} onDelete={sessions.remove} />;
        const list = tab === "all" ? GAMES : GAMES.filter((g) => g.cat === (tab as GameCat));
        const sorted = [...list].sort((a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)));
        return (
          <>
            <Panel hue="amber" tint>
              <div className="flex flex-wrap items-center justify-between gap-4" data-daily-calm>
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px]" style={{ background: "var(--ux-surface)", color: "var(--ux-amber-ink)" }}>
                    <I name={suggest.icon} className="h-7 w-7" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--ux-amber-ink)" }}>Daily calm</p>
                    <h2 className="text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>{suggest.name}</h2>
                    <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>
                      {mood ? `Suggested because you felt ${lookOf(mood).label.toLowerCase()} today.` : "A gentle place to start."}
                    </p>
                  </div>
                </div>
                <Btn icon="Play" href={suggest.href}>Play now</Btn>
              </div>
            </Panel>
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }} data-games-grid>
              {sorted.map((g) => <GameCard key={g.id} g={g} fav={favs.includes(g.id)} onFav={() => toggleFav(g.id)} played={sessions.rows.filter((s) => s.data.game === g.id).length} />)}
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              If you are feeling unsafe or very low, please talk to someone — Tele-MANAS is free on <a href="tel:14416" className="font-bold underline">14416</a>, any time.
              More support is in <Link href="/app/health/mind" className="font-bold underline">Mental Wellness</Link>.
            </p>
          </>
        );
      }}
    </HealthFrame>
  );
}

function GameCard({ g, fav, onFav, played }: { g: Game; fav: boolean; onFav: () => void; played: number }) {
  return (
    <article className="ux-card ux-hov group relative flex flex-col overflow-hidden" style={{ padding: 0 }} data-game={g.id}>
      <Link href={g.href} className="relative block aspect-[16/10] w-full overflow-hidden" style={{ background: "var(--ux-surface-2)" }} aria-label={`Play ${g.name}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={g.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 45%, rgba(16,6,24,.7) 100%)" }} />
        <span className="absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold"
              style={{ background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
          <Icons.Play className="h-3.5 w-3.5" style={{ color: "var(--ux-amber-ink)" }} /> Play
        </span>
      </Link>
      <button type="button" onClick={onFav} aria-pressed={fav} aria-label={fav ? `Remove ${g.name} from favourites` : `Add ${g.name} to favourites`}
              className="ux-press absolute end-3 top-3 grid h-10 w-10 place-items-center rounded-full"
              style={{ background: "var(--ux-surface)", color: fav ? "var(--ux-amber-ink)" : "var(--ux-muted)", boxShadow: "var(--ux-shadow-sm)" }}>
        <Icons.Star className="h-[18px] w-[18px]" style={{ fill: fav ? "currentColor" : "none" }} />
      </button>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <b className="flex items-center gap-2 text-base" style={{ color: "var(--ux-ink)" }}>
          <I name={g.icon} className="h-[18px] w-[18px]" style={{ color: "var(--ux-amber-ink)" }} /> {g.name}
        </b>
        <p className="text-[13.5px]" style={{ color: "var(--ux-muted)" }}>{g.desc}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs font-bold">
          <span className="rounded-full px-2.5 py-1" style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
            {CATS.find((c) => c.id === g.cat)?.label} · {g.time}
          </span>
          {played > 0 && <span style={{ color: "var(--ux-muted)" }}>Played {played}×</span>}
        </div>
      </div>
    </article>
  );
}

function achievements(ss: Entry<"game">[]) {
  const mins = ss.reduce((a, s) => a + (s.data.seconds || 0), 0) / 60;
  const played = new Set(ss.map((s) => s.data.game));
  const from = lastDays(7)[0].day;
  const days7 = new Set(ss.filter((s) => s.date >= from).map((s) => s.date)).size;
  return [
    { name: "First break", desc: "Save your first session", on: ss.length >= 1 },
    { name: "Five breaks", desc: "Save 5 sessions", on: ss.length >= 5 },
    { name: "Calm 30", desc: "Play for 30 minutes in total", on: mins >= 30 },
    { name: "Explorer", desc: `Try all ${GAMES.length} games`, on: GAMES.every((g) => played.has(g.id)) },
    { name: "Steady week", desc: "Take breaks on 3 days in a week", on: days7 >= 3 },
  ];
}

function Activity({ sessions, loading, favs, onDelete }: { sessions: Entry<"game">[]; loading: boolean; favs: string[]; onDelete: (id: string) => void }) {
  const [confirm, setConfirm] = useState("");
  const from = lastDays(7)[0].day;
  const week = sessions.filter((s) => s.date >= from);
  const counts = sessions.reduce<Record<string, number>>((a, s) => { a[s.data.game] = (a[s.data.game] || 0) + 1; return a; }, {});
  const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const withMood = sessions.filter((s) => s.data.mood);
  const calmer = withMood.filter((s) => s.data.mood === "good").length;
  const mmss = (sec: number) => (sec >= 60 ? `${Math.round(sec / 60)} min` : `${sec} sec`);

  return (
    <>
      <MetricGrid>
        <Metric hue="amber" icon="Gamepad2" label="Sessions, 7 days" value={week.length} />
        <Metric hue="orange" icon="Clock" label="Minutes, 7 days" value={Math.round(week.reduce((a, s) => a + (s.data.seconds || 0), 0) / 60)} unit="min" />
        <Metric hue="violet" icon="Trophy" label="Most played" value={top ? gameName(top) : "–"} />
        <Metric hue="green" icon="Smile" label="Calmer after" value={withMood.length ? `${Math.round((calmer / withMood.length) * 100)}%` : "–"}
                sub={withMood.length ? `of ${withMood.length} sessions with a mood` : "Pick a mood after playing"} />
      </MetricGrid>
      <Cols
        main={
          <Panel title="Session history">
            {loading ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading…</p>
              : sessions.length === 0 ? (
                <Empty icon="Gamepad2" title="No sessions yet" body="Play any game and press “I'm done” — your session is saved here."
                       action={<Btn size="sm" icon="Play" href="/app/health/games">Pick a game</Btn>} />
              ) : (
                <ul className="flex flex-col" data-sessions>
                  {sessions.slice(0, 40).map((s) => (
                    <li key={s.id} className="flex items-center gap-3 border-t py-3 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>
                        <I name={GAMES.find((g) => g.id === s.data.game)?.icon || "Gamepad2"} className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{gameName(s.data.game)}</b>
                        <span className="block truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                          {[fmtDay(s.date, { weekday: "short", day: "numeric", month: "short" }), mmss(s.data.seconds || 0), s.data.scoreLabel].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      {s.data.mood && <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--ux-muted)" }} title={`Felt ${lookOf(s.data.mood).label.toLowerCase()} after`}>
                        <MoodFace mood={s.data.mood} size={22} /><span className="max-sm:hidden">after</span>
                      </span>}
                      <Btn size="sm" variant={confirm === s.id ? "outline" : "ghost"} icon="Trash2" ariaLabel={confirm === s.id ? "Tap again to delete" : "Delete"}
                           onClick={() => (confirm === s.id ? (setConfirm(""), onDelete(s.id)) : setConfirm(s.id))}>
                        {confirm === s.id ? "Delete?" : ""}
                      </Btn>
                    </li>
                  ))}
                </ul>
              )}
          </Panel>
        }
        side={<>
          <Panel title="Achievements">
            <div className="grid grid-cols-2 gap-2.5" data-achievements>
              {achievements(sessions).map((a) => (
                <div key={a.name} className="flex flex-col gap-1.5 rounded-[14px] p-3"
                     style={{ background: a.on ? "var(--ux-tint-amber)" : "var(--ux-surface-2)" }}>
                  <Icons.Award className="h-5 w-5" style={{ color: a.on ? "var(--ux-amber-ink)" : "var(--ux-muted)" }} />
                  <b className="text-[13.5px]" style={{ color: "var(--ux-ink)" }}>{a.name}</b>
                  <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{a.desc}</span>
                  {a.on && <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                                 style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}><Icons.Check className="h-3 w-3" /> Earned</span>}
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Your favourites">
            {favs.length ? (
              <div className="flex flex-col gap-2">
                {favs.map((id) => {
                  const g = GAMES.find((x) => x.id === id);
                  return g ? <Btn key={id} variant="outline" icon={g.icon} href={g.href}>{g.name}</Btn> : null;
                })}
              </div>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Tap the star on any game to keep it here.</p>}
          </Panel>
        </>}
      />
    </>
  );
}
