import { cookies } from "next/headers";

import { THEME_STORAGE_KEY, themeToVariables } from "./apply";
import { DEFAULT_THEME } from "./presets";
import { DEFAULT_TOKEN_NAMES, type ThemeChoice, type TokenNames } from "./types";

/**
 * Server-rendered theme.
 *
 * The palette is computed on the server from the theme cookie and written into
 * the HTML as a `<style>` block, so the very first pixel the browser paints is
 * already the user's colour. There is no client script, no effect, and no
 * flash of the default pink before hers arrives.
 *
 * Both modes are emitted at once — light on `:root`, dark under `.dark` — so
 * toggling dark mode is a class change with no recalculation and no flash
 * either.
 */

function readThemeCookie(raw: string | undefined): ThemeChoice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return parsed?.primary && parsed?.secondary ? (parsed as ThemeChoice) : null;
  } catch {
    return null;
  }
}

function toCss(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

export default async function ThemeStyle({
  tokenNames = DEFAULT_TOKEN_NAMES,
}: {
  tokenNames?: TokenNames;
}) {
  const store = await cookies();
  const theme = readThemeCookie(store.get(THEME_STORAGE_KEY)?.value) ?? DEFAULT_THEME;

  let light: string;
  let dark: string;
  try {
    light = toCss(themeToVariables(theme, "light", tokenNames));
    dark = toCss(themeToVariables(theme, "dark", tokenNames));
  } catch {
    // A corrupt cookie must never break the page — fall through to the
    // stylesheet's own defaults by emitting nothing.
    return null;
  }

  return (
    <style
      // Not user input in the injection sense: every value is a hex string
      // this module generated from a parsed colour.
      dangerouslySetInnerHTML={{
        __html: `:root{${light}}.dark{${dark}}`,
      }}
    />
  );
}
