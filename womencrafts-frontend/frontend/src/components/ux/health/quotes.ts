/**
 * One quote for each Health & Wellness section, beside its banner (as Work has).
 *
 * Every line is WomSakhi's own and signed as WomSakhi: the same rule as the
 * app's other quotes (components/ux/fill/content.ts) — a misattributed line on
 * a health screen undoes the trust the screen is asking for. The quote shown
 * changes each day, per section; "Another" steps to the next.
 */

export const HEALTH_QUOTES: Record<string, string[]> = {
  home: [
    "Looking after yourself is not selfish. It is how you keep going for everyone you love.",
    "Small steps, taken every day, become a road no one can take from you.",
    "Water, a walk, a good night's sleep — health is built from small, kind habits.",
    "You do not have to do it all today. Do one good thing for yourself, and count it.",
  ],
  fitness: [
    "Strong is not a size. It is the walk you finish and the stairs you climb with ease.",
    "Ten minutes of movement is ten minutes more than none. Start where you are.",
    "Move a little every day; your body remembers kindness.",
    "You are not training to look like anyone. You are training to feel like yourself.",
  ],
  nutrition: [
    "Good food does not have to be fancy. Dal, rice, sabzi and a glass of water are a fine start.",
    "Eat the colours of the season — your plate is your first medicine.",
    "Feed yourself the way you would feed someone you love.",
    "Iron, protein, water: three small checks that carry a woman a long way.",
  ],
  sleep: [
    "Rest is not lost time. A calm mind earns, learns and decides better.",
    "Tonight, let the phone sleep first. You can be next.",
    "A tired woman is not a weak woman. She is a woman who needs her rest.",
    "Good days often begin the night before.",
  ],
  mind: [
    "Asking for help is not weakness. It is how women have always lifted each other.",
    "Your feelings are visitors. Let them in, listen, and let them go.",
    "Be as gentle with yourself as you are with the people you care for.",
    "Breathe in for four, out for six. You have more calm in you than you think.",
  ],
  games: [
    "A few minutes of play is not wasted. It is how a busy mind comes back to rest.",
    "Colour, breathe, smile. A small break can change the whole day.",
    "Nothing to win, nothing to lose — just a moment that is only yours.",
    "When the mind is full, give the hands something gentle to do.",
  ],
  fertility: [
    "Knowing your cycle is knowing yourself. Every month teaches you something.",
    "Your body speaks in patterns. Listening is the first step to caring.",
    "There is no wrong question about your own body. Ask, and keep asking.",
    "Every cycle is different, and every woman is too. Compare only with yourself.",
  ],
  pregnancy: [
    "Growing a life is work. Rest when you can, and ask for help when you need it.",
    "Every check-up is a gift to two people.",
    "Eat well, sleep well, and let others carry the heavy things for a while.",
    "You are already a good mother — you are here, learning, caring, preparing.",
  ],
  reminders: [
    "A reminder is a promise you made to yourself, kept on time.",
    "Small habits, remembered daily, become big changes.",
    "Your health deserves a place in your calendar.",
    "One tablet, one glass of water, one check-up at a time.",
  ],
  mentors: [
    "Every woman who walked ahead of you left a path. Ask her to show you.",
    "Asking for help is not weakness. It is how women have always lifted each other.",
    "A good mentor does not give you answers. She helps you find your own.",
    "Learn from her journey; then walk your own.",
  ],
  doctors: [
    "No question is too small to ask your doctor. Your health is worth the conversation.",
    "Going early is wiser than waiting until it hurts.",
    "Bring your questions, your reports and your courage. That is enough.",
    "Caring for yourself includes letting someone qualified care for you.",
  ],
  records: [
    "Your health story, kept in one place, helps every doctor help you better.",
    "Write it down today; thank yourself at your next check-up.",
    "Knowing your numbers is a quiet kind of strength.",
    "Your records belong to you. Keep them close and share them by choice.",
  ],
  videos: [
    "Learn a little every day, and your body will thank you.",
    "Watch, try, and go at your own pace. There is no rush.",
    "Small steps, taken every day, become a road no one can take from you.",
  ],
};

/** The section a Health & Wellness path belongs to: /app/health/<section>, or "home" for the hub. */
export const healthSection = (path: string) => (path.match(/^\/app\/health\/([a-z]+)/)?.[1] ?? "home");
