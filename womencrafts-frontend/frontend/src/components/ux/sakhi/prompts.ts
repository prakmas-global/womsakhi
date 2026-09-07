/**
 * What Sakhi opens with, and what she says she will not do.
 *
 * ── Why this is content in its own file ─────────────────────────────────────
 * These are the first words a woman reads from the assistant, and the sentence
 * that tells her it will never move her money. That is product copy with a
 * safety promise in it — it belongs where it can be read and translated
 * without opening a thousand-line component, and where changing a starter
 * prompt does not mean touching the chat loop.
 */
export const MODE_PREFIX: Record<string, string> = {
  quick: "",
  steps: "Explain this step by step, in simple words, in order: ",
};

export const STARTERS = [
  { icon: "Search", tint: "--ux-tint-green", ink: "--ux-green-ink",
    title: "Find work I can do", note: "from home, part-time, near me",
    ask: "What work can I do from home, part-time or near me?" },
  { icon: "Wallet", tint: "--ux-tint-violet", ink: "--ux-violet-ink",
    title: "What did I earn this month", note: "and what is still coming",
    ask: "What did I earn this month, and what is still coming?" },
  { icon: "Camera", tint: "--ux-tint-blue", ink: "--ux-blue-ink",
    title: "Read this form for me", note: "photograph it and she explains it",
    ask: "I have a form I do not understand. Can you explain what it is asking me?" },
  { icon: "Scale", tint: "--ux-tint-amber", ink: "--ux-amber-ink",
    title: "Am I allowed maternity leave", note: "and who do I ask",
    ask: "Am I allowed maternity leave, and who do I ask?" },
];

export const FOLLOW_UPS = [
  "Explain that more simply",
  "What do I need to start?",
  "Show me the next step",
];

export const CAN = [
  { icon: "Search", text: "Find a course, a scheme or work in your own words" },
  { icon: "Wallet", text: "Tell you what you have earned and what is still coming" },
  { icon: "CalendarDays", text: "Remind you what is booked this week" },
  { icon: "Languages", text: "Answer in the language you ask in" },
];
export const WONT = ["Move your money, ever", "Apply for anything as you",
              "Send a message as you", "Share what you tell her with your circle"];
