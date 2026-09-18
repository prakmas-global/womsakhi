"use client";

import { SectionHead } from "@/components/ux/kit";

/**
 * Phone-only pieces for the Earn and money screens.
 *
 * Everything here changes what a screen looks like below `lg` and nothing
 * above it. The desktop keeps `SectionHead` exactly as it was; the phone gets
 * the native shape instead.
 */

/**
 * The small line above a screen's large title — "YOUR BOOKS" over "Who owes
 * you what". On a desktop it is a brand-coloured kicker; on a phone it is the
 * quiet caption iOS sets above a large title, 12px/600 in the tertiary ink, so
 * the title is the one loud thing at the top of the screen.
 */
export const EYEBROW =
  "text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--ux-muted)] " +
  "lg:text-2xs lg:font-extrabold lg:tracking-[0.2em] lg:text-[color:var(--ux-brand)]";

/**
 * A run of separate cards on a desktop, ONE grouped inset list on a phone.
 *
 * Put `GROUP` on the element that holds the run and `GROUP_ROW` on each card
 * in it. Below `lg` the holder becomes the group — one surface, one hairline
 * border, the 16px corner `ListGroup` uses — and each card gives up its own
 * border, corner and fill, keeping only a hairline above it. Ten floating
 * cards with a gap between each is a web page; ten rows in one group is a
 * list.
 *
 * The `!` is not decoration. `.ux-card`'s phone border and radius live in
 * `mobile.css`, which is unlayered, and an unlayered rule beats any utility
 * that is not marked important.
 */
export const GROUP =
  "max-lg:gap-0 max-lg:overflow-hidden max-lg:rounded-[16px] max-lg:border " +
  "max-lg:border-[color:var(--ux-line)] max-lg:bg-[color:var(--ux-surface)]";
export const GROUP_ROW =
  "max-lg:rounded-none! max-lg:border-x-0! max-lg:border-b-0! max-lg:first:border-t-0! " +
  "max-lg:bg-transparent! max-lg:shadow-none!";

/**
 * Form fields on a phone take the card's own 16px inset. The kit's fields pad
 * 12 and 14; set on the element that holds a form, this lines their text up
 * with every other inset on the screen without touching the kit.
 */
export const FIELDS =
  "max-lg:[&_select]:px-4 max-lg:[&_textarea]:px-4 max-lg:[&_span:has(>input)]:px-4";

/**
 * A row of kit `Choice` cards. Each is `flex-1`, so three of them on one
 * 358px line squeezed their words into 19px columns; on a phone they stack,
 * each a full-width option with the 16px inset and 12px corner.
 */
export const CHOICES =
  "max-lg:flex-col max-lg:[&>button]:rounded-[12px] max-lg:[&>button]:p-4";

/**
 * The Back / Next row at the foot of a step. On a phone the forward action is
 * full width and comes first, the way back is a quiet line under it.
 */
export const STEP_NAV = "max-lg:flex-col-reverse max-lg:items-stretch";

/**
 * A section heading: `SectionHead` on a desktop, a quiet group label on a
 * phone.
 *
 * A phone screen carries ONE heavy heading, the large title at the top. Above
 * each group below it native writes a small upper-case caption, not another
 * bold heading with an icon beside it — repeating the heading weight above
 * every group is what makes a phone screen read as a dashboard. The sub-line
 * and the count survive; only their weight changes.
 */
export function Section({
  title, sub, chip, icon, action, onAction,
}: {
  title: string; sub?: string; chip?: string; icon?: string; action?: string; onAction?: () => void;
}) {
  return (
    <>
      <div className="hidden lg:block">
        <SectionHead title={title} sub={sub} chip={chip} icon={icon} action={action} onAction={onAction} />
      </div>
      <div className="mb-2 flex items-end justify-between gap-3 lg:hidden">
        <div className="min-w-0 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-[color:var(--ux-muted)]">
            {title}{chip ? ` · ${chip}` : ""}
          </h2>
          {sub && <p className="mt-1 text-[13px] leading-snug text-[color:var(--ux-muted)]">{sub}</p>}
        </div>
        {action && (
          <button type="button" onClick={onAction}
                  className="shrink-0 text-[15px] font-semibold text-[color:var(--ux-brand)]">
            {action}
          </button>
        )}
      </div>
    </>
  );
}
