"use client";

import { use, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { apiCancelEvent, apiRegisterForEvent } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";

import {
  Btn, Card, EmptyState, IconTile, mapsHref, Pill, Progress, RailSkeleton,
  ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useEvents } from "@/components/ux/growth";
import { rupees } from "@/components/ux/events/data";

/**
 * One event.
 *
 * A full event says so and offers a waiting list — it never shows a button that
 * fails when tapped. And for anything in person, "how do I get there and what
 * do I bring" is on the page, because that is what actually stops a woman going.
 */
export default function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: events, source, refetch } = useEvents();
  const EVENTS = [...events.upcoming, ...events.past];
  const e = EVENTS.find((x) => x.id === id);

  /**
   * Whether she has a place — the server's answer, with a press still in
   * flight allowed to show through.
   *
   * This was `useState(e?.going ?? false)`, read on the first render before
   * the fetch had landed, so it was always seeded from the fallback. Pressing
   * it then flipped a boolean and nothing else: the organiser never heard.
   */
  const [pending, setPending] = useState<boolean | null>(null);
  const going = pending ?? e?.going ?? false;

  const place = useAction(
    async (want: string) => {
      if (want === "going") await apiRegisterForEvent(id);
      else await apiCancelEvent(id);
    },
    {
      onDone: refetch,
      optimistic: (want) => setPending(want === "going"),
      rollback: () => setPending(null),
      fallbackError: "That did not go through. Your place is not booked — try again in a moment.",
    },
  );

  // "Not listed" is a claim, and it cannot be made while the answer is still
  // on its way — saying it during the fetch makes the screen flash "that is
  // not here" before showing itself.
  if (!e && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!e) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="CalendarX"
            title="That event is not listed"
            body="It may have finished, or the link may be old."
            action={<Btn href="/app/events" variant="primary" iconEnd="ArrowRight">All events</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  // `seats: 0` means the organiser set no limit, not that every place has
  // gone. `taken >= spots` read 0 >= 0 and stamped "Full" on an open talk.
  const limited = e.spots > 0;
  const full = limited && e.taken >= e.spots;
  const similar = EVENTS.filter((x) => x.id !== e.id && x.kind === e.kind).slice(0, 2);

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={going ? "You are going" : full ? "This one is full" : "Take a place"} />
            <div className="flex items-baseline justify-between">
              <span className="text-xsm" style={{ color: "var(--ux-muted)" }}>
                {!limited ? "Open to everyone" : full ? "All taken" : `${e.spots - e.taken} of ${e.spots} left`}
              </span>
              <span className="text-lg font-bold" style={{ color: "var(--ux-ink)" }}>{rupees(e.fee_minor)}</span>
            </div>
            {limited && (
              <div className="mt-2.5">
                <Progress pct={(e.taken / e.spots) * 100} track="--ux-track"
                          tone={full ? "--ux-orange" : "--ux-brand-600"} />
              </div>
            )}

            <div className="mt-4 space-y-2.5">
              {/* "Tell me if a place opens" and "Remind me the day before"
                  used to be here. Nothing keeps a waiting list and nothing
                  schedules a reminder, so both said "we will" about something
                  nobody had arranged. A full event now says so in words. */}
              {full && !going ? (
                <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-orange-ink)" }}>
                  Every place has gone. Nothing to book here — the ones below are still open.
                </p>
              ) : (
                <Btn variant={going ? "outline" : "primary"} full
                     icon={place.busy ? "Loader" : going ? "Check" : undefined}
                     iconEnd={place.busy || going ? undefined : "ArrowRight"}
                     disabled={place.busy}
                     onClick={() => void place.run(going ? "not going" : "going")}>
                  {place.busy ? "Sending…"
                    : going ? "You are going"
                    : e.fee_minor > 0 ? `Book · ${rupees(e.fee_minor)}` : "Join, free"}
                </Btn>
              )}
              {going && !place.busy && (
                <Btn variant="ghost" full size="sm" onClick={() => void place.run("not going")}>
                  Give up my place
                </Btn>
              )}
            </div>

            {place.error && (
              <p role="alert" className="ux-slide-up mt-3 text-xsm leading-relaxed"
                 style={{ color: "var(--ux-orange-ink)" }}>
                {place.error}
              </p>
            )}

            {going && (
              <p className="ux-slide-up mt-3.5 rounded-[12px] p-3 text-xs leading-relaxed"
                 style={{ background: "var(--ux-tint-green)", color: "var(--ux-ink-2)" }}>
                {e.online
                  ? "The joining link reaches you by message an hour before."
                  : "Bring your own stock and something to sit on. Tables are provided."}
              </p>
            )}
          </Card>

          {!e.online && (
            <Card>
              <SectionHead title="Getting there" icon="MapPin" />
              {/* "Nearest bus: Route 12 and 34, Sector 12 stop" and "Parking:
                  free, behind the hall" used to be printed here — the same two
                  lines under every venue in the country. The API carries a
                  venue and nothing else, so a venue and a map is what this
                  shows. A woman does not need a bus route we made up. */}
              <div className="space-y-3">
                {[["Where", e.place, "MapPin"]].map(([k, v, ic]) => (
                  <div key={k} className="ux-hov flex items-start gap-3">
                    <IconTile icon={ic} tint="--ux-tint-lilac" ink="--ux-brand" size={34} radius={10} />
                    <div className="min-w-0">
                      <p className="text-2xs uppercase tracking-[0.06em]" style={{ color: "var(--ux-faint)" }}>{k}</p>
                      <p className="mt-0.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>{v}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3.5">
                <Btn href={mapsHref(e.place)} variant="soft" size="sm" full icon="Navigation">Open in maps</Btn>
              </div>
            </Card>
          )}
        </div>
      }
    >
      <Link href="/app/events"
            className="ux-hov -my-1 mb-3.5 inline-flex items-center gap-1.5 py-1 text-xsm font-medium"
            style={{ color: "var(--ux-brand)" }}>
        <Icons.ArrowLeft className="ux-ico h-4 w-4" /> All events
      </Link>

      <Card className="mb-[16px] overflow-hidden" pad={0}>
        <div className="relative h-[210px] overflow-hidden" style={{ background: `var(${e.tint})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={e.art} alt="" className="h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0"
                style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.5), transparent 58%)" }} />
          <span className="absolute start-4 top-4 grid h-[62px] w-[56px] place-items-center rounded-[12px]"
                style={{ background: "var(--ux-surface)", boxShadow: "var(--ux-shadow-card)" }}>
            <span className="text-xl font-bold leading-none" style={{ color: "var(--ux-brand)" }}>{e.day}</span>
            <span className="text-2xs font-semibold" style={{ color: "var(--ux-brand)" }}>{e.month}</span>
          </span>
          <span className="absolute end-4 top-4 flex gap-2">
            <Pill tone={e.kind === "Mela" ? "pink" : e.kind === "Webinar" ? "blue" : "green"} size="sm">{e.kind}</Pill>
            {full && <Pill tone="orange" size="sm">Full</Pill>}
          </span>
        </div>

        <div className="p-[20px]">
          <h1 className="text-2xl font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>{e.title}</h1>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            <span className="inline-flex items-center gap-1.5"><Icons.Calendar className="h-4 w-4" /> {e.when}</span>
            <span className="inline-flex items-center gap-1.5"><Icons.Clock className="h-4 w-4" /> {e.time}</span>
            <span className="inline-flex items-center gap-1.5">
              {e.online ? <Icons.Video className="h-4 w-4" /> : <Icons.MapPin className="h-4 w-4" />} {e.place}
            </span>
          </p>
          <p className="mt-3.5 text-sm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{e.blurb}</p>
        </div>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-[16px]">
        <Card>
          <SectionHead title="What happens on the day" />
          <ol className="ux-stagger space-y-3.5">
            {(e.kind === "Mela"
              ? [["Arrive by 9:30", "Find your table — they are numbered and yours is in the message"],
                 ["Set up until 10:00", "Bring a cloth for the table if you want one"],
                 ["Sell until 4:00", "Most buying happens between 11 and 1"],
                 ["Pack up by 4:30", "Take anything unsold home; nothing is stored"]]
              : [["Join five minutes early", "The link opens fifteen minutes before"],
                 ["The talk, 45 minutes", "You can ask questions in writing throughout"],
                 ["Questions, 20 minutes", "Anything you like, in Hindi or English"],
                 ["A recording afterwards", "Sent to you within two days"]]
            ).map(([t, note], i) => (
              <li key={t} className="flex items-start gap-3">
                <span className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{t}</p>
                  <p className="mt-0.5 text-xsm leading-snug" style={{ color: "var(--ux-muted)" }}>{note}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <SectionHead title="What to bring" icon="Backpack" />
          <ul className="space-y-2.5">
            {(e.online
              ? ["A quiet corner if you can find one", "Paper and a pen", "Your questions written down"]
              : ["Your stock, priced and labelled", "A cloth for the table", "Change for small notes", "Water and food"]
            ).map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                <Icons.Check className="mt-[2px] h-[14px] w-[14px] shrink-0" style={{ color: "var(--ux-green-ink)" }} strokeWidth={2.6} />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {similar.length > 0 && (
        <div className="mt-[16px]">
          <SectionHead title={`Other ${e.kind.toLowerCase()}s coming up`} />
          <div className="ux-deck grid grid-cols-2 gap-[16px]">
            {similar.map((o, i) => (
              <Card key={o.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-[46px] w-[42px] shrink-0 place-items-center rounded-[12px]"
                        style={{ background: "var(--ux-brand-tint)" }}>
                    <span className="text-base font-bold leading-none" style={{ color: "var(--ux-brand)" }}>{o.day}</span>
                    <span className="text-2xs font-semibold" style={{ color: "var(--ux-brand)" }}>{o.month}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{o.title}</h3>
                    <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{o.time}</p>
                  </div>
                  <Btn href={`/app/events/${o.id}`} variant="soft" size="sm" iconEnd="ArrowRight">Open</Btn>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </HomeShell>
  );
}
