"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back } from "@/components/ux/kit";
import { ScreenHead } from "@/components/ux/learning/native";
import { Fact, MediaCard, MediaGrid } from "@/components/ux/media/MediaCard";

/**
 * Calm games — a few quiet minutes, nothing to win.
 *
 * Four small things to do with her hands and breath when the day is heavy.
 * No scores to beat, no timers counting against her, no sign-in streaks; each
 * ends with one optional tap — "how do you feel now?" — that goes to the same
 * mood check-in as Health → Today.
 */
const GAMES = [
  { href: "/app/health/games/breathe", title: "Breathe with me", image: "/ux/art/course-meditation.webp",
    about: "Follow a soft circle in and out. One, three or five minutes.", time: "1–5 min", icon: "Heart" },
  { href: "/app/health/games/bubbles", title: "Pop the bubbles", image: "/ux/art/circle-rooftop-evening.webp",
    about: "Tap the bubbles as they float up. Nothing to win, nothing to lose.", time: "As long as you like", icon: "CircleDot" },
  { href: "/app/health/games/pairs", title: "Match the pairs", image: "/ux/art/circle-hands-together.webp",
    about: "Turn the cards and find the matching pictures. Gentle on the mind.", time: "3–5 min", icon: "Sparkles" },
  { href: "/app/health/games/rangoli", title: "Colour the rangoli", image: "/ux/art/learn-dashboard-mindfulness.webp",
    about: "Tap the petals to fill them with festive colours. Save it when you finish.", time: "5–10 min", icon: "Palette" },
];

export default function CalmGamesPage() {
  return (
    <HomeShell active="/app/health/games">
      <Back to="/app/health" label="Health" className="mb-3" />
      <ScreenHead title="Calm games" sub="A few quiet minutes for yourself. No scores, no hurry." />
      <MediaGrid cols={2}>
        {GAMES.map((g) => (
          <MediaCard key={g.href} href={g.href} image={g.image} title={g.title}
                     topLeft={{ text: g.time, tone: "light" }}
                     overlay={<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                                    style={{ background: "rgba(255,255,255,.22)", backdropFilter: "blur(6px)" }}>Tap to play</span>}
                     meta={<Fact icon={g.icon}>No score · no timer</Fact>}>
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{g.about}</p>
          </MediaCard>
        ))}
      </MediaGrid>
      <p className="mt-5 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
        If you are feeling unsafe or very low, please talk to someone — Help → Safety has numbers you can call any time.
      </p>
    </HomeShell>
  );
}
