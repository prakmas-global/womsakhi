import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";

/**
 * The current product brand pair, scoped to the auth screens. These match the
 * signed-in app's design tokens so the first screen and the member experience
 * feel like one product. The shell puts both variable classes on its own root.
 */
export const authSerif = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--wsa-serif",
  display: "swap",
});

export const authSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--wsa-sans",
  display: "swap",
});
