import { Plus_Jakarta_Sans } from "next/font/google";

/**
 * The brand's one typeface (design-system/brand.css), scoped to the sign-in,
 * verification and onboarding shells, which put both variable classes on
 * their own root.
 *
 * `authSerif` keeps its name so the stylesheets that read `--wsa-serif` for
 * headings need no change, but it is the same family: WomSakhi headings
 * differ from body text by weight and size, not by typeface.
 */
export const authSerif = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--wsa-serif",
  display: "swap",
});

export const authSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--wsa-sans",
  display: "swap",
});
