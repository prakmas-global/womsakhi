/**
 * The public contract of the theme engine.
 *
 * Deliberately small: a theme is two seed colours and an id. Everything else —
 * the twenty shades, the dark variants, the readable foregrounds — is derived,
 * because derived values cannot drift out of step with each other.
 */

export interface ThemeChoice {
  /** A preset id, or "custom" when the user picked their own colours. */
  id: string;
  /** Seed for the primary scale (buttons, links, active states). */
  primary: string;
  /** Seed for the secondary scale (accents, icon chips, gradients). */
  secondary: string;
}

/** Which token families a host app wants the engine to drive. */
export interface TokenNames {
  /** CSS variable prefix for the primary scale, e.g. "--color-brand". */
  primary: string;
  /** CSS variable prefix for the secondary scale, e.g. "--color-violet". */
  secondary: string;
}

export const DEFAULT_TOKEN_NAMES: TokenNames = {
  primary: "--color-brand",
  secondary: "--color-violet",
};

export type ColorMode = "light" | "dark";
