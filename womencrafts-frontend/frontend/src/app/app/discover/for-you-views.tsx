"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Avatar, Btn, Card, I, IconTile, v } from "@/components/ux/kit";
import type { DiscoverItem } from "@/components/ux/discovery/data";
import { GroupHead, MediaRow } from "@/components/ux/learning/native";
import { useT } from "@/i18n";

/* ------------------------------------------------------------------ */
/*  Section heading                                                    */
/* ------------------------------------------------------------------ */

/** A section title with its reason and a way to see the rest. */
export function Head({ icon, title, sub, href, count }: {
  icon: string; title: string; sub: string; href: string; count?: number;
}) {
  const tr = useT();
  return (
    <>
    {/* On a phone: the quiet group label, its reason under it, "View all" at
        the far end. The 17px bold heading with an icon is the desktop one. */}
    <div className="lg:hidden">
      <GroupHead title={title} sub={sub} count={count} action={tr("foryou.viewAll")} href={href} />
    </div>
    <div className="mb-3.5 hidden items-end justify-between gap-4 lg:flex">
      <div className="flex items-start gap-2.5">
        <I name={icon} className="mt-[3px] h-[20px] w-[20px] shrink-0" style={{ color: v("--ux-brand") }} />
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-[-0.01em]"
              style={{ color: v("--ux-ink") }}>
            {title}
            {count !== undefined && (
              <span className="text-base font-bold" style={{ color: v("--ux-brand") }}>{count}</span>
            )}
          </h2>
          <p className="mt-0.5 text-xsm" style={{ color: v("--ux-muted") }}>{sub}</p>
        </div>
      </div>
      <Link href={href} className="ux-sq flex shrink-0 items-center gap-0.5 text-xsm font-bold"
            style={{ color: v("--ux-brand") }}>{tr("foryou.viewAll")}<Icons.ChevronRight className="h-[14px] w-[14px]" />
      </Link>
    </div>
    </>
  );
}

/**
 * The same woman as a grouped-list row, for a phone.
 *
 * Every card led to one place — her profile — so on a phone the whole row is
 * that link: her initial, her name, her headline, where she is and what she
 * knows, and a chevron. Nothing on the card is dropped; the tags become one
 * quiet line instead of a wrap of pills.
 */
export function WomanRow({ i }: { i: DiscoverItem }) {
  return (
    <MediaRow
      href={i.href}
      media={<Avatar src={i.photo} name={i.title} size={44} />}
      title={i.title}
      lines={[i.detail, i.meta, i.tags?.length ? i.tags.join(" · ") : null]}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  A woman she can learn from                                         */
/* ------------------------------------------------------------------ */

/**
 * A mentor, as her own profile describes her.
 *
 * ── What came off this card ─────────────────────────────────────────────────
 * Three things, all of them invented and all of them the kind a woman would
 * believe:
 *
 *   · **"2 km away".** There is no location on a member, no geocoding and no
 *     distance anywhere in this product. The number was typed into a fixture.
 *   · **The quote.** The card led with a sentence in quotation marks —
 *     "She does what you do, in your area, and has taken bulk orders" — which
 *     no mentor ever said and which claimed to know the reader's trade.
 *   · **The face.** Every card carried a stock photograph. Most mentors have
 *     not uploaded one, and a stranger's face under a real woman's real name
 *     is the worst of the three. `Avatar` draws her initial instead.
 *
 * What is left is what her profile actually says: her headline, the city she
 * gave, when she said she is free, and what she says she knows. The action is
 * her profile, where asking for a session is a real request to a real person —
 * the old Message button opened an empty inbox screen addressed to nobody.
 */
export function WomanCard({ i }: { i: DiscoverItem }) {
  const tr = useT();
  return (
    <Card pad={16} className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <Avatar src={i.photo} name={i.title} size={56} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>{i.title}</p>
          <p className="mt-0.5 text-xs leading-snug" style={{ color: v("--ux-muted") }}>{i.detail}</p>
        </div>
      </div>

      {i.meta && (
        <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-snug" style={{ color: v("--ux-faint") }}>
          <Icons.MapPin className="mt-[2px] h-[12px] w-[12px] shrink-0" />
          {i.meta}
        </p>
      )}

      {i.tags && i.tags.length > 0 && (
        <div className="mt-2.5 flex flex-1 flex-wrap content-start gap-1.5">
          {i.tags.map((t) => (
            <span key={t} className="rounded-full px-2.5 py-1 text-2xs font-bold"
                  style={{ background: v(i.tint), color: v(i.ink) }}>
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Btn size="sm" full variant="outline" href={i.href} iconEnd="ArrowRight">
          {tr("foryouviews.seeHerProfile")}
        </Btn>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Picked for her                                                     */
/* ------------------------------------------------------------------ */

/**
 * One suggestion — a job, a course, a circle.
 *
 * **The reason is optional now, and that is the whole point of this file.**
 * It renders only when the server sent one, which today means courses alone:
 * `/me/home` derives `reason` from the course she is actually enrolled on.
 * Work, circles and mentors have no reason anywhere in this product, so their
 * cards carry none — rather than the generic sentence in a sparkly box that
 * used to stand in for one and read as though it were about her.
 *
 * `badge` is the other half of the rule: it appears only for something the
 * server states about her and this row — "You applied" — never a mood.
 */
export function PickCard({ i, saved, onSave }: {
  i: DiscoverItem; saved?: boolean; onSave?: () => void;
}) {
  const tr = useT();
  return (
    <Card pad={16} className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <IconTile icon={i.icon} tint={i.tint} ink={i.ink} size={44} radius={12} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>{i.title}</p>
          {i.detail && (
            <p className="mt-0.5 text-xs leading-snug" style={{ color: v("--ux-muted") }}>{i.detail}</p>
          )}
        </div>
      </div>

      {i.badge && (
        <span className="mt-2.5 w-fit rounded-full px-2.5 py-1 text-2xs font-bold"
              style={{ background: v(i.tint), color: v(i.ink) }}>
          {i.badge}
        </span>
      )}

      {i.meta && (
        <p className="mt-2 text-xs leading-snug" style={{ color: v("--ux-faint") }}>{i.meta}</p>
      )}

      {/* Only when the server said why. No line at all otherwise. */}
      {i.because && (
        <p className="mt-3 flex items-start gap-1.5 rounded-[12px] px-4 py-2 text-[13px] leading-snug lg:rounded-[10px] lg:px-2.5 lg:text-xs"
           style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
          <Icons.Sparkles className="mt-[2px] h-[11px] w-[11px] shrink-0" />
          {i.because}
        </p>
      )}

      <div className="mt-3 flex flex-1 items-end gap-2">
        <Btn size="sm" href={i.href} full iconEnd="ArrowRight">{tr("foryou.haveALook")}</Btn>
        {/* Bookmarks appear only where the server keeps one. An opening is
            saved by `POST /growth/opportunities/{id}/save`; a course and a
            circle have no such row, and a Save button that flips a React
            boolean is the same lie one reload later. */}
        {onSave && (
          <Btn size="sm" variant={saved ? "soft" : "ghost"} icon="Bookmark" onClick={onSave}
               ariaLabel={saved ? `Remove ${i.title} from saved` : `Save ${i.title}`}>
            {saved ? "Saved" : "Save"}
          </Btn>
        )}
      </div>
    </Card>
  );
}
