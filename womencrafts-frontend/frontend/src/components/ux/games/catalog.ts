/**
 * The games, in one list — the hub, the activity tab and Mental Wellness read
 * it. Categories are the approved design's: Breathing, Focus, Puzzle and
 * Relaxation. `id` is what a saved session records (`game` entries).
 */

export type GameCat = "breathing" | "focus" | "puzzle" | "relaxation";

export const CATS: { id: GameCat; label: string }[] = [
  { id: "breathing", label: "Breathing" },
  { id: "focus", label: "Focus" },
  { id: "puzzle", label: "Puzzle" },
  { id: "relaxation", label: "Relaxation" },
];

export interface Game {
  id: string;
  href: string;
  name: string;
  cat: GameCat;
  desc: string;
  how: string;
  time: string;
  icon: string;
  image: string;
}

export const GAMES: Game[] = [
  { id: "breathe", href: "/app/health/games/breathe", name: "Breathe with me", cat: "breathing", icon: "Wind",
    image: "/ux/art/course-meditation.webp", time: "1–5 min",
    desc: "Follow the circle as it grows and shrinks: breathe in, hold, breathe out.",
    how: "Breathe in as the circle grows, hold, then breathe out slowly as it shrinks." },
  { id: "pairs", href: "/app/health/games/pairs", name: "Memory Match", cat: "focus", icon: "Grid3x3",
    image: "/ux/art/circle-hands-together.webp", time: "2–4 min",
    desc: "Flip two cards at a time and find all the matching pairs.",
    how: "Tap a card to turn it over, then find its matching pair." },
  { id: "numbers", href: "/app/health/games/numbers", name: "Number Path", cat: "focus", icon: "Hash",
    image: "/ux/art/scene-woman-planning-board.webp", time: "1–3 min",
    desc: "Tap the numbers in order. A gentle way to settle your attention.",
    how: "Tap the numbers from 1 upwards. Finish a board and a new one appears." },
  { id: "puzzle", href: "/app/health/games/puzzle", name: "Slide Puzzle", cat: "puzzle", icon: "Puzzle",
    image: "/ux/art/scene-woman-at-laptop-thinking.webp", time: "2–5 min",
    desc: "Slide the numbered tiles back into order, one move at a time.",
    how: "Tap a tile next to the empty space to slide it. Put the numbers in order, left to right." },
  { id: "garden", href: "/app/health/games/garden", name: "Mindful Garden", cat: "relaxation", icon: "Sprout",
    image: "/ux/art/scene-woman-planting-sapling.webp", time: "1–5 min",
    desc: "A calm garden with gentle prompts. Plant flowers as you breathe.",
    how: "Follow the prompts. Tap the grass to plant a flower." },
  { id: "bubbles", href: "/app/health/games/bubbles", name: "Bubble Pop", cat: "relaxation", icon: "CircleDot",
    image: "/ux/art/circle-rooftop-evening.webp", time: "As long as you like",
    desc: "Pop slow, floating bubbles. Nothing to win, nothing to lose.",
    how: "Tap the bubbles as they float up. Miss as many as you like." },
  { id: "rangoli", href: "/app/health/games/rangoli", name: "Colour the rangoli", cat: "relaxation", icon: "Palette",
    image: "/ux/art/circle-dashboard-crafts.webp", time: "5–10 min",
    desc: "Tap the petals to fill them with festive colours. Save it when you finish.",
    how: "Pick a colour, then tap the petals. There is no wrong way." },
];

export const gameName = (id: string) => GAMES.find((g) => g.id === id)?.name ?? id;
