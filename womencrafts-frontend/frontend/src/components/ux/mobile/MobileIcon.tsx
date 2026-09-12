"use client";

/**
 * Icons that belong on a phone.
 *
 * ── Why not the app's existing lucide set ───────────────────────────────────
 * lucide is a web icon set and it is a good one, but it is built on a single
 * principle — everything is a 24px outline at a uniform stroke weight. That is
 * exactly right for a dense desktop UI and it is why the app uses it
 * everywhere else.
 *
 * A phone needs something lucide does not have: **a filled twin for every
 * outline**. Every native tab bar on both platforms says "you are here" by
 * swapping an outline icon for its solid version, and it does that instead of
 * relying on colour — which is what makes it legible to a colour-blind user
 * and in direct sunlight, the two conditions this app is most often used in.
 * Faking it by thickening a stroke does not read as the same thing; the eye
 * sees a bolder outline, not a selected item.
 *
 * Ionicons is the set Ionic and Capacitor ship, drawn to match the platform
 * conventions on both, and every glyph comes as an `X` / `XOutline` pair.
 *
 * ── Bundle cost ─────────────────────────────────────────────────────────────
 * `react-icons/io5` carries 1,332 icons. They are named exports of a
 * side-effect-free module, so importing eleven of them by name pulls in
 * eleven — the same tree-shaking argument `icons.ts` makes for lucide, and the
 * same reason NOT to write `import * as Io`.
 */

import {
  IoHome, IoHomeOutline,
  IoSchool, IoSchoolOutline,
  IoBriefcase, IoBriefcaseOutline,
  IoWallet, IoWalletOutline,
  IoPeople, IoPeopleOutline,
  IoPerson, IoPersonOutline,
  IoChatbubble, IoChatbubbleOutline,
  IoNotifications, IoNotificationsOutline,
  IoSearch, IoSearchOutline,
  IoSettingsSharp, IoSettingsOutline,
  IoStorefront, IoStorefrontOutline,
  IoBook, IoBookOutline,
  IoRibbon, IoRibbonOutline,
  IoCart, IoCartOutline,
  IoHeart, IoHeartOutline,
  IoAdd, IoChevronForward, IoChevronBack, IoClose, IoEllipsisHorizontal,
} from "react-icons/io5";
import type { IconType } from "react-icons";

/** Every glyph the phone UI draws, as an outline/solid pair. */
const PAIRS: Record<string, [IconType, IconType]> = {
  home:      [IoHomeOutline, IoHome],
  learn:     [IoSchoolOutline, IoSchool],
  work:      [IoBriefcaseOutline, IoBriefcase],
  earn:      [IoWalletOutline, IoWallet],
  circle:    [IoPeopleOutline, IoPeople],
  you:       [IoPersonOutline, IoPerson],
  chat:      [IoChatbubbleOutline, IoChatbubble],
  bell:      [IoNotificationsOutline, IoNotifications],
  search:    [IoSearchOutline, IoSearch],
  settings:  [IoSettingsOutline, IoSettingsSharp],
  shop:      [IoStorefrontOutline, IoStorefront],
  book:      [IoBookOutline, IoBook],
  award:     [IoRibbonOutline, IoRibbon],
  market:    [IoCartOutline, IoCart],
  saved:     [IoHeartOutline, IoHeart],
};

/** Glyphs with no meaningful filled state — chrome, not destinations. */
const SINGLE: Record<string, IconType> = {
  add: IoAdd,
  forward: IoChevronForward,
  back: IoChevronBack,
  close: IoClose,
  more: IoEllipsisHorizontal,
};

export type MobileIconName = keyof typeof PAIRS | keyof typeof SINGLE;

export function MobileIcon({ name, active = false, size = 24, className, style, title }: {
  name: MobileIconName;
  /** Solid when true, outline when false. This is how a tab bar says "here". */
  active?: boolean;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** Only when the icon is the sole label. An icon beside its own text is
   *  decorative, and naming it makes a screen reader say everything twice. */
  title?: string;
}) {
  const pair = PAIRS[name as keyof typeof PAIRS];
  const Glyph = pair ? pair[active ? 1 : 0] : SINGLE[name as keyof typeof SINGLE];
  if (!Glyph) return null;

  return (
    <Glyph
      size={size}
      className={className}
      style={style}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    />
  );
}

export default MobileIcon;
