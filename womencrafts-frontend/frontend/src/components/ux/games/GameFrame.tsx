"use client";

import { useCallback, useEffect, useRef } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn } from "@/components/ux/kit";
import { ScreenHead } from "@/components/ux/learning/native";
import { apiAddEntry, apiEditEntry, today } from "@/lib/health-api";

import { FeelSheet } from "./FeelSheet";

/**
 * The frame every calm game sits in: back to the games, a quiet title, the
 * game, and "I'm done" — which opens the how-do-you-feel sheet. The game
 * itself can open that sheet too when it ends (breathing time is up, the last
 * pair is found).
 *
 * ── One session per round ────────────────────────────────────────────────
 * Opening the sheet saves the round as a `game` entry in her Health store:
 * how long she played and, when the game has one, what she did ("6 pairs in
 * 14 turns"). The mood she picks afterwards is added to that same entry, so
 * Games → Your activity and Mental Wellness → Insights can say whether a
 * break helped. Rounds under five seconds (an accidental tap on "I'm done")
 * are not saved. "Play again" starts a new round.
 */
export function GameFrame({ title, sub, children, feel, setFeel, again, tools, game, result, back }: {
  title: string;
  sub: string;
  children: React.ReactNode;
  /** Where "back" goes, when not to the games list (a game with its own front page). */
  back?: { to: string; label: string };
  feel: boolean;
  setFeel: (v: boolean) => void;
  again?: () => void;
  /** Controls shown beside "I'm done" — sound on/off and the like. */
  tools?: React.ReactNode;
  /** The catalogue id this round is saved under (components/ux/games/catalog.ts). */
  game?: string;
  /** What she did this round, read when it is saved. */
  result?: () => { score?: number; scoreLabel?: string };
}) {
  const started = useRef(0);
  const saved = useRef<Promise<string | null> | null>(null);
  const resultRef = useRef(result);
  useEffect(() => { resultRef.current = result; });
  useEffect(() => { started.current = Date.now(); }, []);

  useEffect(() => {
    if (!feel || !game || saved.current) return;
    const seconds = Math.round((Date.now() - started.current) / 1000);
    if (seconds < 5) return;
    const r = resultRef.current?.() ?? {};
    saved.current = apiAddEntry("game", {
      game, seconds: Math.min(seconds, 4 * 3600),
      score: Math.max(0, Math.round(r.score ?? 0)), scoreLabel: (r.scoreLabel ?? "").slice(0, 40),
    }, today()).then((e) => e.id).catch(() => null);
  }, [feel, game]);

  const onMood = useCallback((mood: string) => {
    void saved.current?.then((id) => { if (id) void apiEditEntry<"game">(id, { data: { mood } }).catch(() => undefined); });
  }, []);

  const playAgain = again ? () => { saved.current = null; started.current = Date.now(); again(); } : undefined;

  return (
    <HomeShell active="/app/health/games">
      <Back to={back?.to ?? "/app/health/games"} label={back?.label ?? "Games"} className="mb-3" />
      <ScreenHead title={title} sub={sub}>
        <div className="flex flex-wrap items-center gap-2">
          {tools}
          <Btn variant="soft" icon="Check" onClick={() => setFeel(true)}>I&apos;m done</Btn>
        </div>
      </ScreenHead>
      {children}
      <FeelSheet open={feel} onClose={() => setFeel(false)} again={playAgain} onMood={onMood} />
    </HomeShell>
  );
}

/** A round on/off button for the sound — off by default in every game. */
export function SoundToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Btn variant="outline" icon="Volume2" onClick={() => onChange(!on)}
         ariaLabel={on ? "Turn sound off" : "Turn sound on"}>
      {on ? "Sound on" : "Sound off"}
    </Btn>
  );
}
