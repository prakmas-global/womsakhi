"use client";

import * as Icons from "@/components/ux/icons";
import { Btn, v } from "@/components/ux/kit";
import { artFor } from "@/components/ux/media/art";
import type { WorkDoneItem } from "@/lib/work-api";

/**
 * Work she finished through WomSakhi (backend: app/core/work_done.py) — jobs
 * from Find work, whether the WomSakhi team listed them or another member
 * posted them, that she was offered and did.
 *
 * What makes a line here worth more than anything she could write about
 * herself is the second half of it: who confirmed it, the stars they gave and
 * what they said. A job she has marked done that the poster has not yet
 * confirmed is shown as hers, and says it is waiting — never dressed up as
 * confirmed.
 */
export function WorkDone({ items, loading }: { items: WorkDoneItem[]; loading?: boolean }) {
  const confirmed = items.filter((w) => w.confirmed).length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold" style={{ color: v("--ux-ink") }}>Work done through WomSakhi</h2>
          <p className="text-xs" style={{ color: v("--ux-muted") }}>
            {items.length
              ? `${items.length} ${items.length === 1 ? "job" : "jobs"} · ${confirmed} confirmed by the employer`
              : "Jobs you finish from Find work show here, with what the employer said."}
          </p>
        </div>
        {items.length > 0 && confirmed > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
            <Icons.BadgeCheck className="h-4 w-4" /> {confirmed} confirmed
          </span>
        )}
      </div>

      {loading && !items.length ? (
        <div className="mt-3 space-y-2.5">{[0, 1].map((i) => <span key={i} className="ux-skeleton block h-[92px] rounded-[16px]" />)}</div>
      ) : items.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-[18px] border-2 border-dashed px-5 py-7 text-center"
             style={{ borderColor: v("--ux-line-strong") }}>
          <span className="grid h-14 w-14 place-items-center rounded-full" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
            <Icons.Briefcase className="h-7 w-7" />
          </span>
          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>No finished work yet</p>
          <p className="max-w-[380px] text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
            When you finish work you were offered here, tap <b>I finished this work</b> in My applications.
            Once the employer confirms it, it shows here — and on your card for the next person hiring.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <Btn size="sm" href="/app/opportunities" icon="Search">Find work</Btn>
            <Btn size="sm" variant="outline" href="/app/applications" icon="ClipboardList">My applications</Btn>
          </div>
        </div>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((w, i) => (
            <li key={w.id} className="ux-rise rounded-[16px] border p-3 sm:p-3.5"
                style={{ ["--i" as string]: Math.min(i, 8), borderColor: v(w.confirmed ? "--ux-line" : "--ux-line-strong"),
                         background: v("--ux-surface") }}>
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={artFor([w.title, ...w.skills], "job", undefined, w.id)} alt="" loading="lazy" decoding="async"
                     className="h-14 w-14 shrink-0 rounded-[12px] object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>{w.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs" style={{ color: v("--ux-muted") }}>
                    <span className="font-semibold" style={{ color: v("--ux-ink-2") }}>{w.org || "A member"}</span>
                    {w.posted_by === "staff" && (
                      <span className="rounded-full px-1.5 py-[1px] text-[10px] font-bold" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                        Listed by WomSakhi
                      </span>
                    )}
                    {[w.kind, w.place, w.done].filter(Boolean).map((x) => <span key={x}>· {x}</span>)}
                  </p>
                </div>
                {w.confirmed ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-bold"
                        style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
                    <Icons.BadgeCheck className="h-3.5 w-3.5" /> <span className="max-sm:hidden">Confirmed by employer</span><span className="sm:hidden">Confirmed</span>
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold"
                        style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>
                    <Icons.Hourglass className="h-3.5 w-3.5" /> Waiting to confirm
                  </span>
                )}
              </div>

              {(w.skills.length > 0 || w.rating || w.praise.length > 0 || w.note) && (
                <div className="mt-2.5 space-y-2 ps-0 sm:ps-[68px]">
                  {w.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {w.skills.map((s) => (
                        <span key={s} className="rounded-full px-2.5 py-1 text-2xs font-semibold" style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>{s}</span>
                      ))}
                    </div>
                  )}
                  {(w.rating || w.praise.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {w.rating ? (
                        <span className="me-1 inline-flex items-center gap-[2px]" aria-label={`${w.rating} out of 5 stars`}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Icons.Star key={n} className="h-4 w-4" style={{ color: n <= (w.rating ?? 0) ? "#f5a524" : v("--ux-line-strong"),
                                                                           fill: n <= (w.rating ?? 0) ? "#f5a524" : "none" }} />
                          ))}
                        </span>
                      ) : null}
                      {w.praise.map((p) => (
                        <span key={p} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-bold"
                              style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                          <Icons.Heart className="h-3 w-3" /> {p}
                        </span>
                      ))}
                    </div>
                  )}
                  {w.note && (
                    <p className="text-xs italic leading-relaxed" style={{ color: v("--ux-ink-2") }}>“{w.note}” — {w.org || "the employer"}</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
