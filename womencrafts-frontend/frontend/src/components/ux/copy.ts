/**
 * Sentences the app says in more than one place.
 *
 * ── Why these live together ─────────────────────────────────────────────────
 * Twenty strings were written out in two or more files. That is not only
 * repetition: it is twenty chances for the same idea to be phrased two ways.
 * "That did not go through" appeared three times and had already started to
 * drift, and every one of them is a sentence a woman reads at the moment
 * something has gone wrong — the worst possible place for the app to sound
 * like two different products.
 *
 * It also matters for translation. A string written in four files is four
 * entries a translator has to notice are identical, and four places to miss.
 *
 * ── What does NOT belong here ───────────────────────────────────────────────
 * Anything specific to one screen. This is only for lines that genuinely
 * recur — moving one-off copy here separates it from the thing it describes
 * and makes both harder to read.
 */

export const COPY = {
  /** After copying something to the clipboard. */
  linkCopied: "Link copied — open it in your browser",

  /** A write failed. Never says what technically happened; says what to do. */
  writeFailed: "That did not go through. Try again in a moment.",

  /** Above a form, so she knows nothing has been committed yet. */
  nothingSavedYet: "Nothing is saved until you press the button.",

  /** A conversation or thread would not open. */
  threadFailed: "That conversation could not be opened.",

  /** A record that is gone, or a link that has aged out. */
  goneOrOld: "It may have been cancelled, or the link may be old.",

  /**
   * Said before meeting anyone from the app.
   *
   * Deliberately identical everywhere it appears. Safety guidance that is
   * worded differently on two screens reads as two different rules, and a woman
   * deciding whether to go somewhere should not have to work out which applies.
   */
  meetSafely: "Meet in a public place, or on a video call",

  /**
   * Cancelling a booking.
   *
   * `/app/bookings` and `/app/bookings/[id]` are the same flow at two zoom
   * levels, so all five of these were written out twice — including the two
   * confirmation questions, where a difference in wording between the list and
   * the detail would read as two different consequences.
   */
  booking: {
    cancelFailed: "We could not cancel it. Your booking still stands — try again.",
    refundNote: "Your stall fee comes back in 5–7 working days. Cancel it?",
    placeGoesOn: "Your place goes to the next woman on the list. Cancel it?",
    feedbackAsk: "What went well, and what would have helped? The team reads every one of these.",
    feedbackPrivate: "It goes to the people who run WomSakhi. It is not shown publicly.",
  },

  /** A send that did not leave — distinct from a write that half-happened. */
  sendFailed: "That did not go through. Nothing has been sent — try again in a moment.",

  /**
   * What to tap in the browser's print sheet to keep a copy.
   *
   * Five screens hand her a printable document — a certificate, a statement, a
   * receipt — and every one of them has to explain the same non-obvious step,
   * because "Print" is not where a person looks for "save this file".
   */
  saveAsPdf: "Choose \u201CSave as PDF\u201D",

  /** An empty list, where nothing has gone wrong and nothing is expected yet. */
  nothingHereYet: "Nothing here yet",

  /** After she sends feedback to the people who run WomSakhi. */
  noteReceived: "Thank you \u2014 the team has your note",

  /**
   * The last-resort failure line, when even the API could not say what broke.
   *
   * `lib/api.ts` and `lib/member-api.ts` already fall back to this; the three
   * dashboard forms that set it by hand were the drift risk.
   */
  genericFailure: "Something went wrong. Please try again.",
} as const;
