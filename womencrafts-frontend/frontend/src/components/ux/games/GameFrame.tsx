"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn } from "@/components/ux/kit";
import { ScreenHead } from "@/components/ux/learning/native";

import { FeelSheet } from "./FeelSheet";

/**
 * The frame every calm game sits in: back to the games, a quiet title, the
 * game, and "I'm done" — which opens the how-do-you-feel sheet. The game
 * itself can open that sheet too when it ends (breathing time is up, the last
 * pair is found).
 */
export function GameFrame({ title, sub, children, feel, setFeel, again, tools }: {
  title: string;
  sub: string;
  children: React.ReactNode;
  feel: boolean;
  setFeel: (v: boolean) => void;
  again?: () => void;
  /** Controls shown beside "I'm done" — sound on/off and the like. */
  tools?: React.ReactNode;
}) {
  return (
    <HomeShell active="/app/health/games">
      <Back to="/app/health/games" label="Calm games" className="mb-3" />
      <ScreenHead title={title} sub={sub}>
        <div className="flex flex-wrap items-center gap-2">
          {tools}
          <Btn variant="soft" icon="Check" onClick={() => setFeel(true)}>I&apos;m done</Btn>
        </div>
      </ScreenHead>
      {children}
      <FeelSheet open={feel} onClose={() => setFeel(false)} again={again} />
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
