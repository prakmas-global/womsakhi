/**
 * The sessionStorage key that marks the splash as seen.
 *
 * Its own plain module on purpose: the (auth) layout is a server component and
 * inlines this into a script. Imported from the "use client" Splash module it
 * would arrive as a client reference, not a string.
 */
export const SPLASH_KEY = "wsa-splash-seen";
