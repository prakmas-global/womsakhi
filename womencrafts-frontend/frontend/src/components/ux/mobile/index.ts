/**
 * The native-feeling mobile kit.
 *
 * Everything here is a Client Component — each file carries its own
 * `"use client"` and this barrel deliberately does NOT. A barrel with the
 * directive turns every export into a client reference, including the plain
 * values: a `const` re-exported through a `"use client"` barrel arrives in a
 * Server Component as an opaque reference rather than as a string, and the
 * failure is silent. That trap has already cost this codebase a day (see the
 * `@/i18n` barrel and `LOCALE_COOKIE`). Leaving the directive on the leaves
 * means a Server Component can still import a type or a constant from here
 * without anything strange happening.
 *
 * These are the parts CSS cannot do on its own. The look — surfaces, radii,
 * colour, the presentation curve, safe areas, 44px targets — already lives in
 * `app/ux/tokens.css` and `app/ux/mobile.css`, and nothing in this folder
 * re-declares any of it.
 *
 * Gallery: `/mobile-kit`.
 */

export { Sheet, useReducedMotion, overlayRoot, type SheetDetent } from "./Sheet";
export { ListRow, ListGroup, type RowTint } from "./ListRow";
export { SegmentedControl, type Segment } from "./SegmentedControl";
export { PullToRefresh } from "./PullToRefresh";
export { Stepper } from "./Stepper";
export {
  ToastHost,
  toast,
  dismissToast,
  clearToasts,
  type ToastItem,
  type ToastTone,
} from "./Toast";
export { SwipeAction, type SwipeActionSpec } from "./SwipeAction";
