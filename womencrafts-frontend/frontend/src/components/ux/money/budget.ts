/**
 * Where the money goes — the one thing §64 asks for that nothing showed.
 *
 * ── Why this is not a budgeting app ─────────────────────────────────────────
 * Budgeting tools assume a predictable month: a salary in, categories out, a
 * variance report at the end. That describes almost nobody here. Her income
 * arrives in uneven pieces from different people, and the useful question is
 * never "did you stay under ₹2,000 on food" — it is **"is there enough for the
 * things that cannot wait"**.
 *
 * So: no categories, no limits, no score, and nothing that turns red. A woman
 * who had to spend it did not overspend — she had to spend it, and an app that
 * tells her otherwise is one she will stop opening.
 *
 * ── Ranked by consequence, never by amount ──────────────────────────────────
 * A ₹1,800 school fee that loses a term test outranks a ₹3,500 rent that can
 * be a week late, because the cost of missing them is not the same. Every
 * commitment carries what actually happens if it is missed, and the ones with
 * nothing much at stake say so.
 */

export interface Commitment {
  id: string;
  what: string;
  minor: number;
  when: string;
  /** What actually happens if it is missed. Empty where nothing much does. */
  ifMissed: string;
  weight: "cannot-wait" | "should-pay" | "can-move";
  icon: string;
  tint: string;
  ink: string;
}

export const COMMITMENTS: Commitment[] = [
  { id: "bc1", what: "Meena's school fee", minor: 180000, when: "by 15 September",
    ifMissed: "She cannot sit the term test", weight: "cannot-wait",
    icon: "GraduationCap", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { id: "bc2", what: "Your circle instalment", minor: 50000, when: "by 20 September",
    ifMissed: "You lose your turn, and your place", weight: "cannot-wait",
    icon: "Coins", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "bc3", what: "Rent", minor: 350000, when: "by 5 October",
    ifMissed: "", weight: "should-pay",
    icon: "Home", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  { id: "bc4", what: "Machine repair", minor: 60000, when: "when you can",
    ifMissed: "It still works, just slower", weight: "can-move",
    icon: "Wrench", tint: "--ux-surface-2", ink: "--ux-muted" },
];

/**
 * Money she is expecting, split by whether it is actually agreed.
 *
 * The split is the point. Counting a maybe as money is how a woman commits to
 * a fee she cannot cover, so anything unagreed is shown separately and never
 * added into what she can spend.
 */
export interface Incoming {
  id: string;
  from: string;
  minor: number;
  when: string;
  certain: boolean;
}

export const INCOMING: Incoming[] = [
  { id: "bi1", from: "Ghar Ka Khana — August tiffin", minor: 148000, when: "12 days late", certain: true },
  { id: "bi2", from: "Sunita — two blouses", minor: 80000, when: "on Friday", certain: true },
  { id: "bi3", from: "Your circle payout", minor: 1250000, when: "next round", certain: true },
  { id: "bi4", from: "Bridal mehendi, if it is confirmed", minor: 200000, when: "not agreed yet", certain: false },
];

export const IN_HAND = 230000;

export const budgetTotals = () => {
  const mustPay = COMMITMENTS.filter((c) => c.weight === "cannot-wait").reduce((n, c) => n + c.minor, 0);
  const committed = COMMITMENTS.reduce((n, c) => n + c.minor, 0);
  // Only agreed money counts. A maybe is shown, never added.
  const sure = INCOMING.filter((i) => i.certain).reduce((n, i) => n + i.minor, 0);
  const maybe = INCOMING.filter((i) => !i.certain).reduce((n, i) => n + i.minor, 0);
  return { mustPay, committed, sure, maybe, spare: IN_HAND + sure - committed, coversMust: IN_HAND + sure >= mustPay };
};

export const WEIGHT_LABEL: Record<Commitment["weight"], string> = {
  "cannot-wait": "Cannot wait",
  "should-pay": "Should pay",
  "can-move": "Can wait",
};
