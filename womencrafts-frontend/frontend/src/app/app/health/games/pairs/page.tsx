"use client";

import { useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn } from "@/components/ux/kit";
import { Picks } from "@/components/ux/kit/form";
import { GameFrame, SoundToggle } from "@/components/ux/games/GameFrame";
import { tone } from "@/components/ux/games/sound";
import s from "@/components/ux/games/games.module.css";

/**
 * Match the pairs — turn two cards, keep them if they match.
 *
 * Pictures from the app's own library: women at work, crafts, a market stall.
 * Moves are counted only so she can see how far she has come; there is no
 * clock and no best score to chase.
 */
const ART = [
  "course-sewing-machine", "course-cooking-packing-orders", "course-handmade-market-stall", "course-meditation",
  "course-holding-certificate", "course-confident-microphone", "work-dashboard-embroidery", "circle-hands-together",
].map((n) => `/ux/art/${n}.webp`);
const LEVELS: Record<string, number> = { "Easy · 6 pairs": 6, "More · 8 pairs": 8 };

type Card = { id: number; img: string };

function deal(pairs: number): Card[] {
  const pics = [...ART].sort(() => Math.random() - 0.5).slice(0, pairs);
  const deck = [...pics, ...pics].map((img, i) => ({ id: i, img }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export default function PairsPage() {
  const [level, setLevel] = useState("Easy · 6 pairs");
  const [deck, setDeck] = useState<Card[]>([]);
  const [up, setUp] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [sound, setSound] = useState(false);
  const [feel, setFeel] = useState(false);

  // Shuffled in the browser only, so the server and the first render agree.
  const fresh = (lv = level) => { setDeck(deal(LEVELS[lv])); setUp([]); setFound([]); setMoves(0); };
  useEffect(() => {
    const t = window.setTimeout(() => setDeck(deal(LEVELS["Easy · 6 pairs"])), 0);
    return () => window.clearTimeout(t);
  }, []);

  const pairs = LEVELS[level];
  const done = deck.length > 0 && found.length === pairs;

  const flip = (c: Card) => {
    if (up.length === 2 || up.includes(c.id) || found.includes(c.img)) return;
    const next = [...up, c.id];
    setUp(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next.map((id) => deck.find((d) => d.id === id)!);
    if (a.img === b.img) {
      if (sound) tone(523, 0.6, 0.05);
      window.setTimeout(() => {
        setFound((f) => {
          const all = [...f, a.img];
          if (all.length === pairs) window.setTimeout(() => setFeel(true), 900);
          return all;
        });
        setUp([]);
      }, 350);
    } else {
      window.setTimeout(() => setUp([]), 900);
    }
  };

  return (
    <GameFrame title="Match the pairs" sub="Turn two cards. If the pictures match, they stay."
               feel={feel} setFeel={setFeel} again={() => fresh()}
               tools={<SoundToggle on={sound} onChange={setSound} />}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Picks options={Object.keys(LEVELS)} value={level} onPick={(l) => { setLevel(l); fresh(l); }} label="How many cards" />
        <p className="text-xsm font-semibold tabular-nums" style={{ color: "var(--ux-muted)" }}>
          {found.length} of {pairs} found · {moves} {moves === 1 ? "turn" : "turns"}
        </p>
      </div>

      <section className={`${s.stage} p-3 sm:p-4`}>
        {done && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[14px] p-4"
               style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
            <p className="flex items-center gap-2 text-sm font-bold"><Icons.Sparkles className="h-4 w-4" /> All pairs found — well done.</p>
            <Btn variant="primary" icon="RefreshCw" onClick={() => fresh()}>Play again</Btn>
          </div>
        )}
        <div className={s.pairGrid}
             style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", maxWidth: 640, margin: "0 auto" }}>
          {deck.map((c) => {
            const open = up.includes(c.id) || found.includes(c.img);
            return (
              <button key={c.id} type="button" onClick={() => flip(c)}
                      aria-label={open ? "A picture" : "A hidden card"}
                      className={`${s.pairCard} ${open ? s.flipped : ""} ${found.includes(c.img) ? s.matched : ""}`}>
                <span className={s.pairInner}>
                  <span className={s.pairBack}><Icons.Flower2 className="h-7 w-7 opacity-90" /></span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <span className={s.pairFace}><img src={c.img} alt="" draggable={false} /></span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </GameFrame>
  );
}
