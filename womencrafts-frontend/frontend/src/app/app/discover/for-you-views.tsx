"use client";

import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, I, IconTile, v } from "@/components/ux/kit";
import type { DiscoverItem } from "@/components/ux/discovery/data";
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
    <div className="mb-3.5 flex items-end justify-between gap-4">
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
  );
}

/* ------------------------------------------------------------------ */
/*  Women near her                                                     */
/* ------------------------------------------------------------------ */

/**
 * A woman a step ahead, in her trade.
 *
 * Led by a face rather than an icon, because that is the whole mechanism: the
 * evidence for this user base is that seeing a *named woman like her doing one
 * specific thing* moves people, where a leaderboard or a "trending" row does
 * not. The quote underneath is why she is on this screen, in her own terms.
 *
 * The primary action is Message, not "view profile" — the thing worth doing
 * with a woman two kilometres away is talking to her.
 */
export function WomanCard({ i, onMessage }: { i: DiscoverItem; onMessage: () => void }) {
  return (
    <Card pad={16} className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <span className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={i.photo} alt="" loading="lazy" decoding="async"
               className="h-[64px] w-[64px] rounded-[12px] object-cover"
               style={{ background: v(i.tint) }} />
          {/* She is reachable now — the reason Message is worth pressing. */}
          <span aria-hidden className="absolute -end-1 -top-1 h-[14px] w-[14px] rounded-full border-2"
                style={{ background: v("--ux-green-ink"), borderColor: v("--ux-surface") }} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" style={{ color: v("--ux-ink") }}>{i.title}</p>
          <p className="mt-0.5 truncate text-xsm" style={{ color: v("--ux-muted") }}>{i.detail}</p>
          {i.away && (
            <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: v("--ux-faint") }}>
              <Icons.MapPin className="h-[12px] w-[12px] shrink-0" />
              {i.away}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 flex-1 rounded-[10px] p-2.5 text-xs leading-snug"
         style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
        <Icons.Quote className="me-1 inline h-[11px] w-[11px] align-[-1px]" style={{ color: v("--ux-faint") }} />
        {i.because}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Btn size="sm" full onClick={onMessage}>Message</Btn>
        <Link href={i.href} aria-label={`More about ${i.title}`}
              className="ux-press ux-sq grid h-[36px] w-[42px] shrink-0 place-items-center rounded-[10px] border"
              style={{ borderColor: v("--ux-line"), color: v("--ux-muted") }}>
          <Icons.MoreHorizontal className="h-[16px] w-[16px]" />
        </Link>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  A skill she could cross into                                       */
/* ------------------------------------------------------------------ */

/**
 * A trade next to the one she already has.
 *
 * The badge carries the reason in two words — "Higher income", "Steady demand"
 * — because that is the thing she is deciding on, and it should be readable
 * before she has read the title.
 */
export function CrossingCard({ i, saved, onSave }: {
  i: DiscoverItem; saved: boolean; onSave: () => void;
}) {
  const tr = useT();
  return (
    <Card pad={0} className="flex h-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={i.photo} alt="" loading="lazy" decoding="async"
           className="h-auto w-[108px] shrink-0 object-cover"
           style={{ background: v(i.tint) }} />
      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        {i.badge && (
          <span className="mb-1.5 w-fit rounded-full px-2.5 py-1 text-2xs font-bold"
                style={{ background: v(i.tint), color: v(i.ink) }}>
            {i.badge}
          </span>
        )}
        <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>{i.title}</p>
        <p className="mt-1 text-xs leading-snug" style={{ color: v("--ux-muted") }}>{i.detail}</p>
        <p className="mt-0.5 text-xs leading-snug" style={{ color: v("--ux-faint") }}>{i.meta}</p>

        <div className="mt-auto flex items-center gap-2 pt-3">
          <Btn size="sm" variant="outline" href={i.href} full>{tr("foryou.seeDetails")}</Btn>
          <Btn size="sm" variant={saved ? "soft" : "ghost"} icon="Bookmark" onClick={onSave}>
            {saved ? "Saved" : "Save"}
          </Btn>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Picked for her                                                     */
/* ------------------------------------------------------------------ */

/** A single suggestion — a contract, a course, a circle, an event. */
export function PickCard({ i, saved, onSave }: {
  i: DiscoverItem; saved: boolean; onSave: () => void;
}) {
  const tr = useT();
  return (
    <Card pad={16} className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <IconTile icon={i.icon} tint={i.tint} ink={i.ink} size={44} radius={12} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>{i.title}</p>
          <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{i.detail}</p>
        </div>
      </div>

      {/* The reason. This is the part that makes it not an advertisement. */}
      <p className="mt-3 flex flex-1 items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-xs leading-snug"
         style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
        <Icons.Sparkles className="mt-[2px] h-[11px] w-[11px] shrink-0" />
        {i.because}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Btn size="sm" href={i.href} full iconEnd="ArrowRight">{tr("foryou.haveALook")}</Btn>
        <Btn size="sm" variant={saved ? "soft" : "ghost"} icon="Bookmark" onClick={onSave}>
          {saved ? "Saved" : "Save"}
        </Btn>
      </div>
    </Card>
  );
}
